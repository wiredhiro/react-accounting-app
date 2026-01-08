import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import type { SortingState } from '@tanstack/react-table';
import type { JournalEntry } from '../types';
import { useJournalStore } from '../stores/journalStore';
import { useAccountStore } from '../stores/accountStore';
import { useTemplateStore } from '../stores/templateStore';
import { JournalForm, type JournalFormSubmitData } from './JournalForm';
import { downloadCSV, journalToCSV } from '../utils/csv';

const columnHelper = createColumnHelper<JournalEntry>();

export function JournalList() {
  const { entries, addEntry, updateEntry, deleteEntry, deleteEntries } = useJournalStore();
  const { accounts } = useAccountStore();
  const { addTemplate } = useTemplateStore();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState<JournalEntry | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [pendingTemplateData, setPendingTemplateData] = useState<{
    description: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
  } | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState(false);

  // フィルター適用
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // 日付フィルター
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;

      // 勘定科目フィルター
      if (accountFilter) {
        const debitMatch = entry.debitAccountId === accountFilter;
        const creditMatch = entry.creditAccountId === accountFilter;
        if (!debitMatch && !creditMatch) return false;
      }

      // 金額範囲フィルター
      if (minAmount && entry.amount < Number(minAmount)) return false;
      if (maxAmount && entry.amount > Number(maxAmount)) return false;

      return true;
    });
  }, [entries, startDate, endDate, accountFilter, minAmount, maxAmount]);

  // フィルターをクリア
  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setAccountFilter('');
    setMinAmount('');
    setMaxAmount('');
    setGlobalFilter('');
  };

  // アクティブなフィルターの数
  const activeFilterCount = [startDate, endDate, accountFilter, minAmount, maxAmount, globalFilter].filter(Boolean).length;

  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account ? `${account.code} ${account.name}` : '不明';
  };

  // 選択関連のヘルパー関数
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const visibleIds = table.getRowModel().rows.map((row) => row.original.id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // 一括削除
  const handleBulkDelete = () => {
    deleteEntries(Array.from(selectedIds));
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            checked={table.getRowModel().rows.length > 0 && table.getRowModel().rows.every((row) => selectedIds.has(row.original.id))}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleSelect(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
      }),
      columnHelper.accessor('date', {
        header: '日付',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('description', {
        header: '摘要',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('debitAccountId', {
        header: '借方',
        cell: (info) => getAccountName(info.getValue()),
      }),
      columnHelper.accessor('creditAccountId', {
        header: '貸方',
        cell: (info) => getAccountName(info.getValue()),
      }),
      columnHelper.accessor('amount', {
        header: () => <div style={{ textAlign: 'right', paddingRight: '24px' }}>金額</div>,
        cell: (info) => (
          <div style={{ textAlign: 'right', paddingRight: '24px' }}>{info.getValue().toLocaleString()}円</div>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row.original);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontSize: '13px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
            >
              編集
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDuplicateConfirm(row.original);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontSize: '13px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
            >
              複製
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirm(row.original.id);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontSize: '13px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
            >
              削除
            </button>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, selectedIds]
  );

  const table = useReactTable({
    data: filteredEntries,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setIsFormOpen(true);
  };

  // 仕訳を複製（今日の日付で新規作成）
  const handleDuplicate = (entry: JournalEntry) => {
    addEntry({
      date: new Date().toISOString().split('T')[0],
      description: entry.description,
      debitAccountId: entry.debitAccountId,
      creditAccountId: entry.creditAccountId,
      debitSubAccountId: entry.debitSubAccountId,
      creditSubAccountId: entry.creditSubAccountId,
      amount: entry.amount,
      taxType: entry.taxType,
      taxRate: entry.taxRate,
      taxIncluded: entry.taxIncluded,
      taxAmount: entry.taxAmount,
    });
    setDuplicateConfirm(null);
  };

  const handleFormSubmit = (data: JournalFormSubmitData) => {
    if (editingEntry) {
      updateEntry(editingEntry.id, data);
    } else {
      addEntry(data);
    }
    setIsFormOpen(false);
    setEditingEntry(null);
  };

  const handleDelete = (id: string) => {
    deleteEntry(id);
    setDeleteConfirm(null);
  };

  // CSVエクスポート（フィルター適用後のデータをエクスポート）
  const handleExport = () => {
    const getSimpleAccountName = (id: string) => {
      const account = accounts.find((a) => a.id === id);
      return account?.name || '不明';
    };
    const csv = journalToCSV(filteredEntries, getSimpleAccountName);
    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `仕訳一覧_${today}.csv`);
  };

  // テンプレートとして保存
  const handleSaveTemplate = (data: { description: string; debitAccountId: string; creditAccountId: string; amount: number }) => {
    setPendingTemplateData(data);
    setTemplateName(data.description || '');
    setTemplateModalOpen(true);
  };

  const confirmSaveTemplate = () => {
    if (pendingTemplateData && templateName.trim()) {
      addTemplate({
        name: templateName.trim(),
        description: pendingTemplateData.description,
        debitAccountId: pendingTemplateData.debitAccountId,
        creditAccountId: pendingTemplateData.creditAccountId,
        defaultAmount: pendingTemplateData.amount > 0 ? pendingTemplateData.amount : undefined,
      });
      setTemplateModalOpen(false);
      setPendingTemplateData(null);
      setTemplateName('');
      setTemplateSaveSuccess(true);
      setTimeout(() => setTemplateSaveSuccess(false), 3000);
    }
  };

  return (
    <div className="p-6">
      <div className="print-header">
        <h1>仕訳帳</h1>
        <p>出力日: {new Date().toLocaleDateString('ja-JP')}</p>
      </div>

      <div className="flex justify-between items-center mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-800">仕訳入力</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => window.print()}
            disabled={filteredEntries.length === 0}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: filteredEntries.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: filteredEntries.length === 0 ? '#9ca3af' : '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              if (filteredEntries.length > 0) e.currentTarget.style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              if (filteredEntries.length > 0) e.currentTarget.style.backgroundColor = '#3b82f6';
            }}
          >
            印刷 / PDF保存
          </button>
          <button
            onClick={handleExport}
            disabled={filteredEntries.length === 0}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: filteredEntries.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: filteredEntries.length === 0 ? '#9ca3af' : '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              if (filteredEntries.length > 0) e.currentTarget.style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              if (filteredEntries.length > 0) e.currentTarget.style.backgroundColor = '#3b82f6';
            }}
          >
            CSVエクスポート
          </button>
          <button
            onClick={() => {
              setEditingEntry(null);
              setIsFormOpen(true);
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
          >
            + 新規追加
          </button>
        </div>
      </div>

      {/* 成功メッセージ */}
      {templateSaveSuccess && (
        <div className="mb-4 p-4 bg-purple-100 text-purple-700 rounded-md">
          テンプレートを保存しました
        </div>
      )}
      {importErrors.length > 0 && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
          <p className="font-bold mb-2">インポートエラー:</p>
          <ul className="list-disc list-inside">
            {importErrors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
          <button
            onClick={() => setImportErrors([])}
            className="mt-2 text-sm underline"
          >
            閉じる
          </button>
        </div>
      )}

      {/* 検索・フィルターパネル */}
      <div className="mb-4 no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              style={{ position: 'absolute', width: '18px', height: '18px', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="摘要を検索..."
              style={{ width: '100%', padding: '12px 16px 12px 42px', fontSize: '15px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '12px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: showFilters || activeFilterCount > 0 ? '#2563eb' : '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              if (showFilters || activeFilterCount > 0) {
                e.currentTarget.style.backgroundColor = '#1d4ed8';
              } else {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (showFilters || activeFilterCount > 0) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              } else {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              style={{ width: '16px', height: '16px', transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            フィルター
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              style={{
                padding: '6px 12px',
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
              クリア
            </button>
          )}
          <span className="text-sm text-gray-500">
            {filteredEntries.length}件 / 全{entries.length}件
          </span>
        </div>

        {/* 詳細フィルター */}
        {showFilters && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
            {/* クイック選択 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
              <span className="text-sm text-gray-600">期間:</span>
              <button
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                  setStartDate(firstDay.toISOString().split('T')[0]);
                  setEndDate(now.toISOString().split('T')[0]);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
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
                今月
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
                  setStartDate(firstDay.toISOString().split('T')[0]);
                  setEndDate(lastDay.toISOString().split('T')[0]);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
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
                先月
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                  setStartDate(firstDay.toISOString().split('T')[0]);
                  setEndDate(now.toISOString().split('T')[0]);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
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
                過去3ヶ月
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), 0, 1);
                  setStartDate(firstDay.toISOString().split('T')[0]);
                  setEndDate(now.toISOString().split('T')[0]);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
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
                今年
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
              {/* 日付範囲 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: '160px',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '160px',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* 勘定科目フィルター */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">勘定科目</label>
                <select
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  style={{
                    width: '200px',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="">すべて</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} {account.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 金額範囲 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">金額範囲</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    placeholder="最小"
                    min="0"
                    style={{
                      width: '120px',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                  <span className="text-gray-500">〜</span>
                  <input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    placeholder="最大"
                    min="0"
                    style={{
                      width: '120px',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 選択時の操作バー */}
      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '12px 0' }} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#1f2937', fontWeight: 500 }}>
              {selectedIds.size}件選択中
            </span>
            <button
              onClick={clearSelection}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
            >
              選択解除
            </button>
          </div>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            一括削除
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            仕訳がありません
          </div>
        )}
      </div>

      {/* フォームモーダル */}
      {isFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '512px' }}>
            <h2 className="text-xl font-bold mb-4">
              {editingEntry ? '仕訳を編集' : '新規仕訳'}
            </h2>
            <JournalForm
              key={editingEntry?.id || 'new'}
              initialData={editingEntry || undefined}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingEntry(null);
              }}
              onSaveTemplate={handleSaveTemplate}
            />
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '384px' }}>
            <h2 className="text-lg font-bold mb-4">削除の確認</h2>
            <p className="text-gray-600 mb-6">
              この仕訳を削除してもよろしいですか？
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleDelete(deleteConfirm)}
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
                削除
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
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

      {/* 複製確認モーダル */}
      {duplicateConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '420px' }}>
            <h2 className="text-lg font-bold mb-4">複製の確認</h2>
            <p className="text-gray-600 mb-4">
              この仕訳を今日の日付で複製しますか？
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <p className="text-gray-500">元の日付:</p>
                <p className="text-gray-700 font-medium">{duplicateConfirm.date}</p>
                <p className="text-gray-500">新しい日付:</p>
                <p className="text-blue-600 font-medium">{new Date().toISOString().split('T')[0]}</p>
                <p className="text-gray-500">摘要:</p>
                <p className="text-gray-700">{duplicateConfirm.description || '(なし)'}</p>
                <p className="text-gray-500">借方:</p>
                <p className="text-gray-700">{getAccountName(duplicateConfirm.debitAccountId)}</p>
                <p className="text-gray-500">貸方:</p>
                <p className="text-gray-700">{getAccountName(duplicateConfirm.creditAccountId)}</p>
                <p className="text-gray-500">金額:</p>
                <p className="text-gray-700 font-medium">{duplicateConfirm.amount.toLocaleString()}円</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleDuplicate(duplicateConfirm)}
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
                複製する
              </button>
              <button
                onClick={() => setDuplicateConfirm(null)}
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

      {/* 一括削除確認モーダル */}
      {bulkDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '420px' }}>
            <h2 className="text-lg font-bold mb-4 text-red-600">一括削除の確認</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 font-medium mb-2">
                {selectedIds.size}件の仕訳を削除しようとしています
              </p>
              <p className="text-red-600 text-sm">
                この操作は取り消せません。本当に削除しますか？
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
              <p className="text-sm font-medium text-gray-700 mb-2">削除対象:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {Array.from(selectedIds).slice(0, 10).map((id) => {
                  const entry = entries.find((e) => e.id === id);
                  if (!entry) return null;
                  return (
                    <li key={id} className="flex justify-between">
                      <span>{entry.date} - {entry.description || '(摘要なし)'}</span>
                      <span className="text-gray-500">{entry.amount.toLocaleString()}円</span>
                    </li>
                  );
                })}
                {selectedIds.size > 10 && (
                  <li className="text-gray-400 italic">
                    ...他 {selectedIds.size - 10}件
                  </li>
                )}
              </ul>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleBulkDelete}
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
                {selectedIds.size}件を削除
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(false)}
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

      {/* テンプレート保存モーダル */}
      {templateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '384px' }}>
            <h2 className="text-lg font-bold mb-4">テンプレートとして保存</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                テンプレート名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                }}
                placeholder="例: 売上入金"
              />
            </div>
            {pendingTemplateData && (
              <div className="bg-gray-50 rounded p-3 mb-4 text-sm">
                <p className="text-gray-600">摘要: {pendingTemplateData.description || '(なし)'}</p>
                <p className="text-gray-600">借方: {getAccountName(pendingTemplateData.debitAccountId)}</p>
                <p className="text-gray-600">貸方: {getAccountName(pendingTemplateData.creditAccountId)}</p>
                {pendingTemplateData.amount > 0 && (
                  <p className="text-gray-600">金額: {pendingTemplateData.amount.toLocaleString()}円</p>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={confirmSaveTemplate}
                disabled={!templateName.trim()}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: !templateName.trim() ? 'not-allowed' : 'pointer',
                  backgroundColor: !templateName.trim() ? '#9ca3af' : '#3b82f6',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => { if (templateName.trim()) e.currentTarget.style.backgroundColor = '#2563eb'; }}
                onMouseLeave={(e) => { if (templateName.trim()) e.currentTarget.style.backgroundColor = '#3b82f6'; }}
              >
                保存
              </button>
              <button
                onClick={() => {
                  setTemplateModalOpen(false);
                  setPendingTemplateData(null);
                  setTemplateName('');
                }}
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
