import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Eye,
  RefreshCw,
  TrendingUp,
  FileText,
  Building2,
  User,
  ArrowUpRight,
  QrCode,
  X,
  CreditCard,
  Plus
} from 'lucide-react';

import api, { money, fmtDate, fmtDateTime, todayISO, monthStartISO } from '../lib/api';
import { Panel, SectionHeader, StatTile, Badge, Button, Spinner, EmptyState, DataTable, Modal } from '../lib/ui';
import { exportReport } from '../lib/exporters';

/** Converts number to Indian words (Rupees) */
function numberToWords(num) {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(val) {
    if (val < 20) return a[val];
    if (val < 100) return b[Math.floor(val / 10)] + (val % 10 ? ' ' + a[val % 10] : '');
    if (val < 1000) return a[Math.floor(val / 100)] + ' Hundred' + (val % 100 ? ' and ' + inWords(val % 100) : '');
    if (val < 100000) return inWords(Math.floor(val / 1000)) + ' Thousand' + (val % 1000 ? ' ' + inWords(val % 1000) : '');
    if (val < 10000000) return inWords(Math.floor(val / 100000)) + ' Lakh' + (val % 100000 ? ' ' + inWords(val % 100000) : '');
    return inWords(Math.floor(val / 10000000)) + ' Crore' + (val % 10000000 ? ' ' + inWords(val % 10000000) : '');
  }

  return `${inWords(n)} Rupees Only`;
}

export default function InvoicesManager({ tenant, showToast, onNavigate }) {
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PAID, DUE, VOID
  const [dateFilter, setDateFilter] = useState('THIS_MONTH'); // TODAY, THIS_WEEK, THIS_MONTH, ALL
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [viewMode, setViewMode] = useState('TAX_INVOICE'); // TAX_INVOICE, THERMAL

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const [ordersRes, settingsRes] = await Promise.all([
        api.get('/orders', { limit: 300 }),
        api.get('/settings').catch(() => ({}))
      ]);
      setInvoices(ordersRes || []);
      setSettings(settingsRes || null);
    } catch (err) {
      showToast(api.message(err, 'Failed to fetch invoices.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Filter calculations
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const todayStr = todayISO();
    const monthStart = monthStartISO();

    return invoices.filter((inv) => {
      // Status Filter
      const isVoid = inv.status === 'VOID';
      const isDue = (inv.outstanding || inv.dueAmount || 0) > 0;
      if (statusFilter === 'PAID' && (isVoid || isDue)) return false;
      if (statusFilter === 'DUE' && (!isDue || isVoid)) return false;
      if (statusFilter === 'VOID' && !isVoid) return false;

      // Date Filter
      if (inv.date) {
        const invDateStr = inv.date.slice(0, 10);
        if (dateFilter === 'TODAY' && invDateStr !== todayStr) return false;
        if (dateFilter === 'THIS_MONTH' && invDateStr < monthStart) return false;
        if (dateFilter === 'THIS_WEEK') {
          const pastWeek = new Date();
          pastWeek.setDate(now.getDate() - 7);
          if (invDateStr < pastWeek.toISOString().slice(0, 10)) return false;
        }
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchId = String(inv.orderId || '').toLowerCase().includes(q);
        const matchCust = String(inv.customerName || '').toLowerCase().includes(q);
        const matchPhone = String(inv.customerPhone || '').includes(q);
        const matchMode = String(inv.paymentMethod || '').toLowerCase().includes(q);
        if (!matchId && !matchCust && !matchPhone && !matchMode) return false;
      }

      return true;
    });
  }, [invoices, statusFilter, dateFilter, search]);

  // KPI Metrics
  const stats = useMemo(() => {
    let totalAmount = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let voidCount = 0;

    filteredInvoices.forEach((inv) => {
      if (inv.status === 'VOID') {
        voidCount++;
        return;
      }
      const amt = Number(inv.total || 0);
      const due = Number(inv.dueAmount || (inv.paymentStatus === 'UNPAID' ? amt : 0));
      totalAmount += amt;
      totalDue += due;
      totalPaid += (amt - due);
    });

    return {
      count: filteredInvoices.length,
      totalAmount,
      totalPaid,
      totalDue,
      voidCount
    };
  }, [filteredInvoices]);

  const handleVoidInvoice = async (invoice) => {
    if (!window.confirm(`Are you sure you want to VOID invoice ${invoice.orderId}? Inventory and accounts will be adjusted.`)) {
      return;
    }
    try {
      const res = await api.post(`/orders/${invoice.orderId}/void`);
      showToast(res.message || 'Invoice voided successfully.');
      setInvoices((prev) => prev.map((o) => (o.orderId === invoice.orderId ? { ...o, status: 'VOID' } : o)));
      if (selectedInvoice?.orderId === invoice.orderId) {
        setSelectedInvoice((prev) => ({ ...prev, status: 'VOID' }));
      }
    } catch (err) {
      showToast(api.message(err, 'Could not void invoice.'), 'error');
    }
  };

  const exportInvoices = (format) => {
    const rows = filteredInvoices.map((inv) => ({
      'Invoice No': inv.orderId,
      'Date': fmtDateTime(inv.date),
      'Customer': inv.customerName || 'Walk-in',
      'Phone': inv.customerPhone || '—',
      'Payment Mode': inv.paymentMethod || 'Cash',
      'Items Count': (inv.items || []).length,
      'Subtotal': inv.subtotal || inv.total,
      'GST / Tax': inv.tax || 0,
      'Discount': inv.discount || 0,
      'Total Amount': inv.total,
      'Status': inv.status || 'PAID'
    }));
    exportReport(rows, `Invoices_${todayISO()}`, format);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <SectionHeader
        eyebrow="Sales & Receivables"
        title="Invoices Register"
        icon={Receipt}
        subtitle="Complete sales tax invoices register, receipt reprints, GST breakdowns, and accounting reconciliation."
        actions={
          <div className="flex items-center gap-2">
            <Button icon={RefreshCw} onClick={fetchInvoices} loading={loading}>
              Refresh
            </Button>
            <Button
              variant="outline"
              icon={Download}
              onClick={() => exportInvoices('csv')}
              disabled={filteredInvoices.length === 0}
            >
              Export CSV
            </Button>
            {onNavigate && (
              <Button variant="primary" icon={Plus} onClick={() => onNavigate('pos')}>
                Create Invoice (POS)
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Invoiced</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-[color:var(--text-primary)]">
            {money(stats.totalAmount, { decimals: false })}
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
            {stats.count} {stats.count === 1 ? 'invoice' : 'invoices'}
          </div>
        </div>

        <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Received / Paid</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {money(stats.totalPaid, { decimals: false })}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-semibold">
            Fully collected
          </div>
        </div>

        <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Due / Outstanding</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-amber-600 dark:text-amber-400">
            {money(stats.totalDue, { decimals: false })}
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
            Customer receivables
          </div>
        </div>

        <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Voided Invoices</span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-extrabold text-rose-600 dark:text-rose-400">
            {stats.voidCount}
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
            Reversed & cancelled
          </div>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <Panel className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { key: 'ALL', label: 'All Invoices' },
              { key: 'PAID', label: 'Paid' },
              { key: 'DUE', label: 'Due / Credit' },
              { key: 'VOID', label: 'Void' }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Date Range */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search Invoice #, customer, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field-input text-xs"
                style={{ paddingLeft: '2.1rem' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="field-input text-xs py-2 px-3 min-w-[130px] rounded-xl font-semibold cursor-pointer"
            >
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="ALL">All Time</option>
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        {loading ? (
          <Spinner label="Loading sales invoices…" />
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No Invoices Found"
            hint="Try changing your search term or filter range, or generate a new invoice in POS Billing."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider text-[10.5px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {filteredInvoices.map((inv) => {
                  const isVoid = inv.status === 'VOID';
                  const isDue = (inv.dueAmount || 0) > 0;
                  return (
                    <tr
                      key={inv.orderId}
                      className="hover:bg-[color:var(--bg-subtle)] transition-colors group cursor-pointer"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-[color:var(--text-secondary)] whitespace-nowrap">
                        {fmtDate(inv.date)}
                        <span className="block text-[10px] text-[color:var(--text-muted)]">
                          {fmtDateTime(inv.date).slice(12)}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                          {inv.orderId}
                        </span>
                        {inv.voucherNo && (
                          <span className="block text-[10px] text-[color:var(--text-muted)] font-mono">
                            Voucher: {inv.voucherNo}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-[color:var(--text-primary)]">
                          {inv.customerName || 'Walk-in Customer'}
                        </div>
                        {inv.customerPhone && inv.customerPhone !== 'N/A' && (
                          <div className="text-[10.5px] text-[color:var(--text-muted)]">{inv.customerPhone}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-[color:var(--text-secondary)]">
                          {inv.paymentMethod || 'Cash'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[13px] text-[color:var(--text-primary)] whitespace-nowrap">
                        {money(inv.total)}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isVoid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <XCircle className="w-3 h-3" /> VOID
                          </span>
                        ) : isDue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3 h-3" /> DUE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> PAID
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title="View Tax Invoice"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setViewMode('TAX_INVOICE');
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            title="Print Slip"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setViewMode('THERMAL');
                              setTimeout(() => window.print(), 200);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {!isVoid && (
                            <button
                              type="button"
                              title="Void Invoice"
                              onClick={() => handleVoidInvoice(inv)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Professional Tax Invoice Modal */}
      {selectedInvoice && (
        <TaxInvoiceModal
          invoice={selectedInvoice}
          settings={settings}
          tenant={tenant}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onClose={() => setSelectedInvoice(null)}
          onVoid={() => handleVoidInvoice(selectedInvoice)}
        />
      )}
    </div>
  );
}

/** Standard Tax Invoice & Thermal Receipt Modal */
function TaxInvoiceModal({ invoice, settings, tenant, viewMode, setViewMode, onClose, onVoid }) {
  const company = invoice.company || settings?.company || { name: tenant?.name || 'Selsolve Store' };
  const billing = invoice.billing || settings?.billing || {};
  const isVoid = invoice.status === 'VOID';

  // GST slabs
  const gstSlabs = {};
  (invoice.items || []).forEach((item) => {
    const rate = item.taxRate || 0;
    if (!rate) return;
    if (!gstSlabs[rate]) gstSlabs[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    const amt = item.total || (item.qty * item.price);
    gstSlabs[rate].taxable += amt;
    if (billing.interState) {
      gstSlabs[rate].igst += (amt * rate) / 100;
    } else {
      gstSlabs[rate].cgst += (amt * (rate / 2)) / 100;
      gstSlabs[rate].sgst += (amt * (rate / 2)) / 100;
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Tax Invoice — ${invoice.orderId}`}
      subtitle={`Generated on ${fmtDateTime(invoice.date)}`}
      icon={Receipt}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            {!isVoid && (
              <Button variant="danger" size="sm" onClick={onVoid}>
                Void Invoice
              </Button>
            )}
            <div className="flex items-center p-1 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border)] text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('TAX_INVOICE')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'TAX_INVOICE' ? 'bg-indigo-600 text-white shadow-xs' : 'text-[color:var(--text-secondary)]'
                }`}
              >
                Standard A4
              </button>
              <button
                type="button"
                onClick={() => setViewMode('THERMAL')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'THERMAL' ? 'bg-indigo-600 text-white shadow-xs' : 'text-[color:var(--text-secondary)]'
                }`}
              >
                Thermal Slip (3")
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={onClose}>Close</Button>
            <Button variant="primary" icon={Printer} onClick={() => window.print()}>
              Print Invoice
            </Button>
          </div>
        </div>
      }
    >
      {viewMode === 'TAX_INVOICE' ? (
        /* Standard A4 Tax Invoice */
        <div id="printable-tax-invoice" className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 font-sans shadow-xs space-y-6">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900">
                {company.name}
              </div>
              {company.address && <div className="text-xs text-slate-600 mt-1 max-w-sm">{company.address}</div>}
              <div className="text-xs text-slate-600 mt-0.5">
                {company.city} {company.state ? `· ${company.state}` : ''} {company.pincode ? `- ${company.pincode}` : ''}
              </div>
              {company.gstin && (
                <div className="text-xs font-semibold text-slate-800 mt-1">
                  GSTIN: <span className="font-mono">{company.gstin}</span>
                </div>
              )}
              {company.phone && <div className="text-xs text-slate-600">Phone: {company.phone}</div>}
            </div>

            <div className="text-right sm:min-w-[200px]">
              <div className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold uppercase tracking-wider rounded-lg">
                TAX INVOICE
              </div>
              <div className="text-lg font-mono font-bold text-slate-900 mt-2">
                #{invoice.orderId}
              </div>
              {isVoid && (
                <div className="text-xs font-extrabold text-rose-600 uppercase tracking-widest mt-1">
                  [ VOID / CANCELLED ]
                </div>
              )}
            </div>
          </div>

          {/* Meta & Bill To rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-b border-slate-200 pb-6">
            <div className="space-y-1">
              <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">Bill To:</span>
              <div className="text-sm font-bold text-slate-900">{invoice.customerName || 'Walk-in Customer'}</div>
              {invoice.customerPhone && invoice.customerPhone !== 'N/A' && (
                <div className="text-slate-600">Phone: {invoice.customerPhone}</div>
              )}
              {invoice.customerGstin && (
                <div className="text-slate-700 font-semibold">GSTIN: {invoice.customerGstin}</div>
              )}
            </div>

            <div className="space-y-1.5 sm:text-right">
              <div className="flex sm:justify-end gap-3">
                <span className="text-slate-500">Invoice Date:</span>
                <span className="font-bold font-mono">{fmtDate(invoice.date)}</span>
              </div>
              <div className="flex sm:justify-end gap-3">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-bold">{invoice.paymentMethod || 'Cash'}</span>
              </div>
              {invoice.cashier && (
                <div className="flex sm:justify-end gap-3">
                  <span className="text-slate-500">Cashier:</span>
                  <span className="font-semibold">{invoice.cashier}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-50">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item & Description</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                  <th className="py-2.5 px-3 text-right">Tax (%)</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(invoice.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {item.barcode && <div className="text-[10px] text-slate-500 font-mono">Barcode: {item.barcode}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {item.qty} {item.unit || ''}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{Number(item.price).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">{item.taxRate ? `${item.taxRate}%` : '0%'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculations & Total */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Total in Words:</span>
                <div className="text-xs font-semibold text-slate-800 italic mt-0.5">
                  {numberToWords(invoice.total)}
                </div>
              </div>

              {/* GST Slab Breakdown */}
              {Object.keys(gstSlabs).length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-[11px] space-y-1.5">
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Tax Slabs Summary</div>
                  {Object.entries(gstSlabs).map(([rate, vals]) => (
                    <div key={rate} className="flex justify-between text-slate-600 font-mono">
                      <span>GST @ {rate}% on {money(vals.taxable)}:</span>
                      <span className="font-bold">
                        {money(vals.igst || (vals.cgst + vals.sgst))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {billing.termsText && (
                <div className="text-[11px] text-slate-600">
                  <strong className="text-slate-700">Terms & Conditions:</strong> {billing.termsText}
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-mono font-semibold">{money(invoice.subtotal || invoice.total)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-600 font-semibold">
                  <span>Discount:</span>
                  <span className="font-mono">-{money(invoice.discount)}</span>
                </div>
              )}
              {invoice.tax > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">GST Total:</span>
                  <span className="font-mono font-semibold">{money(invoice.tax)}</span>
                </div>
              )}
              {invoice.roundOff !== 0 && invoice.roundOff && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                  <span>Round Off:</span>
                  <span className="font-mono">{money(invoice.roundOff)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-extrabold text-slate-900">
                <span>Grand Total:</span>
                <span className="text-base text-indigo-600 font-mono">{money(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Footer & Signature */}
          <div className="flex flex-col sm:flex-row items-end justify-between gap-6 pt-6 border-t border-slate-200 text-xs">
            <div className="text-slate-500 text-[11px]">
              {billing.footerText || 'Thank you for your business!'}
            </div>
            <div className="text-center sm:text-right space-y-1">
              <div className="h-10"></div>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800 text-[11px]">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Thermal 3-inch slip */
        <div id="printable-thermal-receipt" className="bg-white text-black p-4 rounded-xl border border-slate-300 font-mono text-[11.5px] max-w-sm mx-auto shadow-sm">
          <div className="border-b border-dashed border-black pb-2 text-center">
            <div className="text-[13px] font-bold uppercase">{company.name}</div>
            {company.address && <div className="text-[10px]">{company.address}</div>}
            {company.gstin && <div className="text-[10px]">GSTIN: {company.gstin}</div>}
          </div>
          <div className="flex justify-between border-b border-dashed border-black py-1.5 text-[10px]">
            <div>
              <div>Bill: {invoice.orderId}</div>
              <div>{fmtDateTime(invoice.date)}</div>
            </div>
            <div className="text-right">
              <div>{invoice.customerName || 'Walk-in'}</div>
              <div>Cashier: {invoice.cashier || 'Admin'}</div>
            </div>
          </div>
          <table className="w-full py-1 text-[10.5px]">
            <thead>
              <tr className="border-b border-dashed border-black uppercase text-[9.5px]">
                <th className="py-1 text-left">Item</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Rate</th>
                <th className="py-1 text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((it, i) => (
                <tr key={i}>
                  <td className="py-0.5">{it.name}</td>
                  <td className="py-0.5 text-right">{it.qty}</td>
                  <td className="py-0.5 text-right">{Number(it.price).toFixed(2)}</td>
                  <td className="py-0.5 text-right">{Number(it.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-dashed border-black pt-1.5 space-y-0.5 text-right">
            <div>Subtotal: {money(invoice.subtotal || invoice.total)}</div>
            {invoice.discount > 0 && <div>Discount: -{money(invoice.discount)}</div>}
            {invoice.tax > 0 && <div>GST: {money(invoice.tax)}</div>}
            <div className="text-[13px] font-bold border-t border-dashed border-black pt-1">
              TOTAL: {money(invoice.total)}
            </div>
          </div>
          <div className="text-center text-[10px] mt-3 border-t border-dashed border-black pt-2">
            {billing.footerText || 'Thank you, visit again!'}
          </div>
        </div>
      )}
    </Modal>
  );
}
