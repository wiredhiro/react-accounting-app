import { v4 as uuidv4 } from 'uuid';
import type { JournalEntry, Account } from '../types';
import type { FixedAsset } from '../types/fixedAsset';
import { calculateDepreciationSchedule } from './depreciation';

// 減価償却仕訳の生成結果
export interface DepreciationJournalResult {
  entries: JournalEntry[];
  totalAmount: number;
  assetCount: number;
  errors: string[];
}

// 勘定科目を名前で検索
function findAccountByName(accounts: Account[], name: string): Account | undefined {
  return accounts.find((a) => a.name === name);
}

// 減価償却累計額の勘定科目を取得
function getAccumulatedDepreciationAccount(accounts: Account[]): Account | undefined {
  return findAccountByName(accounts, '減価償却累計額');
}

// 減価償却費の勘定科目を取得
function getDepreciationExpenseAccount(accounts: Account[]): Account | undefined {
  return findAccountByName(accounts, '減価償却費');
}

// 当期の減価償却仕訳を生成
export function generateDepreciationJournals(
  assets: FixedAsset[],
  accounts: Account[],
  fiscalYearStart: string,
  fiscalYear: number
): DepreciationJournalResult {
  const entries: JournalEntry[] = [];
  const errors: string[] = [];
  let totalAmount = 0;
  let assetCount = 0;

  // 必要な勘定科目を取得
  const depreciationExpenseAccount = getDepreciationExpenseAccount(accounts);
  const accumulatedDepreciationAccount = getAccumulatedDepreciationAccount(accounts);

  if (!depreciationExpenseAccount) {
    errors.push('勘定科目「減価償却費」が見つかりません。勘定科目マスタに追加してください。');
    return { entries, totalAmount, assetCount, errors };
  }

  if (!accumulatedDepreciationAccount) {
    errors.push('勘定科目「減価償却累計額」が見つかりません。勘定科目マスタに追加してください。');
    return { entries, totalAmount, assetCount, errors };
  }

  // アクティブな資産について減価償却仕訳を生成
  const activeAssets = assets.filter((asset) => !asset.isDisposed);

  activeAssets.forEach((asset) => {
    // 償却スケジュールを計算
    const schedules = calculateDepreciationSchedule(asset, fiscalYearStart, 50);

    // 当期のスケジュールを取得
    const currentSchedule = schedules.find((s) => s.fiscalYear === fiscalYear);

    if (!currentSchedule || currentSchedule.depreciationAmount === 0) {
      return; // 当期の償却がない場合はスキップ
    }

    const now = new Date().toISOString();

    // 減価償却仕訳を作成
    // 借方: 減価償却費、貸方: 減価償却累計額
    const entry: JournalEntry = {
      id: uuidv4(),
      date: currentSchedule.yearEndDate, // 期末日で計上
      description: `${asset.name} 減価償却費`,
      debitAccountId: depreciationExpenseAccount.id,
      creditAccountId: accumulatedDepreciationAccount.id,
      amount: currentSchedule.depreciationAmount,
      createdAt: now,
      updatedAt: now,
    };

    entries.push(entry);
    totalAmount += currentSchedule.depreciationAmount;
    assetCount++;
  });

  return { entries, totalAmount, assetCount, errors };
}

// 既存の減価償却仕訳を確認（重複防止用）
export function hasDepreciationJournals(
  journalEntries: JournalEntry[],
  accounts: Account[],
  fiscalYearStart: string,
  fiscalYearEnd: string
): boolean {
  const depreciationExpenseAccount = getDepreciationExpenseAccount(accounts);
  if (!depreciationExpenseAccount) return false;

  // 期間内に減価償却費の仕訳があるか確認
  return journalEntries.some((entry) => {
    return (
      entry.debitAccountId === depreciationExpenseAccount.id &&
      entry.date >= fiscalYearStart &&
      entry.date <= fiscalYearEnd &&
      entry.description.includes('減価償却費')
    );
  });
}

// 既存の減価償却仕訳を取得
export function getDepreciationJournals(
  journalEntries: JournalEntry[],
  accounts: Account[],
  fiscalYearStart: string,
  fiscalYearEnd: string
): JournalEntry[] {
  const depreciationExpenseAccount = getDepreciationExpenseAccount(accounts);
  if (!depreciationExpenseAccount) return [];

  return journalEntries.filter((entry) => {
    return (
      entry.debitAccountId === depreciationExpenseAccount.id &&
      entry.date >= fiscalYearStart &&
      entry.date <= fiscalYearEnd &&
      entry.description.includes('減価償却費')
    );
  });
}

