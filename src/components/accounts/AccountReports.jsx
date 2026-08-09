import React, { useEffect, useMemo, useState } from 'react';
import {
  FileBarChart2, Scale, TrendingUp, Landmark, Waves, BookOpen, Users, Truck,
  Wallet, Receipt, Percent, AlertTriangle, CheckCircle2
} from 'lucide-react';

import api, { money, fmtDate, monthStartISO, todayISO, financialYearStartISO } from '../../lib/api';
import {
  Panel, SectionHeader, Button, Select, Spinner, EmptyState, Badge, Money,
  DataTable, DateRange, ReportFrame, SegmentedControl
} from '../../lib/ui';
import { exportReport } from '../../lib/exporters';

/**
 * Every statutory and management report the shop needs, all reading the same
 * journal. Each report declares how to fetch itself, how to render itself and
 * how to flatten itself for export, so adding one is a single entry here.
 */
const REPORTS = [
  { id: 'trial-balance', label: 'Trial Balance', icon: Scale, group: 'Statements' },
  { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp, group: 'Statements' },
  { id: 'balance-sheet', label: 'Balance Sheet', icon: Landmark, group: 'Statements' },
  { id: 'cash-flow', label: 'Cash Flow', icon: Waves, group: 'Statements' },
  { id: 'general-ledger', label: 'General Ledger', icon: BookOpen, group: 'Ledgers' },
  { id: 'cash-book', label: 'Cash Book', icon: Wallet, group: 'Ledgers' },
  { id: 'bank-book', label: 'Bank Book', icon: Landmark, group: 'Ledgers' },
  { id: 'outstanding-customers', label: 'Outstanding Customers', icon: Users, group: 'Parties' },
  { id: 'outstanding-vendors', label: 'Outstanding Vendors', icon: Truck, group: 'Parties' },
  { id: 'income', label: 'Income Report', icon: Receipt, group: 'Analysis' },
  { id: 'expense', label: 'Expense Report', icon: Receipt, group: 'Analysis' },
  { id: 'gst', label: 'GST Summary', icon: Percent, group: 'Analysis' }
];

const GROUPS = [...new Set(REPORTS.map((r) => r.group))];

export default function AccountReports({ showToast }) {
  const [reportId, setReportId] = useState('trial-balance');
  const [range, setRange] = useState({ from: financialYearStartISO(), to: todayISO() });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [liquid, setLiquid] = useState([]);
  const [bookAccountId, setBookAccountId] = useState('');

  const report = REPORTS.find((r) => r.id === reportId);

  useEffect(() => {
    api.get('/settings').then((s) => setCompany(s.company)).catch(() => {});
    api
      .get('/accounts/transfers')
      .then((d) => setLiquid(d.accounts || []))
      .catch(() => {});
  }, []);

  // The cash/bank book needs a concrete ledger; default to the first of its kind.
  useEffect(() => {
    if (reportId !== 'cash-book' && reportId !== 'bank-book') return;
    const kind = reportId === 'cash-book' ? 'CASH' : 'BANK';
    const match = liquid.filter((a) => a.kind === kind);
    if (match.length && !match.some((a) => a.id === bookAccountId)) setBookAccountId(match[0].id);
  }, [reportId, liquid]);

  const endpoint = useMemo(() => {
    const q = { from: range.from || undefined, to: range.to || undefined };
    switch (reportId) {
      case 'trial-balance':
        return ['/accounts/reports/trial-balance', q];
      case 'profit-loss':
        return ['/accounts/reports/profit-loss', q];
      case 'balance-sheet':
        return ['/accounts/reports/balance-sheet', { asOf: range.to || undefined }];
      case 'cash-flow':
        return ['/accounts/reports/cash-flow', q];
      case 'general-ledger':
        return ['/accounts/reports/general-ledger', q];
      case 'cash-book':
      case 'bank-book':
        return bookAccountId ? [`/accounts/reports/day-book/${bookAccountId}`, q] : null;
      case 'outstanding-customers':
        return ['/accounts/reports/outstanding/CUSTOMER', q];
      case 'outstanding-vendors':
        return ['/accounts/reports/outstanding/VENDOR', q];
      case 'income':
        return ['/accounts/reports/income', q];
      case 'expense':
        return ['/accounts/reports/expense', q];
      case 'gst':
        return ['/accounts/reports/gst', q];
      default:
        return null;
    }
  }, [reportId, range, bookAccountId]);

  useEffect(() => {
    if (!endpoint) return undefined;
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
    reportId === 'balance-sheet'
      ? `As at ${fmtDate(range.to || todayISO())}`
      : range.from || range.to
        ? `${range.from ? fmtDate(range.from) : 'Inception'} to ${fmtDate(range.to || todayISO())}`
        : 'All time';

  const exportPayload = data ? buildExport(reportId, data, report.label, company, periodLabel) : null;

  const onExport = (format) => {
    if (!exportPayload) return;
    exportReport(format, { ...exportPayload, company, period: periodLabel });
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Control"
        title="Financial Reports"
        icon={FileBarChart2}
        subtitle="Statutory statements and management reports, all derived from the same journal — export any of them to Excel or PDF."
      />

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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRange from={range.from} to={range.to} onChange={setRange} />
        {(reportId === 'cash-book' || reportId === 'bank-book') && (
          <Select
            value={bookAccountId}
            onChange={(e) => setBookAccountId(e.target.value)}
            className="max-w-[240px]"
          >
            {liquid
              .filter((a) => a.kind === (reportId === 'cash-book' ? 'CASH' : 'BANK'))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {money(a.balance, { decimals: false })}
                </option>
              ))}
          </Select>
        )}
      </div>

      {loading ? (
        <Spinner label={`Building the ${report.label.toLowerCase()}…`} />
      ) : !data ? (
        <EmptyState icon={AlertTriangle} title="Report unavailable" hint="Adjust the period or account and try again." />
      ) : (
        <ReportFrame title={report.label} company={company} period={periodLabel} onExport={onExport}>
          {renderReport(reportId, data)}
        </ReportFrame>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Report renderers
 * ------------------------------------------------------------------ */

function renderReport(id, data) {
  switch (id) {
    case 'trial-balance':
      return <TrialBalance data={data} />;
    case 'profit-loss':
      return <ProfitLoss data={data} />;
    case 'balance-sheet':
      return <BalanceSheet data={data} />;
    case 'cash-flow':
      return <CashFlow data={data} />;
    case 'general-ledger':
      return <GeneralLedger data={data} />;
    case 'cash-book':
    case 'bank-book':
      return <DayBook data={data} />;
    case 'outstanding-customers':
      return <Outstanding data={data} partyLabel="Customer" />;
    case 'outstanding-vendors':
      return <Outstanding data={data} partyLabel="Vendor" />;
    case 'income':
      return <HeadReport data={data} label="Income Head" tone="success" />;
    case 'expense':
      return <HeadReport data={data} label="Expense Head" tone="danger" />;
    case 'gst':
      return <GstSummary data={data} />;
    default:
      return null;
  }
}

function BalanceBanner({ ok, okText, failText }) {
  return (
    <div
      className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-bold ${
        ok
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {ok ? okText : failText}
    </div>
  );
}

function TrialBalance({ data }) {
  return (
    <>
      <BalanceBanner
        ok={data.isBalanced}
        okText="Debits equal credits — the ledger is in balance."
        failText={`Out of balance by ${money(data.difference)} — review recent vouchers.`}
      />
      <DataTable
        maxHeight="none"
        dense
        columns={[
          { key: 'code', label: 'Code', width: 90, render: (r) => <span className="tabular font-bold">{r.code}</span> },
          { key: 'name', label: 'Account', render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: 'type', label: 'Type', width: 100, render: (r) => <Badge>{r.type}</Badge> },
          { key: 'debit', label: 'Debit', align: 'right', width: 130, render: (r) => <Money value={r.debit} showZero={false} /> },
          { key: 'credit', label: 'Credit', align: 'right', width: 130, render: (r) => <Money value={r.credit} showZero={false} /> }
        ]}
        rows={data.rows}
        rowKey={(r) => r.accountId}
        footer={['', 'Total', '', money(data.totalDebit), money(data.totalCredit)]}
        empty={<EmptyState title="No postings in this period" />}
      />
    </>
  );
}

function StatementColumn({ title, lines, total, totalLabel, tone }) {
  return (
    <div className="surface rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
      <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-secondary)]">
        {title}
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {lines.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11.5px] text-[color:var(--text-muted)]">No balances</div>
        ) : (
          lines.map((line) => (
            <div key={line.accountId} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="truncate text-[12.5px] text-[color:var(--text-primary)]">
                <span className="tabular mr-2 text-[10.5px] font-bold text-[color:var(--text-muted)]">{line.code}</span>
                {line.name}
              </span>
              <Money value={line.amount} className="shrink-0 text-[12.5px] font-semibold" />
            </div>
          ))
        )}
      </div>
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderTop: '2px solid var(--border-strong)' }}
      >
        <span className="text-[11.5px] font-bold uppercase text-[color:var(--text-secondary)]">
          {totalLabel || `Total ${title}`}
        </span>
        <Money
          value={total}
          className={`text-[13px] font-bold ${
            tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'danger' ? 'text-rose-600 dark:text-rose-400' : ''
          }`}
        />
      </div>
    </div>
  );
}

function ProfitLoss({ data }) {
  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Revenue" value={data.revenue} />
        <Kpi label="Cost of Goods Sold" value={data.cogs} />
        <Kpi label="Gross Profit" value={data.grossProfit} sub={`${data.grossMargin}% margin`} tone="success" />
        <Kpi
          label="Net Profit"
          value={data.netProfit}
          sub={`${data.netMargin}% of income`}
          tone={data.netProfit >= 0 ? 'success' : 'danger'}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatementColumn title="Income" lines={data.income.lines} total={data.totalIncome} tone="success" />
        <StatementColumn title="Expenses" lines={data.expenses.lines} total={data.totalExpenses} tone="danger" />
      </div>

      <div
        className="mt-3 flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: 'var(--accent-soft)' }}
      >
        <span className="text-[13px] font-bold uppercase tracking-wide text-[color:var(--accent)]">
          {data.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
        </span>
        <Money value={data.netProfit} colored className="text-[18px] font-bold" />
      </div>
    </>
  );
}

function BalanceSheet({ data }) {
  return (
    <>
      <BalanceBanner
        ok={data.isBalanced}
        okText="Assets equal Liabilities plus Equity — the balance sheet ties out."
        failText={`Balance sheet is out by ${money(data.difference)}.`}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <StatementColumn title="Assets" lines={data.assets.lines} total={data.totalAssets} />
        <div className="space-y-3">
          <StatementColumn title="Liabilities" lines={data.liabilities.lines} total={data.totalLiabilities} />
          <StatementColumn title="Equity" lines={data.equity.lines} total={data.totalEquity} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
          <span className="text-[12px] font-bold uppercase text-[color:var(--text-secondary)]">Total Assets</span>
          <Money value={data.totalAssets} className="text-[15px] font-bold" />
        </div>
        <div className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
          <span className="text-[12px] font-bold uppercase text-[color:var(--text-secondary)]">
            Total Liabilities + Equity
          </span>
          <Money value={data.totalLiabilitiesAndEquity} className="text-[15px] font-bold" />
        </div>
      </div>
    </>
  );
}

function CashFlow({ data }) {
  const sections = [
    { key: 'operating', label: 'Operating Activities', data: data.operating },
    { key: 'investing', label: 'Investing Activities', data: data.investing },
    { key: 'financing', label: 'Financing Activities', data: data.financing }
  ];

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Opening Balance" value={data.openingBalance} />
        <Kpi label="Total Inflow" value={data.operating.inflow + data.investing.inflow + data.financing.inflow} tone="success" />
        <Kpi label="Total Outflow" value={data.operating.outflow + data.investing.outflow + data.financing.outflow} tone="danger" />
        <Kpi label="Closing Balance" value={data.closingBalance} tone="accent" />
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.key} className="rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[11.5px] font-bold uppercase tracking-wide text-[color:var(--text-secondary)]">
                {section.label}
              </span>
              <Money value={section.data.net} colored className="text-[13px] font-bold" />
            </div>
            {section.data.items.length > 0 && (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {section.data.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between px-3 py-1.5">
                    <span className="truncate text-[12.5px] text-[color:var(--text-primary)]">{item.name}</span>
                    <Money value={item.amount} colored className="text-[12.5px] font-semibold" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className="mt-3 flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: 'var(--accent-soft)' }}
      >
        <span className="text-[13px] font-bold uppercase tracking-wide text-[color:var(--accent)]">
          Net Change in Cash
        </span>
        <Money value={data.netChange} colored className="text-[18px] font-bold" />
      </div>
    </>
  );
}

function GeneralLedger({ data }) {
  const [open, setOpen] = useState({});

  if (!data.ledgers.length) return <EmptyState title="No ledger activity in this period" />;

  return (
    <div className="space-y-2">
      {data.ledgers.map((ledger) => {
        const isOpen = open[ledger.account.id];
        return (
          <div key={ledger.account.id} className="rounded-xl" style={{ border: '1px solid var(--border)' }}>
            <button
              onClick={() => setOpen((p) => ({ ...p, [ledger.account.id]: !p[ledger.account.id] }))}
              className="flex w-full items-center gap-3 px-3 py-2 text-left"
            >
              <span className="tabular w-16 shrink-0 text-[11px] font-bold text-[color:var(--text-muted)]">
                {ledger.account.code}
              </span>
              <span className="flex-1 truncate text-[12.5px] font-semibold text-[color:var(--text-primary)]">
                {ledger.account.name}
              </span>
              <Badge>{ledger.entries.length} entries</Badge>
              <Money value={ledger.closing} className="w-28 shrink-0 text-right text-[12.5px] font-bold" />
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                <table className="ledger-table w-full">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Date</th>
                      <th style={{ width: 100 }}>Voucher</th>
                      <th>Particulars</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Debit</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Credit</th>
                      <th style={{ width: 120, textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.entries.map((e, i) => (
                      <tr key={`${e.voucherId}_${i}`}>
                        <td>{fmtDate(e.date)}</td>
                        <td className="tabular font-bold text-[color:var(--accent)]">{e.voucherNo}</td>
                        <td className="text-[color:var(--text-secondary)]">{e.narration || '—'}</td>
                        <td className="tabular text-right">
                          <Money value={e.debit} showZero={false} />
                        </td>
                        <td className="tabular text-right">
                          <Money value={e.credit} showZero={false} />
                        </td>
                        <td className="tabular text-right font-semibold">
                          <Money value={e.balance} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DayBook({ data }) {
  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Account" value={data.account.name} raw />
        <Kpi label="Opening" value={data.opening} />
        <Kpi label="Days with activity" value={data.days.length} raw />
        <Kpi label="Closing" value={data.closing} tone="accent" />
      </div>

      <DataTable
        maxHeight="none"
        dense
        columns={[
          { key: 'date', label: 'Date', width: 120, render: (d) => fmtDate(d.date) },
          { key: 'opening', label: 'Opening', align: 'right', width: 120, render: (d) => <Money value={d.opening} /> },
          {
            key: 'inflow',
            label: 'Receipts',
            align: 'right',
            width: 120,
            render: (d) => <Money value={d.inflow} showZero={false} className="text-emerald-600 dark:text-emerald-400" />
          },
          {
            key: 'outflow',
            label: 'Payments',
            align: 'right',
            width: 120,
            render: (d) => <Money value={d.outflow} showZero={false} className="text-rose-600 dark:text-rose-400" />
          },
          { key: 'closing', label: 'Closing', align: 'right', width: 130, render: (d) => <Money value={d.closing} className="font-bold" /> },
          { key: 'entries', label: 'Entries', align: 'right', width: 80, render: (d) => d.entries.length }
        ]}
        rows={data.days}
        rowKey={(d) => d.date}
        empty={<EmptyState title="No cash movement in this period" />}
        footer={[
          'Total',
          '',
          money(data.days.reduce((s, d) => s + d.inflow, 0)),
          money(data.days.reduce((s, d) => s + d.outflow, 0)),
          money(data.closing),
          ''
        ]}
      />
    </>
  );
}

function Outstanding({ data, partyLabel }) {
  const [mode, setMode] = useState('BALANCES');
  const total = data.rows.reduce((s, r) => s + Math.max(0, r.balance), 0);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 no-print">
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: 'BALANCES', label: 'Balances' },
            { value: 'AGEING', label: 'Ageing' }
          ]}
        />
        <div className="text-[12px] font-bold text-[color:var(--text-secondary)]">
          Total outstanding: <Money value={total} className="text-[13px]" />
        </div>
      </div>

      {mode === 'BALANCES' ? (
        <DataTable
          maxHeight="none"
          dense
          columns={[
            { key: 'code', label: 'Code', width: 100, render: (r) => <span className="tabular font-bold">{r.code}</span> },
            { key: 'name', label: partyLabel, render: (r) => <span className="font-semibold">{r.name}</span> },
            { key: 'entryCount', label: 'Entries', align: 'right', width: 90 },
            { key: 'lastActivity', label: 'Last Activity', width: 130, render: (r) => fmtDate(r.lastActivity) },
            { key: 'balance', label: 'Outstanding', align: 'right', width: 140, render: (r) => <Money value={r.balance} className="font-bold" /> }
          ]}
          rows={data.rows}
          rowKey={(r) => r.accountId}
          footer={['', 'Total', '', '', money(total)]}
          empty={<EmptyState title="Nothing outstanding" hint="Every account is settled." />}
        />
      ) : (
        <DataTable
          maxHeight="none"
          dense
          columns={[
            { key: 'name', label: partyLabel, render: (r) => <span className="font-semibold">{r.name}</span> },
            { key: 'current', label: '0–30 days', align: 'right', width: 110, render: (r) => <Money value={r.current} showZero={false} /> },
            { key: 'd30', label: '31–60', align: 'right', width: 100, render: (r) => <Money value={r.d30} showZero={false} /> },
            { key: 'd60', label: '61–90', align: 'right', width: 100, render: (r) => <Money value={r.d60} showZero={false} /> },
            { key: 'd90', label: '91–120', align: 'right', width: 100, render: (r) => <Money value={r.d90} showZero={false} /> },
            {
              key: 'older',
              label: 'Over 120',
              align: 'right',
              width: 110,
              render: (r) => <Money value={r.older} showZero={false} className="text-rose-600 dark:text-rose-400" />
            },
            { key: 'total', label: 'Total', align: 'right', width: 130, render: (r) => <Money value={r.total} className="font-bold" /> }
          ]}
          rows={data.ageing}
          rowKey={(r) => r.accountId}
          footer={[
            'Total',
            ...['current', 'd30', 'd60', 'd90', 'older', 'total'].map((k) =>
              money(data.ageing.reduce((s, r) => s + (r[k] || 0), 0))
            )
          ]}
          empty={<EmptyState title="Nothing outstanding" />}
        />
      )}
    </>
  );
}

function HeadReport({ data, label, tone }) {
  const total = data.total || 0;
  return (
    <DataTable
      maxHeight="none"
      dense
      columns={[
        { key: 'code', label: 'Code', width: 90, render: (r) => <span className="tabular font-bold">{r.code}</span> },
        { key: 'name', label, render: (r) => <span className="font-semibold">{r.name}</span> },
        {
          key: 'share',
          label: 'Share',
          align: 'right',
          width: 90,
          render: (r) => (
            <span className="tabular text-[color:var(--text-muted)]">
              {total ? ((r.amount / total) * 100).toFixed(1) : '0.0'}%
            </span>
          )
        },
        {
          key: 'amount',
          label: 'Amount',
          align: 'right',
          width: 140,
          render: (r) => (
            <Money
              value={r.amount}
              className={`font-bold ${tone === 'danger' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}
            />
          )
        }
      ]}
      rows={data.lines}
      rowKey={(r) => r.accountId}
      footer={['', 'Total', '100.0%', money(total)]}
      empty={<EmptyState title="Nothing recorded in this period" />}
    />
  );
}

function GstSummary({ data }) {
  const rows = [
    { head: 'CGST', output: data.output.cgst, input: data.input.cgst },
    { head: 'SGST', output: data.output.sgst, input: data.input.sgst },
    { head: 'IGST', output: data.output.igst, input: data.input.igst }
  ];

  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Kpi label="Output Tax Collected" value={data.totalOutput} tone="danger" />
        <Kpi label="Input Credit Available" value={data.totalInput} tone="success" />
        <Kpi
          label={data.netPayable >= 0 ? 'Net GST Payable' : 'Net GST Refundable'}
          value={Math.abs(data.netPayable)}
          tone="accent"
        />
      </div>

      <DataTable
        maxHeight="none"
        dense
        columns={[
          { key: 'head', label: 'Tax Head', render: (r) => <span className="font-semibold">{r.head}</span> },
          { key: 'output', label: 'Output (Payable)', align: 'right', width: 160, render: (r) => <Money value={r.output} /> },
          { key: 'input', label: 'Input (Credit)', align: 'right', width: 160, render: (r) => <Money value={r.input} /> },
          {
            key: 'net',
            label: 'Net',
            align: 'right',
            width: 160,
            render: (r) => <Money value={r.output - r.input} colored className="font-bold" />
          }
        ]}
        rows={rows}
        rowKey={(r) => r.head}
        footer={['Total', money(data.totalOutput), money(data.totalInput), money(data.netPayable)]}
      />
    </>
  );
}

function Kpi({ label, value, sub, tone = 'neutral', raw = false }) {
  const color = {
    neutral: 'text-[color:var(--text-primary)]',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-rose-600 dark:text-rose-400',
    accent: 'text-indigo-600 dark:text-indigo-400'
  }[tone];

  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
      <div className="label-eyebrow">{label}</div>
      <div className={`tabular mt-0.5 truncate text-[15px] font-bold ${color}`}>
        {raw ? value : money(value)}
      </div>
      {sub && <div className="text-[10.5px] font-semibold text-[color:var(--text-muted)]">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Export flattening — one shape per report so CSV and PDF agree
 * ------------------------------------------------------------------ */

function buildExport(id, data, title) {
  const num = (v) => Number(v || 0).toFixed(2);

  switch (id) {
    case 'trial-balance':
      return {
        title,
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Account' },
          { key: 'type', label: 'Type' },
          { key: 'debit', label: 'Debit', align: 'right', value: (r) => num(r.debit) },
          { key: 'credit', label: 'Credit', align: 'right', value: (r) => num(r.credit) }
        ],
        rows: data.rows,
        totals: ['', 'TOTAL', '', num(data.totalDebit), num(data.totalCredit)]
      };

    case 'profit-loss': {
      const rows = [
        ...data.income.lines.map((l) => ({ section: 'Income', code: l.code, name: l.name, amount: num(l.amount) })),
        { section: 'Income', code: '', name: 'Total Income', amount: num(data.totalIncome) },
        ...data.expenses.lines.map((l) => ({ section: 'Expenses', code: l.code, name: l.name, amount: num(l.amount) })),
        { section: 'Expenses', code: '', name: 'Total Expenses', amount: num(data.totalExpenses) },
        { section: 'Result', code: '', name: data.netProfit >= 0 ? 'Net Profit' : 'Net Loss', amount: num(data.netProfit) }
      ];
      return {
        title,
        columns: [
          { key: 'section', label: 'Section' },
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Particulars' },
          { key: 'amount', label: 'Amount', align: 'right' }
        ],
        rows
      };
    }

    case 'balance-sheet': {
      const rows = [
        ...data.assets.lines.map((l) => ({ section: 'Assets', name: l.name, amount: num(l.amount) })),
        { section: 'Assets', name: 'Total Assets', amount: num(data.totalAssets) },
        ...data.liabilities.lines.map((l) => ({ section: 'Liabilities', name: l.name, amount: num(l.amount) })),
        { section: 'Liabilities', name: 'Total Liabilities', amount: num(data.totalLiabilities) },
        ...data.equity.lines.map((l) => ({ section: 'Equity', name: l.name, amount: num(l.amount) })),
        { section: 'Equity', name: 'Total Equity', amount: num(data.totalEquity) }
      ];
      return {
        title,
        columns: [
          { key: 'section', label: 'Section' },
          { key: 'name', label: 'Particulars' },
          { key: 'amount', label: 'Amount', align: 'right' }
        ],
        rows
      };
    }

    case 'cash-flow': {
      const rows = ['operating', 'investing', 'financing'].flatMap((key) => [
        ...data[key].items.map((i) => ({ section: key, name: i.name, amount: num(i.amount) })),
        { section: key, name: `Net ${key}`, amount: num(data[key].net) }
      ]);
      rows.push({ section: 'Summary', name: 'Opening Balance', amount: num(data.openingBalance) });
      rows.push({ section: 'Summary', name: 'Closing Balance', amount: num(data.closingBalance) });
      return {
        title,
        columns: [
          { key: 'section', label: 'Activity' },
          { key: 'name', label: 'Particulars' },
          { key: 'amount', label: 'Amount', align: 'right' }
        ],
        rows
      };
    }

    case 'general-ledger':
      return {
        title,
        columns: [
          { key: 'account', label: 'Account' },
          { key: 'date', label: 'Date' },
          { key: 'voucherNo', label: 'Voucher' },
          { key: 'narration', label: 'Particulars' },
          { key: 'debit', label: 'Debit', align: 'right' },
          { key: 'credit', label: 'Credit', align: 'right' },
          { key: 'balance', label: 'Balance', align: 'right' }
        ],
        rows: data.ledgers.flatMap((l) =>
          l.entries.map((e) => ({
            account: `${l.account.code} ${l.account.name}`,
            date: fmtDate(e.date),
            voucherNo: e.voucherNo,
            narration: e.narration,
            debit: num(e.debit),
            credit: num(e.credit),
            balance: num(e.balance)
          }))
        )
      };

    case 'cash-book':
    case 'bank-book':
      return {
        title: `${title} — ${data.account.name}`,
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'opening', label: 'Opening', align: 'right', value: (r) => num(r.opening) },
          { key: 'inflow', label: 'Receipts', align: 'right', value: (r) => num(r.inflow) },
          { key: 'outflow', label: 'Payments', align: 'right', value: (r) => num(r.outflow) },
          { key: 'closing', label: 'Closing', align: 'right', value: (r) => num(r.closing) }
        ],
        rows: data.days
      };

    case 'outstanding-customers':
    case 'outstanding-vendors':
      return {
        title,
        columns: [
          { key: 'name', label: 'Party' },
          { key: 'current', label: '0-30', align: 'right', value: (r) => num(r.current) },
          { key: 'd30', label: '31-60', align: 'right', value: (r) => num(r.d30) },
          { key: 'd60', label: '61-90', align: 'right', value: (r) => num(r.d60) },
          { key: 'd90', label: '91-120', align: 'right', value: (r) => num(r.d90) },
          { key: 'older', label: 'Over 120', align: 'right', value: (r) => num(r.older) },
          { key: 'total', label: 'Total', align: 'right', value: (r) => num(r.total) }
        ],
        rows: data.ageing
      };

    case 'income':
    case 'expense':
      return {
        title,
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Head' },
          { key: 'amount', label: 'Amount', align: 'right', value: (r) => num(r.amount) }
        ],
        rows: data.lines,
        totals: ['', 'TOTAL', num(data.total)]
      };

    case 'gst':
      return {
        title,
        columns: [
          { key: 'head', label: 'Tax Head' },
          { key: 'output', label: 'Output', align: 'right' },
          { key: 'input', label: 'Input', align: 'right' },
          { key: 'net', label: 'Net', align: 'right' }
        ],
        rows: [
          { head: 'CGST', output: num(data.output.cgst), input: num(data.input.cgst), net: num(data.output.cgst - data.input.cgst) },
          { head: 'SGST', output: num(data.output.sgst), input: num(data.input.sgst), net: num(data.output.sgst - data.input.sgst) },
          { head: 'IGST', output: num(data.output.igst), input: num(data.input.igst), net: num(data.output.igst - data.input.igst) }
        ],
        totals: ['TOTAL', num(data.totalOutput), num(data.totalInput), num(data.netPayable)]
      };

    default:
      return { title, columns: [], rows: [] };
  }
}
