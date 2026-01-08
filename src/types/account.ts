export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export const accountTypeLabels: Record<AccountType, string> = {
  asset: '資産',
  liability: '負債',
  equity: '純資産',
  revenue: '収益',
  expense: '費用',
};

export const accountTypeOrder: AccountType[] = [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
];
