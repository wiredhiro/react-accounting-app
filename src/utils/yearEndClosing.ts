import type { JournalEntry, Account, OpeningBalance } from '../types';

// 年度締め結果の型定義
export interface YearEndClosingResult {
  // 期末残高（B/S科目）
  closingBalances: {
    accountId: string;
    accountName: string;
    accountType: string;
    balance: number;
  }[];
  // 当期純利益
  netProfit: number;
  // 繰越利益剰余金への振替仕訳
  closingEntry: {
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    description: string;
  } | null;
  // 次期繰越用の期首残高
  carryForwardBalances: OpeningBalance[];
}

// 勘定科目のタイプを取得
function getAccountType(accounts: Account[], id: string): string | undefined {
  return accounts.find((a) => a.id === id)?.type;
}


// B/S科目かどうか
function isBalanceSheetAccount(type: string): boolean {
  return type === 'asset' || type === 'liability' || type === 'equity';
}


// 繰越利益剰余金の勘定科目を探す
function findRetainedEarningsAccount(accounts: Account[]): Account | undefined {
  return accounts.find((a) =>
    a.name === '繰越利益剰余金' ||
    a.name === '利益剰余金' ||
    a.name === '繰越利益'
  );
}

// 年度締め処理を実行
export function calculateYearEndClosing(
  entries: JournalEntry[],
  accounts: Account[],
  openingBalances: OpeningBalance[],
  fiscalYearStart: string,
  fiscalYearEnd: string
): YearEndClosingResult {
  // 期間内の仕訳をフィルター
  const periodEntries = entries.filter((entry) => {
    return entry.date >= fiscalYearStart && entry.date <= fiscalYearEnd;
  });

  // 各科目の残高を計算
  const balances = new Map<string, number>();

  // 期首残高を初期値として設定
  openingBalances.forEach((ob) => {
    balances.set(ob.accountId, ob.amount);
  });

  // 収益・費用の集計
  let totalRevenue = 0;
  let totalExpense = 0;

  // 仕訳を処理
  periodEntries.forEach((entry) => {
    const debitType = getAccountType(accounts, entry.debitAccountId);
    const creditType = getAccountType(accounts, entry.creditAccountId);

    // 収益の集計
    if (creditType === 'revenue') {
      totalRevenue += entry.amount;
    }
    if (debitType === 'revenue') {
      totalRevenue -= entry.amount; // 収益の取消
    }

    // 費用の集計
    if (debitType === 'expense') {
      totalExpense += entry.amount;
    }
    if (creditType === 'expense') {
      totalExpense -= entry.amount; // 費用の取消
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

  // 当期純利益
  const netProfit = totalRevenue - totalExpense;

  // 繰越利益剰余金への振替仕訳を作成
  const retainedEarningsAccount = findRetainedEarningsAccount(accounts);
  let closingEntry: YearEndClosingResult['closingEntry'] = null;

  if (retainedEarningsAccount && netProfit !== 0) {
    if (netProfit > 0) {
      // 利益の場合：損益 → 繰越利益剰余金
      closingEntry = {
        debitAccountId: '', // 損益勘定（実際には使用しない）
        creditAccountId: retainedEarningsAccount.id,
        amount: netProfit,
        description: `当期純利益の振替（${fiscalYearEnd}）`,
      };
    } else {
      // 損失の場合：繰越利益剰余金 → 損益
      closingEntry = {
        debitAccountId: retainedEarningsAccount.id,
        creditAccountId: '', // 損益勘定（実際には使用しない）
        amount: Math.abs(netProfit),
        description: `当期純損失の振替（${fiscalYearEnd}）`,
      };
    }

    // 繰越利益剰余金の残高を更新（純資産は貸方が正なので、利益は減算）
    const currentRetainedEarnings = balances.get(retainedEarningsAccount.id) || 0;
    balances.set(retainedEarningsAccount.id, currentRetainedEarnings - netProfit);
  }

  // 期末残高の一覧を作成（B/S科目のみ）- 繰越利益剰余金更新後
  const closingBalances: YearEndClosingResult['closingBalances'] = [];
  accounts.forEach((account) => {
    if (isBalanceSheetAccount(account.type)) {
      const balance = balances.get(account.id) || 0;
      if (balance !== 0) {
        closingBalances.push({
          accountId: account.id,
          accountName: account.name,
          accountType: account.type,
          balance,
        });
      }
    }
  });

  // 次期繰越用の期首残高を作成
  const carryForwardBalances: OpeningBalance[] = [];
  accounts.forEach((account) => {
    if (isBalanceSheetAccount(account.type)) {
      const balance = balances.get(account.id) || 0;
      if (balance !== 0) {
        carryForwardBalances.push({
          accountId: account.id,
          amount: balance,
        });
      }
    }
  });

  return {
    closingBalances,
    netProfit,
    closingEntry,
    carryForwardBalances,
  };
}

// ローカル日付をYYYY-MM-DD形式でフォーマット
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 会計年度の終了日を計算（開始日の1年後の前日）
export function calculateFiscalYearEnd(fiscalYearStart: string): string {
  // 開始日をパース（YYYY-MM-DD形式）
  const [year, month, day] = fiscalYearStart.split('-').map(Number);
  // 1年後の同日の前日 = 終了日
  // 例: 2026-01-01開始 → 2027-01-01の前日 = 2026-12-31
  const endDate = new Date(year + 1, month - 1, day - 1);
  return formatLocalDate(endDate);
}

// 次の会計年度開始日を計算
export function calculateNextFiscalYearStart(fiscalYearStart: string): string {
  // 開始日をパース（YYYY-MM-DD形式）
  const [year, month, day] = fiscalYearStart.split('-').map(Number);
  // 1年後の同日
  const nextStart = new Date(year + 1, month - 1, day);
  return formatLocalDate(nextStart);
}

// 勘定科目タイプの日本語表示
export function getAccountTypeLabel(type: string): string {
  switch (type) {
    case 'asset':
      return '資産';
    case 'liability':
      return '負債';
    case 'equity':
      return '純資産';
    case 'revenue':
      return '収益';
    case 'expense':
      return '費用';
    default:
      return type;
  }
}
