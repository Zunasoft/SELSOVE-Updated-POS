import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, CalendarDays, CalendarRange, Package, Layers, Truck, CreditCard,
  Boxes, History, ClipboardList, TrendingUp, AlertTriangle, Wallet
} from 'lucide-react';

import api, { money, moneyShort, fmtDate, fmtDateTime, monthStartISO, todayISO } from '../lib/api';
import {
  Panel, SectionHeader, StatTile, Badge, Money, Spinner, EmptyState,
  DataTable, DateRange, ReportFrame, ShareBars, Donut, SegmentedControl
} from '../lib/ui';
import { exportReport } from '../lib/exporters';

/**
 * Operational reporting — SOW Module 10. Financial statements live in the
 * Accounts module; everything here answers "what moved on the shop floor".
 */
const REPORTS = [
  { id: 'sales-daily', label: 'Daily Sales', icon: CalendarDays, group: 'Sales' },
  { id: 'sales-monthly', label: 'Monthly Sales', icon: CalendarRange, group: 'Sales' },
  { id: 'sales-products', label: 'Product Sales', icon: Package, group: 'Sales' },
  { id: 'sales-categories', label: 'Category Sales', icon: Layers, group: 'Sales' },
  { id: 'payment-modes', label: 'Payment Modes', icon: CreditCard, group: 'Sales' },
  { id: 'stock', label: 'Stock Report', icon: Boxes, group: 'Inventory' },
  { id: 'movements', label: 'Stock History', icon: History, group: 'Inventory' },
  { id: 'purchases', label: 'Purchase Report', icon: Truck, group: 'Purchases' },
  { id: 'sessions', label: 'Session History', icon: ClipboardList, group: 'Counter' }
];

const GROUPS = [...new Set(REPORTS.map((r) => r.group))];

const MOVEMENT_TONE = {
  SALE: 'danger',
  PURCHASE: 'success',
  ADJUSTMENT: 'warning',
  RECIPE: 'info',
  OPENING: 'neutral',
  RETURN: 'accent'
};

export default function ReportsManager({ showToast }) {
  const [reportId, setReportId] = useState('sales-daily');
  const [range, setRange] = useState({ from: monthStartISO(), to: todayISO() });
  const [analytics, setAnalytics] = useState(null);
  const [data, setData] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const report = REPORTS.find((r) => r.id === reportId);

  useEffect(() => {
    api.get('/analytics').then(setAnalytics).catch(() => {});
    api.get('/settings').then((s) => setCompany(s.company)).catch(() => {});
  }, []);

  const endpoint = useMemo(() => {
    const q = { from: range.from || undefined, to: range.to || undefined };
    const paths = {
      'sales-daily': '/reports/sales/daily',
      'sales-monthly': '/reports/sales/monthly',
      'sales-products': '/reports/sales/products',
      'sales-categories': '/reports/sales/categories',
      'payment-modes': '/reports/sales/payment-modes',
      stock: '/reports/stock',
      movements: '/inventory/movements',
      purchases: '/reports/purchases',
      sessions: '/reports/sessions'
    };
    return [paths[reportId], q];
  }, [reportId, range]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get(endpoint[0], endpoint[1])
      .then((d) => alive && setData(d))
      .catch((err) => {
        if (alive) {
          setData(null);
          showToast(api.message(err, 'Could not build that report.'), 'error');
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [endpoint]);

  const periodLabel =
    range.from || range.to
      ? `${range.from ? fmtDate(range.from) : 'Inception'} to ${fmtDate(range.to || todayISO())}`
      : 'All time';

  const onExport = (format) => {
    const payload = buildExport(reportId, data, report.label);
    if (payload) exportReport(format, { ...payload, company, period: periodLabel });
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Analytics"
        title="Reports & Analytics"
        icon={BarChart3}
        subtitle="Sales, inventory, purchase and counter reports — every one exportable to Excel or PDF."
      />

      {analytics && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile
            label="Today's Sales"
            value={moneyShort(analytics.todaysSales)}
            sub={`${analytics.todaysBills} bills · avg ${money(analytics.averageBillValue, { decimals: false })}`}
            icon={TrendingUp}
            tone="accent"
          />
          <StatTile
            label="This Month"
            value={moneyShort(analytics.monthlySales)}
            sub={`${analytics.monthlyBills} bills`}
            icon={CalendarRange}
          />
          <StatTile
            label="Stock Value"
            value={moneyShort(analytics.stockValue)}
            sub={`${analytics.totalStockItems} units on hand`}
            icon={Boxes}
          />
          <StatTile
            label="Low Stock"
            value={analytics.lowStockCount}
            sub="Items at or below minimum"
            icon={AlertTriangle}
            tone={analytics.lowStockCount > 0 ? 'warning' : 'success'}
          />
          <StatTile
            label="Cash + Bank"
            value={moneyShort(analytics.cashInHand + analytics.bankBalance)}
            sub={`Receivables ${moneyShort(analytics.receivables)}`}
            icon={Wallet}
          />
        </div>
      )}

      {/* Report picker */}
      <Panel>
        <div className="space-y-2.5">
          {GROUPS.map((group) => (
            <div key={group} className="flex flex-wrap items-center gap-2">
              <span className="label-eyebrow w-20 shrink-0">{group}</span>
              <div className="flex flex-wrap gap-1.5">
                {REPORTS.filter((r) => r.group === group).map((r) => {
                  const Icon = r.icon;
                  const active = reportId === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setReportId(r.id)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-bold transition-all ${
                        active
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                      }`}
                      style={active ? undefined : { background: 'var(--bg-subtle)' }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <DateRange from={range.from} to={range.to} onChange={setRange} />

      {loading ? (
        <Spinner label={`Building the ${report.label.toLowerCase()} report…`} />
      ) : !data ? (
        <EmptyState icon={AlertTriangle} title="Report unavailable" hint="Adjust the period and try again." />
      ) : (
        <ReportFrame title={report.label} company={company} period={periodLabel} onExport={onExport}>
          {renderReport(reportId, data)}
        </ReportFrame>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Renderers
 * ------------------------------------------------------------------ */

function renderReport(id, data) {
  switch (id) {
    case 'sales-daily':
      return <DailySales data={data} />;
    case 'sales-monthly':
      return <MonthlySales data={data} />;
    case 'sales-products':
      return <ProductSales data={data} />;
    case 'sales-categories':
      return <CategorySales data={data} />;
    case 'payment-modes':
      return <PaymentModes data={data} />;
    case 'stock':
      return <StockReport data={data} />;
    case 'movements':
      return <StockHistory rows={data} />;
    case 'purchases':
      return <PurchaseReport data={data} />;
    case 'sessions':
      return <SessionHistory rows={data} />;
    default:
      return null;
  }
}

function DailySales({ data }) {
  return (
    <DataTable
      maxHeight="none"
      dense
      columns={[
        { key: 'date', label: 'Date', width: 120, render: (r) => fmtDate(r.date) },
        { key: 'bills', label: 'Bills', align: 'right', width: 80 },
        { key: 'subtotal', label: 'Subtotal', align: 'right', width: 120, render: (r) => <Money value={r.subtotal} /> },
        { key: 'discount', label: 'Discount', align: 'right', width: 110, render: (r) => <Money value={r.discount} showZero={false} /> },
        { key: 'tax', label: 'GST', align: 'right', width: 110, render: (r) => <Money value={r.tax} showZero={false} /> },
        { key: 'total', label: 'Net Sales', align: 'right', width: 130, render: (r) => <Money value={r.total} className="font-bold" /> },
        {
          key: 'grossProfit',
          label: 'Gross Profit',
          align: 'right',
          width: 130,
          render: (r) => <Money value={r.grossProfit} colored className="font-semibold" />
        }
      ]}
      rows={data.rows}
      rowKey={(r) => r.date}
      empty={<EmptyState title="No sales in this period" />}
      footer={[
        'Total',
        data.totals.bills,
        '',
        money(data.totals.discount),
        money(data.totals.tax),
        money(data.totals.total),
        money(data.totals.grossProfit)
      ]}
    />
  );
}

function MonthlySales({ data }) {
  return (
    <DataTable
      maxHeight="none"
      dense
      columns={[
        { key: 'month', label: 'Month', width: 130 },
        { key: 'bills', label: 'Bills', align: 'right', width: 90 },
        { key: 'discount', label: 'Discount', align: 'right', width: 120, render: (r) => <Money value={r.discount} showZero={false} /> },
        { key: 'tax', label: 'GST', align: 'right', width: 120, render: (r) => <Money value={r.tax} showZero={false} /> },
        { key: 'total', label: 'Net Sales', align: 'right', width: 140, render: (r) => <Money value={r.total} className="font-bold" /> },
        { key: 'grossProfit', label: 'Gross Profit', align: 'right', width: 140, render: (r) => <Money value={r.grossProfit} colored className="font-semibold" /> }
      ]}
      rows={data}
      rowKey={(r) => r.month}
      empty={<EmptyState title="No sales recorded yet" />}
      footer={[
        'Total',
        data.reduce((s, r) => s + r.bills, 0),
        money(data.reduce((s, r) => s + r.discount, 0)),
        money(data.reduce((s, r) => s + r.tax, 0)),
        money(data.reduce((s, r) => s + r.total, 0)),
        money(data.reduce((s, r) => s + r.grossProfit, 0))
      ]}
    />
  );
}

function ProductSales({ data }) {
  const top = data.rows.slice(0, 8).map((r) => ({ name: r.name, amount: r.revenue }));

  return (
    <>
      {top.length > 0 && (
        <div className="mb-4">
          <div className="label-eyebrow mb-2">Top sellers by revenue</div>
          <ShareBars items={top} tone="accent" />
        </div>
      )}
      <DataTable
        maxHeight="none"
        dense
        columns={[
          { key: 'name', label: 'Product', render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: 'qty', label: 'Qty Sold', align: 'right', width: 110, render: (r) => `${r.qty} ${r.unit}` },
          { key: 'revenue', label: 'Revenue', align: 'right', width: 130, render: (r) => <Money value={r.revenue} className="font-bold" /> },
          { key: 'cost', label: 'Cost', align: 'right', width: 120, render: (r) => <Money value={r.cost} /> },
          { key: 'profit', label: 'Profit', align: 'right', width: 120, render: (r) => <Money value={r.profit} colored className="font-semibold" /> },
          {
            key: 'margin',
            label: 'Margin',
            align: 'right',
            width: 90,
            render: (r) => <span className="tabular text-[color:var(--text-muted)]">{r.margin}%</span>
          }
        ]}
        rows={data.rows}
        rowKey={(r) => r.productId}
        empty={<EmptyState title="No products sold in this period" />}
        footer={[
          'Total',
          '',
          money(data.total),
          money(data.rows.reduce((s, r) => s + r.cost, 0)),
          money(data.rows.reduce((s, r) => s + r.profit, 0)),
          ''
        ]}
      />
    </>
  );
}

const DONUT_COLORS = ['#4f46e5', '#059669', '#f59e0b', '#e11d48', '#0891b2', '#7c3aed', '#65a30d'];

function CategorySales({ data }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-start">
      <div className="flex justify-center">
        <Donut
          segments={data.rows.slice(0, 7).map((r, i) => ({
            label: r.name,
            value: r.revenue,
            color: DONUT_COLORS[i % DONUT_COLORS.length]
          }))}
          centerValue={moneyShort(data.total)}
          centerLabel="Total sales"
        />
      </div>

      <DataTable
        maxHeight="none"
        dense
        columns={[
          {
            key: 'name',
            label: 'Category',
            render: (r, i) => (
              <span className="flex items-center gap-2 font-semibold">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                {r.icon} {r.name}
              </span>
            )
          },
          { key: 'qty', label: 'Units', align: 'right', width: 100 },
          { key: 'revenue', label: 'Revenue', align: 'right', width: 130, render: (r) => <Money value={r.revenue} className="font-bold" /> },
          { key: 'profit', label: 'Profit', align: 'right', width: 120, render: (r) => <Money value={r.profit} colored /> },
          {
            key: 'share',
            label: 'Share',
            align: 'right',
            width: 90,
            render: (r) => <span className="tabular text-[color:var(--text-muted)]">{r.share}%</span>
          }
        ]}
        rows={data.rows}
        rowKey={(r) => r.categoryId}
        empty={<EmptyState title="No category sales in this period" />}
        footer={['Total', '', money(data.total), '', '100%']}
      />
    </div>
  );
}

function PaymentModes({ data }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-start">
      <div className="flex justify-center">
        <Donut
          segments={data.rows.map((r, i) => ({
            label: r.mode,
            value: r.total,
            color: DONUT_COLORS[i % DONUT_COLORS.length]
          }))}
          centerValue={moneyShort(data.total)}
          centerLabel="Collected"
        />
      </div>

      <DataTable
        maxHeight="none"
        dense
        columns={[
          {
            key: 'mode',
            label: 'Payment Mode',
            render: (r, i) => (
              <span className="flex items-center gap-2 font-semibold">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                {r.mode}
              </span>
            )
          },
          { key: 'bills', label: 'Bills', align: 'right', width: 100 },
          { key: 'total', label: 'Amount', align: 'right', width: 140, render: (r) => <Money value={r.total} className="font-bold" /> },
          {
            key: 'share',
            label: 'Share',
            align: 'right',
            width: 90,
            render: (r) => <span className="tabular text-[color:var(--text-muted)]">{r.share}%</span>
          }
        ]}
        rows={data.rows}
        rowKey={(r) => r.mode}
        empty={<EmptyState title="No collections in this period" />}
        footer={['Total', data.rows.reduce((s, r) => s + r.bills, 0), money(data.total), '100%']}
      />
    </div>
  );
}

const STOCK_TONE = { HEALTHY: 'success', LOW: 'warning', OUT_OF_STOCK: 'danger' };
const STOCK_LABEL = { HEALTHY: 'Healthy', LOW: 'Low', OUT_OF_STOCK: 'Out of stock' };

function StockReport({ data }) {
  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Mini label="Value at cost" value={money(data.totalValueAtCost)} />
        <Mini label="Value at retail" value={money(data.totalValueAtRetail)} />
        <Mini label="Potential margin" value={money(data.totalValueAtRetail - data.totalValueAtCost)} tone="success" />
      </div>

      <DataTable
        maxHeight="none"
        dense
        columns={[
          { key: 'name', label: 'Product', render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: 'category', label: 'Category', width: 170, render: (r) => <span className="text-[color:var(--text-muted)]">{r.category}</span> },
          { key: 'stock', label: 'In Stock', align: 'right', width: 110, render: (r) => `${r.stock} ${r.unit}` },
          { key: 'minStock', label: 'Min', align: 'right', width: 70 },
          { key: 'sold', label: 'Sold', align: 'right', width: 80 },
          { key: 'valueAtCost', label: 'Value (Cost)', align: 'right', width: 130, render: (r) => <Money value={r.valueAtCost} /> },
          {
            key: 'status',
            label: 'Status',
            width: 120,
            render: (r) => <Badge tone={STOCK_TONE[r.status]}>{STOCK_LABEL[r.status]}</Badge>
          }
        ]}
        rows={data.rows}
        empty={<EmptyState title="No products in the catalogue" />}
        footer={['Total', '', '', '', '', money(data.totalValueAtCost), `${data.lowStock} need attention`]}
      />
    </>
  );
}

function StockHistory({ rows }) {
  return (
    <DataTable
      maxHeight="none"
      dense
      columns={[
        { key: 'date', label: 'When', width: 150, render: (r) => fmtDateTime(r.date) },
        { key: 'productName', label: 'Product', render: (r) => <span className="font-semibold">{r.productName}</span> },
        { key: 'type', label: 'Type', width: 120, render: (r) => <Badge tone={MOVEMENT_TONE[r.type] || 'neutral'}>{r.type}</Badge> },
        {
          key: 'qtyChange',
          label: 'Change',
          align: 'right',
          width: 110,
          render: (r) => (
            <span
              className={`tabular font-bold ${
                r.qtyChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {r.qtyChange >= 0 ? '+' : ''}
              {r.qtyChange} {r.unit}
            </span>
          )
        },
        { key: 'balanceAfter', label: 'Balance', align: 'right', width: 110, render: (r) => `${r.balanceAfter} ${r.unit}` },
        { key: 'reason', label: 'Reason', render: (r) => <span className="text-[color:var(--text-muted)]">{r.reason}</span> },
        { key: 'user', label: 'By', width: 110, render: (r) => <span className="text-[color:var(--text-muted)]">{r.user}</span> }
      ]}
      rows={rows}
      empty={<EmptyState icon={History} title="No stock movements yet" hint="Sales, purchases and adjustments will be logged here." />}
    />
  );
}

function PurchaseReport({ data }) {
  const [mode, setMode] = useState('INVOICES');

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 no-print">
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: 'INVOICES', label: 'Invoices' },
            { value: 'VENDORS', label: 'By Vendor' }
          ]}
        />
        <div className="flex gap-3">
          <Mini label="Total purchases" value={money(data.total)} />
          <Mini label="GST input credit" value={money(data.totalTax)} tone="success" />
        </div>
      </div>

      {mode === 'INVOICES' ? (
        <DataTable
          maxHeight="none"
          dense
          columns={[
            { key: 'date', label: 'Date', width: 110, render: (r) => fmtDate(r.date) },
            { key: 'invoiceNo', label: 'Invoice', width: 140, render: (r) => <span className="tabular font-bold">{r.invoiceNo}</span> },
            { key: 'vendorName', label: 'Vendor', render: (r) => <span className="font-semibold">{r.vendorName}</span> },
            { key: 'subtotal', label: 'Taxable', align: 'right', width: 120, render: (r) => <Money value={r.subtotal} /> },
            { key: 'tax', label: 'GST', align: 'right', width: 110, render: (r) => <Money value={r.tax} showZero={false} /> },
            { key: 'totalAmount', label: 'Total', align: 'right', width: 130, render: (r) => <Money value={r.totalAmount} className="font-bold" /> },
            {
              key: 'paymentStatus',
              label: 'Status',
              width: 100,
              render: (r) => (
                <Badge tone={r.paymentStatus === 'PAID' ? 'success' : 'warning'}>
                  {r.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}
                </Badge>
              )
            }
          ]}
          rows={data.rows}
          empty={<EmptyState title="No purchases in this period" />}
          footer={['Total', '', '', '', money(data.totalTax), money(data.total), '']}
        />
      ) : (
        <DataTable
          maxHeight="none"
          dense
          columns={[
            { key: 'vendor', label: 'Vendor', render: (r) => <span className="font-semibold">{r.vendor}</span> },
            { key: 'invoices', label: 'Invoices', align: 'right', width: 110 },
            { key: 'total', label: 'Total Purchased', align: 'right', width: 160, render: (r) => <Money value={r.total} className="font-bold" /> },
            {
              key: 'unpaid',
              label: 'Unpaid',
              align: 'right',
              width: 140,
              render: (r) => <Money value={r.unpaid} showZero={false} className="text-rose-600 dark:text-rose-400" />
            }
          ]}
          rows={data.byVendor}
          rowKey={(r) => r.vendor}
          empty={<EmptyState title="No vendor activity in this period" />}
          footer={[
            'Total',
            data.byVendor.reduce((s, r) => s + r.invoices, 0),
            money(data.total),
            money(data.byVendor.reduce((s, r) => s + r.unpaid, 0))
          ]}
        />
      )}
    </>
  );
}

function SessionHistory({ rows }) {
  return (
    <DataTable
      maxHeight="none"
      dense
      columns={[
        { key: 'openedAt', label: 'Opened', width: 150, render: (r) => fmtDateTime(r.openedAt) },
        { key: 'openedBy', label: 'Cashier', width: 140, render: (r) => <span className="font-semibold">{r.openedBy || '—'}</span> },
        { key: 'openingCash', label: 'Opening', align: 'right', width: 110, render: (r) => <Money value={r.openingCash} /> },
        { key: 'cashIn', label: 'Cash In', align: 'right', width: 110, render: (r) => <Money value={r.cashIn} showZero={false} /> },
        { key: 'cashOut', label: 'Cash Out', align: 'right', width: 110, render: (r) => <Money value={r.cashOut} showZero={false} /> },
        { key: 'billCount', label: 'Bills', align: 'right', width: 80, render: (r) => r.billCount ?? '—' },
        { key: 'expectedCash', label: 'Expected', align: 'right', width: 120, render: (r) => <Money value={r.expectedCash ?? r.currentCash} /> },
        { key: 'countedCash', label: 'Counted', align: 'right', width: 120, render: (r) => <Money value={r.countedCash} showZero={false} /> },
        {
          key: 'variance',
          label: 'Variance',
          align: 'right',
          width: 120,
          render: (r) => (r.variance === undefined ? '—' : <Money value={r.variance} colored className="font-bold" />)
        },
        {
          key: 'status',
          label: 'Status',
          width: 100,
          render: (r) => <Badge tone={r.status === 'open' ? 'info' : 'neutral'}>{r.status === 'open' ? 'Open' : 'Closed'}</Badge>
        }
      ]}
      rows={rows}
      rowKey={(r) => r.id}
      empty={<EmptyState icon={ClipboardList} title="No counter sessions yet" />}
    />
  );
}

function Mini({ label, value, tone = 'neutral' }) {
  const color = {
    neutral: 'text-[color:var(--text-primary)]',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-rose-600 dark:text-rose-400'
  }[tone];
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
      <div className="label-eyebrow">{label}</div>
      <div className={`tabular mt-0.5 text-[14px] font-bold ${color}`}>{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Export flattening — one shape per report so CSV and PDF agree
 * ------------------------------------------------------------------ */

function buildExport(id, data, title) {
  if (!data) return null;
  const num = (v) => Number(v || 0).toFixed(2);

  switch (id) {
    case 'sales-daily':
      return {
        title,
        columns: [
          { key: 'date', label: 'Date', value: (r) => fmtDate(r.date) },
          { key: 'bills', label: 'Bills', align: 'right' },
          { key: 'subtotal', label: 'Subtotal', align: 'right', value: (r) => num(r.subtotal) },
          { key: 'discount', label: 'Discount', align: 'right', value: (r) => num(r.discount) },
          { key: 'tax', label: 'GST', align: 'right', value: (r) => num(r.tax) },
          { key: 'total', label: 'Net Sales', align: 'right', value: (r) => num(r.total) },
          { key: 'grossProfit', label: 'Gross Profit', align: 'right', value: (r) => num(r.grossProfit) }
        ],
        rows: data.rows,
        totals: [
          'TOTAL',
          data.totals.bills,
          '',
          num(data.totals.discount),
          num(data.totals.tax),
          num(data.totals.total),
          num(data.totals.grossProfit)
        ]
      };

    case 'sales-monthly':
      return {
        title,
        columns: [
          { key: 'month', label: 'Month' },
          { key: 'bills', label: 'Bills', align: 'right' },
          { key: 'tax', label: 'GST', align: 'right', value: (r) => num(r.tax) },
          { key: 'total', label: 'Net Sales', align: 'right', value: (r) => num(r.total) },
          { key: 'grossProfit', label: 'Gross Profit', align: 'right', value: (r) => num(r.grossProfit) }
        ],
        rows: data
      };

    case 'sales-products':
      return {
        title,
        columns: [
          { key: 'name', label: 'Product' },
          { key: 'unit', label: 'Unit' },
          { key: 'qty', label: 'Qty Sold', align: 'right' },
          { key: 'revenue', label: 'Revenue', align: 'right', value: (r) => num(r.revenue) },
          { key: 'cost', label: 'Cost', align: 'right', value: (r) => num(r.cost) },
          { key: 'profit', label: 'Profit', align: 'right', value: (r) => num(r.profit) },
          { key: 'margin', label: 'Margin %', align: 'right' }
        ],
        rows: data.rows
      };

    case 'sales-categories':
      return {
        title,
        columns: [
          { key: 'name', label: 'Category' },
          { key: 'qty', label: 'Units', align: 'right' },
          { key: 'revenue', label: 'Revenue', align: 'right', value: (r) => num(r.revenue) },
          { key: 'profit', label: 'Profit', align: 'right', value: (r) => num(r.profit) },
          { key: 'share', label: 'Share %', align: 'right' }
        ],
        rows: data.rows
      };

    case 'payment-modes':
      return {
        title,
        columns: [
          { key: 'mode', label: 'Payment Mode' },
          { key: 'bills', label: 'Bills', align: 'right' },
          { key: 'total', label: 'Amount', align: 'right', value: (r) => num(r.total) },
          { key: 'share', label: 'Share %', align: 'right' }
        ],
        rows: data.rows
      };

    case 'stock':
      return {
        title,
        columns: [
          { key: 'name', label: 'Product' },
          { key: 'category', label: 'Category' },
          { key: 'barcode', label: 'Barcode' },
          { key: 'stock', label: 'In Stock', align: 'right' },
          { key: 'unit', label: 'Unit' },
          { key: 'minStock', label: 'Min', align: 'right' },
          { key: 'purchasePrice', label: 'Cost', align: 'right', value: (r) => num(r.purchasePrice) },
          { key: 'price', label: 'Selling', align: 'right', value: (r) => num(r.price) },
          { key: 'valueAtCost', label: 'Stock Value', align: 'right', value: (r) => num(r.valueAtCost) },
          { key: 'status', label: 'Status' }
        ],
        rows: data.rows,
        totals: ['TOTAL', '', '', '', '', '', '', '', num(data.totalValueAtCost), '']
      };

    case 'movements':
      return {
        title,
        columns: [
          { key: 'date', label: 'When', value: (r) => fmtDateTime(r.date) },
          { key: 'productName', label: 'Product' },
          { key: 'type', label: 'Type' },
          { key: 'qtyChange', label: 'Change', align: 'right' },
          { key: 'balanceAfter', label: 'Balance', align: 'right' },
          { key: 'unit', label: 'Unit' },
          { key: 'reason', label: 'Reason' },
          { key: 'user', label: 'By' }
        ],
        rows: data
      };

    case 'purchases':
      return {
        title,
        columns: [
          { key: 'date', label: 'Date', value: (r) => fmtDate(r.date) },
          { key: 'invoiceNo', label: 'Invoice' },
          { key: 'vendorName', label: 'Vendor' },
          { key: 'subtotal', label: 'Taxable', align: 'right', value: (r) => num(r.subtotal) },
          { key: 'tax', label: 'GST', align: 'right', value: (r) => num(r.tax) },
          { key: 'totalAmount', label: 'Total', align: 'right', value: (r) => num(r.totalAmount) },
          { key: 'paymentStatus', label: 'Status' }
        ],
        rows: data.rows,
        totals: ['TOTAL', '', '', '', num(data.totalTax), num(data.total), '']
      };

    case 'sessions':
      return {
        title,
        columns: [
          { key: 'openedAt', label: 'Opened', value: (r) => fmtDateTime(r.openedAt) },
          { key: 'openedBy', label: 'Cashier' },
          { key: 'openingCash', label: 'Opening', align: 'right', value: (r) => num(r.openingCash) },
          { key: 'cashIn', label: 'Cash In', align: 'right', value: (r) => num(r.cashIn) },
          { key: 'cashOut', label: 'Cash Out', align: 'right', value: (r) => num(r.cashOut) },
          { key: 'billCount', label: 'Bills', align: 'right' },
          { key: 'countedCash', label: 'Counted', align: 'right', value: (r) => num(r.countedCash) },
          { key: 'variance', label: 'Variance', align: 'right', value: (r) => num(r.variance) },
          { key: 'status', label: 'Status' }
        ],
        rows: data
      };

    default:
      return null;
  }
}
