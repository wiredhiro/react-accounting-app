import type { TaxRate, TaxCalculation, TaxIncluded } from '../types';

/**
 * 消費税を計算する
 * @param amount 金額
 * @param taxRate 税率（0, 8, 10）
 * @param taxIncluded 税込/税抜
 * @returns 税計算結果
 */
export function calculateTax(
  amount: number,
  taxRate: TaxRate,
  taxIncluded: TaxIncluded
): TaxCalculation {
  if (taxRate === 0) {
    return {
      baseAmount: amount,
      taxAmount: 0,
      totalAmount: amount,
      taxRate: 0,
    };
  }

  const rate = taxRate / 100;

  if (taxIncluded === 'included') {
    // 税込金額から税抜金額と税額を計算
    const baseAmount = Math.floor(amount / (1 + rate));
    const taxAmount = amount - baseAmount;
    return {
      baseAmount,
      taxAmount,
      totalAmount: amount,
      taxRate,
    };
  } else {
    // 税抜金額から税額と税込金額を計算
    const taxAmount = Math.floor(amount * rate);
    const totalAmount = amount + taxAmount;
    return {
      baseAmount: amount,
      taxAmount,
      totalAmount,
      taxRate,
    };
  }
}

/**
 * 税込金額から税抜金額を計算
 */
export function extractBaseAmount(totalAmount: number, taxRate: TaxRate): number {
  if (taxRate === 0) return totalAmount;
  return Math.floor(totalAmount / (1 + taxRate / 100));
}

/**
 * 税抜金額から税込金額を計算
 */
export function calculateTotalAmount(baseAmount: number, taxRate: TaxRate): number {
  if (taxRate === 0) return baseAmount;
  return baseAmount + Math.floor(baseAmount * (taxRate / 100));
}

/**
 * 税額を計算（税抜金額から）
 */
export function calculateTaxAmount(baseAmount: number, taxRate: TaxRate): number {
  if (taxRate === 0) return 0;
  return Math.floor(baseAmount * (taxRate / 100));
}
