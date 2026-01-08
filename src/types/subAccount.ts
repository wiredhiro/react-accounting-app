// 補助科目の型定義

export interface SubAccount {
  id: string;
  parentAccountId: string; // 親勘定科目ID
  code: string; // 補助科目コード
  name: string; // 補助科目名（取引先名など）
  description?: string; // 説明
  createdAt: string;
  updatedAt: string;
}

// 補助科目の用途タイプ
export type SubAccountUsage = 'customer' | 'vendor' | 'project' | 'department' | 'other';

export const subAccountUsageLabels: Record<SubAccountUsage, string> = {
  customer: '得意先',
  vendor: '仕入先',
  project: 'プロジェクト',
  department: '部門',
  other: 'その他',
};
