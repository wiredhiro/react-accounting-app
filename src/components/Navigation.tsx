export type Page = 'dashboard' | 'journal' | 'templates' | 'ledger' | 'sub-ledger' | 'customer-balance' | 'trial-balance' | 'financial-statements' | 'cash-flow' | 'monthly-trend' | 'tax-report' | 'fixed-assets' | 'accounts' | 'sub-accounts' | 'opening-balance' | 'year-end' | 'backup';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

interface NavItem {
  page: Page;
  label: string;
}

const navItems: NavItem[] = [
  { page: 'dashboard', label: 'ダッシュボード' },
  { page: 'journal', label: '仕訳入力' },
  { page: 'templates', label: 'テンプレート' },
  { page: 'ledger', label: '元帳' },
  { page: 'sub-ledger', label: '補助元帳' },
  { page: 'customer-balance', label: '得意先残高' },
  { page: 'trial-balance', label: '試算表' },
  { page: 'financial-statements', label: '財務諸表' },
  { page: 'cash-flow', label: 'CF計算書' },
  { page: 'monthly-trend', label: '月次推移' },
  { page: 'tax-report', label: '消費税' },
  { page: 'fixed-assets', label: '固定資産' },
  { page: 'accounts', label: '勘定科目' },
  { page: 'sub-accounts', label: '補助科目' },
  { page: 'opening-balance', label: '期首残高' },
  { page: 'year-end', label: '年度締め' },
  { page: 'backup', label: 'バックアップ' },
];

export function Navigation({ currentPage, onNavigate }: NavigationProps) {
  return (
    <nav className="no-print" style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#e5e7eb' }}>
      <div className="px-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-center" style={{ height: '56px', paddingTop: '8px' }}>
          <span className="font-bold text-lg text-gray-800">会計ソフト</span>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div style={{ marginLeft: '16px', marginRight: '16px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', overflowX: 'auto' }}>
          {navItems.map((item) => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                border: 'none',
                outline: 'none',
                cursor: 'pointer',
                backgroundColor: currentPage === item.page ? 'white' : '#e5e7eb',
                color: currentPage === item.page ? '#1f2937' : '#4b5563',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (currentPage !== item.page) {
                  e.currentTarget.style.backgroundColor = '#d1d5db';
                  e.currentTarget.style.color = '#1f2937';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== item.page) {
                  e.currentTarget.style.backgroundColor = '#e5e7eb';
                  e.currentTarget.style.color = '#4b5563';
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
