import type { JournalEntry, Account, OpeningBalance } from '../types';

// 経営指標の型定義
export interface FinancialIndicators {
  // 収益性指標
  grossProfitMargin: number | null;      // 売上総利益率（粗利率）
  operatingProfitMargin: number | null;  // 営業利益率
  netProfitMargin: number | null;        // 当期純利益率

  // 安全性指標
  currentRatio: number | null;           // 流動比率
  equityRatio: number | null;            // 自己資本比率
  debtEquityRatio: number | null;        // 負債資本比率

  // 効率性指標
  totalAssetTurnover: number | null;     // 総資産回転率
  receivablesTurnover: number | null;    // 売上債権回転率

  // 元データ
  revenue: number;                       // 売上高
  costOfSales: number;                   // 売上原価（仕入）
  grossProfit: number;                   // 売上総利益
  operatingExpenses: number;             // 営業費用（販管費）
  operatingProfit: number;               // 営業利益
  netProfit: number;                     // 当期純利益
  totalAssets: number;                   // 総資産
  totalLiabilities: number;              // 総負債
  equity: number;                        // 純資産
  currentAssets: number;                 // 流動資産
  currentLiabilities: number;            // 流動負債
  receivables: number;                   // 売上債権（売掛金）
}

// 経営指標のラベル定義
export const indicatorLabels: Record<string, { name: string; description: string; unit: string; goodDirection: 'high' | 'low' | 'moderate' }> = {
  grossProfitMargin: {
    name: '売上総利益率',
    description: '売上高に対する粗利の割合。商品力・価格競争力を示す',
    unit: '%',
    goodDirection: 'high',
  },
  operatingProfitMargin: {
    name: '営業利益率',
    description: '売上高に対する営業利益の割合。本業の収益力を示す',
    unit: '%',
    goodDirection: 'high',
  },
  netProfitMargin: {
    name: '当期純利益率',
    description: '売上高に対する最終利益の割合。総合的な収益力を示す',
    unit: '%',
    goodDirection: 'high',
  },
  currentRatio: {
    name: '流動比率',
    description: '短期的な支払能力。200%以上が理想',
    unit: '%',
    goodDirection: 'high',
  },
  equityRatio: {
    name: '自己資本比率',
    description: '総資産に占める自己資本の割合。財務の健全性を示す',
    unit: '%',
    goodDirection: 'high',
  },
  debtEquityRatio: {
    name: '負債資本比率',
    description: '自己資本に対する負債の割合。低いほど安全',
    unit: '%',
    goodDirection: 'low',
  },
  totalAssetTurnover: {
    name: '総資産回転率',
    description: '資産をどれだけ効率的に売上に結びつけているか',
    unit: '回',
    goodDirection: 'high',
  },
  receivablesTurnover: {
    name: '売上債権回転率',
    description: '売掛金の回収効率。高いほど回収が早い',
    unit: '回',
    goodDirection: 'high',
  },
};

// 勘定科目のタイプを取得
function getAccountType(accounts: Account[], id: string): string | undefined {
  return accounts.find((a) => a.id === id)?.type;
}

// 勘定科目名を取得
function getAccountName(accounts: Account[], id: string): string {
  return accounts.find((a) => a.id === id)?.name || '';
}

// 売上原価科目かどうか
function isCostOfSales(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  return name === '仕入' || name.includes('売上原価');
}

// 流動資産かどうか（現金、預金、売掛金、商品など）
function isCurrentAsset(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  const currentAssetNames = ['現金', '普通預金', '当座預金', '売掛金', '商品', '受取手形', '有価証券', '前払'];
  return currentAssetNames.some(n => name.includes(n));
}

// 流動負債かどうか（買掛金、未払金、短期借入金など）
function isCurrentLiability(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  const currentLiabilityNames = ['買掛金', '未払', '前受', '短期借入', '支払手形', '仮受'];
  return currentLiabilityNames.some(n => name.includes(n));
}

// 売掛金かどうか
function isReceivable(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  return name === '売掛金' || name === '受取手形';
}

// 経営指標を計算
export function calculateFinancialIndicators(
  entries: JournalEntry[],
  accounts: Account[],
  openingBalances: OpeningBalance[] = []
): FinancialIndicators {
  // 各科目の残高を計算（期首残高から開始）
  const balances = new Map<string, number>();

  // 期首残高を初期値として設定
  openingBalances.forEach((ob) => {
    balances.set(ob.accountId, ob.amount);
  });

  let revenue = 0;
  let costOfSales = 0;
  let operatingExpenses = 0;

  entries.forEach((entry) => {
    const debitType = getAccountType(accounts, entry.debitAccountId);
    const creditType = getAccountType(accounts, entry.creditAccountId);

    // 収益（売上）の集計
    if (creditType === 'revenue') {
      revenue += entry.amount;
    }

    // 費用の集計
    if (debitType === 'expense') {
      if (isCostOfSales(accounts, entry.debitAccountId)) {
        costOfSales += entry.amount;
      } else {
        operatingExpenses += entry.amount;
      }
    }

    // B/S科目の残高計算
    // 借方
    if (debitType === 'asset') {
      const current = balances.get(entry.debitAccountId) || 0;
      balances.set(entry.debitAccountId, current + entry.amount);
    }
    if (debitType === 'liability') {
      const current = balances.get(entry.debitAccountId) || 0;
      balances.set(entry.debitAccountId, current - entry.amount);
    }
    if (debitType === 'equity') {
      const current = balances.get(entry.debitAccountId) || 0;
      balances.set(entry.debitAccountId, current - entry.amount);
    }

    // 貸方
    if (creditType === 'asset') {
      const current = balances.get(entry.creditAccountId) || 0;
      balances.set(entry.creditAccountId, current - entry.amount);
    }
    if (creditType === 'liability') {
      const current = balances.get(entry.creditAccountId) || 0;
      balances.set(entry.creditAccountId, current + entry.amount);
    }
    if (creditType === 'equity') {
      const current = balances.get(entry.creditAccountId) || 0;
      balances.set(entry.creditAccountId, current + entry.amount);
    }
  });

  // B/S科目の集計
  // 負債・純資産は貸方残高（内部的には負の値）だが、表示用に符号を反転
  let totalAssets = 0;
  let totalLiabilities = 0;
  let equity = 0;
  let currentAssets = 0;
  let currentLiabilities = 0;
  let receivables = 0;

  balances.forEach((balance, accountId) => {
    const type = getAccountType(accounts, accountId);

    if (type === 'asset') {
      totalAssets += balance;
      if (isCurrentAsset(accounts, accountId)) {
        currentAssets += balance;
      }
      if (isReceivable(accounts, accountId)) {
        receivables += balance;
      }
    }
    if (type === 'liability') {
      // 負債は貸方残高（負の値）なので、符号を反転して正の値にする
      // 借方残高（正の値）の場合はそのまま負の値として表示
      totalLiabilities -= balance;
      if (isCurrentLiability(accounts, accountId)) {
        currentLiabilities -= balance;
      }
    }
    if (type === 'equity') {
      // 純資産は貸方残高（負の値）なので、符号を反転して正の値にする
      // 借方残高（正の値=欠損）の場合はマイナス表示
      equity -= balance;
    }
  });

  // 利益計算
  const grossProfit = revenue - costOfSales;
  const operatingProfit = grossProfit - operatingExpenses;
  const netProfit = operatingProfit; // 簡易版（営業外損益・特別損益は考慮しない）

  // 経営指標の計算
  const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : null;
  const operatingProfitMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : null;
  const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : null;
  const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities) * 100 : null;
  const equityRatio = totalAssets > 0 ? (equity / totalAssets) * 100 : null;
  const debtEquityRatio = equity > 0 ? (totalLiabilities / equity) * 100 : null;
  const totalAssetTurnover = totalAssets > 0 ? revenue / totalAssets : null;
  const receivablesTurnover = receivables > 0 ? revenue / receivables : null;

  return {
    // 収益性指標
    grossProfitMargin,
    operatingProfitMargin,
    netProfitMargin,
    // 安全性指標
    currentRatio,
    equityRatio,
    debtEquityRatio,
    // 効率性指標
    totalAssetTurnover,
    receivablesTurnover,
    // 元データ
    revenue,
    costOfSales,
    grossProfit,
    operatingExpenses,
    operatingProfit,
    netProfit,
    totalAssets,
    totalLiabilities,
    equity,
    currentAssets,
    currentLiabilities,
    receivables,
  };
}

// 指標の評価（良い/普通/要注意）
export function evaluateIndicator(key: string, value: number | null): 'good' | 'normal' | 'warning' | null {
  if (value === null) return null;

  switch (key) {
    case 'grossProfitMargin':
      return value >= 30 ? 'good' : value >= 15 ? 'normal' : 'warning';
    case 'operatingProfitMargin':
      return value >= 10 ? 'good' : value >= 5 ? 'normal' : 'warning';
    case 'netProfitMargin':
      return value >= 5 ? 'good' : value >= 2 ? 'normal' : 'warning';
    case 'currentRatio':
      return value >= 200 ? 'good' : value >= 100 ? 'normal' : 'warning';
    case 'equityRatio':
      return value >= 40 ? 'good' : value >= 20 ? 'normal' : 'warning';
    case 'debtEquityRatio':
      return value <= 100 ? 'good' : value <= 200 ? 'normal' : 'warning';
    case 'totalAssetTurnover':
      return value >= 1.5 ? 'good' : value >= 0.8 ? 'normal' : 'warning';
    case 'receivablesTurnover':
      return value >= 12 ? 'good' : value >= 6 ? 'normal' : 'warning';
    default:
      return 'normal';
  }
}

// 業種別の目安（参考用）
export const industryBenchmarks: Record<string, Record<string, { low: number; medium: number; high: number }>> = {
  retail: {
    grossProfitMargin: { low: 20, medium: 30, high: 40 },
    operatingProfitMargin: { low: 2, medium: 5, high: 10 },
  },
  manufacturing: {
    grossProfitMargin: { low: 15, medium: 25, high: 35 },
    operatingProfitMargin: { low: 3, medium: 7, high: 12 },
  },
  service: {
    grossProfitMargin: { low: 40, medium: 55, high: 70 },
    operatingProfitMargin: { low: 5, medium: 10, high: 20 },
  },
};
