import { useState, useRef } from 'react';
import { useJournalStore } from '../stores/journalStore';
import { useAccountStore } from '../stores/accountStore';
import { useSubAccountStore } from '../stores/subAccountStore';
import { useOpeningBalanceStore } from '../stores/openingBalanceStore';
import { useFixedAssetStore } from '../stores/fixedAssetStore';
import { downloadBackup, parseBackup } from '../utils/backup';
import { generateSampleData, generateSampleSubAccounts, generateSampleOpeningBalances } from '../utils/sampleData';
import { defaultAccounts } from '../data/defaultAccounts';

export function BackupRestore() {
  const { entries, setEntries } = useJournalStore();
  const { accounts, setAccounts, resetToDefault } = useAccountStore();
  const { subAccounts, setSubAccounts } = useSubAccountStore();
  const { setBalances, setFiscalYearStart } = useOpeningBalanceStore();
  const { clearAssets } = useFixedAssetStore();
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<boolean>(false);
  const [confirmRestore, setConfirmRestore] = useState<{
    journals: number;
    accounts: number;
    content: string;
  } | null>(null);
  const [sampleDataSuccess, setSampleDataSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // バックアップをダウンロード
  const handleBackup = () => {
    downloadBackup(entries, accounts);
  };

  // ファイル選択時の処理
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const { data, error } = parseBackup(content);

      if (error) {
        setRestoreError(error);
        setConfirmRestore(null);
      } else if (data) {
        setRestoreError(null);
        setConfirmRestore({
          journals: data.journals.length,
          accounts: data.accounts.length,
          content,
        });
      }
    };
    reader.readAsText(file);

    // ファイル選択をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 復元を実行
  const handleRestore = () => {
    if (!confirmRestore) return;

    const { data, error } = parseBackup(confirmRestore.content);
    if (error || !data) {
      setRestoreError(error || '復元に失敗しました');
      setConfirmRestore(null);
      return;
    }

    setEntries(data.journals);
    setAccounts(data.accounts);
    setConfirmRestore(null);
    setRestoreSuccess(true);
    setTimeout(() => setRestoreSuccess(false), 3000);
  };

  // サンプルデータを生成（勘定科目マスタをリセットしてから生成）
  const handleGenerateSampleData = () => {
    // まず勘定科目マスタをデフォルトにリセット
    resetToDefault();
    // サンプル補助科目を生成
    const sampleSubAccounts = generateSampleSubAccounts(defaultAccounts);
    setSubAccounts(sampleSubAccounts);
    // サンプル期首残高を生成（資本金・繰越利益剰余金など）
    const sampleOpeningBalances = generateSampleOpeningBalances(defaultAccounts);
    setBalances(sampleOpeningBalances);
    // 会計年度開始日を設定（暦年：今年の1月1日）
    const now = new Date();
    setFiscalYearStart(`${now.getFullYear()}-01-01`);
    // デフォルト勘定科目とサンプル補助科目を使用してサンプルデータを生成
    const sampleEntries = generateSampleData(defaultAccounts, sampleSubAccounts, 6);
    // 現在の仕訳に追加（storeから最新を取得）
    const currentEntries = useJournalStore.getState().entries;
    setEntries([...currentEntries, ...sampleEntries]);
    setSampleDataSuccess(true);
    setTimeout(() => setSampleDataSuccess(false), 3000);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">データバックアップ・復元</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* バックアップ */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">バックアップ</h2>
          <p className="text-sm text-gray-600 mb-4">
            現在のデータをJSONファイルとしてダウンロードします。
            仕訳データと勘定科目データが含まれます。
          </p>
          <div className="bg-gray-50 rounded p-4 mb-4">
            <p className="text-sm text-gray-600">現在のデータ:</p>
            <ul className="text-sm text-gray-800 mt-2">
              <li>仕訳: {entries.length}件</li>
              <li>勘定科目: {accounts.length}件</li>
              <li>補助科目: {subAccounts.length}件</li>
            </ul>
          </div>
          <button
            onClick={handleBackup}
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px',
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
            バックアップをダウンロード
          </button>
        </div>

        {/* 復元 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">復元</h2>
          <p className="text-sm text-gray-600 mb-4">
            バックアップファイルからデータを復元します。
            <span className="text-red-600 font-medium">現在のデータは上書きされます。</span>
          </p>

          {restoreSuccess && (
            <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md">
              データを復元しました
            </div>
          )}

          {restoreError && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
              <p className="font-bold mb-1">エラー</p>
              <p>{restoreError}</p>
              <button
                onClick={() => setRestoreError(null)}
                className="mt-2 text-sm underline"
              >
                閉じる
              </button>
            </div>
          )}

          <label
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }}
          >
            バックアップファイルを選択
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* サンプルデータ生成 */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">サンプルデータ生成</h2>
        <p className="text-sm text-gray-600 mb-4">
          デモ用のサンプルデータを自動生成します。
          期首残高（資本金など）、補助科目（取引先・銀行口座）、過去6ヶ月分の仕訳が追加されます。
          <br />
          <span className="text-orange-600 font-medium">※勘定科目マスタ・補助科目・期首残高がリセットされます。</span>
        </p>

        {sampleDataSuccess && (
          <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md">
            サンプルデータを生成しました
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleGenerateSampleData}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px',
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
            サンプルデータを生成
          </button>
          <button
            onClick={() => {
              setEntries([]);
              clearAssets();
            }}
            disabled={entries.length === 0}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: entries.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: entries.length === 0 ? '#9ca3af' : '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              if (entries.length > 0) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (entries.length > 0) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
          >
            全仕訳・固定資産を削除
          </button>
        </div>
      </div>

      {/* 復元確認モーダル */}
      {confirmRestore && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '448px' }}>
            <h2 className="text-lg font-bold mb-4">復元の確認</h2>
            <p className="text-gray-600 mb-4">
              以下のデータを復元します。現在のデータは上書きされます。
            </p>
            <div className="bg-gray-50 rounded p-4 mb-4">
              <ul className="text-sm text-gray-800">
                <li>仕訳: {confirmRestore.journals}件</li>
                <li>勘定科目: {confirmRestore.accounts}件</li>
              </ul>
            </div>
            <p className="text-red-600 text-sm mb-6">
              この操作は取り消せません。続行しますか？
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleRestore}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
              >
                復元する
              </button>
              <button
                onClick={() => setConfirmRestore(null)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '6px',
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
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
