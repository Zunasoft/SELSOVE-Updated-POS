import React, { useEffect, useState } from 'react';
import {
  Wallet, Landmark, Users, Truck, TrendingUp, TrendingDown, ShieldCheck,
  AlertTriangle, ArrowUpRight, ReceiptText, PiggyBank
} from 'lucide-react';

import api, { money, moneyShort, fmtDate, fmtDateTime } from '../../lib/api';
import {
  Panel, SectionHeader, StatTile, Spinner, EmptyState, Badge, Money,
  TrendBars, ShareBars, DataTable, Button
} from '../../lib/ui';

const VOUCHER_TONE = {
  SALES: 'success',
  PURCHASE: 'warning',
  RECEIPT: 'success',
  PAYMENT: 'danger',
  EXPENSE: 'danger',
  INCOME: 'success',
  CONTRA: 'info',
  JOURNAL: 'accent',
  OPENING: 'neutral',
  STOCK: 'neutral'
};

export default function AccountsDashboard({ navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .get('/accounts/dashboard')
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <Spinner label="Preparing your books…" />;
  if (!data) return <EmptyState icon={AlertTriangle} title="Could not load the accounts dashboard" />;

  const netWorking = data.cashInHand + data.bankBalance;
  const health = data.health;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Accounts"
        title="Financial Dashboard"
        subtitle="Live position of cash, bank, receivables and payables — every figure derived directly from the double-entry ledger."
        actions={
          <Button variant="primary" icon={ArrowUpRight} onClick={() => navigate('reports')}>
            Open Reports
          </Button>
        }
      />

      {/* Books integrity banner — silence here means the ledger agrees with itself. */}
      <div
        className={`flex flex-wrap items-center gap-2.5 rounded-2xl px-4 py-2.5 text-[12px] font-semibold ${
          health.booksBalanced
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
        }`}
      >
        {health.booksBalanced ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        <span>
          {health.booksBalanced
            ? 'Books are balanced — trial balance and balance sheet both tie out.'
            : `Books are out by ${money(health.trialBalanceDifference)} — review recent vouchers.`}
        </span>
        <span className="ml-auto text-[11px] font-medium opacity-75">
          {health.voucherCount} vouchers · {health.accountCount} ledger accounts
        </span>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Today's Sales"
          value={moneyShort(data.todaysSales)}
          sub={`${data.todaysBills} bill${data.todaysBills === 1 ? '' : 's'} today`}
          icon={ReceiptText}
          tone="accent"
        />
        <StatTile
          label="Cash in Hand"
          value={moneyShort(data.cashInHand)}
          sub="Counter drawer balance"
          icon={Wallet}
          tone={data.cashInHand < 0 ? 'danger' : 'neutral'}
          onClick={() => navigate('cash')}
        />
        <StatTile
          label="Bank Balance"
          value={moneyShort(data.bankBalance)}
          sub="All bank ledgers"
          icon={Landmark}
          tone="neutral"
          onClick={() => navigate('bank')}
        />
        <StatTile
          label="Monthly Profit"
          value={moneyShort(data.monthlyProfit)}
          sub={`Gross margin ${data.grossMargin}%`}
          icon={data.monthlyProfit >= 0 ? TrendingUp : TrendingDown}
          tone={data.monthlyProfit >= 0 ? 'success' : 'danger'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Receivables"
          value={moneyShort(data.receivables)}
          sub="Owed by customers"
          icon={Users}
          tone={data.receivables > 0 ? 'warning' : 'success'}
          onClick={() => navigate('customers')}
        />
        <StatTile
          label="Payables"
          value={moneyShort(data.payables)}
          sub="Owed to vendors"
          icon={Truck}
          tone={data.payables > 0 ? 'danger' : 'success'}
          onClick={() => navigate('vendors')}
        />
        <StatTile
          label="Monthly Income"
          value={moneyShort(data.monthlyIncome)}
          sub="All income heads"
          icon={TrendingUp}
          tone="success"
        />
        <StatTile
          label="Monthly Expenses"
          value={moneyShort(data.monthlyExpenses)}
          sub="All expense heads"
          icon={TrendingDown}
          tone="danger"
          onClick={() => navigate('expenses')}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Six-month trend */}
        <Panel className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="label-eyebrow">Six-month trend</div>
              <div className="text-[13px] font-bold text-[color:var(--text-primary)]">Income vs Expenses</div>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold text-[color:var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-indigo-500" /> Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-rose-400" /> Expense
              </span>
            </div>
          </div>
          <TrendBars data={data.trend} />
          <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <Metric label="Working funds" value={money(netWorking)} />
            <Metric label="Gross profit (MTD)" value={money(data.grossProfit)} />
            <Metric
              label="Net position"
              value={money(data.cashInHand + data.bankBalance + data.receivables - data.payables)}
            />
          </div>
        </Panel>

        {/* Top expenses */}
        <Panel>
          <div className="mb-3">
            <div className="label-eyebrow">This month</div>
            <div className="text-[13px] font-bold text-[color:var(--text-primary)]">Top Expense Heads</div>
          </div>
          {data.topExpenses.length === 0 ? (
            <EmptyState icon={PiggyBank} title="No expenses booked yet" hint="Expense heads will rank here once you record them." />
          ) : (
            <ShareBars items={data.topExpenses.map((e) => ({ name: e.name, amount: e.amount }))} tone="danger" />
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <OutstandingPanel
          title="Outstanding Customers"
          eyebrow="Receivables"
          rows={data.outstandingCustomers}
          tone="warning"
          onOpen={() => navigate('customers')}
        />
        <OutstandingPanel
          title="Outstanding Vendors"
          eyebrow="Payables"
          rows={data.outstandingVendors}
          tone="danger"
          onOpen={() => navigate('vendors')}
        />
      </div>

      {/* Recent vouchers */}
      <div className="space-y-2">
        <SectionHeader
          eyebrow="Audit trail"
          title="Recent Vouchers"
          actions={
            <Button onClick={() => navigate('journal')} icon={ArrowUpRight}>
              View journal
            </Button>
          }
        />
        <DataTable
          maxHeight="none"
          columns={[
            {
              key: 'voucherNo',
              label: 'Voucher',
              render: (v) => (
                <span className="tabular font-bold text-[color:var(--accent)]">{v.voucherNo}</span>
              )
            },
            {
              key: 'type',
              label: 'Type',
              render: (v) => <Badge tone={VOUCHER_TONE[v.type] || 'neutral'}>{v.type}</Badge>
            },
            { key: 'date', label: 'Date', render: (v) => fmtDateTime(v.date) },
            {
              key: 'narration',
              label: 'Narration',
              render: (v) => (
                <span className="line-clamp-1 text-[color:var(--text-secondary)]">{v.narration}</span>
              )
            },
            {
              key: 'totalDebit',
              label: 'Amount',
              align: 'right',
              width: 120,
              render: (v) => <Money value={v.totalDebit} className="font-bold" />
            }
          ]}
          rows={data.recentVouchers}
          rowKey={(v) => v.id}
          empty={<EmptyState title="No vouchers posted yet" hint="Your first sale or expense will appear here." />}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <div className="tabular mt-0.5 text-[13px] font-bold text-[color:var(--text-primary)]">{value}</div>
    </div>
  );
}

function OutstandingPanel({ title, eyebrow, rows, tone, onOpen }) {
  const total = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);

  return (
    <Panel padded={false}>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div>
          <div className="label-eyebrow">{eyebrow}</div>
          <div className="text-[13px] font-bold text-[color:var(--text-primary)]">{title}</div>
        </div>
        <div className="text-right">
          <Money value={total} className="text-[15px] font-bold" />
          <button onClick={onOpen} className="block text-[10px] font-bold text-[color:var(--accent)] hover:underline">
            View all
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing outstanding" hint="All settled — nothing pending here." />
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {rows.map((row) => (
            <div key={row.accountId} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-semibold text-[color:var(--text-primary)]">{row.name}</div>
                <div className="text-[10.5px] text-[color:var(--text-muted)]">
                  {row.code} · last activity {fmtDate(row.lastActivity)}
                </div>
              </div>
              <Badge tone={tone}>{money(row.balance, { decimals: false })}</Badge>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
