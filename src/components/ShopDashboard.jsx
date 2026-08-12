import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, RefreshCw, TrendingUp, CalendarRange, Receipt, Wallet, Landmark,
  ArrowDownCircle, ArrowUpCircle, Lock, Unlock, Boxes, PackageX,
  Users2, CreditCard, PieChart
} from 'lucide-react';

import api, { money, moneyShort, fmtDate, fmtDateTime, todayISO, monthStartISO } from '../lib/api';
import {
  Panel, SectionHeader, StatTile, Badge, Money, Spinner, EmptyState,
  DataTable, Button, TrendBars, Donut
} from '../lib/ui';

const DONUT_COLORS = ['#4f46e5', '#059669', '#f59e0b', '#e11d48', '#0891b2', '#7c3aed', '#65a30d'];

/** ISO date N days before today — used to build the 14-day trend window. */
const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

/**
 * Module 2 — Shop Dashboard. The shop's front door: today's numbers, the
 * counter session, low stock and a look at what just sold. Every section is
 * defensive because a brand-new shop has zero of everything and must still
 * render cleanly instead of crashing on an undefined field.
 */
export default function ShopDashboard({ tenant, token, showToast, onNavigate }) {
  const [analytics, setAnalytics] = useState(null);
  const [daily, setDaily] = useState(null);
  const [cash, setCash] = useState(null);
  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [analyticsRes, dailyRes, cashRes, categoriesRes] = await Promise.allSettled([
      api.get('/analytics'),
      api.get('/reports/sales/daily', { from: daysAgoISO(13), to: todayISO() }),
      api.get('/reports/cash-summary', { from: todayISO(), to: todayISO() }),
      api.get('/reports/sales/categories', { from: monthStartISO(), to: todayISO() })
    ]);

    if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value);
    else showToast(api.message(analyticsRes.reason, 'Could not load the shop overview.'), 'error');

    if (dailyRes.status === 'fulfilled') setDaily(dailyRes.value);
    else showToast(api.message(dailyRes.reason, 'Could not load the sales trend.'), 'error');

    if (cashRes.status === 'fulfilled') setCash(cashRes.value);
    else showToast(api.message(cashRes.reason, 'Could not load the cash summary.'), 'error');

    if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value);
    else showToast(api.message(categoriesRes.reason, 'Could not load category sales.'), 'error');

    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !analytics) {
    return <Spinner label="Loading your shop's dashboard…" />;
  }

  const a = analytics || {};
  const lowStockItems = a.lowStockItems || [];
  const recentOrders = a.recentOrders || [];
  const session = cash?.session || a.session || null;

  const trendData = (daily?.rows || []).map((r) => ({
    month: fmtDate(r.date).slice(0, 6),
    income: r.total || 0,
    expense: r.cogs || 0
  }));

  const categoryRows = categories?.rows || [];

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Overview"
        title="Shop Dashboard"
        icon={LayoutDashboard}
        subtitle={`${tenant?.name || 'Your shop'} · ${fmtDate(todayISO())}`}
        actions={
          <Button icon={RefreshCw} onClick={load} loading={loading}>
            Refresh
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Today's Sales"
          value={moneyShort(a.todaysSales)}
          sub={`${a.todaysBills || 0} bills today`}
          icon={TrendingUp}
          tone="accent"
        />
        <StatTile
          label="Today's Bills"
          value={a.todaysBills || 0}
          sub={`avg ${money(a.averageBillValue, { decimals: false })} / bill`}
          icon={Receipt}
        />
        <StatTile
          label="Monthly Sales"
          value={moneyShort(a.monthlySales)}
          sub={`${a.monthlyBills || 0} bills this month`}
          icon={CalendarRange}
          tone="success"
        />
        <StatTile
          label="Average Bill"
          value={money(a.averageBillValue, { decimals: false })}
          sub={`${a.totalSalesCount || 0} bills all time`}
          icon={PieChart}
        />
      </div>

      {/* Cash Flow Status — Module 16 */}
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="label-eyebrow">Cash Flow Status</div>
          {session ? (
            <Badge tone={session.status === 'open' ? 'success' : 'neutral'}>
              {session.status === 'open' ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {session.status === 'open' ? `Open · ${session.openedBy || 'Unknown'}` : 'Closed'}
            </Badge>
          ) : (
            <Badge tone="warning">No counter session</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CashTile label="Cash in Hand" value={a.cashInHand} icon={Wallet} />
          <CashTile label="Bank Balance" value={cash?.bankBalance ?? a.bankBalance} icon={Landmark} />
          <CashTile label="Cash In (Today)" value={cash?.totalInflow} icon={ArrowDownCircle} tone="success" />
          <CashTile label="Cash Out (Today)" value={cash?.totalOutflow} icon={ArrowUpCircle} tone="danger" />
        </div>
        {session?.status === 'open' && (
          <div className="mt-3 flex flex-wrap gap-4 border-t pt-3 text-[11px] font-semibold text-[color:var(--text-secondary)]" style={{ borderColor: 'var(--border)' }}>
            <span>
              Opening cash: <span className="tabular font-bold text-[color:var(--text-primary)]">{money(session.openingCash)}</span>
            </span>
            <span>
              Current cash: <span className="tabular font-bold text-[color:var(--text-primary)]">{money(session.currentCash)}</span>
            </span>
            <span>
              Opened: <span className="font-bold text-[color:var(--text-primary)]">{fmtDateTime(session.openedAt)}</span>
            </span>
          </div>
        )}
      </Panel>

      {/* Sales trend */}
      <Panel>
        <div className="label-eyebrow mb-3">14-Day Sales Trend</div>
        {trendData.length > 0 ? (
          <TrendBars data={trendData} height={140} />
        ) : (
          <EmptyState icon={TrendingUp} title="No sales yet" hint="Your daily sales trend will appear here once you start billing." />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Low stock alerts */}
        <Panel padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 p-4 pb-0">
            <div className="label-eyebrow">Low Stock Alerts</div>
            <Button size="sm" variant="outline" onClick={() => onNavigate?.('inventory')}>
              View Inventory
            </Button>
          </div>
          <div className="p-4">
            <DataTable
              maxHeight="none"
              dense
              columns={[
                { key: 'name', label: 'Product', render: (r) => <span className="font-semibold">{r.name}</span> },
                { key: 'stock', label: 'Stock', align: 'right', width: 90, render: (r) => `${r.stock} ${r.unit || ''}` },
                { key: 'minStock', label: 'Min', align: 'right', width: 70 },
                {
                  key: 'status',
                  label: '',
                  width: 90,
                  render: (r) => (
                    <Badge tone={r.stock <= 0 ? 'danger' : 'warning'}>{r.stock <= 0 ? 'Out' : 'Low'}</Badge>
                  )
                }
              ]}
              rows={lowStockItems}
              rowKey={(r) => r.id}
              empty={<EmptyState icon={Boxes} title="Stock levels are healthy" hint="No products are at or below their minimum stock." />}
            />
          </div>
        </Panel>

        {/* Recent sales */}
        <Panel padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 p-4 pb-0">
            <div className="label-eyebrow">Recent Sales</div>
            <Button size="sm" variant="outline" onClick={() => onNavigate?.('pos')}>
              Go to POS
            </Button>
          </div>
          <div className="p-4">
            <DataTable
              maxHeight="none"
              dense
              onRowClick={() => onNavigate?.('pos')}
              columns={[
                { key: 'orderId', label: 'Invoice', width: 130, render: (r) => <span className="tabular font-bold">{r.orderId}</span> },
                { key: 'date', label: 'Time', width: 120, render: (r) => fmtDateTime(r.date) },
                { key: 'customerName', label: 'Customer', render: (r) => <span className="font-semibold">{r.customerName || 'Walk-in'}</span> },
                { key: 'paymentMethod', label: 'Mode', width: 100, render: (r) => <Badge>{r.paymentMethod}</Badge> },
                { key: 'total', label: 'Total', align: 'right', width: 110, render: (r) => <Money value={r.total} className="font-bold" /> }
              ]}
              rows={recentOrders}
              rowKey={(r) => r.orderId}
              empty={<EmptyState icon={Receipt} title="No sales yet" hint="Bills you create in POS will show up here." />}
            />
          </div>
        </Panel>
      </div>

      {/* Receivables / Payables / Stock Value / Expenses */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Receivables" value={moneyShort(a.receivables)} icon={Users2} tone="warning" />
        <StatTile label="Payables" value={moneyShort(a.payables)} icon={CreditCard} tone="danger" />
        <StatTile label="Stock Value" value={moneyShort(a.stockValue)} icon={Boxes} />
        <StatTile label="Expenses" value={moneyShort(a.totalExpenses)} icon={PackageX} />
      </div>

      {/* Category share */}
      <Panel>
        <div className="label-eyebrow mb-3">Sales by Category · This Month</div>
        {categoryRows.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="flex justify-center">
              <Donut
                segments={categoryRows.slice(0, 7).map((r, i) => ({
                  label: r.name,
                  value: r.revenue,
                  color: DONUT_COLORS[i % DONUT_COLORS.length]
                }))}
                centerValue={moneyShort(categories?.total)}
                centerLabel="Total sales"
              />
            </div>
            <div className="space-y-2">
              {categoryRows.slice(0, 7).map((r, i) => (
                <div key={r.categoryId || r.name} className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-[color:var(--text-primary)]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="truncate">{r.icon} {r.name}</span>
                  </span>
                  <span className="tabular shrink-0 font-bold text-[color:var(--text-secondary)]">{money(r.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState icon={PieChart} title="No category sales yet" hint="Sell products this month to see the category breakdown." />
        )}
      </Panel>
    </div>
  );
}

function CashTile({ label, value, icon: Icon, tone = 'neutral' }) {
  const color = {
    neutral: 'text-[color:var(--text-primary)]',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-rose-600 dark:text-rose-400'
  }[tone];
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-muted)]">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={`tabular text-[14px] font-bold ${color}`}>{money(value)}</div>
    </div>
  );
}
