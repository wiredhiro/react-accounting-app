import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FixedAsset } from '../types/fixedAsset';

interface FixedAssetStore {
  assets: FixedAsset[];
  addAsset: (asset: Omit<FixedAsset, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateAsset: (id: string, updates: Partial<FixedAsset>) => void;
  deleteAsset: (id: string) => void;
  disposeAsset: (id: string, disposalDate: string, disposalAmount?: number) => void;
  getAsset: (id: string) => FixedAsset | undefined;
  getActiveAssets: () => FixedAsset[];
  getDisposedAssets: () => FixedAsset[];
  clearAssets: () => void;
}

// UUID生成
function generateId(): string {
  return 'asset_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export const useFixedAssetStore = create<FixedAssetStore>()(
  persist(
    (set, get) => ({
      assets: [],

      addAsset: (assetData) => {
        const now = new Date().toISOString();
        const newAsset: FixedAsset = {
          ...assetData,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          assets: [...state.assets, newAsset],
        }));
      },

      updateAsset: (id, updates) => {
        set((state) => ({
          assets: state.assets.map((asset) =>
            asset.id === id
              ? { ...asset, ...updates, updatedAt: new Date().toISOString() }
              : asset
          ),
        }));
      },

      deleteAsset: (id) => {
        set((state) => ({
          assets: state.assets.filter((asset) => asset.id !== id),
        }));
      },

      disposeAsset: (id, disposalDate, disposalAmount) => {
        set((state) => ({
          assets: state.assets.map((asset) =>
            asset.id === id
              ? {
                  ...asset,
                  isDisposed: true,
                  disposalDate,
                  disposalAmount,
                  updatedAt: new Date().toISOString(),
                }
              : asset
          ),
        }));
      },

      getAsset: (id) => {
        return get().assets.find((asset) => asset.id === id);
      },

      getActiveAssets: () => {
        return get().assets.filter((asset) => !asset.isDisposed);
      },

      getDisposedAssets: () => {
        return get().assets.filter((asset) => asset.isDisposed);
      },

      clearAssets: () => {
        set({ assets: [] });
      },
    }),
    {
      name: 'fixed-asset-storage',
    }
  )
);
