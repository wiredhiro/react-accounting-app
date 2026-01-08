import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JournalEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface JournalStore {
  entries: JournalEntry[];
  addEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEntry: (id: string, entry: Partial<Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteEntry: (id: string) => void;
  deleteEntries: (ids: string[]) => void;
  setEntries: (entries: JournalEntry[]) => void;
}

export const useJournalStore = create<JournalStore>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (entryData) => {
        const now = new Date().toISOString();
        const newEntry: JournalEntry = {
          ...entryData,
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          entries: [...state.entries, newEntry],
        }));
      },

      updateEntry: (id, entryData) => {
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id
              ? { ...entry, ...entryData, updatedAt: new Date().toISOString() }
              : entry
          ),
        }));
      },

      deleteEntry: (id) => {
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== id),
        }));
      },

      deleteEntries: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          entries: state.entries.filter((entry) => !idSet.has(entry.id)),
        }));
      },

      setEntries: (entries) => {
        set({ entries });
      },
    }),
    {
      name: 'journal-storage',
    }
  )
);
