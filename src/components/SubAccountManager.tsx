import { useState, useMemo } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useSubAccountStore } from '../stores/subAccountStore';
import { useJournalStore } from '../stores/journalStore';
import { accountTypeLabels } from '../types';
import type { SubAccount } from '../types';

export function SubAccountManager() {
  const { accounts } = useAccountStore();
  const { subAccounts, addSubAccount, updateSubAccount, deleteSubAccount } = useSubAccountStore();
  const { entries } = useJournalStore();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubAccount, setEditingSubAccount] = useState<SubAccount | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', description: '' });

  // 補助科目を持てる勘定科目（売掛金、買掛金、その他必要な科目）
  const accountsWithSubAccounts = useMemo(() => {
    return accounts.filter((a) =>
      // 売掛金、買掛金、未収入金、未払金などの科目を対象
      ['asset', 'liability'].includes(a.type)
    ).sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts]);

  // 選択された勘定科目の補助科目一覧
  const filteredSubAccounts = useMemo(() => {
    if (!selectedAccountId) return [];
    return subAccounts
      .filter((sa) => sa.parentAccountId === selectedAccountId)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [subAccounts, selectedAccountId]);

  // 選択された勘定科目
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // 補助科目別の残高を計算
  const subAccountBalances = useMemo(() => {
    const balances = new Map<string, number>();

    entries.forEach((entry) => {
      // 借方補助科目
      if (entry.debitSubAccountId && entry.debitAccountId === selectedAccountId) {
        const current = balances.get(entry.debitSubAccountId) || 0;
        balances.set(entry.debitSubAccountId, current + entry.amount);
      }
      // 貸方補助科目
      if (entry.creditSubAccountId && entry.creditAccountId === selectedAccountId) {
        const current = balances.get(entry.creditSubAccountId) || 0;
        balances.set(entry.creditSubAccountId, current - entry.amount);
      }
    });

    return balances;
  }, [entries, selectedAccountId]);

  const handleOpenForm = (subAccount?: SubAccount) => {
    if (subAccount) {
      setEditingSubAccount(subAccount);
      setFormData({
        code: subAccount.code,
        name: subAccount.name,
        description: subAccount.description || '',
      });
    } else {
      setEditingSubAccount(null);
      setFormData({ code: '', name: '', description: '' });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingSubAccount(null);
    setFormData({ code: '', name: '', description: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAccountId) return;

    if (editingSubAccount) {
      updateSubAccount(editingSubAccount.id, {
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
      });
    } else {
      addSubAccount({
        parentAccountId: selectedAccountId,
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
      });
    }

    handleCloseForm();
  };

  const handleDelete = (subAccount: SubAccount) => {
    // 使用中かチェック
    const isUsed = entries.some(
      (e) => e.debitSubAccountId === subAccount.id || e.creditSubAccountId === subAccount.id
    );

    if (isUsed) {
      alert('この補助科目は仕訳で使用されているため削除できません。');
      return;
    }

    if (confirm(`「${subAccount.name}」を削除しますか？`)) {
      deleteSubAccount(subAccount.id);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">補助科目管理</h1>

      {/* 勘定科目選択 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label className="text-sm font-medium text-gray-700">勘定科目:</label>
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
            <option value="">勘定科目を選択してください</option>
            {accountsWithSubAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name} ({accountTypeLabels[account.type]})
              </option>
            ))}
          </select>
          {selectedAccountId && (
            <button
              onClick={() => handleOpenForm()}
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
              補助科目を追加
            </button>
          )}
        </div>
      </div>

      {/* 補助科目一覧 */}
      {selectedAccountId ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-700">
              {selectedAccount?.name} の補助科目一覧
            </h2>
          </div>

          {filteredSubAccounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              補助科目がありません。「補助科目を追加」ボタンから追加してください。
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    コード
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    補助科目名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    説明
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    残高
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubAccounts.map((subAccount) => {
                  const balance = subAccountBalances.get(subAccount.id) || 0;
                  const isDebitNormal = selectedAccount?.type === 'asset';
                  const displayBalance = isDebitNormal ? balance : -balance;

                  return (
                    <tr key={subAccount.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{subAccount.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {subAccount.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {subAccount.description || '-'}
                      </td>
                      <td className={`px-6 py-4 text-sm text-right font-medium ${displayBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {displayBalance.toLocaleString()}円
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <button
                          onClick={() => handleOpenForm(subAccount)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(subAccount)}
                          className="text-red-600 hover:text-red-800"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr className="font-bold">
                  <td colSpan={3} className="px-6 py-3 text-sm text-gray-700">
                    合計
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-gray-900">
                    {(() => {
                      const total = filteredSubAccounts.reduce((sum, sa) => {
                        const balance = subAccountBalances.get(sa.id) || 0;
                        const isDebitNormal = selectedAccount?.type === 'asset';
                        return sum + (isDebitNormal ? balance : -balance);
                      }, 0);
                      return `${total.toLocaleString()}円`;
                    })()}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          勘定科目を選択すると、その科目に紐づく補助科目を管理できます。
        </div>
      )}

      {/* 説明 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">補助科目について</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>補助科目は勘定科目の内訳を管理するために使用します</li>
          <li>例: 売掛金の取引先別残高、買掛金の仕入先別残高</li>
          <li>仕訳入力時に補助科目を選択することで、取引先別の集計が可能になります</li>
          <li>補助元帳で補助科目別の取引履歴を確認できます</li>
        </ul>
      </div>

      {/* フォームモーダル */}
      {isFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '400px',
            margin: '0 16px',
            padding: '24px',
          }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 className="text-lg font-semibold text-gray-800">
                {editingSubAccount ? '補助科目を編集' : '補助科目を追加'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  コード <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                  maxLength={10}
                  placeholder="例: 001"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  補助科目名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={50}
                  placeholder="例: 株式会社ABC"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  maxLength={200}
                  placeholder="例: 主要取引先"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={handleCloseForm}
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
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
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
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
                >
                  {editingSubAccount ? '更新' : '追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
