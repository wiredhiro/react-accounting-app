import type { TaxRate, TaxType, TaxIncluded } from './tax';

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  debitAccountId: string;
  creditAccountId: string;
  debitSubAccountId?: string; // 借方補助科目ID
  creditSubAccountId?: string; // 貸方補助科目ID
  amount: number;
  // 消費税関連フィールド
  taxType?: TaxType;           // 税区分
  taxRate?: TaxRate;           // 税率（0, 8, 10）
  taxIncluded?: TaxIncluded;   // 税込/税抜
  taxAmount?: number;          // 消費税額
  createdAt: string;
  updatedAt: string;
}

export interface JournalTemplate {
  id: string;
  name: string;
  description: string;
  debitAccountId: string;
  creditAccountId: string;
  defaultAmount?: number;
  createdAt: string;
}
