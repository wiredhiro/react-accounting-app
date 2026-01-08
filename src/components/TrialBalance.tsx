import { useMemo, Fragment, useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useJournalStore } from '../stores/journalStore';
import { useAccountStore } from '../stores/accountStore';
import { useOpeningBalanceStore } from '../stores/openingBalanceStore';
import { accountTypeLabels, accountTypeOrder } from '../types';
import type { AccountType } from '../types';
import { downloadCSV, trialBalanceToCSV } from '../utils/csv';
import { DateFilter } from './DateFilter';

interface BalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debitTotal: number;
  creditTotal: number;
  debitBalance: number;
  creditBalance: number;
}

export function TrialBalance() {
  const { entries } = useJournalStore();
  const { accounts } = useAccountStore();
  const { settings: openingBalanceSettings } = useOpeningBalanceStore();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeOpeningBalance, setIncludeOpeningBalance] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `試算表_${new Date().toISOString().split('T')[0]}`,
  });

  // 日付フィルター適用
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;
      return true;
    });
  }, [entries, startDate, endDate]);

  // 存在しない勘定科目IDを検出
  const missingAccountIds = useMemo(() => {
    const accountIds = new Set(accounts.map((a) => a.id));
    const missing = new Set<string>();

    filteredEntries.forEach((entry) => {
      if (!accountIds.has(entry.debitAccountId)) {
        missing.add(entry.debitAccountId);
      }
      if (!accountIds.has(entry.creditAccountId)) {
        missing.add(entry.creditAccountId);
      }
    });

    return missing;
  }, [filteredEntries, accounts]);

  const balanceData = useMemo(() => {
    // 各勘定科目の借方・貸方合計を計算
    const accountTotals = new Map<string, { debit: number; credit: number }>();

    // 期首残高を適用（オプションが有効な場合）
    if (includeOpeningBalance) {
      openingBalanceSettings.balances.forEach((balance) => {
        const existing = accountTotals.get(balance.accountId) || { debit: 0, credit: 0 };
        if (balance.amount > 0) {
          existing.debit += balance.amount;
        } else {
          existing.credit += Math.abs(balance.amount);
        }
        accountTotals.set(balance.accountId, existing);
      });
    }

    filteredEntries.forEach((entry) => {
      // 借方科目
      const debitData = accountTotals.get(entry.debitAccountId) || { debit: 0, credit: 0 };
      debitData.debit += entry.amount;
      accountTotals.set(entry.debitAccountId, debitData);

      // 貸方科目
      const creditData = accountTotals.get(entry.creditAccountId) || { debit: 0, credit: 0 };
      creditData.credit += entry.amount;
      accountTotals.set(entry.creditAccountId, creditData);
    });

    // 残高試算表用のデータを作成（存在する勘定科目）
    const rows: BalanceRow[] = accounts
      .filter((account) => accountTotals.has(account.id))
      .map((account) => {
        const totals = accountTotals.get(account.id)!;

        return {
          accountId: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          debitTotal: totals.debit,
          creditTotal: totals.credit,
          debitBalance: 0,
          creditBalance: 0,
        };
      });

    // 存在しない勘定科目も追加（不明科目として）
    missingAccountIds.forEach((missingId) => {
      const totals = accountTotals.get(missingId);
      if (totals) {
        rows.push({
          accountId: missingId,
          code: '???',
          name: `不明な科目 (${missingId.slice(0, 8)}...)`,
          type: 'asset', // デフォルトは資産として扱う
          debitTotal: totals.debit,
          creditTotal: totals.credit,
          debitBalance: 0,
          creditBalance: 0,
        });
      }
    });

    // コードでソート
    rows.sort((a, b) => a.code.localeCompare(b.code));

    // 正しい残高計算
    rows.forEach((row) => {
      const isDebitNormal = row.type === 'asset' || row.type === 'expense';
      const netBalance = row.debitTotal - row.creditTotal;

      if (isDebitNormal) {
        // 資産・費用: 借方増加
        row.debitBalance = netBalance >= 0 ? netBalance : 0;
        row.creditBalance = netBalance < 0 ? -netBalance : 0;
      } else {
        // 負債・純資産・収益: 貸方増加
        row.debitBalance = netBalance > 0 ? netBalance : 0;
        row.creditBalance = netBalance <= 0 ? -netBalance : 0;
      }
    });

    return rows;
  }, [filteredEntries, accounts, missingAccountIds, includeOpeningBalance, openingBalanceSettings.balances]);

  // 勘定科目の分類ごとにグループ化
  const groupedData = useMemo(() => {
    const groups: Record<AccountType, BalanceRow[]> = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      expense: [],
    };

    balanceData.forEach((row) => {
      groups[row.type].push(row);
    });

    return groups;
  }, [balanceData]);

  // 合計計算
  const totals = useMemo(() => {
    return balanceData.reduce(
      (acc, row) => ({
        debitTotal: acc.debitTotal + row.debitTotal,
        creditTotal: acc.creditTotal + row.creditTotal,
        debitBalance: acc.debitBalance + row.debitBalance,
        creditBalance: acc.creditBalance + row.creditBalance,
      }),
      { debitTotal: 0, creditTotal: 0, debitBalance: 0, creditBalance: 0 }
    );
  }, [balanceData]);

  const isBalanced = totals.debitTotal === totals.creditTotal;

  // CSVエクスポート
  const handleExport = () => {
    const csvData = balanceData.map((row) => ({
      code: row.code,
      name: row.name,
      type: accountTypeLabels[row.type],
      debitTotal: row.debitTotal,
      creditTotal: row.creditTotal,
      debitBalance: row.debitBalance,
      creditBalance: row.creditBalance,
    }));
    const csv = trialBalanceToCSV(csvData);
    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `試算表_${today}.csv`);
  };

  return (
    <div className="p-6">
      <div className="print-header">
        <h1>試算表</h1>
        <p>
          {startDate || endDate
            ? `期間: ${startDate || '開始日なし'} 〜 ${endDate || '終了日なし'}`
            : '全期間'}
          {' | '}出力日: {new Date().toLocaleDateString('ja-JP')}
        </p>
      </div>

      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-800">試算表</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {filteredEntries.length > 0 && (
            <>
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
            </>
          )}
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
          <span className="text-sm text-gray-700">期首残高を含める</span>
        </label>
        {includeOpeningBalance && openingBalanceSettings.balances.length > 0 && (
          <span className="text-sm text-gray-500">
            (期首: {openingBalanceSettings.fiscalYearStart})
          </span>
        )}
      </div>

      {/* 存在しない勘定科目の警告 */}
      {missingAccountIds.size > 0 && (
        <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 rounded-md no-print">
          <p className="font-bold mb-1">警告: 削除された勘定科目を使用した仕訳があります</p>
          <p className="text-sm">
            {missingAccountIds.size}件の勘定科目が仕訳で使用されていますが、マスタに存在しません。
            該当の仕訳を修正するか、勘定科目を再作成してください。
          </p>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          仕訳がありません。仕訳を入力してください。
        </div>
      ) : (
        <div ref={printRef} className="bg-white rounded-lg shadow overflow-hidden print-content">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" colSpan={2}>
                  勘定科目
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" colSpan={2}>
                  合計試算表
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" colSpan={2}>
                  残高試算表
                </th>
              </tr>
              <tr className="bg-gray-100">
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">コード</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">科目名</th>
                <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">借方</th>
                <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">貸方</th>
                <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">借方</th>
                <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">貸方</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {accountTypeOrder.map((type) => {
                const rows = groupedData[type];
                if (rows.length === 0) return null;

                return (
                  <Fragment key={type}>
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-2 text-sm font-semibold text-gray-700">
                        【{accountTypeLabels[type]}】
                      </td>
                    </tr>
                    {rows.map((row) => (
                      <tr key={row.accountId} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm text-gray-900">{row.code}</td>
                        <td className="px-6 py-3 text-sm text-gray-900">{row.name}</td>
                        <td className="px-6 py-3 text-sm text-gray-900 text-right">
                          {row.debitTotal > 0 ? row.debitTotal.toLocaleString() : ''}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900 text-right">
                          {row.creditTotal > 0 ? row.creditTotal.toLocaleString() : ''}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900 text-right">
                          {row.debitBalance > 0 ? row.debitBalance.toLocaleString() : ''}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900 text-right">
                          {row.creditBalance > 0 ? row.creditBalance.toLocaleString() : ''}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr className="font-bold">
                <td colSpan={2} className="px-6 py-3 text-sm text-gray-700">合計</td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {totals.debitTotal.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {totals.creditTotal.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {totals.debitBalance.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {totals.creditBalance.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className={`px-6 py-4 ${isBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-sm font-medium ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
              {isBalanced
                ? '借方・貸方の合計が一致しています'
                : '借方・貸方の合計が一致していません。仕訳を確認してください。'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

