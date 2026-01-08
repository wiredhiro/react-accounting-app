import { useMemo, useState } from 'react';
import { useJournalStore } from '../stores/journalStore';
import { useAccountStore } from '../stores/accountStore';
import { useOpeningBalanceStore } from '../stores/openingBalanceStore';
import { calculateCashFlow, cashFlowLabels } from '../utils/cashFlow';
import { DateFilter } from './DateFilter';
import { downloadCSV } from '../utils/csv';

export function CashFlowStatement() {
  const { entries } = useJournalStore();
  const { accounts } = useAccountStore();
  const { settings: openingBalanceSettings } = useOpeningBalanceStore();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 日付フィルター適用
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;
      return true;
    });
  }, [entries, startDate, endDate]);

  // キャッシュフロー計算
  const cashFlow = useMemo(() => {
    return calculateCashFlow(filteredEntries, accounts, openingBalanceSettings.balances);
  }, [filteredEntries, accounts, openingBalanceSettings.balances]);

  // 金額のフォーマット
  const formatAmount = (amount: number) => {
    if (amount === 0) return '-';
    const formatted = Math.abs(amount).toLocaleString();
    return amount < 0 ? `△${formatted}` : formatted;
  };

  // CSV出力
  const handleExportCSV = () => {
    let csv = '\uFEFF'; // BOM for Excel
    csv += 'キャッシュフロー計算書\n';
    if (startDate || endDate) {
      csv += `期間: ${startDate || '期首'} 〜 ${endDate || '期末'}\n`;
    }
    csv += '\n';

    // 営業活動
    csv += `${cashFlowLabels.operating.title}\n`;
    csv += `${cashFlowLabels.operating.netProfit},${cashFlow.operating.netProfit}\n`;
    csv += `${cashFlowLabels.operating.depreciation},${cashFlow.operating.depreciation}\n`;
    csv += `${cashFlowLabels.operating.accountsReceivableChange},${cashFlow.operating.accountsReceivableChange}\n`;
    csv += `${cashFlowLabels.operating.inventoryChange},${cashFlow.operating.inventoryChange}\n`;
    csv += `${cashFlowLabels.operating.accountsPayableChange},${cashFlow.operating.accountsPayableChange}\n`;
    csv += `${cashFlowLabels.operating.subtotal},${cashFlow.operating.subtotal}\n`;
    csv += '\n';

    // 投資活動
    csv += `${cashFlowLabels.investing.title}\n`;
    csv += `${cashFlowLabels.investing.fixedAssetPurchase},${cashFlow.investing.fixedAssetPurchase}\n`;
    csv += `${cashFlowLabels.investing.fixedAssetSale},${cashFlow.investing.fixedAssetSale}\n`;
    csv += `${cashFlowLabels.investing.subtotal},${cashFlow.investing.subtotal}\n`;
    csv += '\n';

    // 財務活動
    csv += `${cashFlowLabels.financing.title}\n`;
    csv += `${cashFlowLabels.financing.borrowing},${cashFlow.financing.borrowing}\n`;
    csv += `${cashFlowLabels.financing.repayment},${cashFlow.financing.repayment}\n`;
    csv += `${cashFlowLabels.financing.capitalIncrease},${cashFlow.financing.capitalIncrease}\n`;
    csv += `${cashFlowLabels.financing.subtotal},${cashFlow.financing.subtotal}\n`;
    csv += '\n';

    // サマリー
    csv += `${cashFlowLabels.summary.totalCashFlow},${cashFlow.totalCashFlow}\n`;
    csv += `${cashFlowLabels.summary.beginningCash},${cashFlow.beginningCash}\n`;
    csv += `${cashFlowLabels.summary.endingCash},${cashFlow.endingCash}\n`;

    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `キャッシュフロー計算書_${today}.csv`);
  };

  // 行コンポーネント
  const Row = ({ label, amount, isSubtotal = false, indent = false }: { label: string; amount: number; isSubtotal?: boolean; indent?: boolean }) => (
    <tr className={isSubtotal ? 'bg-gray-50 font-semibold' : ''}>
      <td className={`py-2 px-4 border-b ${indent ? 'pl-8' : ''}`}>{label}</td>
      <td className={`py-2 px-4 border-b text-right ${amount < 0 ? 'text-red-600' : ''}`}>
        {formatAmount(amount)}
      </td>
    </tr>
  );

  // セクションヘッダー
  const SectionHeader = ({ title }: { title: string }) => (
    <tr className="bg-gray-100">
      <td colSpan={2} className="py-2 px-4 font-bold text-gray-700 border-b">
        {title}
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">キャッシュフロー計算書</h1>
        <button
          onClick={handleExportCSV}
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
          CSV出力
        </button>
      </div>

      <DateFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {entries.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          仕訳データがありません
        </div>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">営業活動CF</p>
              <p className={`text-2xl font-bold ${cashFlow.operating.subtotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatAmount(cashFlow.operating.subtotal)}円
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">投資活動CF</p>
              <p className={`text-2xl font-bold ${cashFlow.investing.subtotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatAmount(cashFlow.investing.subtotal)}円
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">財務活動CF</p>
              <p className={`text-2xl font-bold ${cashFlow.financing.subtotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatAmount(cashFlow.financing.subtotal)}円
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg shadow p-4">
              <p className="text-sm text-blue-600">現金増減額</p>
              <p className={`text-2xl font-bold ${cashFlow.totalCashFlow >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatAmount(cashFlow.totalCashFlow)}円
              </p>
            </div>
          </div>

          {/* 現金残高 */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">期首現金残高</p>
                <p className="text-xl font-bold text-gray-700">{cashFlow.beginningCash.toLocaleString()}円</p>
              </div>
              <div className="text-3xl text-gray-300">→</div>
              <div className={`px-4 py-2 rounded-lg ${cashFlow.totalCashFlow >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <p className="text-sm text-gray-500">増減</p>
                <p className={`text-xl font-bold ${cashFlow.totalCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cashFlow.totalCashFlow >= 0 ? '+' : ''}{cashFlow.totalCashFlow.toLocaleString()}円
                </p>
              </div>
              <div className="text-3xl text-gray-300">→</div>
              <div>
                <p className="text-sm text-gray-500">期末現金残高</p>
                <p className="text-xl font-bold text-blue-600">{cashFlow.endingCash.toLocaleString()}円</p>
              </div>
            </div>
          </div>

          {/* 詳細テーブル */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="py-3 px-4 text-left">科目</th>
                  <th className="py-3 px-4 text-right w-40">金額（円）</th>
                </tr>
              </thead>
              <tbody>
                {/* 営業活動によるキャッシュフロー */}
                <SectionHeader title={cashFlowLabels.operating.title} />
                <Row label={cashFlowLabels.operating.netProfit} amount={cashFlow.operating.netProfit} indent />
                <Row label={cashFlowLabels.operating.depreciation} amount={cashFlow.operating.depreciation} indent />
                <Row
                  label={`${cashFlowLabels.operating.accountsReceivableChange}（${cashFlow.operating.accountsReceivableChange >= 0 ? '減少' : '増加'}）`}
                  amount={cashFlow.operating.accountsReceivableChange}
                  indent
                />
                <Row
                  label={`${cashFlowLabels.operating.inventoryChange}（${cashFlow.operating.inventoryChange >= 0 ? '減少' : '増加'}）`}
                  amount={cashFlow.operating.inventoryChange}
                  indent
                />
                <Row
                  label={`${cashFlowLabels.operating.accountsPayableChange}（${cashFlow.operating.accountsPayableChange >= 0 ? '増加' : '減少'}）`}
                  amount={cashFlow.operating.accountsPayableChange}
                  indent
                />
                <Row label={cashFlowLabels.operating.subtotal} amount={cashFlow.operating.subtotal} isSubtotal />

                {/* 投資活動によるキャッシュフロー */}
                <SectionHeader title={cashFlowLabels.investing.title} />
                <Row label={cashFlowLabels.investing.fixedAssetPurchase} amount={cashFlow.investing.fixedAssetPurchase} indent />
                <Row label={cashFlowLabels.investing.fixedAssetSale} amount={cashFlow.investing.fixedAssetSale} indent />
                <Row label={cashFlowLabels.investing.subtotal} amount={cashFlow.investing.subtotal} isSubtotal />

                {/* 財務活動によるキャッシュフロー */}
                <SectionHeader title={cashFlowLabels.financing.title} />
                <Row label={cashFlowLabels.financing.borrowing} amount={cashFlow.financing.borrowing} indent />
                <Row label={cashFlowLabels.financing.repayment} amount={cashFlow.financing.repayment} indent />
                <Row label={cashFlowLabels.financing.capitalIncrease} amount={cashFlow.financing.capitalIncrease} indent />
                <Row label={cashFlowLabels.financing.subtotal} amount={cashFlow.financing.subtotal} isSubtotal />

                {/* サマリー */}
                <tr className="bg-blue-50">
                  <td colSpan={2} className="py-2 px-4 border-b"></td>
                </tr>
                <tr className="bg-blue-100 font-bold">
                  <td className="py-3 px-4">{cashFlowLabels.summary.totalCashFlow}</td>
                  <td className={`py-3 px-4 text-right ${cashFlow.totalCashFlow < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {formatAmount(cashFlow.totalCashFlow)}
                  </td>
                </tr>
                <Row label={cashFlowLabels.summary.beginningCash} amount={cashFlow.beginningCash} />
                <tr className="bg-gray-50 font-bold">
                  <td className="py-3 px-4">{cashFlowLabels.summary.endingCash}</td>
                  <td className="py-3 px-4 text-right text-blue-600">
                    {formatAmount(cashFlow.endingCash)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 注記 */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <h3 className="font-semibold mb-2">キャッシュフロー計算書について</h3>
            <ul className="space-y-1">
              <li>・間接法により作成しています</li>
              <li>・△（三角）はマイナス（現金の減少）を表します</li>
              <li>・営業活動CF：本業での現金の流れ（プラスが望ましい）</li>
              <li>・投資活動CF：設備投資などでの現金の流れ（成長企業ではマイナスになることが多い）</li>
              <li>・財務活動CF：借入や返済での現金の流れ</li>
              <li>・フリーキャッシュフロー = 営業活動CF + 投資活動CF</li>
            </ul>
          </div>

          {/* フリーキャッシュフロー */}
          <div className="mt-4 bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-700">フリーキャッシュフロー（FCF）</h3>
                <p className="text-sm text-gray-500">自由に使える現金（営業CF + 投資CF）</p>
              </div>
              <p className={`text-2xl font-bold ${(cashFlow.operating.subtotal + cashFlow.investing.subtotal) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatAmount(cashFlow.operating.subtotal + cashFlow.investing.subtotal)}円
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
