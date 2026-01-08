import { useState, useMemo } from 'react';
import { useJournalStore } from '../stores/journalStore';
import { useAccountStore } from '../stores/accountStore';
import { useOpeningBalanceStore } from '../stores/openingBalanceStore';
import {
  calculateYearEndClosing,
  calculateFiscalYearEnd,
  calculateNextFiscalYearStart,
} from '../utils/yearEndClosing';

export function YearEndClosing() {
  const { entries } = useJournalStore();
  const { accounts } = useAccountStore();
  const { settings: openingBalanceSettings, setBalances, setFiscalYearStart } = useOpeningBalanceStore();

  const [step, setStep] = useState<'preview' | 'confirm' | 'complete'>('preview');

  // 会計年度の計算
  const fiscalYearStart = openingBalanceSettings.fiscalYearStart || new Date().getFullYear() + '-04-01';
  const fiscalYearEnd = calculateFiscalYearEnd(fiscalYearStart);
  const nextFiscalYearStart = calculateNextFiscalYearStart(fiscalYearStart);

  // 年度締め計算結果
  const closingResult = useMemo(() => {
    return calculateYearEndClosing(
      entries,
      accounts,
      openingBalanceSettings.balances,
      fiscalYearStart,
      fiscalYearEnd
    );
  }, [entries, accounts, openingBalanceSettings.balances, fiscalYearStart, fiscalYearEnd]);

  // 金額のフォーマット
  const formatAmount = (amount: number, showSign = false) => {
    const absAmount = Math.abs(amount).toLocaleString();
    if (showSign) {
      return amount >= 0 ? `+${absAmount}` : `-${absAmount}`;
    }
    return amount < 0 ? `△${absAmount}` : absAmount;
  };

  // 繰越処理を実行
  const handleCarryForward = () => {
    // 次期の期首残高を設定
    setBalances(closingResult.carryForwardBalances);
    // 次期の会計年度開始日を設定
    setFiscalYearStart(nextFiscalYearStart);

    setStep('complete');
  };

  // 科目タイプ別にグループ化
  const groupedBalances = useMemo(() => {
    const groups: Record<string, typeof closingResult.closingBalances> = {
      asset: [],
      liability: [],
      equity: [],
    };

    closingResult.closingBalances.forEach((item) => {
      if (groups[item.accountType]) {
        groups[item.accountType].push(item);
      }
    });

    return groups;
  }, [closingResult.closingBalances]);

  // 合計計算
  const totals = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    let equity = 0;

    closingResult.closingBalances.forEach((item) => {
      if (item.accountType === 'asset') {
        assets += item.balance;
      } else if (item.accountType === 'liability') {
        // 負債は内部的に負の値なので符号反転
        liabilities -= item.balance;
      } else if (item.accountType === 'equity') {
        // 純資産も内部的に負の値なので符号反転
        equity -= item.balance;
      }
    });

    return { assets, liabilities, equity };
  }, [closingResult.closingBalances]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">年度締め・繰越処理</h1>

      {/* 会計年度情報 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">会計年度</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">当期会計年度</p>
            <p className="text-lg font-bold text-gray-700">
              {fiscalYearStart} 〜 {fiscalYearEnd}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-600">次期会計年度開始日</p>
            <p className="text-lg font-bold text-blue-700">{nextFiscalYearStart}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">当期仕訳件数</p>
            <p className="text-lg font-bold text-gray-700">
              {entries.filter((e) => e.date >= fiscalYearStart && e.date <= fiscalYearEnd).length}件
            </p>
          </div>
        </div>
      </div>

      {step === 'preview' && (
        <>
          {/* 損益サマリー */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">当期損益</h2>
            <div className={`text-center p-6 rounded-lg ${closingResult.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-sm text-gray-600 mb-2">当期純利益</p>
              <p className={`text-3xl font-bold ${closingResult.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatAmount(closingResult.netProfit)}円
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {closingResult.netProfit >= 0
                  ? 'この金額が繰越利益剰余金に加算されます'
                  : 'この金額が繰越利益剰余金から減算されます'}
              </p>
            </div>
          </div>

          {/* 期末残高一覧 */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">期末残高一覧（B/S科目）</h2>

            {closingResult.closingBalances.length === 0 ? (
              <p className="text-gray-500 text-center py-8">期末残高がありません</p>
            ) : (
              <div className="space-y-6">
                {/* 資産 */}
                {groupedBalances.asset.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-blue-600 mb-2 border-b pb-1">資産</h3>
                    <table className="w-full">
                      <tbody>
                        {groupedBalances.asset.map((item) => (
                          <tr key={item.accountId} className="border-b border-gray-100">
                            <td className="py-2 text-gray-700">{item.accountName}</td>
                            <td className="py-2 text-right text-gray-700">
                              {formatAmount(item.balance)}円
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 font-semibold">
                          <td className="py-2 text-blue-700">資産合計</td>
                          <td className="py-2 text-right text-blue-700">{totals.assets.toLocaleString()}円</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 負債 */}
                {groupedBalances.liability.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-orange-600 mb-2 border-b pb-1">負債</h3>
                    <table className="w-full">
                      <tbody>
                        {groupedBalances.liability.map((item) => (
                          <tr key={item.accountId} className="border-b border-gray-100">
                            <td className="py-2 text-gray-700">{item.accountName}</td>
                            <td className="py-2 text-right text-gray-700">
                              {formatAmount(-item.balance)}円
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-orange-50 font-semibold">
                          <td className="py-2 text-orange-700">負債合計</td>
                          <td className="py-2 text-right text-orange-700">{totals.liabilities.toLocaleString()}円</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 純資産 */}
                {groupedBalances.equity.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-green-600 mb-2 border-b pb-1">純資産</h3>
                    <table className="w-full">
                      <tbody>
                        {groupedBalances.equity.map((item) => (
                          <tr key={item.accountId} className="border-b border-gray-100">
                            <td className="py-2 text-gray-700">
                              {item.accountName}
                              {(item.accountName === '繰越利益剰余金' || item.accountName === '利益剰余金') && (
                                <span className="text-xs text-gray-500 ml-2">（当期純利益{closingResult.netProfit >= 0 ? '加算' : '減算'}後）</span>
                              )}
                            </td>
                            <td className="py-2 text-right text-gray-700">
                              {formatAmount(-item.balance)}円
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-green-50 font-semibold">
                          <td className="py-2 text-green-700">純資産合計</td>
                          <td className="py-2 text-right text-green-700">
                            {totals.equity.toLocaleString()}円
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 貸借バランス確認 */}
                <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">資産合計</span>
                    <span className="font-bold">{totals.assets.toLocaleString()}円</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600">負債・純資産合計</span>
                    <span className="font-bold">
                      {(totals.liabilities + totals.equity).toLocaleString()}円
                    </span>
                  </div>
                  {totals.assets === totals.liabilities + totals.equity ? (
                    <p className="text-green-600 text-center mt-2 text-sm">貸借一致</p>
                  ) : (
                    <p className="text-red-600 text-center mt-2 text-sm">
                      差額: {(totals.assets - totals.liabilities - totals.equity).toLocaleString()}円
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 繰越処理ボタン */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">次期への繰越</h2>
            <p className="text-gray-600 mb-4">
              期末残高を次期の期首残高として設定します。
              この操作を行うと、現在の期首残高設定が上書きされます。
            </p>
            <div className="bg-yellow-50 rounded-lg p-4 mb-4">
              <p className="text-yellow-700 text-sm">
                <strong>注意:</strong> 繰越処理は年度末に1回だけ実行してください。
                実行前に必ずバックアップを取ることをお勧めします。
              </p>
            </div>
            <button
              onClick={() => setStep('confirm')}
              disabled={closingResult.closingBalances.length === 0}
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '6px',
                border: 'none',
                cursor: closingResult.closingBalances.length === 0 ? 'not-allowed' : 'pointer',
                backgroundColor: closingResult.closingBalances.length === 0 ? '#9ca3af' : '#3b82f6',
                color: '#ffffff',
              }}
              onMouseEnter={(e) => {
                if (closingResult.closingBalances.length > 0) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (closingResult.closingBalances.length > 0) {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }
              }}
            >
              繰越処理を開始
            </button>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-red-600 mb-4">繰越処理の確認</h2>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 font-medium mb-2">以下の処理が実行されます：</p>
            <ul className="text-red-600 text-sm space-y-1 list-disc list-inside">
              <li>当期純利益（{formatAmount(closingResult.netProfit)}円）を繰越利益剰余金に加算</li>
              <li>期末残高（{closingResult.carryForwardBalances.length}科目）を次期の期首残高として設定</li>
              <li>会計年度開始日を {nextFiscalYearStart} に更新</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 max-h-64 overflow-y-auto">
            <p className="text-sm font-medium text-gray-700 mb-2">次期繰越残高:</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 text-gray-600">科目</th>
                  <th className="text-right py-1 text-gray-600">残高</th>
                </tr>
              </thead>
              <tbody>
                {closingResult.carryForwardBalances.map((balance) => {
                  const account = accounts.find((a) => a.id === balance.accountId);
                  const type = account?.type || '';
                  const displayAmount = type === 'asset' ? balance.amount : -balance.amount;
                  return (
                    <tr key={balance.accountId} className="border-b border-gray-100">
                      <td className="py-1 text-gray-700">{account?.name || '不明'}</td>
                      <td className="py-1 text-right text-gray-700">
                        {displayAmount.toLocaleString()}円
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleCarryForward}
              style={{
                flex: 1,
                padding: '12px 16px',
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
              繰越処理を実行
            </button>
            <button
              onClick={() => setStep('preview')}
              style={{
                flex: 1,
                padding: '12px 16px',
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
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8">
            <div className="text-green-500 mb-4 flex justify-center">
              <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">繰越処理が完了しました</h2>
            <p className="text-gray-600 mb-6">
              次期の会計年度は {nextFiscalYearStart} から開始されます。
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-green-700 font-medium mb-2">処理内容:</p>
              <ul className="text-green-600 text-sm space-y-1 list-disc list-inside">
                <li>期首残高を {closingResult.carryForwardBalances.length} 科目に設定</li>
                <li>会計年度開始日を {nextFiscalYearStart} に更新</li>
              </ul>
            </div>
            <button
              onClick={() => setStep('preview')}
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
              確認画面に戻る
            </button>
          </div>
        </div>
      )}

      {/* 注記 */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <h3 className="font-semibold mb-2">年度締め・繰越処理について</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li>当期の損益（収益−費用）を計算し、繰越利益剰余金に振り替えます</li>
          <li>B/S科目（資産・負債・純資産）の期末残高を、次期の期首残高として設定します</li>
          <li>P/L科目（収益・費用）は翌期に繰り越されません（ゼロからスタート）</li>
          <li>この処理は仕訳データには影響しません（期首残高設定のみ更新）</li>
        </ul>
      </div>
    </div>
  );
}
