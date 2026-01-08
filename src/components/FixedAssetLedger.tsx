import { useState, useMemo, useEffect } from 'react';
import { useFixedAssetStore } from '../stores/fixedAssetStore';
import { useAccountStore } from '../stores/accountStore';
import { useJournalStore } from '../stores/journalStore';
import { useOpeningBalanceStore } from '../stores/openingBalanceStore';
import { calculateDepreciationSchedule } from '../utils/depreciation';
import { calculateFiscalYearEnd } from '../utils/yearEndClosing';
import {
  generateDepreciationJournals,
  getDepreciationJournals,
} from '../utils/depreciationJournal';
import {
  assetCategoryLabels,
  depreciationMethodLabels,
  usefulLifeGuide,
  type AssetCategory,
  type DepreciationMethod,
} from '../types/fixedAsset';

type ViewMode = 'list' | 'add' | 'detail' | 'disposed';

export function FixedAssetLedger() {
  const { assets, addAsset, deleteAsset, disposeAsset } = useFixedAssetStore();
  const { accounts, ensureRequiredAccounts } = useAccountStore();
  const { entries: journalEntries, addEntry } = useJournalStore();

  // コンポーネントマウント時に必要な勘定科目を確認・追加
  useEffect(() => {
    ensureRequiredAccounts();
  }, [ensureRequiredAccounts]);
  const { settings } = useOpeningBalanceStore();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDisposeDialog, setShowDisposeDialog] = useState(false);
  const [showJournalDialog, setShowJournalDialog] = useState(false);
  const [journalMessage, setJournalMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // 新規登録フォームの状態
  const [formData, setFormData] = useState({
    name: '',
    category: 'tools' as AssetCategory,
    accountId: '',
    acquisitionDate: '',
    acquisitionCost: '',
    usefulLife: '',
    depreciationMethod: 'straight_line' as DepreciationMethod,
    residualValue: '1',
    memo: '',
  });

  // 除却フォームの状態
  const [disposeData, setDisposeData] = useState({
    disposalDate: '',
    disposalAmount: '',
  });

  // アクティブな資産
  const activeAssets = useMemo(() => {
    return assets.filter((a) => !a.isDisposed);
  }, [assets]);

  // 除却済み資産
  const disposedAssets = useMemo(() => {
    return assets.filter((a) => a.isDisposed);
  }, [assets]);

  // 選択中の資産
  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId);
  }, [assets, selectedAssetId]);

  // 固定資産関連の勘定科目を取得
  const fixedAssetAccounts = useMemo(() => {
    return accounts.filter((a) => a.type === 'asset' && a.code >= '120' && a.code < '200');
  }, [accounts]);

  // 償却スケジュール
  const depreciationSchedule = useMemo(() => {
    if (!selectedAsset) return [];
    return calculateDepreciationSchedule(selectedAsset, settings.fiscalYearStart, 20);
  }, [selectedAsset, settings.fiscalYearStart]);

  // 当期の会計年度情報
  const fiscalYearInfo = useMemo(() => {
    const fiscalYearStart = settings.fiscalYearStart;
    const fiscalYearEnd = calculateFiscalYearEnd(fiscalYearStart);
    const [year] = fiscalYearStart.split('-').map(Number);
    return { fiscalYearStart, fiscalYearEnd, fiscalYear: year };
  }, [settings.fiscalYearStart]);

  // 既存の減価償却仕訳をチェック
  const existingDepreciationJournals = useMemo(() => {
    return getDepreciationJournals(
      journalEntries,
      accounts,
      fiscalYearInfo.fiscalYearStart,
      fiscalYearInfo.fiscalYearEnd
    );
  }, [journalEntries, accounts, fiscalYearInfo]);

  // 既に減価償却仕訳が存在するか
  const hasExistingJournals = existingDepreciationJournals.length > 0;

  // フォームリセット
  const resetForm = () => {
    setFormData({
      name: '',
      category: 'tools',
      accountId: '',
      acquisitionDate: '',
      acquisitionCost: '',
      usefulLife: '',
      depreciationMethod: 'straight_line',
      residualValue: '1',
      memo: '',
    });
  };

  // 資産登録
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addAsset({
      name: formData.name,
      category: formData.category,
      accountId: formData.accountId,
      acquisitionDate: formData.acquisitionDate,
      acquisitionCost: parseFloat(formData.acquisitionCost) || 0,
      usefulLife: parseInt(formData.usefulLife) || 5,
      depreciationMethod: formData.depreciationMethod,
      residualValue: parseFloat(formData.residualValue) || 1,
      memo: formData.memo || undefined,
      isDisposed: false,
    });

    resetForm();
    setViewMode('list');
  };

  // カテゴリ変更時に耐用年数の目安を設定
  const handleCategoryChange = (category: AssetCategory) => {
    setFormData({
      ...formData,
      category,
      usefulLife: usefulLifeGuide[category][0]?.toString() || '',
    });
  };

  // 資産詳細を表示
  const handleViewDetail = (assetId: string) => {
    setSelectedAssetId(assetId);
    setViewMode('detail');
  };

  // 資産削除
  const handleDelete = () => {
    if (selectedAssetId) {
      deleteAsset(selectedAssetId);
      setShowDeleteConfirm(false);
      setSelectedAssetId(null);
      setViewMode('list');
    }
  };

  // 除却処理
  const handleDispose = () => {
    if (selectedAssetId && disposeData.disposalDate) {
      disposeAsset(
        selectedAssetId,
        disposeData.disposalDate,
        disposeData.disposalAmount ? parseFloat(disposeData.disposalAmount) : undefined
      );
      setShowDisposeDialog(false);
      setDisposeData({ disposalDate: '', disposalAmount: '' });
      setViewMode('list');
    }
  };

  // 減価償却仕訳を生成
  const handleGenerateJournals = () => {
    const result = generateDepreciationJournals(
      assets,
      accounts,
      fiscalYearInfo.fiscalYearStart,
      fiscalYearInfo.fiscalYear
    );

    if (result.errors.length > 0) {
      setJournalMessage({ type: 'error', text: result.errors.join('\n') });
      return;
    }

    if (result.entries.length === 0) {
      setJournalMessage({ type: 'info', text: '当期に計上する減価償却費はありません。' });
      return;
    }

    // 仕訳を登録
    result.entries.forEach((entry) => {
      addEntry(entry);
    });

    setJournalMessage({
      type: 'success',
      text: `${result.assetCount}件の資産について、合計${result.totalAmount.toLocaleString()}円の減価償却仕訳を生成しました。`,
    });
    setShowJournalDialog(false);
  };

  // リスト表示
  const renderList = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">固定資産台帳</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowJournalDialog(true)}
            disabled={activeAssets.length === 0}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px', boxSizing: 'border-box',
              border: 'none',
              cursor: activeAssets.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: activeAssets.length === 0 ? '#9ca3af' : '#3b82f6',
              color: '#ffffff',
              opacity: activeAssets.length === 0 ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (activeAssets.length > 0) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (activeAssets.length > 0) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
          >
            減価償却仕訳を生成
          </button>
          <button
            onClick={() => setViewMode('disposed')}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px', boxSizing: 'border-box',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }}
          >
            除却済み一覧
          </button>
          <button
            onClick={() => setViewMode('add')}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px', boxSizing: 'border-box',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }}
          >
            新規登録
          </button>
        </div>
      </div>

      {/* メッセージ表示 */}
      {journalMessage && (
        <div
          className={`mb-4 p-4 rounded-md ${
            journalMessage.type === 'success'
              ? 'bg-green-100 text-green-700'
              : journalMessage.type === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          <div className="flex justify-between items-center">
            <span>{journalMessage.text}</span>
            <button
              onClick={() => setJournalMessage(null)}
              className="text-current hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 既存仕訳の警告 */}
      {hasExistingJournals && (
        <div className="mb-4 p-4 bg-amber-50 rounded-md">
          <p className="text-amber-700 text-sm">
            当期（{fiscalYearInfo.fiscalYearStart} ～ {fiscalYearInfo.fiscalYearEnd}）の減価償却仕訳が
            {existingDepreciationJournals.length}件登録されています。
          </p>
        </div>
      )}

      {activeAssets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          登録されている固定資産はありません
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">資産名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">種類</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">取得日</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">取得価額</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">償却方法</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">耐用年数</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{asset.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{assetCategoryLabels[asset.category]}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{asset.acquisitionDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {asset.acquisitionCost.toLocaleString()}円
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {depreciationMethodLabels[asset.depreciationMethod]}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-center">{asset.usefulLife}年</td>
                  <td className="px-6 py-4 text-sm text-center">
                    <button
                      onClick={() => handleViewDetail(asset.id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: '#3b82f6',
                        color: '#ffffff',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // 除却済み一覧
  const renderDisposedList = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">除却済み資産一覧</h1>
        <button
          onClick={() => setViewMode('list')}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '6px', boxSizing: 'border-box',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
        >
          ← 戻る
        </button>
      </div>

      {disposedAssets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          除却済みの資産はありません
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">資産名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">種類</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">取得日</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">除却日</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">取得価額</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">売却額</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {disposedAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{asset.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{assetCategoryLabels[asset.category]}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{asset.acquisitionDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{asset.disposalDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {asset.acquisitionCost.toLocaleString()}円
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {asset.disposalAmount ? `${asset.disposalAmount.toLocaleString()}円` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // 新規登録フォーム
  const renderAddForm = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">固定資産登録</h1>
        <button
          onClick={() => {
            resetForm();
            setViewMode('list');
          }}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '6px', boxSizing: 'border-box',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
        >
          ← 戻る
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* 資産名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">資産名 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              maxLength={100}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px', boxSizing: 'border-box',
              }}
              placeholder="例: ノートパソコン"
            />
          </div>

          {/* 資産の種類 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">資産の種類 *</label>
            <select
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px', boxSizing: 'border-box',
              }}
            >
              {Object.entries(assetCategoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 勘定科目 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">勘定科目</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px', boxSizing: 'border-box',
              }}
            >
              <option value="">選択してください</option>
              {fixedAssetAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* 取得日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">取得日 *</label>
            <input
              type="date"
              value={formData.acquisitionDate}
              onChange={(e) => setFormData({ ...formData, acquisitionDate: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 取得価額 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">取得価額 *</label>
            <input
              type="number"
              value={formData.acquisitionCost}
              onChange={(e) => setFormData({ ...formData, acquisitionCost: e.target.value })}
              required
              min="0"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px', boxSizing: 'border-box',
              }}
              placeholder="例: 150000"
            />
          </div>

          {/* 償却方法 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">償却方法 *</label>
            <select
              value={formData.depreciationMethod}
              onChange={(e) =>
                setFormData({ ...formData, depreciationMethod: e.target.value as DepreciationMethod })
              }
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px', boxSizing: 'border-box',
              }}
            >
              {Object.entries(depreciationMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 耐用年数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">耐用年数（年） *</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={formData.usefulLife}
                onChange={(e) => setFormData({ ...formData, usefulLife: e.target.value })}
                required
                min="2"
                max="50"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px', boxSizing: 'border-box',
                }}
              />
              <div className="flex gap-1">
                {usefulLifeGuide[formData.category]?.slice(0, 4).map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setFormData({ ...formData, usefulLife: year.toString() })}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    {year}年
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 残存価額 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">残存価額（備忘価額）</label>
            <input
              type="number"
              value={formData.residualValue}
              onChange={(e) => setFormData({ ...formData, residualValue: e.target.value })}
              min="1"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px', boxSizing: 'border-box',
              }}
            />
            <p className="mt-1 text-xs text-gray-500">※ 通常は1円（備忘価額）</p>
          </div>
        </div>

        {/* メモ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
          <textarea
            value={formData.memo}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px', boxSizing: 'border-box',
            }}
            placeholder="備考などを入力..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setViewMode('list');
            }}
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px', boxSizing: 'border-box',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
          >
            キャンセル
          </button>
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px', boxSizing: 'border-box',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
          >
            登録
          </button>
        </div>
      </form>
    </div>
  );

  // 詳細表示
  const renderDetail = () => {
    if (!selectedAsset) return null;

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">固定資産詳細</h1>
          <button
            onClick={() => {
              setSelectedAssetId(null);
              setViewMode('list');
            }}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px', boxSizing: 'border-box',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
          >
            ← 戻る
          </button>
        </div>

        {/* 資産情報 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">資産情報</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">資産名</span>
              <p className="font-medium">{selectedAsset.name}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">資産の種類</span>
              <p className="font-medium">{assetCategoryLabels[selectedAsset.category]}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">取得日</span>
              <p className="font-medium">{selectedAsset.acquisitionDate}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">取得価額</span>
              <p className="font-medium">{selectedAsset.acquisitionCost.toLocaleString()}円</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">償却方法</span>
              <p className="font-medium">{depreciationMethodLabels[selectedAsset.depreciationMethod]}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">耐用年数</span>
              <p className="font-medium">{selectedAsset.usefulLife}年</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">残存価額</span>
              <p className="font-medium">{selectedAsset.residualValue.toLocaleString()}円</p>
            </div>
            {selectedAsset.memo && (
              <div className="col-span-2">
                <span className="text-sm text-gray-500">メモ</span>
                <p className="font-medium">{selectedAsset.memo}</p>
              </div>
            )}
          </div>

          {/* アクションボタン */}
          {!selectedAsset.isDisposed && (
            <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
              <button
                onClick={() => setShowDisposeDialog(true)}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '6px', boxSizing: 'border-box',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
              >
                除却・売却
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '6px', boxSizing: 'border-box',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
              >
                削除
              </button>
            </div>
          )}
        </div>

        {/* 減価償却スケジュール */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">減価償却スケジュール</h2>
          {depreciationSchedule.length === 0 ? (
            <p className="text-gray-500">償却スケジュールはありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">年度</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">期間</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">月数</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      期首帳簿価額
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      当期償却額
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      累計償却額
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      期末帳簿価額
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {depreciationSchedule.map((schedule, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{schedule.fiscalYear}年度</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {schedule.yearStartDate} ～ {schedule.yearEndDate}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center">{schedule.months}ヶ月</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {schedule.beginningBookValue.toLocaleString()}円
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-600 font-medium text-right">
                        {schedule.depreciationAmount.toLocaleString()}円
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {schedule.accumulatedDepreciation.toLocaleString()}円
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right">
                        {schedule.endingBookValue.toLocaleString()}円
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 削除確認ダイアログ */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">削除の確認</h3>
              <p className="text-gray-600 mb-6">
                「{selectedAsset.name}」を削除しますか？この操作は取り消せません。
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    borderRadius: '6px', boxSizing: 'border-box',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    borderRadius: '6px', boxSizing: 'border-box',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 除却ダイアログ */}
        {showDisposeDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">除却・売却処理</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">除却・売却日 *</label>
                  <input
                    type="date"
                    value={disposeData.disposalDate}
                    onChange={(e) => setDisposeData({ ...disposeData, disposalDate: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">売却額（任意）</label>
                  <input
                    type="number"
                    value={disposeData.disposalAmount}
                    onChange={(e) => setDisposeData({ ...disposeData, disposalAmount: e.target.value })}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px', boxSizing: 'border-box',
                    }}
                    placeholder="売却の場合のみ入力"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                <button
                  onClick={() => {
                    setShowDisposeDialog(false);
                    setDisposeData({ disposalDate: '', disposalAmount: '' });
                  }}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    borderRadius: '6px', boxSizing: 'border-box',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDispose}
                  disabled={!disposeData.disposalDate}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    borderRadius: '6px', boxSizing: 'border-box',
                    border: 'none',
                    cursor: !disposeData.disposalDate ? 'not-allowed' : 'pointer',
                    backgroundColor: !disposeData.disposalDate ? '#9ca3af' : '#3b82f6',
                    color: '#ffffff',
                  }}
                  onMouseEnter={(e) => {
                    if (disposeData.disposalDate) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (disposeData.disposalDate) {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                    }
                  }}
                >
                  処理実行
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 仕訳生成確認ダイアログ
  const renderJournalDialog = () => {
    // プレビュー用に仕訳を生成
    const preview = generateDepreciationJournals(
      assets,
      accounts,
      fiscalYearInfo.fiscalYearStart,
      fiscalYearInfo.fiscalYear
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">減価償却仕訳の生成</h3>

          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              対象会計年度: {fiscalYearInfo.fiscalYearStart} ～ {fiscalYearInfo.fiscalYearEnd}
            </p>
          </div>

          {preview.errors.length > 0 ? (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
              {preview.errors.map((error, i) => (
                <p key={i}>{error}</p>
              ))}
            </div>
          ) : preview.entries.length === 0 ? (
            <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded-md">
              当期に計上する減価償却費はありません。
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  以下の減価償却仕訳を生成します（{preview.assetCount}件、合計{preview.totalAmount.toLocaleString()}円）
                </p>
                <div className="border rounded-md overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">日付</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">摘要</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">金額</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {preview.entries.map((entry, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-gray-600">{entry.date}</td>
                          <td className="px-3 py-2 text-gray-900">{entry.description}</td>
                          <td className="px-3 py-2 text-gray-900 text-right">{entry.amount.toLocaleString()}円</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {hasExistingJournals && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-amber-700 text-sm">
                    注意: 当期の減価償却仕訳が既に{existingDepreciationJournals.length}件登録されています。
                    重複して生成すると二重計上になります。
                  </p>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
            <button
              onClick={() => setShowJournalDialog(false)}
              style={{
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '6px', boxSizing: 'border-box',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
            >
              キャンセル
            </button>
            {preview.entries.length > 0 && preview.errors.length === 0 && (
              <button
                onClick={handleGenerateJournals}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '6px', boxSizing: 'border-box',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
              >
                仕訳を生成
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {viewMode === 'list' && renderList()}
      {viewMode === 'add' && renderAddForm()}
      {viewMode === 'detail' && renderDetail()}
      {viewMode === 'disposed' && renderDisposedList()}
      {showJournalDialog && renderJournalDialog()}
    </div>
  );
}
