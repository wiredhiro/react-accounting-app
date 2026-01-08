import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  balance: number;
}

// 日本語から英語への変換マップ
const translations: Record<string, string> = {
  // 勘定科目
  '売上': 'Sales',
  '受取利息': 'Interest Income',
  '仕入': 'Purchases',
  '給料': 'Salaries',
  '通信費': 'Communication',
  '消耗品費': 'Supplies',
  '水道光熱費': 'Utilities',
  '旅費交通費': 'Travel',
  '広告宣伝費': 'Advertising',
  '現金': 'Cash',
  '普通預金': 'Bank Deposit',
  '当座預金': 'Checking Account',
  '売掛金': 'Accounts Receivable',
  '商品': 'Inventory',
  '備品': 'Equipment',
  '買掛金': 'Accounts Payable',
  '未払金': 'Accrued Expenses',
  '借入金': 'Loans Payable',
  '資本金': 'Capital Stock',
  '繰越利益剰余金': 'Retained Earnings',
};

function translate(text: string): string {
  return translations[text] || text;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString() + ' JPY';
}

function getDateRange(startDate: string, endDate: string): string {
  const start = startDate || 'Beginning';
  const end = endDate || new Date().toISOString().split('T')[0];
  return `Period: ${start} - ${end}`;
}

// 損益計算書PDF出力
export function exportPLToPDF(
  revenue: AccountBalance[],
  expense: AccountBalance[],
  netIncome: number,
  startDate: string,
  endDate: string
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // タイトル
  doc.setFontSize(20);
  doc.text('Profit and Loss Statement', pageWidth / 2, 20, { align: 'center' });

  // 期間
  doc.setFontSize(10);
  doc.text(getDateRange(startDate, endDate), pageWidth / 2, 28, { align: 'center' });

  let yPos = 40;

  // 収益セクション
  doc.setFontSize(14);
  doc.text('Revenue', 14, yPos);
  yPos += 5;

  if (revenue.length > 0) {
    const revenueData = revenue.map((item) => [translate(item.name), formatAmount(item.balance)]);
    revenueData.push(['Total Revenue', formatAmount(revenue.reduce((sum, a) => sum + a.balance, 0))]);

    autoTable(doc, {
      startY: yPos,
      head: [['Account', 'Amount']],
      body: revenueData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 50, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // 費用セクション
  doc.setFontSize(14);
  doc.text('Expenses', 14, yPos);
  yPos += 5;

  if (expense.length > 0) {
    const expenseData = expense.map((item) => [translate(item.name), formatAmount(item.balance)]);
    expenseData.push(['Total Expenses', formatAmount(expense.reduce((sum, a) => sum + a.balance, 0))]);

    autoTable(doc, {
      startY: yPos,
      head: [['Account', 'Amount']],
      body: expenseData,
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 50, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // 当期純利益
  doc.setFontSize(14);
  doc.setTextColor(netIncome >= 0 ? 0 : 255, netIncome >= 0 ? 100 : 0, netIncome >= 0 ? 0 : 0);
  doc.text(`Net Income: ${formatAmount(netIncome)}`, 14, yPos);
  doc.setTextColor(0, 0, 0);

  // フッター
  const today = new Date().toLocaleDateString();
  doc.setFontSize(8);
  doc.text(`Generated: ${today}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });

  doc.save(`PL_${new Date().toISOString().split('T')[0]}.pdf`);
}

// 貸借対照表PDF出力
export function exportBSToPDF(
  assets: AccountBalance[],
  liabilities: AccountBalance[],
  equity: AccountBalance[],
  netIncome: number,
  _startDate: string,
  endDate: string
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // タイトル
  doc.setFontSize(20);
  doc.text('Balance Sheet', pageWidth / 2, 20, { align: 'center' });

  // 基準日
  doc.setFontSize(10);
  doc.text(`As of: ${endDate || new Date().toISOString().split('T')[0]}`, pageWidth / 2, 28, { align: 'center' });

  let yPos = 40;

  // 資産セクション
  doc.setFontSize(14);
  doc.text('Assets', 14, yPos);
  yPos += 5;

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);

  if (assets.length > 0) {
    const assetsData = assets.map((item) => [translate(item.name), formatAmount(item.balance)]);
    assetsData.push(['Total Assets', formatAmount(totalAssets)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Account', 'Amount']],
      body: assetsData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 50, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // 負債セクション
  doc.setFontSize(14);
  doc.text('Liabilities', 14, yPos);
  yPos += 5;

  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);

  if (liabilities.length > 0) {
    const liabilitiesData = liabilities.map((item) => [translate(item.name), formatAmount(item.balance)]);
    liabilitiesData.push(['Total Liabilities', formatAmount(totalLiabilities)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Account', 'Amount']],
      body: liabilitiesData,
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 50, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  } else {
    yPos += 5;
  }

  // 純資産セクション
  doc.setFontSize(14);
  doc.text('Equity', 14, yPos);
  yPos += 5;

  const totalEquityBase = equity.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = totalEquityBase + netIncome;

  const equityData = equity.map((item) => [translate(item.name), formatAmount(item.balance)]);
  if (netIncome !== 0) {
    equityData.push(['Net Income', formatAmount(netIncome)]);
  }
  equityData.push(['Total Equity', formatAmount(totalEquity)]);

  autoTable(doc, {
    startY: yPos,
    head: [['Account', 'Amount']],
    body: equityData,
    theme: 'striped',
    headStyles: { fillColor: [139, 92, 246] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 50, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

  // バランス確認
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const isBalanced = totalAssets === totalLiabilitiesAndEquity;

  doc.setFontSize(12);
  doc.setTextColor(isBalanced ? 0 : 255, isBalanced ? 128 : 0, 0);
  doc.text(`Assets: ${formatAmount(totalAssets)}`, 14, yPos);
  doc.text(`Liabilities + Equity: ${formatAmount(totalLiabilitiesAndEquity)}`, 14, yPos + 6);
  doc.text(isBalanced ? 'BALANCED' : 'NOT BALANCED', 14, yPos + 12);
  doc.setTextColor(0, 0, 0);

  // フッター
  const today = new Date().toLocaleDateString();
  doc.setFontSize(8);
  doc.text(`Generated: ${today}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });

  doc.save(`BS_${new Date().toISOString().split('T')[0]}.pdf`);
}
