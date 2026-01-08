import { useMemo, useState } from 'react';
import { useJournalStore } from '../stores/journalStore';
import { useAccountStore } from '../stores/accountStore';
import { accountTypeLabels } from '../types';
import type { AccountType } from '../types';
import { downloadCSV } from '../utils/csv';

interface MonthlyData {
  month: string; // YYYY-MM
  label: string; // 表示用 (例: 2024年1月)
  revenue: number;
  expense: number;
  profit: number;
  accounts: Map<string, number>;
}

type ViewMode = 'pl' | 'account';

export function MonthlyTrend() {
  const { entries } = useJournalStore();
  const { accounts } = useAccountStore();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [viewMode, setViewMode] = useState<ViewMode>('pl');
  const [selectedType, setSelectedType] = useState<AccountType>('expense');

  // 利用可能な年のリストを取得
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    entries.forEach((entry) => {
      const entryYear = new Date(entry.date).getFullYear();
      years.add(entryYear);
    });
    // 現在の年も追加
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [entries]);

  // 月次データを計算
  const monthlyData = useMemo(() => {
    const months: MonthlyData[] = [];

    // 1月〜12月のデータを初期化
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
      months.push({
        month: monthStr,
        label: `${m}月`,
        revenue: 0,
        expense: 0,
        profit: 0,
        accounts: new Map(),
      });
    }

    // 仕訳データを集計
    entries.forEach((entry) => {
      const entryDate = new Date(entry.date);
      if (entryDate.getFullYear() !== year) return;

      const monthIndex = entryDate.getMonth(); // 0-11
      const monthData = months[monthIndex];

      // 借方科目
      const debitAccount = accounts.find((a) => a.id === entry.debitAccountId);
      if (debitAccount) {
        const current = monthData.accounts.get(entry.debitAccountId) || 0;
        monthData.accounts.set(entry.debitAccountId, current + entry.amount);

        if (debitAccount.type === 'expense') {
          monthData.expense += entry.amount;
        }
      }

      // 貸方科目
      const creditAccount = accounts.find((a) => a.id === entry.creditAccountId);
      if (creditAccount) {
        const current = monthData.accounts.get(entry.creditAccountId) || 0;
        monthData.accounts.set(entry.creditAccountId, current - entry.amount);

        if (creditAccount.type === 'revenue') {
          monthData.revenue += entry.amount;
        }
      }
    });

    // 利益を計算
    months.forEach((m) => {
      m.profit = m.revenue - m.expense;
    });

    return months;
  }, [entries, accounts, year]);

  // 選択された科目分類の勘定科目を取得
  const filteredAccounts = useMemo(() => {
    return accounts
      .filter((a) => a.type === selectedType)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, selectedType]);

  // 年間合計
  const yearTotal = useMemo(() => {
    return monthlyData.reduce(
      (acc, m) => ({
        revenue: acc.revenue + m.revenue,
        expense: acc.expense + m.expense,
        profit: acc.profit + m.profit,
      }),
      { revenue: 0, expense: 0, profit: 0 }
    );
  }, [monthlyData]);

  // 科目別の年間合計
  const accountYearTotals = useMemo(() => {
    const totals = new Map<string, number>();
    monthlyData.forEach((m) => {
      m.accounts.forEach((amount, accountId) => {
        const current = totals.get(accountId) || 0;
        totals.set(accountId, current + amount);
      });
    });
    return totals;
  }, [monthlyData]);

  // CSVエクスポート
  const handleExport = () => {
    let csv = '';

    if (viewMode === 'pl') {
      csv = '月,収益,費用,利益\n';
      monthlyData.forEach((m) => {
        csv += `${m.label},${m.revenue},${m.expense},${m.profit}\n`;
      });
      csv += `合計,${yearTotal.revenue},${yearTotal.expense},${yearTotal.profit}\n`;
    } else {
      // 科目別
      const headers = ['科目', ...monthlyData.map((m) => m.label), '合計'];
      csv = headers.join(',') + '\n';

      filteredAccounts.forEach((account) => {
        const row = [account.name];
        let total = 0;

        monthlyData.forEach((m) => {
          const amount = m.accounts.get(account.id) || 0;
          const displayAmount = ['asset', 'expense'].includes(account.type) ? amount : -amount;
          row.push(displayAmount.toString());
          total += displayAmount;
        });

        row.push(total.toString());
        csv += row.join(',') + '\n';
      });
    }

    downloadCSV(csv, `月次推移表_${year}年_${viewMode === 'pl' ? '損益' : accountTypeLabels[selectedType]}.csv`);
  };

  return (
    <div className="p-6 print-landscape">
      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-800">月次推移表</h1>
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

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 no-print">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
          {/* 年選択 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="text-sm text-gray-600">年度:</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{
                width: '100px',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
              }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
            <button
              onClick={() => setYear((y) => y - 1)}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
            >
              &lt;
            </button>
            <button
              onClick={() => setYear((y) => y + 1)}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
            >
              &gt;
            </button>
          </div>

          {/* 表示モード */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="text-sm text-gray-600">表示:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              style={{
                width: '120px',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
              }}
            >
              <option value="pl">損益推移</option>
              <option value="account">科目別</option>
            </select>
          </div>

          {/* 科目分類（科目別モードの場合） */}
          {viewMode === 'account' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="text-sm text-gray-600">科目分類:</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as AccountType)}
                style={{
                  width: '120px',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              >
                <option value="revenue">収益</option>
                <option value="expense">費用</option>
                <option value="asset">資産</option>
                <option value="liability">負債</option>
                <option value="equity">純資産</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 印刷用ヘッダー */}
      <div className="print-header">
        <h1>月次推移表</h1>
        <p>
          {year}年 | {viewMode === 'pl' ? '損益推移' : `${accountTypeLabels[selectedType]}科目別`}
          {' | '}出力日: {new Date().toLocaleDateString('ja-JP')}
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          仕訳がありません。仕訳を入力してください。
        </div>
      ) : viewMode === 'pl' ? (
        /* 損益推移表 */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">
                    項目
                  </th>
                  {monthlyData.map((m) => (
                    <th key={m.month} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase min-w-[80px]">
                      {m.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-gray-100 min-w-[100px]">
                    合計
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* 収益 */}
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">収益</td>
                  {monthlyData.map((m) => (
                    <td key={m.month} className="px-4 py-3 text-sm text-right text-gray-900">
                      {m.revenue > 0 ? m.revenue.toLocaleString() : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 bg-gray-50">
                    {yearTotal.revenue.toLocaleString()}
                  </td>
                </tr>

                {/* 費用 */}
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">費用</td>
                  {monthlyData.map((m) => (
                    <td key={m.month} className="px-4 py-3 text-sm text-right text-gray-900">
                      {m.expense > 0 ? m.expense.toLocaleString() : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 bg-gray-50">
                    {yearTotal.expense.toLocaleString()}
                  </td>
                </tr>

                {/* 利益 */}
                <tr className="bg-blue-50 font-bold">
                  <td className="px-4 py-3 text-sm text-blue-800 sticky left-0 bg-blue-50">利益</td>
                  {monthlyData.map((m) => (
                    <td
                      key={m.month}
                      className={`px-4 py-3 text-sm text-right ${m.profit >= 0 ? 'text-blue-700' : 'text-red-600'}`}
                    >
                      {m.profit !== 0 ? m.profit.toLocaleString() : '-'}
                    </td>
                  ))}
                  <td className={`px-4 py-3 text-sm text-right bg-blue-100 ${yearTotal.profit >= 0 ? 'text-blue-800' : 'text-red-600'}`}>
                    {yearTotal.profit.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 簡易グラフ */}
          <div className="p-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-3">月別利益推移</h3>
            <div className="flex items-end gap-1 h-32">
              {monthlyData.map((m) => {
                const maxProfit = Math.max(...monthlyData.map((d) => Math.abs(d.profit)), 1);
                const height = Math.abs(m.profit) / maxProfit * 100;
                const isPositive = m.profit >= 0;

                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col items-center justify-end h-24">
                      {m.profit !== 0 && (
                        <div
                          className={`w-full max-w-[30px] rounded-t ${isPositive ? 'bg-blue-500' : 'bg-red-400'}`}
                          style={{ height: `${height}%` }}
                          title={`${m.label}: ${m.profit.toLocaleString()}円`}
                        />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 mt-1">{m.label.replace('月', '')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* 科目別推移表 */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 min-w-[150px]">
                    勘定科目
                  </th>
                  {monthlyData.map((m) => (
                    <th key={m.month} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase min-w-[80px]">
                      {m.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-gray-100 min-w-[100px]">
                    合計
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                      該当する勘定科目がありません
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => {
                    const yearTotal = accountYearTotals.get(account.id) || 0;
                    const displayTotal = ['asset', 'expense'].includes(account.type) ? yearTotal : -yearTotal;

                    return (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-white">
                          <span className="text-gray-400 mr-2">{account.code}</span>
                          {account.name}
                        </td>
                        {monthlyData.map((m) => {
                          const amount = m.accounts.get(account.id) || 0;
                          const displayAmount = ['asset', 'expense'].includes(account.type) ? amount : -amount;

                          return (
                            <td key={m.month} className="px-4 py-3 text-sm text-right text-gray-900">
                              {displayAmount !== 0 ? displayAmount.toLocaleString() : '-'}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 bg-gray-50">
                          {displayTotal !== 0 ? displayTotal.toLocaleString() : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredAccounts.length > 0 && (
                <tfoot className="bg-gray-100">
                  <tr className="font-bold">
                    <td className="px-4 py-3 text-sm text-gray-700 sticky left-0 bg-gray-100">合計</td>
                    {monthlyData.map((m) => {
                      const total = filteredAccounts.reduce((sum, acc) => {
                        const amount = m.accounts.get(acc.id) || 0;
                        const displayAmount = ['asset', 'expense'].includes(acc.type) ? amount : -amount;
                        return sum + displayAmount;
                      }, 0);

                      return (
                        <td key={m.month} className="px-4 py-3 text-sm text-right text-gray-900">
                          {total !== 0 ? total.toLocaleString() : '-'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-sm text-right text-gray-900 bg-gray-200">
                      {filteredAccounts
                        .reduce((sum, acc) => {
                          const total = accountYearTotals.get(acc.id) || 0;
                          const displayTotal = ['asset', 'expense'].includes(acc.type) ? total : -total;
                          return sum + displayTotal;
                        }, 0)
                        .toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* 説明 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg no-print">
        <h3 className="font-semibold text-blue-800 mb-2">月次推移表について</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>損益推移: 月別の収益・費用・利益を表示します</li>
          <li>科目別: 選択した科目分類の勘定科目ごとの月別推移を表示します</li>
          <li>年度を切り替えて過去のデータも確認できます</li>
        </ul>
      </div>
    </div>
  );
}
