import { useMemo, useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useJournalStore } from '../stores/journalStore';
import { useAccountStore } from '../stores/accountStore';
import { useOpeningBalanceStore } from '../stores/openingBalanceStore';
import type { AccountType } from '../types';
import { downloadCSV, plToCSV, bsToCSV } from '../utils/csv';
import { DateFilter } from './DateFilter';

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  balance: number;
}

export function FinancialStatements() {
  const { entries } = useJournalStore();
  const { accounts } = useAccountStore();
  const { settings: openingBalanceSettings } = useOpeningBalanceStore();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeOpeningBalance, setIncludeOpeningBalance] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `財務諸表_${new Date().toISOString().split('T')[0]}`,
  });

  // 日付フィルター適用
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;
      return true;
    });
  }, [entries, startDate, endDate]);

  const accountBalances = useMemo(() => {
    const balances = new Map<string, number>();

    // 期首残高を適用（B/S科目のみ、オプションが有効な場合）
    if (includeOpeningBalance) {
      openingBalanceSettings.balances.forEach((balance) => {
        const account = accounts.find((a) => a.id === balance.accountId);
        // 期首残高はB/S科目（資産・負債・純資産）のみに適用
        if (account && ['asset', 'liability', 'equity'].includes(account.type)) {
          const existing = balances.get(balance.accountId) || 0;
          // 期首残高: 正=借方残高、負=貸方残高
          balances.set(balance.accountId, existing + balance.amount);
        }
      });
    }

    filteredEntries.forEach((entry) => {
      // 借方科目
      const debitBalance = balances.get(entry.debitAccountId) || 0;
      balances.set(entry.debitAccountId, debitBalance + entry.amount);

      // 貸方科目
      const creditBalance = balances.get(entry.creditAccountId) || 0;
      balances.set(entry.creditAccountId, creditBalance - entry.amount);
    });

    const result: AccountBalance[] = [];

    accounts.forEach((account) => {
      const rawBalance = balances.get(account.id) || 0;
      if (rawBalance === 0) return;

      // 資産・費用は借方が正、負債・純資産・収益は貸方が正
      const isDebitNormal = account.type === 'asset' || account.type === 'expense';
      const balance = isDebitNormal ? rawBalance : -rawBalance;

      result.push({
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        balance,
      });
    });

    return result.sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredEntries, accounts, includeOpeningBalance, openingBalanceSettings.balances]);

  // 損益計算書のデータ
  const plData = useMemo(() => {
    const revenue = accountBalances.filter((a) => a.type === 'revenue');
    const expense = accountBalances.filter((a) => a.type === 'expense');

    const totalRevenue = revenue.reduce((sum, a) => sum + a.balance, 0);
    const totalExpense = expense.reduce((sum, a) => sum + a.balance, 0);
    const netIncome = totalRevenue - totalExpense;

    return { revenue, expense, totalRevenue, totalExpense, netIncome };
  }, [accountBalances]);

  // 貸借対照表のデータ
  const bsData = useMemo(() => {
    const assets = accountBalances.filter((a) => a.type === 'asset');
    const liabilities = accountBalances.filter((a) => a.type === 'liability');
    const equity = accountBalances.filter((a) => a.type === 'equity');

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

    // 当期純利益を加算
    const totalEquityWithIncome = totalEquity + plData.netIncome;

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity: totalEquityWithIncome,
      netIncome: plData.netIncome,
    };
  }, [accountBalances, plData.netIncome]);

  // CSVエクスポート
  const handleExportPL = () => {
    const csv = plToCSV(plData.revenue, plData.expense, plData.netIncome);
    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `損益計算書_${today}.csv`);
  };

  const handleExportBS = () => {
    const csv = bsToCSV(bsData.assets, bsData.liabilities, bsData.equity, bsData.netIncome);
    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `貸借対照表_${today}.csv`);
  };

  // PDF出力（日本語フォント対応後に有効化）
  // const handleExportPLPDF = () => {
  //   exportPLToPDF(plData.revenue, plData.expense, plData.netIncome, startDate, endDate);
  // };

  // const handleExportBSPDF = () => {
  //   exportBSToPDF(bsData.assets, bsData.liabilities, bsData.equity, bsData.netIncome, startDate, endDate);
  // };

  if (entries.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">財務諸表</h1>
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          仕訳がありません。仕訳を入力してください。
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="print-header">
        <h1>財務諸表</h1>
        <p>
          {startDate || endDate
            ? `期間: ${startDate || '開始日なし'} 〜 ${endDate || '終了日なし'}`
            : '全期間'}
          {' | '}出力日: {new Date().toLocaleDateString('ja-JP')}
        </p>
      </div>

      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-800">財務諸表</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => handlePrint()}
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
            onClick={handleExportPL}
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
            P/L CSV
          </button>
          <button
            onClick={handleExportBS}
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
            B/S CSV
          </button>
        </div>
      </div>

      {/* 日付フィルター */}
      <DateFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {/* 期首残高オプション */}
      <div className="mb-4 flex items-center gap-4 no-print">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeOpeningBalance}
            onChange={(e) => setIncludeOpeningBalance(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">期首残高を含める (B/S)</span>
        </label>
        {includeOpeningBalance && openingBalanceSettings.balances.length > 0 && (
          <span className="text-sm text-gray-500">
            (期首: {openingBalanceSettings.fiscalYearStart})
          </span>
        )}
      </div>

      <div ref={printRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-content">
        {/* 損益計算書 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-600 text-white px-6 py-4">
            <h2 className="text-lg font-semibold">損益計算書 (P/L)</h2>
          </div>
          <div className="p-4">
            {/* 収益 */}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2 mb-2">収益</h3>
              {plData.revenue.length > 0 ? (
                <table className="w-full">
                  <tbody>
                    {plData.revenue.map((item) => (
                      <tr key={item.id}>
                        <td className="py-1 text-sm text-gray-600">{item.name}</td>
                        <td className="py-1 text-sm text-right">{item.balance.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-medium">
                      <td className="py-2">収益合計</td>
                      <td className="py-2 text-right">{plData.totalRevenue.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-400">なし</p>
              )}
            </div>

            {/* 費用 */}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2 mb-2">費用</h3>
              {plData.expense.length > 0 ? (
                <table className="w-full">
                  <tbody>
                    {plData.expense.map((item) => (
                      <tr key={item.id}>
                        <td className="py-1 text-sm text-gray-600">{item.name}</td>
                        <td className="py-1 text-sm text-right">{item.balance.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-medium">
                      <td className="py-2">費用合計</td>
                      <td className="py-2 text-right">{plData.totalExpense.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-400">なし</p>
              )}
            </div>

            {/* 当期純利益 */}
            <div className="bg-gray-100 rounded p-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800">当期純利益</span>
                <span className={`font-bold text-lg ${plData.netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {plData.netIncome.toLocaleString()}円
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 貸借対照表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-green-600 text-white px-6 py-4">
            <h2 className="text-lg font-semibold">貸借対照表 (B/S)</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 資産の部 */}
              <div>
                <h3 className="font-semibold text-gray-700 border-b pb-2 mb-2">資産の部</h3>
                {bsData.assets.length > 0 ? (
                  <table className="w-full">
                    <tbody>
                      {bsData.assets.map((item) => (
                        <tr key={item.id}>
                          <td className="py-1 text-sm text-gray-600">{item.name}</td>
                          <td className="py-1 text-sm text-right">{item.balance.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="border-t font-medium">
                        <td className="py-2">資産合計</td>
                        <td className="py-2 text-right">{bsData.totalAssets.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-400">なし</p>
                )}
              </div>

              {/* 負債・純資産の部 */}
              <div>
                <h3 className="font-semibold text-gray-700 border-b pb-2 mb-2">負債の部</h3>
                {bsData.liabilities.length > 0 ? (
                  <table className="w-full">
                    <tbody>
                      {bsData.liabilities.map((item) => (
                        <tr key={item.id}>
                          <td className="py-1 text-sm text-gray-600">{item.name}</td>
                          <td className="py-1 text-sm text-right">{item.balance.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="border-t font-medium">
                        <td className="py-2">負債合計</td>
                        <td className="py-2 text-right">{bsData.totalLiabilities.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-400">なし</p>
                )}

                <h3 className="font-semibold text-gray-700 border-b pb-2 mb-2 mt-4">純資産の部</h3>
                <table className="w-full">
                  <tbody>
                    {bsData.equity.map((item) => (
                      <tr key={item.id}>
                        <td className="py-1 text-sm text-gray-600">{item.name}</td>
                        <td className="py-1 text-sm text-right">{item.balance.toLocaleString()}</td>
                      </tr>
                    ))}
                    {bsData.netIncome !== 0 && (
                      <tr>
                        <td className="py-1 text-sm text-gray-600">当期純利益</td>
                        <td className="py-1 text-sm text-right">{bsData.netIncome.toLocaleString()}</td>
                      </tr>
                    )}
                    <tr className="border-t font-medium">
                      <td className="py-2">純資産合計</td>
                      <td className="py-2 text-right">{bsData.totalEquity.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 貸借バランス確認 */}
            <div className={`mt-4 rounded p-3 ${bsData.totalAssets === bsData.totalLiabilities + bsData.totalEquity ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">資産合計:</span>
                  <span className="font-bold ml-2">{bsData.totalAssets.toLocaleString()}円</span>
                </div>
                <div>
                  <span className="text-gray-600">負債・純資産合計:</span>
                  <span className="font-bold ml-2">{(bsData.totalLiabilities + bsData.totalEquity).toLocaleString()}円</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
