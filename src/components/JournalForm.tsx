import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo } from 'react';
import type { JournalEntry, TaxType, TaxRate, TaxIncluded, Account } from '../types';
import { taxTypeLabels, taxRateLabels, taxIncludedLabels } from '../types';
import { useAccountStore } from '../stores/accountStore';
import { useTemplateStore } from '../stores/templateStore';
import { useSubAccountStore } from '../stores/subAccountStore';
import { calculateTax } from '../utils/taxCalculation';

// 借方科目名から推奨される貸方科目名のマッピング
const creditAccountSuggestions: Record<string, string[]> = {
  // 資産科目が借方の場合
  '現金': ['売上', '普通預金', '売掛金', '受取利息'],
  '普通預金': ['売上', '売掛金', '現金', '受取利息', '借入金'],
  '当座預金': ['売上', '売掛金', '現金', '借入金'],
  '売掛金': ['売上'],
  '商品': ['買掛金', '現金', '普通預金'],
  '備品': ['現金', '普通預金', '未払金'],
  '車両運搬具': ['現金', '普通預金', '未払金', '借入金'],
  '建物': ['現金', '普通預金', '未払金', '借入金'],
  '機械装置': ['現金', '普通預金', '未払金', '借入金'],
  'ソフトウェア': ['現金', '普通預金', '未払金'],
  '仮払消費税': ['現金', '普通預金', '買掛金'],
  // 費用科目が借方の場合
  '仕入': ['買掛金', '現金', '普通預金'],
  '給料': ['現金', '普通預金'],
  '通信費': ['現金', '普通預金', '未払金'],
  '消耗品費': ['現金', '普通預金', '未払金'],
  '水道光熱費': ['現金', '普通預金', '未払金'],
  '旅費交通費': ['現金', '普通預金'],
  '広告宣伝費': ['現金', '普通預金', '未払金'],
  '減価償却費': ['減価償却累計額'],
  // 負債科目が借方の場合（支払時）
  '買掛金': ['現金', '普通預金'],
  '未払金': ['現金', '普通預金'],
  '未払消費税': ['現金', '普通預金'],
  '借入金': ['現金', '普通預金'],
  '仮受消費税': ['仮払消費税', '未払消費税'],
};

// 勘定科目タイプに基づく一般的な貸方科目タイプ
const creditTypesByDebitType: Record<string, string[]> = {
  'asset': ['revenue', 'asset', 'liability'],
  'expense': ['asset', 'liability'],
  'liability': ['asset'],
  'equity': ['asset', 'liability'],
  'revenue': ['asset'],
};

const journalSchema = z.object({
  date: z.string().min(1, '日付は必須です'),
  description: z.string().min(1, '摘要は必須です').max(200, '200文字以内で入力してください'),
  debitAccountId: z.string().min(1, '借方科目は必須です'),
  creditAccountId: z.string().min(1, '貸方科目は必須です'),
  debitSubAccountId: z.string().optional(),
  creditSubAccountId: z.string().optional(),
  amount: z.coerce.number().min(1, '金額は1以上で入力してください'),
  taxType: z.enum(['taxable_sales', 'taxable_purchase', 'tax_exempt', 'out_of_scope', 'tax_free_export']).optional(),
  taxRate: z.coerce.number().optional(),
  taxIncluded: z.enum(['included', 'excluded']).optional(),
});

// 消費税フィールドを含む仕訳データ型
export interface JournalFormSubmitData {
  date: string;
  description: string;
  debitAccountId: string;
  creditAccountId: string;
  debitSubAccountId?: string;
  creditSubAccountId?: string;
  amount: number;
  taxType?: TaxType;
  taxRate?: TaxRate;
  taxIncluded?: TaxIncluded;
}

interface JournalFormProps {
  initialData?: JournalEntry;
  onSubmit: (data: JournalFormSubmitData) => void;
  onCancel: () => void;
  onSaveTemplate?: (data: JournalFormSubmitData) => void;
}

export function JournalForm({ initialData, onSubmit, onCancel, onSaveTemplate }: JournalFormProps) {
  const { accounts } = useAccountStore();
  const { templates } = useTemplateStore();
  const { subAccounts } = useSubAccountStore();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(journalSchema),
    defaultValues: initialData
      ? {
          date: initialData.date,
          description: initialData.description,
          debitAccountId: initialData.debitAccountId,
          creditAccountId: initialData.creditAccountId,
          debitSubAccountId: initialData.debitSubAccountId || '',
          creditSubAccountId: initialData.creditSubAccountId || '',
          amount: initialData.amount,
          taxType: initialData.taxType || 'out_of_scope',
          taxRate: initialData.taxRate || 0,
          taxIncluded: initialData.taxIncluded || 'included',
        }
      : {
          date: new Date().toISOString().split('T')[0],
          description: '',
          debitAccountId: '',
          creditAccountId: '',
          debitSubAccountId: '',
          creditSubAccountId: '',
          amount: 0,
          taxType: 'out_of_scope' as TaxType,
          taxRate: 0,
          taxIncluded: 'included' as TaxIncluded,
        },
  });

  // 選択された勘定科目をウォッチ
  const debitAccountId = useWatch({ control, name: 'debitAccountId' });
  const creditAccountId = useWatch({ control, name: 'creditAccountId' });
  const watchedTaxType = useWatch({ control, name: 'taxType' });
  const watchedTaxRate = useWatch({ control, name: 'taxRate' });
  const watchedTaxIncluded = useWatch({ control, name: 'taxIncluded' });
  const watchedAmount = useWatch({ control, name: 'amount' });

  // 消費税計算
  const taxCalc = calculateTax(
    Number(watchedAmount) || 0,
    (Number(watchedTaxRate) || 0) as TaxRate,
    (watchedTaxIncluded || 'included') as TaxIncluded
  );

  // 課税取引かどうか
  const isTaxable = watchedTaxType === 'taxable_sales' || watchedTaxType === 'taxable_purchase';

  // 借方・貸方の補助科目リスト
  const debitSubAccounts = subAccounts.filter((sa) => sa.parentAccountId === debitAccountId);
  const creditSubAccounts = subAccounts.filter((sa) => sa.parentAccountId === creditAccountId);

  const sortedAccounts = [...accounts].sort((a, b) => a.code.localeCompare(b.code));

  // 選択された借方科目
  const selectedDebitAccount = accounts.find((a) => a.id === debitAccountId);

  // 借方科目に基づいておすすめの貸方科目を計算
  const { suggestedCredits, otherCredits } = useMemo(() => {
    if (!selectedDebitAccount) {
      return { suggestedCredits: [] as Account[], otherCredits: sortedAccounts };
    }

    const suggested: Account[] = [];
    const others: Account[] = [];

    // 名前に基づくサジェスト
    const suggestionNames = creditAccountSuggestions[selectedDebitAccount.name] || [];

    // タイプに基づくサジェスト用のタイプリスト
    const suggestionTypes = creditTypesByDebitType[selectedDebitAccount.type] || [];

    sortedAccounts.forEach((account) => {
      // 借方と同じ科目は除外
      if (account.id === debitAccountId) {
        others.push(account);
        return;
      }

      // 名前でサジェストされている場合
      if (suggestionNames.includes(account.name)) {
        suggested.push(account);
      }
      // タイプでサジェストされている場合（名前サジェストに含まれていない場合）
      else if (suggestionTypes.includes(account.type) && suggested.length < 8) {
        // 名前サジェストになくてもタイプ合致ならサジェストに追加（上限8件）
        if (!suggestionNames.length) {
          suggested.push(account);
        } else {
          others.push(account);
        }
      } else {
        others.push(account);
      }
    });

    // サジェストを名前リストの順序でソート
    if (suggestionNames.length > 0) {
      suggested.sort((a, b) => {
        const aIndex = suggestionNames.indexOf(a.name);
        const bIndex = suggestionNames.indexOf(b.name);
        if (aIndex === -1 && bIndex === -1) return a.code.localeCompare(b.code);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }

    return { suggestedCredits: suggested, otherCredits: others };
  }, [selectedDebitAccount, debitAccountId, sortedAccounts]);

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setValue('description', template.description);
      setValue('debitAccountId', template.debitAccountId);
      setValue('creditAccountId', template.creditAccountId);
      if (template.defaultAmount) {
        setValue('amount', template.defaultAmount);
      }
    }
  };

  const handleSaveAsTemplate = () => {
    if (onSaveTemplate) {
      const currentValues = getValues();
      onSaveTemplate({
        ...currentValues,
        amount: Number(currentValues.amount) || 0,
        taxRate: (Number(currentValues.taxRate) || 0) as TaxRate,
      });
    }
  };

  const handleFormSubmit = handleSubmit((data) => {
    onSubmit({
      ...data,
      taxRate: (Number(data.taxRate) || 0) as TaxRate,
    });
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      {/* テンプレート選択 */}
      {templates.length > 0 && !initialData && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            テンプレートから入力
          </label>
          <select
            onChange={(e) => handleTemplateSelect(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#eff6ff',
              boxSizing: 'border-box',
            }}
            defaultValue=""
          >
            <option value="">テンプレートを選択...</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          日付 <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          {...register('date')}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxSizing: 'border-box',
          }}
        />
        {errors.date && (
          <p className="mt-1 text-sm text-red-500">{errors.date.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          摘要 <span className="text-red-500">*</span>
        </label>
        <input
          {...register('description')}
          maxLength={200}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxSizing: 'border-box',
          }}
          placeholder="例: 商品売上"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              借方科目 <span className="text-red-500">*</span>
            </label>
            <select
              {...register('debitAccountId')}
              onChange={(e) => {
                setValue('debitAccountId', e.target.value);
                setValue('debitSubAccountId', ''); // 補助科目をリセット
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
            >
              <option value="">選択してください</option>
              {sortedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} {account.name}
                </option>
              ))}
            </select>
            {errors.debitAccountId && (
              <p className="mt-1 text-sm text-red-500">{errors.debitAccountId.message}</p>
            )}
          </div>
          {debitSubAccounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                借方補助科目
              </label>
              <select
                {...register('debitSubAccountId')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: '#f9fafb',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">（補助科目なし）</option>
                {debitSubAccounts.map((sa) => (
                  <option key={sa.id} value={sa.id}>
                    {sa.code} {sa.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              貸方科目 <span className="text-red-500">*</span>
            </label>
            <select
              {...register('creditAccountId')}
              onChange={(e) => {
                setValue('creditAccountId', e.target.value);
                setValue('creditSubAccountId', ''); // 補助科目をリセット
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
            >
              <option value="">選択してください</option>
              {suggestedCredits.length > 0 && (
                <optgroup label="おすすめ">
                  {suggestedCredits.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} {account.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={suggestedCredits.length > 0 ? 'その他' : 'すべての科目'}>
                {otherCredits.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} {account.name}
                  </option>
                ))}
              </optgroup>
            </select>
            {errors.creditAccountId && (
              <p className="mt-1 text-sm text-red-500">{errors.creditAccountId.message}</p>
            )}
          </div>
          {creditSubAccounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                貸方補助科目
              </label>
              <select
                {...register('creditSubAccountId')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: '#f9fafb',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">（補助科目なし）</option>
                {creditSubAccounts.map((sa) => (
                  <option key={sa.id} value={sa.id}>
                    {sa.code} {sa.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          金額 <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          {...register('amount')}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxSizing: 'border-box',
          }}
          placeholder="0"
          min="1"
        />
        {errors.amount && (
          <p className="mt-1 text-sm text-red-500">{errors.amount.message}</p>
        )}
      </div>

      {/* 消費税設定 */}
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700">消費税設定</label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">税区分</label>
            <select
              {...register('taxType')}
              onChange={(e) => {
                setValue('taxType', e.target.value as TaxType);
                // 非課税・不課税・免税の場合は税率を0に
                if (['tax_exempt', 'out_of_scope', 'tax_free_export'].includes(e.target.value)) {
                  setValue('taxRate', 0);
                } else if (e.target.value === 'taxable_sales' || e.target.value === 'taxable_purchase') {
                  // 課税の場合はデフォルト10%
                  if (Number(getValues('taxRate')) === 0) {
                    setValue('taxRate', 10);
                  }
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
            >
              {(Object.keys(taxTypeLabels) as TaxType[]).map((type) => (
                <option key={type} value={type}>
                  {taxTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">税率</label>
            <select
              {...register('taxRate')}
              disabled={!isTaxable}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: !isTaxable ? '#f3f4f6' : '#ffffff',
                boxSizing: 'border-box',
              }}
            >
              {([0, 8, 10] as TaxRate[]).map((rate) => (
                <option key={rate} value={rate}>
                  {taxRateLabels[rate]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">税込/税抜</label>
            <select
              {...register('taxIncluded')}
              disabled={!isTaxable}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: !isTaxable ? '#f3f4f6' : '#ffffff',
                boxSizing: 'border-box',
              }}
            >
              {(Object.keys(taxIncludedLabels) as TaxIncluded[]).map((type) => (
                <option key={type} value={type}>
                  {taxIncludedLabels[type]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 消費税計算結果 */}
        {isTaxable && Number(watchedTaxRate) > 0 && Number(watchedAmount) > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-md text-sm">
            <div className="grid grid-cols-3 gap-2 text-gray-700">
              <div>
                <span className="text-xs text-gray-500">税抜金額</span>
                <p className="font-medium">{taxCalc.baseAmount.toLocaleString()}円</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">消費税額</span>
                <p className="font-medium text-blue-600">{taxCalc.taxAmount.toLocaleString()}円</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">税込金額</span>
                <p className="font-medium">{taxCalc.totalAmount.toLocaleString()}円</p>
              </div>
            </div>
          </div>
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

      {/* テンプレートとして保存 */}
      {onSaveTemplate && !initialData && (
        <div style={{ marginTop: '12px' }}>
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            style={{
              width: '100%',
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
            この内容をテンプレートとして保存...
          </button>
        </div>
      )}
    </form>
  );
}
