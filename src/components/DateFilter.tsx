import { useState, useEffect } from 'react';

interface DateFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function DateFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateFilterProps) {
  const [quickSelect, setQuickSelect] = useState<string>('');

  // クイック選択の処理
  const handleQuickSelect = (value: string) => {
    setQuickSelect(value);
    const today = new Date();
    let start: Date;
    let end: Date = today;

    switch (value) {
      case 'this-month': {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      }
      case 'last-month': {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      }
      case 'this-quarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1);
        end = new Date(today.getFullYear(), quarter * 3 + 3, 0);
        break;
      }
      case 'this-year': {
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      }
      case 'last-year': {
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31);
        break;
      }
      case 'all': {
        onStartDateChange('');
        onEndDateChange('');
        return;
      }
      default:
        return;
    }

    onStartDateChange(formatDate(start));
    onEndDateChange(formatDate(end));
  };

  // 日付をYYYY-MM-DD形式に変換
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // 手動で日付を変更した場合、クイック選択をリセット
  useEffect(() => {
    setQuickSelect('');
  }, [startDate, endDate]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }} className="no-print">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label className="text-sm text-gray-600">開始日:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          style={{
            width: '150px',
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
          }}
        />
      </div>
      <span className="text-gray-400">〜</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label className="text-sm text-gray-600">終了日:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          style={{
            width: '150px',
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
        <label className="text-sm text-gray-600">期間:</label>
        <select
          value={quickSelect}
          onChange={(e) => handleQuickSelect(e.target.value)}
          style={{
            width: '120px',
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
          }}
        >
          <option value="">選択...</option>
          <option value="this-month">今月</option>
          <option value="last-month">先月</option>
          <option value="this-quarter">今四半期</option>
          <option value="this-year">今年</option>
          <option value="last-year">昨年</option>
          <option value="all">全期間</option>
        </select>
      </div>
      {(startDate || endDate) && (
        <button
          onClick={() => {
            onStartDateChange('');
            onEndDateChange('');
            setQuickSelect('');
          }}
          style={{
            padding: '8px 16px',
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
    </div>
  );
}
