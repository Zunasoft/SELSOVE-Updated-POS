import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ListTree, Landmark, Wallet, Scale, Users, Truck,
  TrendingUp, TrendingDown, Receipt, HandCoins, ArrowLeftRight,
  BookOpenCheck, CheckCheck, FileBarChart2, ChevronRight
} from 'lucide-react';

import AccountsDashboard from './AccountsDashboard';
import ChartOfAccounts from './ChartOfAccounts';
import PartyLedgers from './PartyLedgers';
import IncomeView from './IncomeView';
import ExpensesView from './ExpensesView';
import LiquidAccounts from './LiquidAccounts';
import JournalEntries from './JournalEntries';
import MoneyMovement from './MoneyMovement';
import FundTransfer from './FundTransfer';
import OpeningBalances from './OpeningBalances';
import Reconciliation from './Reconciliation';
import AccountReports from './AccountReports';

/**
 * The Accounts workspace. Grouped navigation mirrors how a bookkeeper actually
 * works — masters first, then parties, then day-to-day vouchers, then control
 * and reporting — rather than listing fifteen flat menu items.
 */
const NAV = [
  {
    group: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }]
  },
  {
    group: 'Masters',
    items: [
      { id: 'chart', label: 'Chart of Accounts', icon: ListTree },
      { id: 'bank', label: 'Bank Accounts', icon: Landmark },
      { id: 'cash', label: 'Cash Accounts', icon: Wallet },
      { id: 'opening', label: 'Opening Balances', icon: Scale }
    ]
  },
  {
    group: 'Parties',
    items: [
      { id: 'customers', label: 'Customers', icon: Users, hint: 'Receivables' },
      { id: 'vendors', label: 'Vendors', icon: Truck, hint: 'Payables' }
    ]
  },
  {
    group: 'Transactions',
    items: [
      { id: 'income', label: 'Income', icon: TrendingUp },
      { id: 'expenses', label: 'Expenses', icon: TrendingDown },
      { id: 'receipts', label: 'Receipts', icon: Receipt },
      { id: 'payments', label: 'Payments', icon: HandCoins },
      { id: 'transfer', label: 'Fund Transfer', icon: ArrowLeftRight },
      { id: 'journal', label: 'Journal Entries', icon: BookOpenCheck }
    ]
  },
  {
    group: 'Control',
    items: [
      { id: 'reconciliation', label: 'Reconciliation', icon: CheckCheck },
      { id: 'reports', label: 'Reports', icon: FileBarChart2 }
    ]
  }
];

const FLAT = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

export default function AccountsModule({ tenant, showToast }) {
  const [view, setView] = useState('dashboard');
  const active = FLAT.find((i) => i.id === view) || FLAT[0];

  const go = (id) => setView(id);

  const shared = { tenant, showToast, navigate: go };

  const screens = {
    dashboard: <AccountsDashboard {...shared} />,
    chart: <ChartOfAccounts {...shared} />,
    bank: <LiquidAccounts key="bank" kind="BANK" {...shared} />,
    cash: <LiquidAccounts key="cash" kind="CASH" {...shared} />,
    opening: <OpeningBalances {...shared} />,
    customers: <PartyLedgers key="cust" partyType="CUSTOMER" {...shared} />,
    vendors: <PartyLedgers key="vend" partyType="VENDOR" {...shared} />,
    income: <IncomeView {...shared} />,
    expenses: <ExpensesView {...shared} />,
    receipts: <MoneyMovement key="rcpt" mode="RECEIPT" {...shared} />,
    payments: <MoneyMovement key="pay" mode="PAYMENT" {...shared} />,
    transfer: <FundTransfer {...shared} />,
    journal: <JournalEntries {...shared} />,
    reconciliation: <Reconciliation {...shared} />,
    reports: <AccountReports {...shared} />
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Desktop rail */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <nav className="surface sticky top-20 rounded-2xl p-2">
          {NAV.map((group) => (
            <div key={group.group} className="mb-1 last:mb-0">
              <div className="label-eyebrow px-2.5 pb-1 pt-2.5">{group.group}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    className={`group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                        : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--text-primary)]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-[color:var(--text-muted)]'}`} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.hint && !isActive && (
                      <span className="text-[9px] font-bold uppercase text-[color:var(--text-muted)]">
                        {item.hint}
                      </span>
                    )}
                    {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile / tablet pill nav */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
        {FLAT.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'surface text-[color:var(--text-secondary)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {screens[view] || screens.dashboard}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export { NAV, FLAT };
