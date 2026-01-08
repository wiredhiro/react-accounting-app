import { useState } from 'react';
import { AccountList } from './components/AccountList';
import { JournalList } from './components/JournalList';
import { TemplateManager } from './components/TemplateManager';
import { GeneralLedger } from './components/GeneralLedger';
import { SubAccountLedger } from './components/SubAccountLedger';
import { TrialBalance } from './components/TrialBalance';
import { FinancialStatements } from './components/FinancialStatements';
import { CashFlowStatement } from './components/CashFlowStatement';
import { Dashboard } from './components/Dashboard';
import { BackupRestore } from './components/BackupRestore';
import { OpeningBalanceSettings } from './components/OpeningBalanceSettings';
import { MonthlyTrend } from './components/MonthlyTrend';
import { TaxReport } from './components/TaxReport';
import { SubAccountManager } from './components/SubAccountManager';
import { YearEndClosing } from './components/YearEndClosing';
import { FixedAssetLedger } from './components/FixedAssetLedger';
import { CustomerBalanceList } from './components/CustomerBalanceList';
import { Navigation } from './components/Navigation';
import type { Page } from './components/Navigation';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  return (
    <div className="min-h-screen bg-gray-200">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="mx-4">
        <div className="bg-white min-h-screen" style={{ padding: '24px' }}>
        {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'journal' && <JournalList />}
      {currentPage === 'templates' && <TemplateManager />}
      {currentPage === 'ledger' && <GeneralLedger />}
      {currentPage === 'sub-ledger' && <SubAccountLedger />}
      {currentPage === 'customer-balance' && <CustomerBalanceList />}
      {currentPage === 'trial-balance' && <TrialBalance />}
      {currentPage === 'financial-statements' && <FinancialStatements />}
      {currentPage === 'cash-flow' && <CashFlowStatement />}
      {currentPage === 'monthly-trend' && <MonthlyTrend />}
      {currentPage === 'tax-report' && <TaxReport />}
      {currentPage === 'fixed-assets' && <FixedAssetLedger />}
      {currentPage === 'accounts' && <AccountList />}
      {currentPage === 'sub-accounts' && <SubAccountManager />}
      {currentPage === 'opening-balance' && <OpeningBalanceSettings />}
      {currentPage === 'year-end' && <YearEndClosing />}
      {currentPage === 'backup' && <BackupRestore />}
        </div>
      </div>
    </div>
  );
}

export default App;
