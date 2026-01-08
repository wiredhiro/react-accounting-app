import { useMemo, useState } from 'react';
import { useJournalStore } from '../stores/journalStore';
import { useAccountStore } from '../stores/accountStore';
import type { TaxSummary, TaxRate, TaxIncluded } from '../types';
import { taxTypeLabels } from '../types';
import { calculateTax } from '../utils/taxCalculation';
import { DateFilter } from './DateFilter';
import { downloadCSV } from '../utils/csv';

export function TaxReport() {
  const { entries } = useJournalStore();
  const { accounts } = useAccountStore();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 勘定科目名を取得
  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.name || '不明';
  };

  // 消費税集計を計算
  const taxSummary = useMemo<TaxSummary>(() => {
    const summary: TaxSummary = {
      salesTax10: 0,
      salesTax8: 0,
      salesTaxTotal: 0,
      purchaseTax10: 0,
      purchaseTax8: 0,
      purchaseTaxTotal: 0,
      netTax: 0,
      taxableSales10: 0,
      taxableSales8: 0,
      taxablePurchase10: 0,
      taxablePurchase8: 0,
    };

    entries.forEach((entry) => {
      // 日付フィルター
      if (startDate && entry.date < startDate) return;
      if (endDate && entry.date > endDate) return;

      // 消費税情報がない場合はスキップ
      if (!entry.taxType || entry.taxType === 'out_of_scope' || entry.taxType === 'tax_exempt') {
        return;
      }

      const taxRate = (entry.taxRate || 0) as TaxRate;
      const taxIncluded = (entry.taxIncluded || 'included') as TaxIncluded;

      if (taxRate === 0) return;

      // 消費税を計算
      const taxCalc = calculateTax(entry.amount, taxRate, taxIncluded);

      if (entry.taxType === 'taxable_sales') {
        // 課税売上
        if (taxRate === 10) {
          summary.salesTax10 += taxCalc.taxAmount;
          summary.taxableSales10 += taxCalc.baseAmount;
        } else if (taxRate === 8) {
          summary.salesTax8 += taxCalc.taxAmount;
          summary.taxableSales8 += taxCalc.baseAmount;
        }
      } else if (entry.taxType === 'taxable_purchase') {
        // 課税仕入
        if (taxRate === 10) {
          summary.purchaseTax10 += taxCalc.taxAmount;
          summary.taxablePurchase10 += taxCalc.baseAmount;
        } else if (taxRate === 8) {
          summary.purchaseTax8 += taxCalc.taxAmount;
          summary.taxablePurchase8 += taxCalc.baseAmount;
        }
      }
    });

    // 合計と差引を計算
    summary.salesTaxTotal = summary.salesTax10 + summary.salesTax8;
    summary.purchaseTaxTotal = summary.purchaseTax10 + summary.purchaseTax8;
    summary.netTax = summary.salesTaxTotal - summary.purchaseTaxTotal;

    return summary;
  }, [entries, startDate, endDate]);

  // 課税取引の一覧
  const taxableEntries = useMemo(() => {
    return entries.filter((entry) => {
      // 日付フィルター
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;

      // 課税取引のみ
      return (
        entry.taxType === 'taxable_sales' ||
        entry.taxType === 'taxable_purchase'
      );
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, startDate, endDate]);

  // CSVエクスポート
  const handleExport = () => {
    let csv = '\uFEFF'; // BOM for Excel
    csv += '消費税集計レポート\n';
    csv += `期間: ${startDate || '開始日なし'} 〜 ${endDate || '終了日なし'}\n\n`;

    csv += '■ 売上に係る消費税\n';
    csv += '区分,課税売上（税抜）,消費税額\n';
    csv += `10%対象,${taxSummary.taxableSales10},${taxSummary.salesTax10}\n`;
    csv += `8%対象,${taxSummary.taxableSales8},${taxSummary.salesTax8}\n`;
    csv += `合計,${taxSummary.taxableSales10 + taxSummary.taxableSales8},${taxSummary.salesTaxTotal}\n\n`;

    csv += '■ 仕入に係る消費税\n';
    csv += '区分,課税仕入（税抜）,消費税額\n';
    csv += `10%対象,${taxSummary.taxablePurchase10},${taxSummary.purchaseTax10}\n`;
    csv += `8%対象,${taxSummary.taxablePurchase8},${taxSummary.purchaseTax8}\n`;
    csv += `合計,${taxSummary.taxablePurchase10 + taxSummary.taxablePurchase8},${taxSummary.purchaseTaxTotal}\n\n`;

    csv += '■ 差引消費税額\n';
    csv += `${taxSummary.netTax}\n\n`;

    csv += '■ 課税取引明細\n';
    csv += '日付,摘要,借方,貸方,金額,税区分,税率,税込/税抜,税抜金額,消費税額\n';
    taxableEntries.forEach((entry) => {
      const taxCalc = calculateTax(
        entry.amount,
        (entry.taxRate || 0) as TaxRate,
        (entry.taxIncluded || 'included') as TaxIncluded
      );
      csv += `${entry.date},"${entry.description}",${getAccountName(entry.debitAccountId)},${getAccountName(entry.creditAccountId)},${entry.amount},${taxTypeLabels[entry.taxType!]},${entry.taxRate}%,${entry.taxIncluded === 'included' ? '税込' : '税抜'},${taxCalc.baseAmount},${taxCalc.taxAmount}\n`;
    });

    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `消費税集計_${today}.csv`);
  };

  return (
    <div className="p-6">
      <div className="print-header">
        <h1>消費税集計レポート</h1>
        <p>
          {startDate || endDate
            ? `期間: ${startDate || '開始日なし'} 〜 ${endDate || '終了日なし'}`
            : '全期間'}
          {' | '}出力日: {new Date().toLocaleDateString('ja-JP')}
        </p>
      </div>

      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-800">消費税集計</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }}
          >
            印刷 / PDF保存
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }}
          >
            CSVエクスポート
          </button>
        </div>
      </div>

      {/* 期間フィルター */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 no-print">
        <DateFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* 売上消費税 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">売上に係る消費税</h3>
          <p className="text-2xl font-bold text-blue-600">
            {taxSummary.salesTaxTotal.toLocaleString()}円
          </p>
          <div className="mt-2 text-sm text-gray-500">
            <p>10%: {taxSummary.salesTax10.toLocaleString()}円</p>
            <p>8%: {taxSummary.salesTax8.toLocaleString()}円</p>
          </div>
        </div>

        {/* 仕入消費税 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">仕入に係る消費税</h3>
          <p className="text-2xl font-bold text-green-600">
            {taxSummary.purchaseTaxTotal.toLocaleString()}円
          </p>
          <div className="mt-2 text-sm text-gray-500">
            <p>10%: {taxSummary.purchaseTax10.toLocaleString()}円</p>
            <p>8%: {taxSummary.purchaseTax8.toLocaleString()}円</p>
          </div>
        </div>

        {/* 差引納付税額 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">差引消費税額</h3>
          <p className={`text-2xl font-bold ${taxSummary.netTax >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
            {taxSummary.netTax >= 0 ? '' : '△'}{Math.abs(taxSummary.netTax).toLocaleString()}円
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {taxSummary.netTax >= 0 ? '納付' : '還付'}
          </p>
        </div>
      </div>

      {/* 詳細テーブル */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 売上消費税詳細 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-blue-800">売上に係る消費税</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">税率</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">課税売上（税抜）</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">消費税額</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-3 text-sm text-gray-900">10%</td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {taxSummary.taxableSales10.toLocaleString()}円
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {taxSummary.salesTax10.toLocaleString()}円
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm text-gray-900">8%（軽減）</td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {taxSummary.taxableSales8.toLocaleString()}円
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {taxSummary.salesTax8.toLocaleString()}円
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-gray-100">
              <tr className="font-bold">
                <td className="px-6 py-3 text-sm text-gray-700">合計</td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {(taxSummary.taxableSales10 + taxSummary.taxableSales8).toLocaleString()}円
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {taxSummary.salesTaxTotal.toLocaleString()}円
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 仕入消費税詳細 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-green-50 px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-green-800">仕入に係る消費税</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">税率</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">課税仕入（税抜）</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">消費税額</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-3 text-sm text-gray-900">10%</td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {taxSummary.taxablePurchase10.toLocaleString()}円
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {taxSummary.purchaseTax10.toLocaleString()}円
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm text-gray-900">8%（軽減）</td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {taxSummary.taxablePurchase8.toLocaleString()}円
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {taxSummary.purchaseTax8.toLocaleString()}円
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-gray-100">
              <tr className="font-bold">
                <td className="px-6 py-3 text-sm text-gray-700">合計</td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {(taxSummary.taxablePurchase10 + taxSummary.taxablePurchase8).toLocaleString()}円
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {taxSummary.purchaseTaxTotal.toLocaleString()}円
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 課税取引明細 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-700">課税取引明細</h2>
        </div>
        {taxableEntries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            課税取引がありません
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">摘要</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">税区分</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">税率</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">税抜金額</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">消費税額</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">税込金額</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {taxableEntries.map((entry) => {
                const taxCalc = calculateTax(
                  entry.amount,
                  (entry.taxRate || 0) as TaxRate,
                  (entry.taxIncluded || 'included') as TaxIncluded
                );
                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.description}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        entry.taxType === 'taxable_sales'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {taxTypeLabels[entry.taxType!]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-center">{entry.taxRate}%</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {taxCalc.baseAmount.toLocaleString()}円
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-600 text-right font-medium">
                      {taxCalc.taxAmount.toLocaleString()}円
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {taxCalc.totalAmount.toLocaleString()}円
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 説明 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg no-print">
        <h3 className="font-semibold text-blue-800 mb-2">消費税集計について</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>仕訳入力時に「税区分」を設定した取引のみが集計されます</li>
          <li>「課税売上」は売上に係る消費税（仮受消費税）として集計されます</li>
          <li>「課税仕入」は仕入に係る消費税（仮払消費税）として集計されます</li>
          <li>差引消費税額がプラスの場合は納付、マイナスの場合は還付となります</li>
          <li>実際の申告時には税理士にご確認ください</li>
        </ul>
      </div>
    </div>
  );
}
