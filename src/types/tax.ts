// 消費税の型定義

// 消費税率
export type TaxRate = 0 | 8 | 10;

// 税区分
export type TaxType =
  | 'taxable_sales'      // 課税売上
  | 'taxable_purchase'   // 課税仕入
  | 'tax_exempt'         // 非課税
  | 'out_of_scope'       // 不課税（対象外）
  | 'tax_free_export';   // 免税（輸出）

export const taxTypeLabels: Record<TaxType, string> = {
  taxable_sales: '課税売上',
  taxable_purchase: '課税仕入',
  tax_exempt: '非課税',
  out_of_scope: '不課税',
  tax_free_export: '免税',
};

export const taxRateLabels: Record<TaxRate, string> = {
  0: '0%（非課税・不課税）',
  8: '8%（軽減税率）',
  10: '10%（標準税率）',
};

// 税込/税抜の区分
export type TaxIncluded = 'included' | 'excluded';

export const taxIncludedLabels: Record<TaxIncluded, string> = {
  included: '税込',
  excluded: '税抜',
};

// 消費税計算結果
export interface TaxCalculation {
  baseAmount: number;      // 税抜金額
  taxAmount: number;       // 消費税額
  totalAmount: number;     // 税込金額
  taxRate: TaxRate;        // 適用税率
}

// 消費税集計データ
export interface TaxSummary {
  // 売上に係る消費税
  salesTax10: number;      // 10%対象売上の消費税
  salesTax8: number;       // 8%対象売上の消費税
  salesTaxTotal: number;   // 売上消費税合計

  // 仕入に係る消費税
  purchaseTax10: number;   // 10%対象仕入の消費税
  purchaseTax8: number;    // 8%対象仕入の消費税
  purchaseTaxTotal: number; // 仕入消費税合計

  // 納付税額
  netTax: number;          // 差引消費税額

  // 課税売上・仕入の金額（税抜）
  taxableSales10: number;
  taxableSales8: number;
  taxablePurchase10: number;
  taxablePurchase8: number;
}
