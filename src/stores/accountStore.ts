import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account } from '../types';
import { defaultAccounts } from '../data/defaultAccounts';
import { v4 as uuidv4 } from 'uuid';

interface AccountStore {
  accounts: Account[];
  addAccount: (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateAccount: (id: string, account: Partial<Omit<Account, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteAccount: (id: string) => void;
  resetToDefault: () => void;
  setAccounts: (accounts: Account[]) => void;
  ensureRequiredAccounts: () => void;
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      accounts: defaultAccounts,

      addAccount: (accountData) => {
        const now = new Date().toISOString();
        const newAccount: Account = {
          ...accountData,
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          accounts: [...state.accounts, newAccount],
        }));
      },

      updateAccount: (id, accountData) => {
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === id
              ? { ...account, ...accountData, updatedAt: new Date().toISOString() }
              : account
          ),
        }));
      },

      deleteAccount: (id) => {
        set((state) => ({
          accounts: state.accounts.filter((account) => account.id !== id),
        }));
      },

      resetToDefault: () => {
        set({ accounts: defaultAccounts });
      },

      setAccounts: (accounts) => {
        set({ accounts });
      },

      // 必須の勘定科目が存在しない場合に追加
      ensureRequiredAccounts: () => {
        set((state) => {
          const existingNames = state.accounts.map((a) => a.name);
          const missingAccounts: Account[] = [];
          const now = new Date().toISOString();

          // デフォルト勘定科目から不足しているものを追加
          defaultAccounts.forEach((defaultAcc) => {
            if (!existingNames.includes(defaultAcc.name)) {
              missingAccounts.push({
                ...defaultAcc,
                id: uuidv4(),
                createdAt: now,
                updatedAt: now,
              });
            }
          });

          if (missingAccounts.length === 0) {
            return state;
          }

          return {
            accounts: [...state.accounts, ...missingAccounts],
          };
        });
      },
    }),
    {
      name: 'account-storage',
    }
  )
);
