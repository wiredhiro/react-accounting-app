import { useState, useMemo } from 'react';
import { useJournalStore } from '../stores/journalStore';
import { useAccountStore } from '../stores/accountStore';
import { accountTypeLabels } from '../types';

interface LedgerEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export function GeneralLedger() {
  const { entries } = useJournalStore();
  const { accounts } = useAccountStore();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.code.localeCompare(b.code)),
    [accounts]
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const ledgerEntries = useMemo(() => {
    if (!selectedAccountId) return [];

    const account = accounts.find((a) => a.id === selectedAccountId);
    if (!account) return [];

    // 資産・費用は借方増加、負債・純資産・収益は貸方増加
    const isDebitNormal = account.type === 'asset' || account.type === 'expense';

    const relevantEntries = entries
      .filter(
        (e) => e.debitAccountId === selectedAccountId || e.creditAccountId === selectedAccountId
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    let balance = 0;
    return relevantEntries.map((entry): LedgerEntry => {
      const isDebit = entry.debitAccountId === selectedAccountId;
      const debit = isDebit ? entry.amount : 0;
      const credit = isDebit ? 0 : entry.amount;

      if (isDebitNormal) {
        balance += debit - credit;
      } else {
        balance += credit - debit;
      }

      return {
        date: entry.date,
        description: entry.description,
        debit,
        credit,
        balance,
      };
    });
  }, [selectedAccountId, entries, accounts]);

  const totalDebit = ledgerEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = ledgerEntries.reduce((sum, e) => sum + e.credit, 0);

  return (
    <div className="p-6">
      <div className="print-header">
        <h1>総勘定元帳</h1>
        {selectedAccount && (
          <p>
            {selectedAccount.code} {selectedAccount.name} | 出力日: {new Date().toLocaleDateString('ja-JP')}
          </p>
        )}
      </div>

      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-800">総勘定元帳</h1>
        {selectedAccount && ledgerEntries.length > 0 && (
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
        )}
      </div>

      <div className="mb-6 no-print">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          勘定科目を選択
        </label>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          style={{
            width: '300px',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
          }}
        >
          <option value="">選択してください</option>
          {sortedAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.code} {account.name} ({accountTypeLabels[account.type]})
            </option>
          ))}
        </select>
      </div>

      {selectedAccount && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">
              {selectedAccount.code} {selectedAccount.name}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({accountTypeLabels[selectedAccount.type]})
              </span>
            </h2>
          </div>

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  日付
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  摘要
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  借方
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  貸方
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  残高
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ledgerEntries.map((entry, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {entry.debit > 0 ? entry.debit.toLocaleString() : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {entry.credit > 0 ? entry.credit.toLocaleString() : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {entry.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
              {ledgerEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    この勘定科目の取引はありません
                  </td>
                </tr>
              )}
            </tbody>
            {ledgerEntries.length > 0 && (
              <tfoot className="bg-gray-100">
                <tr>
                  <td colSpan={2} className="px-6 py-3 text-sm font-medium text-gray-700">
                    合計
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-700 text-right">
                    {totalDebit.toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-700 text-right">
                    {totalCredit.toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                    {ledgerEntries[ledgerEntries.length - 1]?.balance.toLocaleString() ?? 0}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
