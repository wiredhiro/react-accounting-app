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
import type { Account } from '../types';
import { accountTypeLabels } from '../types';
import { useAccountStore } from '../stores/accountStore';
import { AccountForm } from './AccountForm';

const columnHelper = createColumnHelper<Account>();

export function AccountList() {
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccountStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const columns = useMemo(
    () => [
      columnHelper.accessor('code', {
        header: 'コード',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('name', {
        header: '科目名',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('type', {
        header: '分類',
        cell: (info) => (
          <span
            className={`px-2 py-1 rounded text-sm ${getTypeColor(info.getValue())}`}
          >
            {accountTypeLabels[info.getValue()]}
          </span>
        ),
      }),
      columnHelper.accessor('description', {
        header: '説明',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.display({
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleEdit(row.original)}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }}
            >
              編集
            </button>
            <button
              onClick={() => setDeleteConfirm(row.original.id)}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }}
            >
              削除
            </button>
          </div>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: accounts,
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

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => {
    // コードの重複チェック
    const isDuplicate = accounts.some(
      (account) => account.code === data.code && account.id !== editingAccount?.id
    );

    if (isDuplicate) {
      alert(`科目コード「${data.code}」は既に使用されています。別のコードを入力してください。`);
      return;
    }

    if (editingAccount) {
      updateAccount(editingAccount.id, data);
    } else {
      addAccount(data);
    }
    setIsFormOpen(false);
    setEditingAccount(null);
  };

  const handleDelete = (id: string) => {
    deleteAccount(id);
    setDeleteConfirm(null);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">勘定科目マスタ</h1>
        <button
          onClick={() => {
            setEditingAccount(null);
            setIsFormOpen(true);
          }}
          style={{
            padding: '10px 20px',
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
          + 新規追加
        </button>
      </div>

      <div className="mb-4">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <svg
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '18px',
              height: '18px',
            }}
            fill="none"
            stroke="#9ca3af"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="検索..."
            style={{
              width: '280px',
              padding: '12px 12px 12px 40px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

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
            勘定科目がありません
          </div>
        )}
      </div>

      {/* フォームモーダル */}
      {isFormOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '448px' }}>
            <h2 className="text-xl font-bold mb-4">
              {editingAccount ? '勘定科目を編集' : '新規勘定科目'}
            </h2>
            <AccountForm
              initialData={editingAccount || undefined}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingAccount(null);
              }}
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
              この勘定科目を削除してもよろしいですか？
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
    </div>
  );
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'asset':
      return 'bg-blue-100 text-blue-800';
    case 'liability':
      return 'bg-red-100 text-red-800';
    case 'equity':
      return 'bg-purple-100 text-purple-800';
    case 'revenue':
      return 'bg-green-100 text-green-800';
    case 'expense':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
