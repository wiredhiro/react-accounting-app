import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OpeningBalance, OpeningBalanceSettings } from '../types';

interface OpeningBalanceStore {
  settings: OpeningBalanceSettings;
  setFiscalYearStart: (date: string) => void;
  setBalance: (accountId: string, amount: number) => void;
  setBalances: (balances: OpeningBalance[]) => void;
  getBalance: (accountId: string) => number;
  clearBalances: () => void;
}

// デフォルトの会計年度開始日（今年の1月1日）
// 個人事業主の青色申告は暦年（1月1日〜12月31日）が会計年度
const getDefaultFiscalYearStart = () => {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
};

export const useOpeningBalanceStore = create<OpeningBalanceStore>()(
  persist(
    (set, get) => ({
      settings: {
        fiscalYearStart: getDefaultFiscalYearStart(),
        balances: [],
        updatedAt: new Date().toISOString(),
      },

      setFiscalYearStart: (date) => {
        set((state) => ({
          settings: {
            ...state.settings,
            fiscalYearStart: date,
            updatedAt: new Date().toISOString(),
          },
        }));
      },

      setBalance: (accountId, amount) => {
        set((state) => {
          const existingIndex = state.settings.balances.findIndex(
            (b) => b.accountId === accountId
          );
          const newBalances = [...state.settings.balances];

          if (amount === 0) {
            // 金額が0の場合は削除
            if (existingIndex >= 0) {
              newBalances.splice(existingIndex, 1);
            }
          } else if (existingIndex >= 0) {
            // 既存の残高を更新
            newBalances[existingIndex] = { accountId, amount };
          } else {
            // 新規追加
            newBalances.push({ accountId, amount });
          }

          return {
            settings: {
              ...state.settings,
              balances: newBalances,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      setBalances: (balances) => {
        set((state) => ({
          settings: {
            ...state.settings,
            balances: balances.filter((b) => b.amount !== 0),
            updatedAt: new Date().toISOString(),
          },
        }));
      },

      getBalance: (accountId) => {
        const balance = get().settings.balances.find(
          (b) => b.accountId === accountId
        );
        return balance?.amount || 0;
      },

      clearBalances: () => {
        set(() => ({
          settings: {
            fiscalYearStart: getDefaultFiscalYearStart(),
            balances: [],
            updatedAt: new Date().toISOString(),
          },
        }));
      },
    }),
    {
      name: 'opening-balance-storage',
    }
  )
);
