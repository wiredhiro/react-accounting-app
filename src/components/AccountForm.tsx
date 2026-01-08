import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Account } from '../types';
import { accountTypeLabels, accountTypeOrder } from '../types';

const accountSchema = z.object({
  code: z.string()
    .min(1, '科目コードは必須です')
    .max(10, '10文字以内で入力してください')
    .regex(/^[0-9]+$/, '科目コードは半角数字のみで入力してください'),
  name: z.string().min(1, '科目名は必須です').max(50, '50文字以内で入力してください'),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense'] as const),
  description: z.string().max(200, '200文字以内で入力してください').optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountFormProps {
  initialData?: Account;
  onSubmit: (data: AccountFormData) => void;
  onCancel: () => void;
}

export function AccountForm({ initialData, onSubmit, onCancel }: AccountFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: initialData
      ? {
          code: initialData.code,
          name: initialData.name,
          type: initialData.type,
          description: initialData.description || '',
        }
      : {
          type: 'asset',
          description: '',
        },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          科目コード <span className="text-red-500">*</span>
        </label>
        <input
          {...register('code')}
          maxLength={10}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxSizing: 'border-box',
          }}
          placeholder="例: 101"
        />
        {errors.code && (
          <p className="mt-1 text-sm text-red-500">{errors.code.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          科目名 <span className="text-red-500">*</span>
        </label>
        <input
          {...register('name')}
          maxLength={50}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxSizing: 'border-box',
          }}
          placeholder="例: 現金"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          勘定科目の分類 <span className="text-red-500">*</span>
        </label>
        <select
          {...register('type')}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxSizing: 'border-box',
          }}
        >
          {accountTypeOrder.map((type) => (
            <option key={type} value={type}>
              {accountTypeLabels[type]}
            </option>
          ))}
        </select>
        {errors.type && (
          <p className="mt-1 text-sm text-red-500">{errors.type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          説明
        </label>
        <textarea
          {...register('description')}
          rows={3}
          maxLength={200}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxSizing: 'border-box',
          }}
          placeholder="任意の説明を入力"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
        <button
          type="submit"
          style={{
            flex: 1,
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '6px',
            boxSizing: 'border-box',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b82f6'; }}
        >
          {initialData ? '更新' : '追加'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '6px',
            boxSizing: 'border-box',
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
    </form>
  );
}
