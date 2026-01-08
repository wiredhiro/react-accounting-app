import type { Account } from '../types';

const now = new Date().toISOString();

export const defaultAccounts: Account[] = [
  // 資産
  { id: 'acc-101', code: '101', name: '現金', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-102', code: '102', name: '普通預金', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-103', code: '103', name: '当座預金', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-110', code: '110', name: '売掛金', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-120', code: '120', name: '商品', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-150', code: '150', name: '備品', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-151', code: '151', name: '車両運搬具', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-152', code: '152', name: '建物', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-153', code: '153', name: '機械装置', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-154', code: '154', name: 'ソフトウェア', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-159', code: '159', name: '減価償却累計額', type: 'asset', createdAt: now, updatedAt: now },
  { id: 'acc-160', code: '160', name: '仮払消費税', type: 'asset', createdAt: now, updatedAt: now },
  // 負債
  { id: 'acc-201', code: '201', name: '買掛金', type: 'liability', createdAt: now, updatedAt: now },
  { id: 'acc-202', code: '202', name: '未払金', type: 'liability', createdAt: now, updatedAt: now },
  { id: 'acc-203', code: '203', name: '仮受消費税', type: 'liability', createdAt: now, updatedAt: now },
  { id: 'acc-204', code: '204', name: '未払消費税', type: 'liability', createdAt: now, updatedAt: now },
  { id: 'acc-210', code: '210', name: '借入金', type: 'liability', createdAt: now, updatedAt: now },
  // 純資産
  { id: 'acc-301', code: '301', name: '資本金', type: 'equity', createdAt: now, updatedAt: now },
  { id: 'acc-302', code: '302', name: '繰越利益剰余金', type: 'equity', createdAt: now, updatedAt: now },
  // 収益
  { id: 'acc-401', code: '401', name: '売上', type: 'revenue', createdAt: now, updatedAt: now },
  { id: 'acc-402', code: '402', name: '受取利息', type: 'revenue', createdAt: now, updatedAt: now },
  // 費用
  { id: 'acc-501', code: '501', name: '仕入', type: 'expense', createdAt: now, updatedAt: now },
  { id: 'acc-502', code: '502', name: '給料', type: 'expense', createdAt: now, updatedAt: now },
  { id: 'acc-503', code: '503', name: '通信費', type: 'expense', createdAt: now, updatedAt: now },
  { id: 'acc-504', code: '504', name: '消耗品費', type: 'expense', createdAt: now, updatedAt: now },
  { id: 'acc-505', code: '505', name: '水道光熱費', type: 'expense', createdAt: now, updatedAt: now },
  { id: 'acc-506', code: '506', name: '旅費交通費', type: 'expense', createdAt: now, updatedAt: now },
  { id: 'acc-507', code: '507', name: '広告宣伝費', type: 'expense', createdAt: now, updatedAt: now },
  { id: 'acc-508', code: '508', name: '減価償却費', type: 'expense', createdAt: now, updatedAt: now },
];
