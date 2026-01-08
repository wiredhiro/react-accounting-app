import type { JournalEntry } from '../types';

// CSVをダウンロードする共通関数
export function downloadCSV(content: string, filename: string) {
  const bom = '\uFEFF'; // Excel用BOM
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 仕訳データをCSV形式に変換
export function journalToCSV(
  entries: JournalEntry[],
  getAccountName: (id: string) => string
): string {
  const headers = ['日付', '借方科目', '貸方科目', '金額', '摘要'];
  const rows = entries.map((entry) => [
    entry.date,
    getAccountName(entry.debitAccountId),
    getAccountName(entry.creditAccountId),
    entry.amount.toString(),
    `"${entry.description.replace(/"/g, '""')}"`, // ダブルクォートをエスケープ
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

// CSVから仕訳データをパース
export function parseJournalCSV(
  csvContent: string,
  getAccountId: (name: string) => string | undefined
): { entries: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>[]; errors: string[] } {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());
  const entries: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const errors: string[] = [];

  // ヘッダー行をスキップ
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = parseCSVLine(line);

    if (columns.length < 5) {
      errors.push(`行${i + 1}: 列数が不足しています`);
      continue;
    }

    const [date, debitName, creditName, amountStr, description] = columns;

    // 日付のバリデーション
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`行${i + 1}: 日付の形式が不正です（YYYY-MM-DD形式で入力してください）`);
      continue;
    }

    // 勘定科目の検索
    const debitAccountId = getAccountId(debitName);
    const creditAccountId = getAccountId(creditName);

    if (!debitAccountId) {
      errors.push(`行${i + 1}: 借方科目「${debitName}」が見つかりません`);
      continue;
    }
    if (!creditAccountId) {
      errors.push(`行${i + 1}: 貸方科目「${creditName}」が見つかりません`);
      continue;
    }

    // 金額のバリデーション
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      errors.push(`行${i + 1}: 金額が不正です`);
      continue;
    }

    entries.push({
      date,
      debitAccountId,
      creditAccountId,
      amount,
      description: description || '',
    });
  }

  return { entries, errors };
}

// CSV行をパース（ダブルクォート対応）
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}

// 試算表データをCSV形式に変換
export function trialBalanceToCSV(
  data: {
    code: string;
    name: string;
    type: string;
    debitTotal: number;
    creditTotal: number;
    debitBalance: number;
    creditBalance: number;
  }[]
): string {
  const headers = ['コード', '科目名', '分類', '借方合計', '貸方合計', '借方残高', '貸方残高'];
  const rows = data.map((row) => [
    row.code,
    row.name,
    row.type,
    row.debitTotal.toString(),
    row.creditTotal.toString(),
    row.debitBalance.toString(),
    row.creditBalance.toString(),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

// 損益計算書データをCSV形式に変換
export function plToCSV(
  revenue: { name: string; balance: number }[],
  expense: { name: string; balance: number }[],
  netIncome: number
): string {
  const lines: string[] = [];

  lines.push('損益計算書');
  lines.push('');
  lines.push('【収益】');
  revenue.forEach((item) => {
    lines.push(`${item.name},${item.balance}`);
  });
  lines.push(`収益合計,${revenue.reduce((sum, r) => sum + r.balance, 0)}`);
  lines.push('');
  lines.push('【費用】');
  expense.forEach((item) => {
    lines.push(`${item.name},${item.balance}`);
  });
  lines.push(`費用合計,${expense.reduce((sum, e) => sum + e.balance, 0)}`);
  lines.push('');
  lines.push(`当期純利益,${netIncome}`);

  return lines.join('\n');
}

// 貸借対照表データをCSV形式に変換
export function bsToCSV(
  assets: { name: string; balance: number }[],
  liabilities: { name: string; balance: number }[],
  equity: { name: string; balance: number }[],
  netIncome: number
): string {
  const lines: string[] = [];

  lines.push('貸借対照表');
  lines.push('');
  lines.push('【資産の部】');
  assets.forEach((item) => {
    lines.push(`${item.name},${item.balance}`);
  });
  lines.push(`資産合計,${assets.reduce((sum, a) => sum + a.balance, 0)}`);
  lines.push('');
  lines.push('【負債の部】');
  liabilities.forEach((item) => {
    lines.push(`${item.name},${item.balance}`);
  });
  lines.push(`負債合計,${liabilities.reduce((sum, l) => sum + l.balance, 0)}`);
  lines.push('');
  lines.push('【純資産の部】');
  equity.forEach((item) => {
    lines.push(`${item.name},${item.balance}`);
  });
  if (netIncome !== 0) {
    lines.push(`当期純利益,${netIncome}`);
  }
  const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0) + netIncome;
  lines.push(`純資産合計,${totalEquity}`);

  return lines.join('\n');
}
