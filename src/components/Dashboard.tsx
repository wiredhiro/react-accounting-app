import { useMemo, useState } from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts';
import { useJournalStore } from '../stores/journalStore';
import { useAccountStore } from '../stores/accountStore';
import { useOpeningBalanceStore } from '../stores/openingBalanceStore';
import { DateFilter } from './DateFilter';
import {
  calculateFinancialIndicators,
  evaluateIndicator,
  indicatorLabels,
} from '../utils/financialIndicators';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export function Dashboard() {
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

  // 勘定科目IDから名前を取得
  const getAccountName = (id: string) => {
    return accounts.find((a) => a.id === id)?.name || '不明';
  };

  const getAccountType = (id: string) => {
    return accounts.find((a) => a.id === id)?.type;
  };

  // 月別データの計算
  const monthlyData = useMemo(() => {
    const data = new Map<string, { revenue: number; expense: number }>();

    filteredEntries.forEach((entry) => {
      const month = entry.date.substring(0, 7); // YYYY-MM
      const current = data.get(month) || { revenue: 0, expense: 0 };

      const debitType = getAccountType(entry.debitAccountId);
      const creditType = getAccountType(entry.creditAccountId);

      // 費用が借方にある場合
      if (debitType === 'expense') {
        current.expense += entry.amount;
      }
      // 収益が貸方にある場合
      if (creditType === 'revenue') {
        current.revenue += entry.amount;
      }

      data.set(month, current);
    });

    return Array.from(data.entries())
      .map(([month, values]) => ({
        month,
        収益: values.revenue,
        費用: values.expense,
        利益: values.revenue - values.expense,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredEntries, accounts]);

  // 費用の内訳（円グラフ用）
  const expenseBreakdown = useMemo(() => {
    const data = new Map<string, number>();

    filteredEntries.forEach((entry) => {
      const debitType = getAccountType(entry.debitAccountId);
      if (debitType === 'expense') {
        const name = getAccountName(entry.debitAccountId);
        const current = data.get(name) || 0;
        data.set(name, current + entry.amount);
      }
    });

    return Array.from(data.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEntries, accounts]);

  // 収益の内訳（円グラフ用）
  const revenueBreakdown = useMemo(() => {
    const data = new Map<string, number>();

    filteredEntries.forEach((entry) => {
      const creditType = getAccountType(entry.creditAccountId);
      if (creditType === 'revenue') {
        const name = getAccountName(entry.creditAccountId);
        const current = data.get(name) || 0;
        data.set(name, current + entry.amount);
      }
    });

    return Array.from(data.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEntries, accounts]);

  // 資産残高の推移
  const assetTrend = useMemo(() => {
    const sortedEntries = [...filteredEntries].sort((a, b) => a.date.localeCompare(b.date));
    const balances = new Map<string, number>();
    const result: { date: string; 現金: number; 普通預金: number }[] = [];

    sortedEntries.forEach((entry) => {
      // 借方に資産がある場合は増加
      if (getAccountType(entry.debitAccountId) === 'asset') {
        const current = balances.get(entry.debitAccountId) || 0;
        balances.set(entry.debitAccountId, current + entry.amount);
      }
      // 貸方に資産がある場合は減少
      if (getAccountType(entry.creditAccountId) === 'asset') {
        const current = balances.get(entry.creditAccountId) || 0;
        balances.set(entry.creditAccountId, current - entry.amount);
      }

      const 現金 = balances.get('acc-101') || 0;
      const 普通預金 = balances.get('acc-102') || 0;

      result.push({
        date: entry.date,
        現金,
        普通預金,
      });
    });

    return result;
  }, [filteredEntries, accounts]);

  // サマリー統計
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalExpense = 0;
    const assetBalances = new Map<string, number>();

    filteredEntries.forEach((entry) => {
      const debitType = getAccountType(entry.debitAccountId);
      const creditType = getAccountType(entry.creditAccountId);

      if (debitType === 'expense') totalExpense += entry.amount;
      if (creditType === 'revenue') totalRevenue += entry.amount;

      if (debitType === 'asset') {
        const current = assetBalances.get(entry.debitAccountId) || 0;
        assetBalances.set(entry.debitAccountId, current + entry.amount);
      }
      if (creditType === 'asset') {
        const current = assetBalances.get(entry.creditAccountId) || 0;
        assetBalances.set(entry.creditAccountId, current - entry.amount);
      }
    });

    const totalAssets = Array.from(assetBalances.values()).reduce((sum, v) => sum + v, 0);

    return {
      totalRevenue,
      totalExpense,
      netIncome: totalRevenue - totalExpense,
      totalAssets,
      entryCount: filteredEntries.length,
    };
  }, [filteredEntries, accounts]);

  // 最新の仕訳
  const recentEntries = useMemo(() => {
    return [...filteredEntries]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }, [filteredEntries]);

  // 経営指標の計算（期首残高を考慮）
  const financialIndicators = useMemo(() => {
    return calculateFinancialIndicators(filteredEntries, accounts, openingBalanceSettings.balances);
  }, [filteredEntries, accounts, openingBalanceSettings.balances]);

  if (entries.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード</h1>
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          仕訳がありません。仕訳を入力してください。
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード</h1>

      {/* 日付フィルター */}
      <DateFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">総収益</p>
          <p className="text-2xl font-bold text-blue-600">{summary.totalRevenue.toLocaleString()}円</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">総費用</p>
          <p className="text-2xl font-bold text-red-600">{summary.totalExpense.toLocaleString()}円</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">純利益</p>
          <p className={`text-2xl font-bold ${summary.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {summary.netIncome.toLocaleString()}円
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">資産残高</p>
          <p className="text-2xl font-bold text-purple-600">{summary.totalAssets.toLocaleString()}円</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">仕訳件数</p>
          <p className="text-2xl font-bold text-gray-700">{summary.entryCount}件</p>
        </div>
      </div>

      {/* 月次推移グラフ（メイン） */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">月次推移</h2>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickFormatter={(value) => {
                  const [, month] = value.split('-');
                  return `${month}月`;
                }}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
              />
              <Tooltip
                formatter={(value) => (typeof value === 'number' ? value.toLocaleString() + '円' : value)}
                labelFormatter={(label) => {
                  const [year, month] = label.split('-');
                  return `${year}年${month}月`;
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="収益" fill="#3B82F6" name="売上" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="費用" fill="#EF4444" name="費用" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="利益" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', strokeWidth: 2, r: 5 }} name="利益" />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-8">データがありません</p>
        )}
      </div>

      {/* 経営指標 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">経営指標</h2>

        {/* 損益サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500">売上高</p>
            <p className="text-lg font-bold text-blue-600">{financialIndicators.revenue.toLocaleString()}円</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">売上原価</p>
            <p className="text-lg font-bold text-gray-600">{financialIndicators.costOfSales.toLocaleString()}円</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">売上総利益</p>
            <p className={`text-lg font-bold ${financialIndicators.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {financialIndicators.grossProfit.toLocaleString()}円
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">販管費</p>
            <p className="text-lg font-bold text-gray-600">{financialIndicators.operatingExpenses.toLocaleString()}円</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">営業利益</p>
            <p className={`text-lg font-bold ${financialIndicators.operatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {financialIndicators.operatingProfit.toLocaleString()}円
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">当期純利益</p>
            <p className={`text-lg font-bold ${financialIndicators.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {financialIndicators.netProfit.toLocaleString()}円
            </p>
          </div>
        </div>

        {/* 指標カード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 収益性指標 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-600 border-b pb-1">収益性</h3>
            {(['grossProfitMargin', 'operatingProfitMargin', 'netProfitMargin'] as const).map((key) => {
              const value = financialIndicators[key];
              const evaluation = evaluateIndicator(key, value);
              const label = indicatorLabels[key];
              return (
                <div key={key} className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">{label.name}</span>
                    <span className="text-gray-400 cursor-help" title={label.description}>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${
                    evaluation === 'good' ? 'text-green-600' :
                    evaluation === 'warning' ? 'text-red-600' :
                    'text-gray-700'
                  }`}>
                    {value !== null ? `${value.toFixed(1)}${label.unit}` : '-'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 安全性指標 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-600 border-b pb-1">安全性</h3>
            {(['currentRatio', 'equityRatio', 'debtEquityRatio'] as const).map((key) => {
              const value = financialIndicators[key];
              const evaluation = evaluateIndicator(key, value);
              const label = indicatorLabels[key];
              return (
                <div key={key} className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">{label.name}</span>
                    <span className="text-gray-400 cursor-help" title={label.description}>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${
                    evaluation === 'good' ? 'text-green-600' :
                    evaluation === 'warning' ? 'text-red-600' :
                    'text-gray-700'
                  }`}>
                    {value !== null ? `${value.toFixed(1)}${label.unit}` : '-'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 効率性指標 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-600 border-b pb-1">効率性</h3>
            {(['totalAssetTurnover', 'receivablesTurnover'] as const).map((key) => {
              const value = financialIndicators[key];
              const evaluation = evaluateIndicator(key, value);
              const label = indicatorLabels[key];
              return (
                <div key={key} className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">{label.name}</span>
                    <span className="text-gray-400 cursor-help" title={label.description}>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${
                    evaluation === 'good' ? 'text-green-600' :
                    evaluation === 'warning' ? 'text-red-600' :
                    'text-gray-700'
                  }`}>
                    {value !== null ? `${value.toFixed(2)}${label.unit}` : '-'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* B/Sサマリー */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-600 border-b pb-1">財政状態</h3>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">総資産</span>
              <span className="text-sm font-bold text-gray-700">
                {financialIndicators.totalAssets.toLocaleString()}円
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">総負債</span>
              <span className="text-sm font-bold text-gray-700">
                {financialIndicators.totalLiabilities.toLocaleString()}円
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">純資産</span>
              <span className={`text-sm font-bold ${financialIndicators.equity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {financialIndicators.equity.toLocaleString()}円
              </span>
            </div>
          </div>
        </div>

        {/* 凡例 */}
        <div className="mt-4 pt-3 border-t flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-600 rounded-full"></span> 良好
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-gray-600 rounded-full"></span> 普通
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-600 rounded-full"></span> 要注意
          </span>
          <span className="ml-auto text-gray-400">指標にマウスを置くと説明が表示されます</span>
        </div>
      </div>

      {/* グラフエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* 費用内訳 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">費用内訳</h2>
          {expenseBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={expenseBreakdown}
                  cx="50%"
                  cy="45%"
                  labelLine={true}
                  label={({ name, percent }) => {
                    const percentage = (percent ?? 0) * 100;
                    if (percentage < 5) return null;
                    return `${name} ${percentage.toFixed(0)}%`;
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expenseBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => (typeof value === 'number' ? value.toLocaleString() + '円' : value)} />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => {
                    const item = expenseBreakdown.find(d => d.name === value);
                    const total = expenseBreakdown.reduce((sum, d) => sum + d.value, 0);
                    const percent = item ? ((item.value / total) * 100).toFixed(0) : 0;
                    return `${value} (${percent}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-8">費用データがありません</p>
          )}
        </div>

        {/* 収益内訳 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">収益内訳</h2>
          {revenueBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={revenueBreakdown}
                  cx="50%"
                  cy="45%"
                  labelLine={true}
                  label={({ name, percent }) => {
                    const percentage = (percent ?? 0) * 100;
                    if (percentage < 5) return null;
                    return `${name} ${percentage.toFixed(0)}%`;
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {revenueBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => (typeof value === 'number' ? value.toLocaleString() + '円' : value)} />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => {
                    const item = revenueBreakdown.find(d => d.name === value);
                    const total = revenueBreakdown.reduce((sum, d) => sum + d.value, 0);
                    const percent = item ? ((item.value / total) * 100).toFixed(0) : 0;
                    return `${value} (${percent}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-8">収益データがありません</p>
          )}
        </div>
      </div>

      {/* 資産推移と最新仕訳 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 資産残高推移 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">資産残高推移</h2>
          {assetTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={assetTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => (typeof value === 'number' ? value.toLocaleString() + '円' : value)} />
                <Legend />
                <Line type="monotone" dataKey="現金" stroke="#3B82F6" strokeWidth={2} />
                <Line type="monotone" dataKey="普通預金" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-8">データがありません</p>
          )}
        </div>

        {/* 最新の仕訳 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">最新の仕訳</h2>
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left text-xs text-gray-500">日付</th>
                <th className="py-2 text-left text-xs text-gray-500">摘要</th>
                <th className="py-2 text-right text-xs text-gray-500">金額</th>
              </tr>
            </thead>
            <tbody>
              {recentEntries.map((entry) => (
                <tr key={entry.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 text-sm">{entry.date}</td>
                  <td className="py-2 text-sm">{entry.description}</td>
                  <td className="py-2 text-sm text-right">{entry.amount.toLocaleString()}円</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
