import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { SubAccount } from '../types';

interface SubAccountStore {
  subAccounts: SubAccount[];
  addSubAccount: (subAccount: Omit<SubAccount, 'id' | 'createdAt' | 'updatedAt'>) => SubAccount;
  updateSubAccount: (id: string, updates: Partial<Omit<SubAccount, 'id' | 'createdAt'>>) => void;
  deleteSubAccount: (id: string) => void;
  getSubAccountsByParent: (parentAccountId: string) => SubAccount[];
  setSubAccounts: (subAccounts: SubAccount[]) => void;
}

export const useSubAccountStore = create<SubAccountStore>()(
  persist(
    (set, get) => ({
      subAccounts: [],

      addSubAccount: (subAccountData) => {
        const now = new Date().toISOString();
        const newSubAccount: SubAccount = {
          ...subAccountData,
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          subAccounts: [...state.subAccounts, newSubAccount],
        }));

        return newSubAccount;
      },

      updateSubAccount: (id, updates) => {
        set((state) => ({
          subAccounts: state.subAccounts.map((sa) =>
            sa.id === id
              ? { ...sa, ...updates, updatedAt: new Date().toISOString() }
              : sa
          ),
        }));
      },

      deleteSubAccount: (id) => {
        set((state) => ({
          subAccounts: state.subAccounts.filter((sa) => sa.id !== id),
        }));
      },

      getSubAccountsByParent: (parentAccountId) => {
        return get().subAccounts.filter((sa) => sa.parentAccountId === parentAccountId);
      },

      setSubAccounts: (subAccounts) => {
        set({ subAccounts });
      },
    }),
    {
      name: 'sub-accounts-storage',
    }
  )
);
