import { useState, useMemo } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useOpeningBalanceStore } from '../stores/openingBalanceStore';
import { accountTypeLabels, accountTypeOrder } from '../types';
import type { AccountType } from '../types';

export function OpeningBalanceSettings() {
  const { accounts } = useAccountStore();
  const { settings, setBalance, clearBalances } = useOpeningBalanceStore();
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 勘定科目を分類別にグループ化（B/S科目のみ）
  const groupedAccounts = useMemo(() => {
    const bsTypes: AccountType[] = ['asset', 'liability', 'equity'];
    const groups: Record<AccountType, typeof accounts> = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      expense: [],
    };

    accounts.forEach((account) => {
      if (bsTypes.includes(account.type)) {
        groups[account.type].push(account);
      }
    });

    // コードでソート
    Object.keys(groups).forEach((type) => {
      groups[type as AccountType].sort((a, b) => a.code.localeCompare(b.code));
    });

    return groups;
  }, [accounts]);

  // 現在の残高を取得するヘルパー
  const getBalanceValue = (accountId: string): string => {
    const balance = settings.balances.find((b) => b.accountId === accountId);
    if (!balance || balance.amount === 0) return '';
    return Math.abs(balance.amount).toString();
  };

  // 残高変更ハンドラ
  const handleBalanceChange = (accountId: string, value: string, accountType: AccountType) => {
    const numValue = parseFloat(value) || 0;
    // 資産は借方残高(正)、負債・純資産は貸方残高(負)として保存
    const isDebitNormal = accountType === 'asset';
    const amount = isDebitNormal ? numValue : -numValue;
    setBalance(accountId, amount);
  };

  // 合計計算
  const totals = useMemo(() => {
    let debitTotal = 0;
    let creditTotal = 0;

    settings.balances.forEach((balance) => {
      if (balance.amount > 0) {
        debitTotal += balance.amount;
      } else {
        creditTotal += Math.abs(balance.amount);
      }
    });

    return { debitTotal, creditTotal, isBalanced: debitTotal === creditTotal };
  }, [settings.balances]);

  // 保存完了メッセージ
  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">期首残高設定</h1>


      {/* 成功メッセージ */}
      {saveSuccess && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md">
          期首残高を保存しました
        </div>
      )}

      {/* 貸借バランス確認 */}
      <div style={{ marginBottom: '24px', paddingTop: '12px', paddingBottom: '12px', borderBottom: '1px solid #000000' }}>
        <div className="flex items-center justify-between">
          <div className="flex gap-8">
            <div>
              <span className="text-sm text-gray-600">借方合計: </span>
              <span className="font-bold text-gray-800">{totals.debitTotal.toLocaleString()}円</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">貸方合計: </span>
              <span className="font-bold text-gray-800">{totals.creditTotal.toLocaleString()}円</span>
            </div>
          </div>
          <div>
            {totals.isBalanced ? (
              <span className="text-green-600 font-medium">貸借一致</span>
            ) : (
              <span className="text-amber-700 font-bold flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                差額: {Math.abs(totals.debitTotal - totals.creditTotal).toLocaleString()}円
              </span>
            )}
          </div>
        </div>
        {!totals.isBalanced && (
          <p className="mt-2 text-sm text-amber-700">
            貸借が一致していません。期首残高は借方と貸方の合計が等しくなる必要があります。
          </p>
        )}
      </div>

      {/* 期首残高入力 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">コード</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">勘定科目</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">借方残高</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">貸方残高</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accountTypeOrder
              .filter((type) => ['asset', 'liability', 'equity'].includes(type))
              .map((type) => {
                const typeAccounts = groupedAccounts[type];
                if (typeAccounts.length === 0) return null;

                const isDebitNormal = type === 'asset';

                return (
                  <tbody key={type}>
                    <tr className="bg-gray-100">
                      <td colSpan={4} className="px-6 py-2 text-sm font-semibold text-gray-700">
                        【{accountTypeLabels[type]}】
                      </td>
                    </tr>
                    {typeAccounts.map((account) => {
                      const balanceValue = getBalanceValue(account.id);
                      return (
                        <tr key={account.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm text-gray-900">{account.code}</td>
                          <td className="px-6 py-3 text-sm text-gray-900">{account.name}</td>
                          <td className="px-6 py-3 text-right">
                            {isDebitNormal ? (
                              <input
                                type="number"
                                value={balanceValue}
                                onChange={(e) => handleBalanceChange(account.id, e.target.value, type)}
                                placeholder="0"
                                min="0"
                                className="w-32 px-3 py-1 text-right border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {!isDebitNormal ? (
                              <input
                                type="number"
                                value={balanceValue}
                                onChange={(e) => handleBalanceChange(account.id, e.target.value, type)}
                                placeholder="0"
                                min="0"
                                className="w-32 px-3 py-1 text-right border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr className="font-bold">
              <td colSpan={2} className="px-6 py-3 text-sm text-gray-700">合計</td>
              <td className="px-6 py-3 text-sm text-gray-900 text-right">
                {totals.debitTotal.toLocaleString()}円
              </td>
              <td className="px-6 py-3 text-sm text-gray-900 text-right">
                {totals.creditTotal.toLocaleString()}円
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* アクションボタン */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '10px 24px',
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
          保存完了
        </button>
        <button
          onClick={clearBalances}
          style={{
            padding: '10px 24px',
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
          全てクリア
        </button>
      </div>

      {/* 説明 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">期首残高について</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>前期末の残高を期首残高として入力してください</li>
          <li>資産科目は借方、負債・純資産科目は貸方に入力します</li>
          <li>借方合計と貸方合計が一致するように入力してください</li>
          <li>期首残高は試算表・財務諸表の計算に反映されます</li>
        </ul>
      </div>
    </div>
  );
}
