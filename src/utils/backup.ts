import type { JournalEntry, Account } from '../types';

export interface BackupData {
  version: string;
  createdAt: string;
  journals: JournalEntry[];
  accounts: Account[];
}

// バックアップデータを作成
export function createBackup(journals: JournalEntry[], accounts: Account[]): BackupData {
  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    journals,
    accounts,
  };
}

// バックアップをJSONファイルとしてダウンロード
export function downloadBackup(journals: JournalEntry[], accounts: Account[]): void {
  const backup = createBackup(journals, accounts);
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().split('T')[0];
  a.download = `会計データ_バックアップ_${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// バックアップファイルを解析
export function parseBackup(content: string): { data: BackupData | null; error: string | null } {
  try {
    const data = JSON.parse(content);

    // バリデーション
    if (!data.version || !data.journals || !data.accounts) {
      return { data: null, error: 'バックアップファイルの形式が不正です' };
    }

    if (!Array.isArray(data.journals)) {
      return { data: null, error: '仕訳データが不正です' };
    }

    if (!Array.isArray(data.accounts)) {
      return { data: null, error: '勘定科目データが不正です' };
    }

    // 基本的な構造チェック
    for (const journal of data.journals) {
      if (!journal.id || !journal.date || !journal.debitAccountId || !journal.creditAccountId || typeof journal.amount !== 'number') {
        return { data: null, error: '仕訳データの形式が不正です' };
      }
    }

    for (const account of data.accounts) {
      if (!account.id || !account.code || !account.name || !account.type) {
        return { data: null, error: '勘定科目データの形式が不正です' };
      }
    }

    return { data: data as BackupData, error: null };
  } catch {
    return { data: null, error: 'JSONの解析に失敗しました' };
  }
}
