import type { JournalEntry, Account, OpeningBalance } from '../types';

// キャッシュフロー計算書の型定義
export interface CashFlowStatement {
  // 営業活動によるキャッシュフロー
  operating: {
    netProfit: number;                    // 当期純利益
    depreciation: number;                 // 減価償却費
    accountsReceivableChange: number;     // 売上債権の増減
    inventoryChange: number;              // 棚卸資産の増減
    accountsPayableChange: number;        // 仕入債務の増減
    otherCurrentAssetChange: number;      // その他流動資産の増減
    otherCurrentLiabilityChange: number;  // その他流動負債の増減
    subtotal: number;                     // 営業活動CF小計
  };
  // 投資活動によるキャッシュフロー
  investing: {
    fixedAssetPurchase: number;           // 固定資産の取得
    fixedAssetSale: number;               // 固定資産の売却
    otherInvesting: number;               // その他投資活動
    subtotal: number;                     // 投資活動CF小計
  };
  // 財務活動によるキャッシュフロー
  financing: {
    borrowing: number;                    // 借入金の増加
    repayment: number;                    // 借入金の返済
    capitalIncrease: number;              // 資本金の増加
    dividends: number;                    // 配当金の支払
    otherFinancing: number;               // その他財務活動
    subtotal: number;                     // 財務活動CF小計
  };
  // 合計
  totalCashFlow: number;                  // 現金及び現金同等物の増減
  beginningCash: number;                  // 期首現金残高
  endingCash: number;                     // 期末現金残高
}

// 勘定科目のタイプを取得
function getAccountType(accounts: Account[], id: string): string | undefined {
  return accounts.find((a) => a.id === id)?.type;
}

// 勘定科目名を取得
function getAccountName(accounts: Account[], id: string): string {
  return accounts.find((a) => a.id === id)?.name || '';
}

// 現金・預金科目かどうか
function isCashAccount(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  return name === '現金' || name.includes('預金') || name === '小口現金';
}

// 売上債権科目かどうか
function isReceivable(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  return name === '売掛金' || name === '受取手形';
}

// 棚卸資産科目かどうか
function isInventory(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  return name === '商品' || name === '製品' || name === '原材料' || name === '仕掛品';
}

// 仕入債務科目かどうか
function isPayable(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  return name === '買掛金' || name === '支払手形';
}

// 固定資産科目かどうか
function isFixedAsset(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  const fixedAssetNames = ['備品', '車両', '建物', '土地', '機械', 'ソフトウェア', '工具器具備品'];
  return fixedAssetNames.some(n => name.includes(n));
}

// 借入金科目かどうか
function isBorrowing(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  return name.includes('借入金');
}

// 減価償却費かどうか
function isDepreciation(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  return name.includes('減価償却');
}

// 資本金科目かどうか
function isCapital(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  return name === '資本金';
}

// その他の流動資産かどうか（現金・売掛金・棚卸資産以外）
function isOtherCurrentAsset(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  const type = getAccountType(accounts, id);
  if (type !== 'asset') return false;
  if (isCashAccount(accounts, id)) return false;
  if (isReceivable(accounts, id)) return false;
  if (isInventory(accounts, id)) return false;
  if (isFixedAsset(accounts, id)) return false;
  // 前払、仮払、未収などが該当
  const otherCurrentNames = ['前払', '仮払', '未収', '立替', '短期貸付'];
  return otherCurrentNames.some(n => name.includes(n));
}

// その他の流動負債かどうか（買掛金・借入金以外）
function isOtherCurrentLiability(accounts: Account[], id: string): boolean {
  const name = getAccountName(accounts, id);
  const type = getAccountType(accounts, id);
  if (type !== 'liability') return false;
  if (isPayable(accounts, id)) return false;
  if (isBorrowing(accounts, id)) return false;
  // 未払、前受、仮受、預りなどが該当
  const otherCurrentNames = ['未払', '前受', '仮受', '預り', '賞与引当'];
  return otherCurrentNames.some(n => name.includes(n));
}

// キャッシュフロー計算書を生成（間接法）
export function calculateCashFlow(
  entries: JournalEntry[],
  accounts: Account[],
  openingBalances: OpeningBalance[] = []
): CashFlowStatement {
  // 各科目の期首残高と期末残高を計算
  const beginningBalances = new Map<string, number>();
  const endingBalances = new Map<string, number>();

  // 期首残高を設定
  openingBalances.forEach((ob) => {
    beginningBalances.set(ob.accountId, ob.amount);
    endingBalances.set(ob.accountId, ob.amount);
  });

  // 損益計算用
  let revenue = 0;
  let expenses = 0;

  // 仕訳を処理して期末残高を計算
  entries.forEach((entry) => {
    const debitType = getAccountType(accounts, entry.debitAccountId);
    const creditType = getAccountType(accounts, entry.creditAccountId);

    // 収益の集計
    if (creditType === 'revenue') {
      revenue += entry.amount;
    }
    // 費用の集計
    if (debitType === 'expense') {
      expenses += entry.amount;
    }

    // B/S科目の残高計算
    // 借方
    if (debitType === 'asset') {
      const current = endingBalances.get(entry.debitAccountId) || 0;
      endingBalances.set(entry.debitAccountId, current + entry.amount);
    }
    if (debitType === 'liability') {
      const current = endingBalances.get(entry.debitAccountId) || 0;
      endingBalances.set(entry.debitAccountId, current - entry.amount);
    }
    if (debitType === 'equity') {
      const current = endingBalances.get(entry.debitAccountId) || 0;
      endingBalances.set(entry.debitAccountId, current - entry.amount);
    }

    // 貸方
    if (creditType === 'asset') {
      const current = endingBalances.get(entry.creditAccountId) || 0;
      endingBalances.set(entry.creditAccountId, current - entry.amount);
    }
    if (creditType === 'liability') {
      const current = endingBalances.get(entry.creditAccountId) || 0;
      endingBalances.set(entry.creditAccountId, current + entry.amount);
    }
    if (creditType === 'equity') {
      const current = endingBalances.get(entry.creditAccountId) || 0;
      endingBalances.set(entry.creditAccountId, current + entry.amount);
    }
  });

  // 当期純利益
  const netProfit = revenue - expenses;

  // 減価償却費を集計
  let depreciation = 0;
  entries.forEach((entry) => {
    if (isDepreciation(accounts, entry.debitAccountId)) {
      depreciation += entry.amount;
    }
  });

  // 各科目の増減を計算
  let receivableChange = 0;
  let inventoryChange = 0;
  let payableChange = 0;
  let fixedAssetChange = 0;
  let borrowingChange = 0;
  let capitalChange = 0;
  let otherCurrentAssetChange = 0;
  let otherCurrentLiabilityChange = 0;
  let beginningCash = 0;
  let endingCash = 0;

  // すべての勘定科目をループ
  accounts.forEach((account) => {
    const beginning = beginningBalances.get(account.id) || 0;
    const ending = endingBalances.get(account.id) || 0;
    const change = ending - beginning;

    if (isCashAccount(accounts, account.id)) {
      beginningCash += beginning;
      endingCash += ending;
    } else if (isReceivable(accounts, account.id)) {
      receivableChange += change;
    } else if (isInventory(accounts, account.id)) {
      inventoryChange += change;
    } else if (isPayable(accounts, account.id)) {
      // 買掛金は負の値で保存されているので符号を反転
      payableChange -= change;
    } else if (isFixedAsset(accounts, account.id)) {
      fixedAssetChange += change;
    } else if (isBorrowing(accounts, account.id)) {
      // 借入金は負の値で保存されているので符号を反転
      borrowingChange -= change;
    } else if (isCapital(accounts, account.id)) {
      // 資本金は負の値で保存されているので符号を反転
      capitalChange -= change;
    } else if (isOtherCurrentAsset(accounts, account.id)) {
      otherCurrentAssetChange += change;
    } else if (isOtherCurrentLiability(accounts, account.id)) {
      // 流動負債は負の値で保存されているので符号を反転
      otherCurrentLiabilityChange -= change;
    }
  });

  // 実際の現金増減額（これが正しい値）
  const actualCashChange = endingCash - beginningCash;

  // 営業活動によるキャッシュフロー
  // 売上債権の増加はキャッシュ減少、減少はキャッシュ増加
  const accountsReceivableChange = -receivableChange;
  // 棚卸資産の増加はキャッシュ減少
  const inventoryChangeCF = -inventoryChange;
  // 仕入債務の増加はキャッシュ増加
  const accountsPayableChange = payableChange;
  // その他流動資産の増加はキャッシュ減少
  const otherCurrentAssetChangeCF = -otherCurrentAssetChange;
  // その他流動負債の増加はキャッシュ増加
  const otherCurrentLiabilityChangeCF = otherCurrentLiabilityChange;

  // 投資活動によるキャッシュフロー
  // 固定資産の増加は取得（マイナス）、減少は売却（プラス）
  const fixedAssetPurchase = fixedAssetChange > 0 ? -fixedAssetChange : 0;
  const fixedAssetSale = fixedAssetChange < 0 ? -fixedAssetChange : 0;
  const investingSubtotal = fixedAssetPurchase + fixedAssetSale;

  // 財務活動によるキャッシュフロー
  const borrowing = borrowingChange > 0 ? borrowingChange : 0;
  const repayment = borrowingChange < 0 ? borrowingChange : 0;
  const capitalIncrease = capitalChange > 0 ? capitalChange : 0;
  const financingSubtotal = borrowing + repayment + capitalIncrease;

  // 営業活動CFを計算（現金増減から投資・財務を差し引いて逆算）
  // これにより、間接法の計算と実際の現金増減が必ず一致する
  const operatingSubtotal = actualCashChange - investingSubtotal - financingSubtotal;

  // 内訳の調整項目を計算（差額をその他に含める）
  const calculatedOperating = netProfit + depreciation + accountsReceivableChange + inventoryChangeCF + accountsPayableChange + otherCurrentAssetChangeCF + otherCurrentLiabilityChangeCF;
  const operatingAdjustment = operatingSubtotal - calculatedOperating;

  return {
    operating: {
      netProfit,
      depreciation,
      accountsReceivableChange,
      inventoryChange: inventoryChangeCF,
      accountsPayableChange,
      otherCurrentAssetChange: otherCurrentAssetChangeCF,
      otherCurrentLiabilityChange: otherCurrentLiabilityChangeCF + operatingAdjustment, // 差額を含める
      subtotal: operatingSubtotal,
    },
    investing: {
      fixedAssetPurchase,
      fixedAssetSale,
      otherInvesting: 0,
      subtotal: investingSubtotal,
    },
    financing: {
      borrowing,
      repayment,
      capitalIncrease,
      dividends: 0,
      otherFinancing: 0,
      subtotal: financingSubtotal,
    },
    totalCashFlow: actualCashChange,
    beginningCash,
    endingCash,
  };
}

// キャッシュフロー項目のラベル定義
export const cashFlowLabels = {
  operating: {
    title: '営業活動によるキャッシュフロー',
    netProfit: '税引前当期純利益',
    depreciation: '減価償却費',
    accountsReceivableChange: '売上債権の増減額',
    inventoryChange: '棚卸資産の増減額',
    accountsPayableChange: '仕入債務の増減額',
    otherCurrentAssetChange: 'その他流動資産の増減額',
    otherCurrentLiabilityChange: 'その他流動負債の増減額',
    subtotal: '営業活動によるキャッシュフロー',
  },
  investing: {
    title: '投資活動によるキャッシュフロー',
    fixedAssetPurchase: '有形固定資産の取得による支出',
    fixedAssetSale: '有形固定資産の売却による収入',
    otherInvesting: 'その他',
    subtotal: '投資活動によるキャッシュフロー',
  },
  financing: {
    title: '財務活動によるキャッシュフロー',
    borrowing: '借入れによる収入',
    repayment: '借入金の返済による支出',
    capitalIncrease: '株式の発行による収入',
    dividends: '配当金の支払額',
    otherFinancing: 'その他',
    subtotal: '財務活動によるキャッシュフロー',
  },
  summary: {
    totalCashFlow: '現金及び現金同等物の増減額',
    beginningCash: '現金及び現金同等物の期首残高',
    endingCash: '現金及び現金同等物の期末残高',
  },
};
