// 減価償却方法
export type DepreciationMethod = 'straight_line' | 'declining_balance';

// 固定資産の種類
export type AssetCategory =
  | 'building' // 建物
  | 'building_equipment' // 建物附属設備
  | 'structure' // 構築物
  | 'machinery' // 機械装置
  | 'vehicle' // 車両運搬具
  | 'tools' // 工具器具備品
  | 'software' // ソフトウェア
  | 'other'; // その他

// 固定資産
export interface FixedAsset {
  id: string;
  name: string; // 資産名
  category: AssetCategory; // 資産の種類
  accountId: string; // 紐づく勘定科目ID
  acquisitionDate: string; // 取得日
  acquisitionCost: number; // 取得価額
  usefulLife: number; // 耐用年数
  depreciationMethod: DepreciationMethod; // 償却方法
  residualValue: number; // 残存価額（通常は取得価額の10%または1円）
  memo?: string; // メモ
  isDisposed: boolean; // 除却・売却済みか
  disposalDate?: string; // 除却・売却日
  disposalAmount?: number; // 売却額
  createdAt: string;
  updatedAt: string;
}

// 減価償却計算結果（年度ごと）
export interface DepreciationSchedule {
  fiscalYear: number; // 年度
  yearStartDate: string; // 年度開始日
  yearEndDate: string; // 年度終了日
  beginningBookValue: number; // 期首帳簿価額
  depreciationAmount: number; // 当期償却額
  accumulatedDepreciation: number; // 累計償却額
  endingBookValue: number; // 期末帳簿価額
  months: number; // 当期の償却月数
}

// 資産カテゴリのラベル
export const assetCategoryLabels: Record<AssetCategory, string> = {
  building: '建物',
  building_equipment: '建物附属設備',
  structure: '構築物',
  machinery: '機械装置',
  vehicle: '車両運搬具',
  tools: '工具器具備品',
  software: 'ソフトウェア',
  other: 'その他',
};

// 償却方法のラベル
export const depreciationMethodLabels: Record<DepreciationMethod, string> = {
  straight_line: '定額法',
  declining_balance: '定率法',
};

// 主な耐用年数の目安（参考値）
export const usefulLifeGuide: Record<AssetCategory, number[]> = {
  building: [22, 24, 38, 47, 50], // 木造22年、鉄骨造24-38年、RC47-50年
  building_equipment: [6, 8, 10, 15, 18],
  structure: [10, 15, 20, 30, 45],
  machinery: [4, 5, 7, 10, 12],
  vehicle: [2, 3, 4, 5, 6], // 軽自動車4年、普通自動車6年
  tools: [2, 3, 4, 5, 6, 8, 10, 15],
  software: [3, 5], // 自社利用3年、市場販売目的5年
  other: [2, 3, 5, 8, 10],
};
