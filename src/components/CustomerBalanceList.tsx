import { useMemo, useState } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useSubAccountStore } from '../stores/subAccountStore';
import { useJournalStore } from '../stores/journalStore';
import { downloadCSV } from '../utils/csv';

type BalanceType = 'receivable' | 'payable';

interface CustomerBalance {
  subAccountId: string;
  subAccountCode: string;
  subAccountName: string;
  parentAccountId: string;
  parentAccountName: string;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  currentBalance: number;
  lastTransactionDate: string | null;
  transactionCount: number;
}

export function CustomerBalanceList() {
  const { accounts } = useAccountStore();
  const { subAccounts } = useSubAccountStore();
  const { entries } = useJournalStore();

  const [balanceType, setBalanceType] = useState<BalanceType>('receivable');
  const [asOfDate, setAsOfDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [showZeroBalance, setShowZeroBalance] = useState(false);

  // 売掛金・買掛金の勘定科目を取得
  const targetAccounts = useMemo(() => {
    if (balanceType === 'receivable') {
      // 売掛金、受取手形など
      return accounts.filter((a) =>
        a.name.includes('売掛') ||
        a.name.includes('受取手形') ||
        a.name.includes('未収')
      );
    } else {
      // 買掛金、支払手形など
      return accounts.filter((a) =>
        a.name.includes('買掛') ||
        a.name.includes('支払手形') ||
        a.name.includes('未払')
      );
    }
  }, [accounts, balanceType]);

  // 得意先別・仕入先別の残高を計算
  const customerBalances = useMemo(() => {
    const balanceMap = new Map<string, CustomerBalance>();

    // 対象勘定科目の補助科目を初期化
    targetAccounts.forEach((account) => {
      const accountSubAccounts = subAccounts.filter(
        (sa) => sa.parentAccountId === account.id
      );

      accountSubAccounts.forEach((sa) => {
        // 期首残高を取得（補助科目単位では現在未対応のため0）
        const openingBalance = 0;

        balanceMap.set(sa.id, {
          subAccountId: sa.id,
          subAccountCode: sa.code,
          subAccountName: sa.name,
          parentAccountId: account.id,
          parentAccountName: account.name,
          openingBalance,
          debitTotal: 0,
          creditTotal: 0,
          currentBalance: openingBalance,
          lastTransactionDate: null,
          transactionCount: 0,
        });
      });
    });

    // 仕訳から取引を集計
    const filteredEntries = entries.filter((e) => e.date <= asOfDate);

    filteredEntries.forEach((entry) => {
      // 借方の補助科目をチェック
      if (entry.debitSubAccountId) {
        const balance = balanceMap.get(entry.debitSubAccountId);
        if (balance) {
          balance.debitTotal += entry.amount;
          balance.transactionCount += 1;
          if (!balance.lastTransactionDate || entry.date > balance.lastTransactionDate) {
            balance.lastTransactionDate = entry.date;
          }
        }
      }

      // 貸方の補助科目をチェック
      if (entry.creditSubAccountId) {
        const balance = balanceMap.get(entry.creditSubAccountId);
        if (balance) {
          balance.creditTotal += entry.amount;
          balance.transactionCount += 1;
          if (!balance.lastTransactionDate || entry.date > balance.lastTransactionDate) {
            balance.lastTransactionDate = entry.date;
          }
        }
      }
    });

    // 残高を計算
    balanceMap.forEach((balance) => {
      const account = accounts.find((a) => a.id === balance.parentAccountId);
      const isDebitNormal = account?.type === 'asset';

      if (isDebitNormal) {
        balance.currentBalance =
          balance.openingBalance + balance.debitTotal - balance.creditTotal;
      } else {
        balance.currentBalance =
          balance.openingBalance + balance.creditTotal - balance.debitTotal;
      }
    });

    // 配列に変換してソート
    let result = Array.from(balanceMap.values());

    // 残高ゼロを除外
    if (!showZeroBalance) {
      result = result.filter((b) => b.currentBalance !== 0 || b.transactionCount > 0);
    }

    // 残高の大きい順にソート
    result.sort((a, b) => Math.abs(b.currentBalance) - Math.abs(a.currentBalance));

    return result;
  }, [targetAccounts, subAccounts, entries, accounts, asOfDate, showZeroBalance]);

  // 合計
  const totals = useMemo(() => {
    return customerBalances.reduce(
      (acc, b) => ({
        openingBalance: acc.openingBalance + b.openingBalance,
        debitTotal: acc.debitTotal + b.debitTotal,
        creditTotal: acc.creditTotal + b.creditTotal,
        currentBalance: acc.currentBalance + b.currentBalance,
        transactionCount: acc.transactionCount + b.transactionCount,
      }),
      {
        openingBalance: 0,
        debitTotal: 0,
        creditTotal: 0,
        currentBalance: 0,
        transactionCount: 0,
      }
    );
  }, [customerBalances]);

  // CSVエクスポート
  const handleExport = () => {
    const typeLabel = balanceType === 'receivable' ? '売掛金' : '買掛金';
    let csv = '\uFEFF'; // BOM for Excel
    csv += `${typeLabel}残高一覧\n`;
    csv += `${asOfDate.replace(/-/g, '/')}現在\n\n`;
    csv += `コード,${balanceType === 'receivable' ? '得意先' : '仕入先'}名,勘定科目,期首残高,借方合計,貸方合計,現在残高,最終取引日,取引件数\n`;

    customerBalances.forEach((b) => {
      csv += `${b.subAccountCode},"${b.subAccountName}","${b.parentAccountName}",${b.openingBalance},${b.debitTotal},${b.creditTotal},${b.currentBalance},${b.lastTransactionDate || ''},${b.transactionCount}\n`;
    });

    csv += `\n合計,,,${totals.openingBalance},${totals.debitTotal},${totals.creditTotal},${totals.currentBalance},,${totals.transactionCount}\n`;

    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `${typeLabel}残高一覧_${asOfDate}_${today}.csv`);
  };

  return (
    <div className="p-6">
      <div className="print-header">
        <h1>{balanceType === 'receivable' ? '売掛金' : '買掛金'}残高一覧</h1>
        <p>{asOfDate.replace(/-/g, '/')}現在 | 出力日: {new Date().toLocaleDateString('ja-JP')}</p>
      </div>

      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-800">
          {balanceType === 'receivable' ? '得意先別' : '仕入先別'}残高一覧
        </h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {customerBalances.length > 0 && (
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              区分
            </label>
            <select
              value={balanceType}
              onChange={(e) => setBalanceType(e.target.value as BalanceType)}
              style={{
                width: '220px',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
              }}
            >
              <option value="receivable">売掛金（得意先別）</option>
              <option value="payable">買掛金（仕入先別）</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ～日現在
            </label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={{
                width: '160px',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '4px' }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showZeroBalance}
                onChange={(e) => setShowZeroBalance(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">残高ゼロも表示</span>
            </label>
          </div>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 no-print">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">
            {balanceType === 'receivable' ? '得意先' : '仕入先'}数
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {customerBalances.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">残高合計</div>
          <div className={`text-2xl font-bold ${totals.currentBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            ¥{totals.currentBalance.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">
            {balanceType === 'receivable' ? '売上（借方）' : '仕入（借方）'}合計
          </div>
          <div className="text-2xl font-bold text-gray-800">
            ¥{totals.debitTotal.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">
            {balanceType === 'receivable' ? '回収（貸方）' : '支払（貸方）'}合計
          </div>
          <div className="text-2xl font-bold text-gray-800">
            ¥{totals.creditTotal.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 残高一覧テーブル */}
      {targetAccounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {balanceType === 'receivable'
            ? '売掛金の勘定科目がありません。勘定科目マスタで「売掛金」を追加してください。'
            : '買掛金の勘定科目がありません。勘定科目マスタで「買掛金」を追加してください。'}
        </div>
      ) : customerBalances.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <p className="mb-2">
            {balanceType === 'receivable' ? '得意先' : '仕入先'}の補助科目がありません。
          </p>
          <p className="text-sm">
            補助科目マスタで{balanceType === 'receivable' ? '売掛金' : '買掛金'}
            に対して{balanceType === 'receivable' ? '得意先' : '仕入先'}を登録してください。
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  コード
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {balanceType === 'receivable' ? '得意先' : '仕入先'}名
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  勘定科目
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  借方合計
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  貸方合計
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  現在残高
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  最終取引日
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  取引件数
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customerBalances.map((balance) => (
                <tr key={balance.subAccountId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {balance.subAccountCode}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {balance.subAccountName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {balance.parentAccountName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {balance.debitTotal > 0
                      ? `¥${balance.debitTotal.toLocaleString()}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {balance.creditTotal > 0
                      ? `¥${balance.creditTotal.toLocaleString()}`
                      : '-'}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm text-right font-bold ${
                      balance.currentBalance > 0
                        ? 'text-blue-600'
                        : balance.currentBalance < 0
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    ¥{balance.currentBalance.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">
                    {balance.lastTransactionDate || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center">
                    {balance.transactionCount}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr className="font-bold">
                <td colSpan={3} className="px-4 py-3 text-sm text-gray-700">
                  合計（{customerBalances.length}件）
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  ¥{totals.debitTotal.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  ¥{totals.creditTotal.toLocaleString()}
                </td>
                <td
                  className={`px-4 py-3 text-sm text-right ${
                    totals.currentBalance >= 0 ? 'text-blue-600' : 'text-red-600'
                  }`}
                >
                  ¥{totals.currentBalance.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 text-center">
                  -
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 text-center">
                  {totals.transactionCount}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 説明 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg no-print">
        <h3 className="font-semibold text-blue-800 mb-2">
          {balanceType === 'receivable' ? '得意先別' : '仕入先別'}残高一覧について
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            ・{balanceType === 'receivable' ? '売掛金' : '買掛金'}
            に登録された補助科目（{balanceType === 'receivable' ? '得意先' : '仕入先'}
            ）ごとの残高を表示します
          </li>
          <li>・日付を指定することで、過去の任意時点の残高を確認できます</li>
          <li>・残高は借方合計と貸方合計の差額で計算されます</li>
          {balanceType === 'receivable' ? (
            <li>・売掛金残高が大きい得意先は、回収管理に注意が必要です</li>
          ) : (
            <li>・買掛金残高が大きい仕入先は、支払予定の確認が重要です</li>
          )}
        </ul>
      </div>
    </div>
  );
}
