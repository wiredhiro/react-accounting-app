import type { JournalEntry, Account, SubAccount, TaxType, TaxRate, TaxIncluded, OpeningBalance } from '../types';
import { v4 as uuidv4 } from 'uuid';

// サンプル補助科目のテンプレート
interface SubAccountTemplate {
  parentAccountName: string;
  code: string;
  name: string;
  description?: string;
}

// サンプル仕訳のテンプレート（勘定科目名で指定）
interface SampleTemplate {
  description: string;
  debitAccountName: string;
  creditAccountName: string;
  debitSubAccountName?: string; // 借方補助科目名（オプション）
  creditSubAccountName?: string; // 貸方補助科目名（オプション）
  minAmount: number;
  maxAmount: number;
  frequency: number; // 月あたりの発生頻度（1=毎月1回、0.5=2ヶ月に1回など）
  // 消費税関連
  taxType?: TaxType;
  taxRate?: TaxRate;
  taxIncluded?: TaxIncluded;
}

// サンプル補助科目データ
const subAccountTemplates: SubAccountTemplate[] = [
  // 売掛金の取引先
  { parentAccountName: '売掛金', code: '001', name: '株式会社ABC商事', description: '主要得意先' },
  { parentAccountName: '売掛金', code: '002', name: '有限会社山田製作所', description: '製造業' },
  { parentAccountName: '売掛金', code: '003', name: 'DEFシステム株式会社', description: 'IT関連' },
  // 買掛金の仕入先
  { parentAccountName: '買掛金', code: '001', name: '東京物産株式会社', description: '主要仕入先' },
  { parentAccountName: '買掛金', code: '002', name: '大阪資材センター', description: '資材仕入' },
  { parentAccountName: '買掛金', code: '003', name: '名古屋パーツ工業', description: '部品仕入' },
  // 普通預金の銀行
  { parentAccountName: '普通預金', code: '001', name: '三菱UFJ銀行 本店', description: 'メインバンク' },
  { parentAccountName: '普通預金', code: '002', name: 'みずほ銀行 渋谷支店', description: 'サブバンク' },
];

const sampleTemplates: SampleTemplate[] = [
  // 売上関連（補助科目付き）- 課税売上10%
  { description: 'ABC商事への売上', debitAccountName: '売掛金', creditAccountName: '売上', debitSubAccountName: '株式会社ABC商事', minAmount: 100000, maxAmount: 500000, frequency: 2, taxType: 'taxable_sales', taxRate: 10, taxIncluded: 'included' },
  { description: '山田製作所への売上', debitAccountName: '売掛金', creditAccountName: '売上', debitSubAccountName: '有限会社山田製作所', minAmount: 50000, maxAmount: 200000, frequency: 1, taxType: 'taxable_sales', taxRate: 10, taxIncluded: 'included' },
  { description: 'DEFシステムへの売上', debitAccountName: '売掛金', creditAccountName: '売上', debitSubAccountName: 'DEFシステム株式会社', minAmount: 80000, maxAmount: 300000, frequency: 1.5, taxType: 'taxable_sales', taxRate: 10, taxIncluded: 'included' },
  // 売掛金回収（補助科目付き）- 消費税なし（債権回収は不課税）
  // 売上とほぼ同じ頻度・金額で回収（売掛金残高が安定するように）
  { description: 'ABC商事より入金', debitAccountName: '普通預金', creditAccountName: '売掛金', debitSubAccountName: '三菱UFJ銀行 本店', creditSubAccountName: '株式会社ABC商事', minAmount: 100000, maxAmount: 500000, frequency: 2 },
  { description: '山田製作所より入金', debitAccountName: '普通預金', creditAccountName: '売掛金', debitSubAccountName: '三菱UFJ銀行 本店', creditSubAccountName: '有限会社山田製作所', minAmount: 50000, maxAmount: 200000, frequency: 1 },
  { description: 'DEFシステムより入金', debitAccountName: '普通預金', creditAccountName: '売掛金', debitSubAccountName: 'みずほ銀行 渋谷支店', creditSubAccountName: 'DEFシステム株式会社', minAmount: 80000, maxAmount: 300000, frequency: 1.5 },
  // 仕入関連（補助科目付き）- 課税仕入10%
  { description: '東京物産より仕入', debitAccountName: '仕入', creditAccountName: '買掛金', creditSubAccountName: '東京物産株式会社', minAmount: 50000, maxAmount: 200000, frequency: 2, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
  { description: '大阪資材より仕入', debitAccountName: '仕入', creditAccountName: '買掛金', creditSubAccountName: '大阪資材センター', minAmount: 30000, maxAmount: 100000, frequency: 1, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
  { description: '名古屋パーツより仕入', debitAccountName: '仕入', creditAccountName: '買掛金', creditSubAccountName: '名古屋パーツ工業', minAmount: 20000, maxAmount: 80000, frequency: 0.5, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
  // 買掛金支払（補助科目付き）- 消費税なし（債務支払は不課税）
  // 仕入とほぼ同じ頻度・金額で支払（買掛金残高が安定するように）
  { description: '東京物産へ支払', debitAccountName: '買掛金', creditAccountName: '普通預金', debitSubAccountName: '東京物産株式会社', creditSubAccountName: '三菱UFJ銀行 本店', minAmount: 50000, maxAmount: 200000, frequency: 2 },
  { description: '大阪資材へ支払', debitAccountName: '買掛金', creditAccountName: '普通預金', debitSubAccountName: '大阪資材センター', creditSubAccountName: '三菱UFJ銀行 本店', minAmount: 30000, maxAmount: 100000, frequency: 1 },
  { description: '名古屋パーツへ支払', debitAccountName: '買掛金', creditAccountName: '普通預金', debitSubAccountName: '名古屋パーツ工業', creditSubAccountName: 'みずほ銀行 渋谷支店', minAmount: 20000, maxAmount: 80000, frequency: 0.5 },
  // 現金売上 - 課税売上10%
  { description: '現金売上', debitAccountName: '現金', creditAccountName: '売上', minAmount: 10000, maxAmount: 80000, frequency: 3, taxType: 'taxable_sales', taxRate: 10, taxIncluded: 'included' },
  // 軽減税率8%の売上（食料品販売など）
  { description: '食料品売上（軽減税率）', debitAccountName: '現金', creditAccountName: '売上', minAmount: 5000, maxAmount: 30000, frequency: 1.5, taxType: 'taxable_sales', taxRate: 8, taxIncluded: 'included' },
  // 経費関連（銀行口座指定）
  { description: '給料支払', debitAccountName: '給料', creditAccountName: '普通預金', creditSubAccountName: '三菱UFJ銀行 本店', minAmount: 200000, maxAmount: 350000, frequency: 1 }, // 給料は不課税
  { description: '電気代', debitAccountName: '水道光熱費', creditAccountName: '普通預金', creditSubAccountName: '三菱UFJ銀行 本店', minAmount: 8000, maxAmount: 25000, frequency: 1, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
  { description: '水道代', debitAccountName: '水道光熱費', creditAccountName: '普通預金', creditSubAccountName: '三菱UFJ銀行 本店', minAmount: 3000, maxAmount: 8000, frequency: 0.5, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
  { description: '携帯電話代', debitAccountName: '通信費', creditAccountName: '普通預金', creditSubAccountName: '三菱UFJ銀行 本店', minAmount: 5000, maxAmount: 15000, frequency: 1, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
  { description: 'インターネット代', debitAccountName: '通信費', creditAccountName: '普通預金', creditSubAccountName: 'みずほ銀行 渋谷支店', minAmount: 4000, maxAmount: 8000, frequency: 1, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
  { description: '事務用品購入', debitAccountName: '消耗品費', creditAccountName: '現金', minAmount: 1000, maxAmount: 10000, frequency: 0.5, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
  { description: '交通費精算', debitAccountName: '旅費交通費', creditAccountName: '現金', minAmount: 2000, maxAmount: 15000, frequency: 2, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
  { description: '広告費', debitAccountName: '広告宣伝費', creditAccountName: '普通預金', creditSubAccountName: 'みずほ銀行 渋谷支店', minAmount: 10000, maxAmount: 50000, frequency: 0.3, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
  // 軽減税率8%の経費（飲食料品など）
  { description: '会議用お茶菓子', debitAccountName: '消耗品費', creditAccountName: '現金', minAmount: 500, maxAmount: 3000, frequency: 0.8, taxType: 'taxable_purchase', taxRate: 8, taxIncluded: 'included' },
  // その他
  { description: '預金利息', debitAccountName: '普通預金', creditAccountName: '受取利息', debitSubAccountName: '三菱UFJ銀行 本店', minAmount: 10, maxAmount: 500, frequency: 0.25, taxType: 'tax_exempt' }, // 利息は非課税
  { description: '備品購入', debitAccountName: '備品', creditAccountName: '普通預金', creditSubAccountName: '三菱UFJ銀行 本店', minAmount: 20000, maxAmount: 100000, frequency: 0.2, taxType: 'taxable_purchase', taxRate: 10, taxIncluded: 'included' },
];

// ランダムな整数を生成（1000円単位に丸める）
function randomAmount(min: number, max: number): number {
  const amount = Math.floor(Math.random() * (max - min + 1)) + min;
  return Math.round(amount / 1000) * 1000;
}

// ランダムな日付を生成
function randomDate(year: number, month: number): string {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.floor(Math.random() * daysInMonth) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 勘定科目名からIDを取得するヘルパー
function getAccountIdByName(accounts: Account[], name: string): string | null {
  const account = accounts.find((a) => a.name === name);
  return account?.id || null;
}

// 補助科目名からIDを取得するヘルパー
function getSubAccountIdByName(
  subAccounts: SubAccount[],
  parentAccountId: string,
  name: string
): string | null {
  const subAccount = subAccounts.find(
    (sa) => sa.parentAccountId === parentAccountId && sa.name === name
  );
  return subAccount?.id || null;
}

// サンプル補助科目を生成
export function generateSampleSubAccounts(accounts: Account[]): SubAccount[] {
  const subAccounts: SubAccount[] = [];
  const now = new Date().toISOString();

  subAccountTemplates.forEach((template) => {
    const parentAccountId = getAccountIdByName(accounts, template.parentAccountName);
    if (!parentAccountId) return;

    subAccounts.push({
      id: uuidv4(),
      parentAccountId,
      code: template.code,
      name: template.name,
      description: template.description,
      createdAt: now,
      updatedAt: now,
    });
  });

  return subAccounts;
}

// ペアになる取引のマッピング（売上→回収、仕入→支払）
// キー: 売上/仕入の摘要、値: 対応する回収/支払の摘要
const pairedTransactions: Record<string, string> = {
  'ABC商事への売上': 'ABC商事より入金',
  '山田製作所への売上': '山田製作所より入金',
  'DEFシステムへの売上': 'DEFシステムより入金',
  '東京物産より仕入': '東京物産へ支払',
  '大阪資材より仕入': '大阪資材へ支払',
  '名古屋パーツより仕入': '名古屋パーツへ支払',
};

// サンプルデータを生成（勘定科目マスタと補助科目を受け取る）
// 暦年（1月1日〜12月31日）の会計年度に合わせて、1月から現在月までのデータを生成
export function generateSampleData(
  accounts: Account[],
  subAccounts: SubAccount[] = [],
  _months: number = 6 // 互換性のため残すが、実際は1月〜現在月を生成
): JournalEntry[] {
  const entries: JournalEntry[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 1月から現在の月までのデータを生成（暦年会計年度）
  for (let targetMonth = 1; targetMonth <= currentMonth; targetMonth++) {
    const targetYear = currentYear;

    // この月のペア取引の金額を保持（売上/仕入の金額を回収/支払に引き継ぐ）
    const pairedAmounts: Map<string, number[]> = new Map();

    // まず売上・仕入のテンプレートを処理して金額を記録
    sampleTemplates.forEach((template) => {
      // ペアの元になる取引（売上・仕入）かどうかを確認
      const pairedDescription = pairedTransactions[template.description];
      if (!pairedDescription) return; // ペア取引でなければスキップ

      // 勘定科目名からIDを取得
      const debitAccountId = getAccountIdByName(accounts, template.debitAccountName);
      const creditAccountId = getAccountIdByName(accounts, template.creditAccountName);

      if (!debitAccountId || !creditAccountId) return;

      // frequency に基づいて金額を生成・記録
      const amounts: number[] = [];
      if (template.frequency < 1) {
        if (Math.random() < template.frequency) {
          amounts.push(randomAmount(template.minAmount, template.maxAmount));
        }
      } else {
        const count = Math.floor(template.frequency);
        for (let j = 0; j < count; j++) {
          amounts.push(randomAmount(template.minAmount, template.maxAmount));
        }
      }

      if (amounts.length > 0) {
        pairedAmounts.set(template.description, amounts);
      }
    });

    // 全テンプレートについて仕訳を生成
    sampleTemplates.forEach((template) => {
      // 勘定科目名からIDを取得
      const debitAccountId = getAccountIdByName(accounts, template.debitAccountName);
      const creditAccountId = getAccountIdByName(accounts, template.creditAccountName);

      // 両方の勘定科目が存在する場合のみ仕訳を生成
      if (!debitAccountId || !creditAccountId) {
        return;
      }

      // 補助科目IDを取得（存在する場合のみ）
      let debitSubAccountId: string | undefined;
      let creditSubAccountId: string | undefined;

      if (template.debitSubAccountName) {
        const id = getSubAccountIdByName(subAccounts, debitAccountId, template.debitSubAccountName);
        if (id) debitSubAccountId = id;
      }

      if (template.creditSubAccountName) {
        const id = getSubAccountIdByName(subAccounts, creditAccountId, template.creditSubAccountName);
        if (id) creditSubAccountId = id;
      }

      // 仕訳エントリを生成する共通関数
      const createEntry = (amount: number): JournalEntry => {
        const timestamp = new Date().toISOString();
        return {
          id: uuidv4(),
          date: randomDate(targetYear, targetMonth),
          description: template.description,
          debitAccountId,
          creditAccountId,
          debitSubAccountId,
          creditSubAccountId,
          amount,
          // 消費税情報
          taxType: template.taxType,
          taxRate: template.taxRate,
          taxIncluded: template.taxIncluded,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      };

      // ペアの元になる取引（売上・仕入）の場合
      const pairedDescription = pairedTransactions[template.description];
      if (pairedDescription) {
        const amounts = pairedAmounts.get(template.description);
        if (amounts) {
          amounts.forEach((amount) => {
            entries.push(createEntry(amount));
          });
        }
        return;
      }

      // ペアの対になる取引（回収・支払）の場合
      const sourceDescription = Object.entries(pairedTransactions).find(
        ([, paired]) => paired === template.description
      )?.[0];
      if (sourceDescription) {
        const amounts = pairedAmounts.get(sourceDescription);
        if (amounts) {
          amounts.forEach((amount) => {
            entries.push(createEntry(amount));
          });
        }
        return;
      }

      // ペア取引でない通常の取引
      if (template.frequency < 1) {
        if (Math.random() >= template.frequency) return;
        entries.push(createEntry(randomAmount(template.minAmount, template.maxAmount)));
        return;
      }

      const count = Math.floor(template.frequency);
      for (let j = 0; j < count; j++) {
        entries.push(createEntry(randomAmount(template.minAmount, template.maxAmount)));
      }
    });
  }

  // 日付順にソート
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// サンプル期首残高のテンプレート（勘定科目名と金額）
// 正の値=借方残高（資産・費用）、負の値=貸方残高（負債・純資産・収益）
interface OpeningBalanceTemplate {
  accountName: string;
  amount: number;
}

const openingBalanceTemplates: OpeningBalanceTemplate[] = [
  // 資産（借方残高=正の値）
  { accountName: '現金', amount: 500000 },
  { accountName: '普通預金', amount: 3500000 },
  { accountName: '売掛金', amount: 800000 },
  { accountName: '備品', amount: 500000 },
  // 負債（貸方残高=負の値）
  { accountName: '買掛金', amount: -300000 },
  { accountName: '未払金', amount: -500000 },
  // 純資産（貸方残高=負の値）
  // 資産合計5,300,000 = 負債合計800,000 + 純資産合計4,500,000
  { accountName: '資本金', amount: -3000000 },
  { accountName: '繰越利益剰余金', amount: -1500000 },
];

// サンプル期首残高を生成
export function generateSampleOpeningBalances(accounts: Account[]): OpeningBalance[] {
  const balances: OpeningBalance[] = [];

  openingBalanceTemplates.forEach((template) => {
    const accountId = getAccountIdByName(accounts, template.accountName);
    if (!accountId) return;

    balances.push({
      accountId,
      amount: template.amount,
    });
  });

  return balances;
}
