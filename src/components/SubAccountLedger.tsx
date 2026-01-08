import { useMemo, useState } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useSubAccountStore } from '../stores/subAccountStore';
import { useJournalStore } from '../stores/journalStore';
import { accountTypeLabels } from '../types';
import { DateFilter } from './DateFilter';
import { downloadCSV } from '../utils/csv';

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export function SubAccountLedger() {
  const { accounts } = useAccountStore();
  const { subAccounts } = useSubAccountStore();
  const { entries } = useJournalStore();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedSubAccountId, setSelectedSubAccountId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 補助科目を持つ勘定科目
  const accountsWithSubAccounts = useMemo(() => {
    const accountIds = new Set(subAccounts.map((sa) => sa.parentAccountId));
    return accounts
      .filter((a) => accountIds.has(a.id))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, subAccounts]);

  // 選択された勘定科目の補助科目一覧
  const filteredSubAccounts = useMemo(() => {
    if (!selectedAccountId) return [];
    return subAccounts
      .filter((sa) => sa.parentAccountId === selectedAccountId)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [subAccounts, selectedAccountId]);

  // 選択された勘定科目と補助科目
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const selectedSubAccount = subAccounts.find((sa) => sa.id === selectedSubAccountId);

  // 補助元帳データを計算
  const ledgerData = useMemo(() => {
    if (!selectedAccountId || !selectedSubAccountId) return [];

    const isDebitNormal = selectedAccount?.type === 'asset' || selectedAccount?.type === 'expense';

    // 日付でフィルターして該当する仕訳を抽出
    const relevantEntries = entries
      .filter((entry) => {
        // 日付フィルター
        if (startDate && entry.date < startDate) return false;
        if (endDate && entry.date > endDate) return false;

        // この補助科目に関連する仕訳のみ
        const isDebitMatch =
          entry.debitAccountId === selectedAccountId &&
          entry.debitSubAccountId === selectedSubAccountId;
        const isCreditMatch =
          entry.creditAccountId === selectedAccountId &&
          entry.creditSubAccountId === selectedSubAccountId;

        return isDebitMatch || isCreditMatch;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    // 残高を計算
    let balance = 0;
    const ledgerEntries: LedgerEntry[] = [];

    relevantEntries.forEach((entry) => {
      const isDebit =
        entry.debitAccountId === selectedAccountId &&
        entry.debitSubAccountId === selectedSubAccountId;
      const isCredit =
        entry.creditAccountId === selectedAccountId &&
        entry.creditSubAccountId === selectedSubAccountId;

      let debit = 0;
      let credit = 0;

      if (isDebit) {
        debit = entry.amount;
        balance += entry.amount;
      }
      if (isCredit) {
        credit = entry.amount;
        balance -= entry.amount;
      }

      ledgerEntries.push({
        id: entry.id,
        date: entry.date,
        description: entry.description,
        debit,
        credit,
        balance: isDebitNormal ? balance : -balance,
      });
    });

    return ledgerEntries;
  }, [entries, selectedAccountId, selectedSubAccountId, selectedAccount, startDate, endDate]);

  // 合計
  const totals = useMemo(() => {
    return ledgerData.reduce(
      (acc, entry) => ({
        debit: acc.debit + entry.debit,
        credit: acc.credit + entry.credit,
      }),
      { debit: 0, credit: 0 }
    );
  }, [ledgerData]);

  // CSVエクスポート
  const handleExport = () => {
    if (!selectedAccount || !selectedSubAccount) return;

    let csv = '\uFEFF'; // BOM for Excel
    csv += `補助元帳: ${selectedAccount.name} - ${selectedSubAccount.name}\n`;
    csv += `期間: ${startDate || '開始日なし'} 〜 ${endDate || '終了日なし'}\n\n`;
    csv += '日付,摘要,借方,貸方,残高\n';

    ledgerData.forEach((entry) => {
      csv += `${entry.date},"${entry.description}",${entry.debit || ''},${entry.credit || ''},${entry.balance}\n`;
    });

    csv += `\n合計,,${totals.debit},${totals.credit},${ledgerData[ledgerData.length - 1]?.balance || 0}\n`;

    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `補助元帳_${selectedAccount.name}_${selectedSubAccount.name}_${today}.csv`);
  };

  return (
    <div className="p-6">
      <div className="print-header">
        <h1>補助元帳</h1>
        <p>
          {selectedAccount?.name} - {selectedSubAccount?.name}
          {' | '}
          {startDate || endDate
            ? `期間: ${startDate || '開始日なし'} 〜 ${endDate || '終了日なし'}`
            : '全期間'}
          {' | '}出力日: {new Date().toLocaleDateString('ja-JP')}
        </p>
      </div>

      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-800">補助元帳</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {selectedSubAccountId && ledgerData.length > 0 && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 no-print">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">勘定科目</label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setSelectedSubAccountId('');
              }}
              style={{
                width: '280px',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
              }}
            >
              <option value="">勘定科目を選択</option>
              {accountsWithSubAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name} ({accountTypeLabels[account.type]})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">補助科目</label>
            <select
              value={selectedSubAccountId}
              onChange={(e) => setSelectedSubAccountId(e.target.value)}
              disabled={!selectedAccountId}
              style={{
                width: '280px',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: !selectedAccountId ? '#f3f4f6' : 'white',
              }}
            >
              <option value="">補助科目を選択</option>
              {filteredSubAccounts.map((sa) => (
                <option key={sa.id} value={sa.id}>
                  {sa.code} - {sa.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DateFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </div>

      {/* 元帳表示 */}
      {!selectedAccountId ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          勘定科目を選択してください
        </div>
      ) : !selectedSubAccountId ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          補助科目を選択してください
        </div>
      ) : ledgerData.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          該当する取引がありません
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-700">
              {selectedAccount?.name} / {selectedSubAccount?.name}
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
              {ledgerData.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">{entry.date}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{entry.description}</td>
                  <td className="px-6 py-3 text-sm text-gray-900 text-right">
                    {entry.debit > 0 ? entry.debit.toLocaleString() : ''}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900 text-right">
                    {entry.credit > 0 ? entry.credit.toLocaleString() : ''}
                  </td>
                  <td className={`px-6 py-3 text-sm text-right font-medium ${entry.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {entry.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr className="font-bold">
                <td colSpan={2} className="px-6 py-3 text-sm text-gray-700">
                  合計
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {totals.debit.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {totals.credit.toLocaleString()}
                </td>
                <td className={`px-6 py-3 text-sm text-right ${(ledgerData[ledgerData.length - 1]?.balance || 0) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {(ledgerData[ledgerData.length - 1]?.balance || 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 説明 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg no-print">
        <h3 className="font-semibold text-blue-800 mb-2">補助元帳について</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>・補助元帳は補助科目別の取引履歴を表示します</li>
          <li>・取引先別の売掛金残高、仕入先別の買掛金残高などを確認できます</li>
          <li>・日付でフィルターして特定期間の取引を確認できます</li>
        </ul>
      </div>
    </div>
  );
}
