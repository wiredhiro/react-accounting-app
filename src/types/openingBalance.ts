// 期首残高の型定義
export interface OpeningBalance {
  accountId: string;
  amount: number; // 正の値=借方残高、負の値=貸方残高（資産・費用は正、負債・純資産・収益は負で保存）
}

export interface OpeningBalanceSettings {
  fiscalYearStart: string; // 会計年度開始日 (YYYY-MM-DD)
  balances: OpeningBalance[];
  updatedAt: string;
}
