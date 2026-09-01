import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Truck, Plus, Trash2, ClipboardList, Wallet, X, Search, Boxes, FileText,
  Undo2, Ban, AlertTriangle, Download, Code, Printer, ChevronLeft, ChevronRight, Paperclip,
  CreditCard, Clock, CheckCircle2, Edit3, ChevronDown, Receipt, Calendar, Building2, User
} from 'lucide-react';

import api, { money, fmtDate, todayISO, monthStartISO, financialYearStartISO, API_BASE } from '../lib/api';
import { exportPurchaseToWord, exportPurchaseOrderToWord } from '../lib/exporters';
import { getProductUnitOptions } from './POSTerminal';
import { ProductFormModal } from './InventoryManager';
import {
  Panel, SectionHeader, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, DateRange, StatTile, DataTable, cx, SearchInput
} from '../lib/ui';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];

// Same wrapping icon+label pill-tab pattern the Inventory section uses — a
// row of tabs is far easier to scan and reach than a compact segmented
// control once there are 5 of them, and a live badge count draws the eye to
// whichever tab actually needs attention right now.
const PURCHASE_TABS = [
  { id: 'INVOICES', label: 'Invoices', icon: Truck },
  { id: 'BY VENDOR', label: 'By Vendor', icon: ClipboardList },
  { id: 'PURCHASE ORDERS', label: 'Purchase Orders', icon: FileText },
  { id: 'RETURNS', label: 'Returns', icon: Undo2 },
  { id: 'PAYMENTS MADE', label: 'Payments Made', icon: Wallet }
];

/**
 * Purchase (goods inward) register. Recording an invoice here receives stock,
 * refreshes each item's cost price, and posts Inventory + GST Input against
 * the vendor — so the "new purchase" flow is the heart of this screen.
 */
export default function PurchaseManager({ tenant, token, showToast }) {
  const loadSeq = useRef(0);
  const [range, setRange] = useState({ from: financialYearStartISO(), to: todayISO() });
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [ledgerAccounts, setLedgerAccounts] = useState([]);
  const [report, setReport] = useState({ rows: [], byVendor: [], total: 0, totalTax: 0 });
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [vendorCredits, setVendorCredits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('INVOICES');
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState(null);
  const [payVendorTarget, setPayVendorTarget] = useState(null);
  const [showNewPO, setShowNewPO] = useState(false);
  const [receivePO, setReceivePO] = useState(null);
  const [poDetail, setPoDetail] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [vcDetail, setVcDetail] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [downloadTarget, setDownloadTarget] = useState(null);
  const [poSearch, setPoSearch] = useState('');
  const [returnSearch, setReturnSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [posSettings, setPosSettings] = useState({});

  const loadPurchases = () => api.get('/purchases', { from: range.from, to: range.to }).then((d) => setPurchases(d || []));
  const loadVendors = () => api.get('/vendors').then((d) => setVendors(d || []));
  const loadProducts = () => api.get('/products').then((d) => setProducts(d || []));
  const loadPurchaseOrders = () => api.get('/purchase-orders').then((d) => setPurchaseOrders(d || []));
  const loadVendorCredits = () => api.get('/vendor-credits').then((d) => setVendorCredits(d || []));
  const loadPayments = () => api.get('/vendors/payments').then((d) => setPayments(d || []));

  const load = async () => {
    // Guard against a slower, older request (e.g. a previous date-range
    // selection) resolving after a newer one and clobbering fresher state.
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const [p, v, pr, tr, rep, po, vc, pay, cat, un, wh, settings] = await Promise.all([
        api.get('/purchases', { from: range.from, to: range.to }),
        api.get('/vendors'),
        api.get('/products'),
        api.get('/accounts/transfers'),
        api.get('/reports/purchases', { from: range.from, to: range.to }),
        api.get('/purchase-orders'),
        api.get('/vendor-credits'),
        api.get('/vendors/payments'),
        api.get('/categories').catch(() => []),
        api.get('/units').catch(() => []),
        api.get('/warehouses').catch(() => []),
        api.get('/settings').catch(() => ({}))
      ]);
      if (seq !== loadSeq.current) return;
      setPurchases(p || []);
      setVendors(v || []);
      setProducts(pr || []);
      setLedgerAccounts(tr?.accounts || []);
      setReport(rep || { rows: [], byVendor: [], total: 0, totalTax: 0 });
      setPurchaseOrders(po || []);
      setVendorCredits(vc || []);
      setPayments(pay || []);
      setCategories(cat || []);
      setUnits(un || []);
      setWarehouses(wh || []);
      setPosSettings(settings?.pos || {});
    } catch (err) {
      if (seq !== loadSeq.current) return;
      showToast(api.message(err, 'Could not load purchase data.'), 'error');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const handleVoidPurchase = async (purchase) => {
    if (!window.confirm(`Are you sure you want to VOID purchase ${purchase.invoiceNo}? This will reverse the received stock and accounting entries.`)) return;
    try {
      const res = await api.post(`/purchases/${purchase.id}/void`);
      showToast(res.message);
      setDetail(null);
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not void this purchase.'), 'error');
    }
  };

  const handleCancelPO = async (po) => {
    if (!window.confirm(`Cancel purchase order ${po.poNumber}?`)) return;
    try {
      const res = await api.post(`/purchase-orders/${po.id}/cancel`);
      showToast(res.message);
      setPoDetail(null);
      loadPurchaseOrders();
    } catch (err) {
      showToast(api.message(err, 'Could not cancel this purchase order.'), 'error');
    }
  };

  const handleVoidVendorCredit = async (vc) => {
    if (!window.confirm(`Void this return to ${vc.vendorName}? The returned stock will be restored.`)) return;
    try {
      const res = await api.post(`/vendor-credits/${vc.id}/void`);
      showToast(res.message);
      setVcDetail(null);
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not void this vendor credit.'), 'error');
    }
  };

  // api.get() unwraps to the raw array, so period totals are derived here
  // rather than read from a summary envelope.
  const summary = useMemo(() => {
    const count = purchases.length;
    const total = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const unpaid = purchases.reduce(
      (s, p) => s + (p.paymentStatus === 'PAID' ? 0 : (p.totalAmount || 0) - (p.paidAmount || 0)),
      0
    );
    const overdue = purchases.filter((p) => p.isOverdue);
    const overdueAmount = overdue.reduce((s, p) => s + (p.totalAmount || 0) - (p.paidAmount || 0), 0);
    return { count, total, unpaid, overdueCount: overdue.length, overdueAmount };
  }, [purchases]);

  const byVendorTotals = useMemo(
    () => ({
      invoices: report.byVendor.reduce((s, v) => s + v.invoices, 0),
      total: report.byVendor.reduce((s, v) => s + v.total, 0),
      unpaid: report.byVendor.reduce((s, v) => s + v.unpaid, 0)
    }),
    [report.byVendor]
  );

  const filteredPOs = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    if (!q) return purchaseOrders;
    return purchaseOrders.filter((p) => p.poNumber?.toLowerCase().includes(q) || p.vendorName?.toLowerCase().includes(q));
  }, [purchaseOrders, poSearch]);

  const filteredVendorCredits = useMemo(() => {
    const q = returnSearch.trim().toLowerCase();
    if (!q) return vendorCredits;
    return vendorCredits.filter(
      (v) =>
        v.purchaseInvoiceNo?.toLowerCase().includes(q) ||
        v.vendorName?.toLowerCase().includes(q) ||
        v.reason?.toLowerCase().includes(q)
    );
  }, [vendorCredits, returnSearch]);

  const filteredPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) => p.vendorName?.toLowerCase().includes(q) || p.reference?.toLowerCase().includes(q) || p.paymentMode?.toLowerCase().includes(q)
    );
  }, [payments, paymentSearch]);

  const filteredPurchases = useMemo(() => {
    let list = purchases;
    if (statusFilter === 'PAID') {
      list = list.filter((p) => p.paymentStatus === 'PAID' && p.status !== 'VOID');
    } else if (statusFilter === 'PARTIAL') {
      list = list.filter((p) => p.paymentStatus === 'PARTIAL' && p.status !== 'VOID');
    } else if (statusFilter === 'UNPAID') {
      list = list.filter((p) => p.paymentStatus === 'UNPAID' && p.status !== 'VOID');
    } else if (statusFilter === 'OVERDUE') {
      list = list.filter((p) => p.isOverdue && p.status !== 'VOID');
    } else if (statusFilter === 'VOID') {
      list = list.filter((p) => p.status === 'VOID');
    }
    if (invoiceSearch) {
      const q = invoiceSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.invoiceNo && p.invoiceNo.toLowerCase().includes(q)) ||
          (p.vendorName && p.vendorName.toLowerCase().includes(q)) ||
          (p.voucherNo && p.voucherNo.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q))
      );
    }
    return list;
  }, [purchases, statusFilter, invoiceSearch]);

  const handleExecuteDownload = (format, target) => {
    if (!target) return;
    const isPO = target.type === 'po' || Boolean(target.poNumber);
    const safeName = (target.invoiceNo || target.poNumber || 'purchase-doc')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    if (format === 'json') {
      const exportData = {
        documentType: isPO ? 'Purchase Order' : 'Purchase Invoice',
        data: target,
        exportedAt: new Date().toISOString(),
        generator: 'Selsolve Smart POS'
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${isPO ? 'po' : 'purchase'}-${safeName}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded "${target.invoiceNo || target.poNumber}" as JSON file`);
    } else if (format === 'word') {
      if (isPO) {
        exportPurchaseOrderToWord({ po: target, company: tenant || {} });
      } else {
        exportPurchaseToWord({ purchase: target, company: tenant || {} });
      }
      showToast(`Exported "${target.invoiceNo || target.poNumber}" as Word (.doc) document`);
    } else if (format === 'pdf') {
      window.print();
      showToast(`Opening Print / Save as PDF for "${target.invoiceNo || target.poNumber}"...`);
    }
    setDownloadTarget(null);
  };

  if (loading) return <Spinner label="Loading purchases…" />;

  const openPOCount = purchaseOrders.filter((p) => p.status === 'ISSUED' || p.status === 'PARTIALLY_RECEIVED').length;
  const tabBadges = {
    INVOICES: summary.overdueCount || null,
    'PURCHASE ORDERS': openPOCount || null
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Purchases"
        title="Purchase Management"
        icon={Truck}
        subtitle="Recording a purchase receives stock, updates each item's cost price, and posts Inventory + GST Input against the vendor."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowNew(true)}>
            New Purchase Invoice
          </Button>
        }
      />

      {/* Tab strip — one icon+label pill per feature area, matching the Inventory section */}
      <div className="flex items-center gap-1.5 border-b border-[color:var(--border-subtle)] pb-3 overflow-x-auto scroll-smooth snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
        {PURCHASE_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = view === t.id;
          const badge = tabBadges[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={cx(
                'flex shrink-0 snap-start items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-all whitespace-nowrap',
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)]'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {badge > 0 && (
                <span
                  className={cx(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                    isActive ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(view === 'INVOICES' || view === 'BY VENDOR') && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Total Purchases" value={money(summary.total, { decimals: false })} sub="Selected period" icon={Truck} tone="accent" />
            <StatTile label="Invoices" value={summary.count} sub="Selected period" icon={ClipboardList} />
            <StatTile label="Unpaid" value={money(summary.unpaid, { decimals: false })} tone="warning" sub="Outstanding to vendors" />
            <StatTile
              label="Overdue"
              value={money(summary.overdueAmount, { decimals: false })}
              tone={summary.overdueCount ? 'danger' : 'neutral'}
              sub={`${summary.overdueCount} invoice(s) past due`}
              icon={AlertTriangle}
            />
            <StatTile label="GST Input Credit" value={money(report.totalTax, { decimals: false })} tone="success" sub="Reclaimable this period" />
          </div>
          <DateRange from={range.from} to={range.to} onChange={setRange} />
        </>
      )}

      {view === 'PURCHASE ORDERS' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
            <div className="flex flex-wrap gap-3">
              <MiniStat label="Open Purchase Orders" value={openPOCount} />
              <MiniStat
                label="Open PO Value"
                value={money(
                  purchaseOrders
                    .filter((p) => p.status === 'ISSUED' || p.status === 'PARTIALLY_RECEIVED')
                    .reduce((s, p) => s + (Number(p.totalAmount) || 0), 0),
                  { decimals: false }
                )}
              />
            </div>
            <Button variant="primary" icon={Plus} onClick={() => setShowNewPO(true)}>
              New Purchase Order
            </Button>
          </div>
          <SearchInput value={poSearch} onChange={setPoSearch} placeholder="Search by PO number or vendor…" className="max-w-sm" />
        </div>
      )}

      {view === 'RETURNS' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
            <MiniStat label="Returns Recorded" value={vendorCredits.filter((v) => v.status !== 'VOID').length} />
            <MiniStat
              label="Total Credited"
              value={money(vendorCredits.filter((v) => v.status !== 'VOID').reduce((s, v) => s + (Number(v.totalAmount) || 0), 0), { decimals: false })}
            />
            <span className="text-[11px] text-[color:var(--text-muted)] ml-auto">
              Open an invoice from the Invoices tab and use “Return Items” to credit a vendor.
            </span>
          </div>
          <SearchInput value={returnSearch} onChange={setReturnSearch} placeholder="Search by invoice, vendor, or reason…" className="max-w-sm" />
        </div>
      )}

      {view === 'PAYMENTS MADE' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
            <MiniStat label="Payments Recorded" value={payments.length} />
            <MiniStat label="Total Paid" value={money(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), { decimals: false })} />
          </div>
          <SearchInput value={paymentSearch} onChange={setPaymentSearch} placeholder="Search by vendor, mode, or reference…" className="max-w-sm" />
        </div>
      )}

      {view === 'INVOICES' && (
        <div className="space-y-3">
          {/* Marquee scrollable status filter buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1" style={{ scrollbarWidth: 'none' }}>
            {[
              { id: 'ALL', label: 'All Invoices' },
              { id: 'UNPAID', label: 'Unpaid / Due' },
              { id: 'PARTIAL', label: 'Partially Paid' },
              { id: 'PAID', label: 'Fully Paid' },
              { id: 'OVERDUE', label: 'Overdue' },
              { id: 'VOID', label: 'Voided' }
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={cx(
                  'flex shrink-0 snap-start items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap',
                  statusFilter === st.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                    : 'text-[color:var(--text-secondary)] bg-[color:var(--bg-subtle)] hover:bg-[color:var(--bg-muted)]'
                )}
              >
                {st.label}
              </button>
            ))}
          </div>

          <SearchInput
            value={invoiceSearch}
            onChange={setInvoiceSearch}
            placeholder="Search by invoice #, vendor name, voucher, or notes…"
            className="max-w-md"
          />

          <DataTable
            maxHeight="56vh"
            columns={[
              { key: 'date', label: 'Date', width: 100, render: (p) => fmtDate(p.date) },
              { key: 'invoiceNo', label: 'Invoice No', render: (p) => <span className="font-bold">{p.invoiceNo}</span> },
              { key: 'vendorName', label: 'Vendor', render: (p) => p.vendorName },
              { key: 'items', label: 'Items', width: 70, align: 'right', render: (p) => p.items?.length || 0 },
              { key: 'subtotal', label: 'Taxable', align: 'right', width: 110, render: (p) => <Money value={p.subtotal} /> },
              { key: 'tax', label: 'GST', align: 'right', width: 100, render: (p) => <Money value={p.tax} showZero={false} /> },
              { key: 'totalAmount', label: 'Total', align: 'right', width: 120, render: (p) => <Money value={p.totalAmount} className="font-bold" /> },
              {
                key: 'dueDate',
                label: 'Due',
                width: 110,
                render: (p) =>
                  p.dueDate ? (
                    <span className={`text-[11px] font-semibold ${p.isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-[color:var(--text-secondary)]'}`}>
                      {p.isOverdue && <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />}
                      {fmtDate(p.dueDate)}
                    </span>
                  ) : (
                    <span className="text-[color:var(--text-muted)]">—</span>
                  )
              },
              {
                key: 'paymentStatus',
                label: 'Status',
                width: 110,
                render: (p) => <PaymentStatusBadge purchase={p} />
              },
              {
                key: 'voucherNo',
                label: 'Voucher',
                width: 90,
                render: (p) => <span className="tabular text-[10.5px] font-bold text-[color:var(--accent)]">{p.voucherNo}</span>
              },
              {
                key: 'actions',
                label: '',
                width: 50,
                render: (p) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDownloadTarget(p);
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    title="Download / Export"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )
              }
            ]}
            rows={filteredPurchases}
            onRowClick={setDetail}
            empty={<EmptyState icon={Truck} title="No purchases match your filter" hint="Record a purchase invoice to receive stock." />}
            footer={[
              'Total', '', '',
              filteredPurchases.reduce((s, p) => s + (p.items?.length || 0), 0),
              money(filteredPurchases.reduce((s, p) => s + (p.subtotal || 0), 0)),
              money(filteredPurchases.reduce((s, p) => s + (p.tax || 0), 0)),
              money(filteredPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0)),
              '', '', '', ''
            ]}
          />
        </div>
      )}

      {view === 'BY VENDOR' && (
        <DataTable
          maxHeight="56vh"
          columns={[
            { key: 'vendor', label: 'Vendor', render: (v) => <span className="font-semibold">{v.vendor}</span> },
            { key: 'invoices', label: 'Invoices', align: 'right', width: 90, render: (v) => v.invoices },
            { key: 'total', label: 'Total Purchased', align: 'right', width: 140, render: (v) => <Money value={v.total} className="font-bold" /> },
            {
              key: 'unpaid',
              label: 'Unpaid',
              align: 'right',
              width: 120,
              render: (v) => <Money value={v.unpaid} showZero={false} className={v.unpaid > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : ''} />
            }
          ]}
          rows={report.byVendor}
          rowKey={(v, i) => v.vendor || i}
          empty={<EmptyState title="No vendor purchases yet" />}
          footer={['Total', byVendorTotals.invoices, money(byVendorTotals.total), money(byVendorTotals.unpaid)]}
        />
      )}

      {view === 'PURCHASE ORDERS' && (
        <DataTable
          maxHeight="56vh"
          columns={[
            { key: 'poNumber', label: 'PO No.', width: 100, render: (p) => <span className="font-bold">{p.poNumber}</span> },
            { key: 'date', label: 'Date', width: 100, render: (p) => fmtDate(p.date) },
            { key: 'vendorName', label: 'Vendor', render: (p) => p.vendorName },
            { key: 'items', label: 'Lines', width: 70, align: 'right', render: (p) => p.items?.length || 0 },
            { key: 'totalAmount', label: 'Total', align: 'right', width: 120, render: (p) => <Money value={p.totalAmount} className="font-bold" /> },
            { key: 'status', label: 'Status', width: 150, render: (p) => <POStatusBadge po={p} /> }
          ]}
          rows={filteredPOs}
          onRowClick={setPoDetail}
          rowKey={(p) => p.id}
          empty={
            poSearch ? (
              <EmptyState icon={FileText} title="No purchase orders match your search" />
            ) : (
              <EmptyState
                icon={FileText}
                title="No purchase orders yet"
                hint="Create a PO to commit to a vendor before goods arrive."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => setShowNewPO(true)}>
                    Create First Purchase Order
                  </Button>
                }
              />
            )
          }
        />
      )}

      {view === 'RETURNS' && (
        <DataTable
          maxHeight="56vh"
          columns={[
            { key: 'date', label: 'Date', width: 100, render: (v) => fmtDate(v.date) },
            { key: 'purchaseInvoiceNo', label: 'Against Invoice', render: (v) => v.purchaseInvoiceNo },
            { key: 'vendorName', label: 'Vendor', render: (v) => v.vendorName },
            { key: 'reason', label: 'Reason', render: (v) => v.reason },
            { key: 'items', label: 'Items', width: 70, align: 'right', render: (v) => v.items?.length || 0 },
            { key: 'totalAmount', label: 'Credited', align: 'right', width: 120, render: (v) => <Money value={v.totalAmount} className="font-bold" /> },
            { key: 'status', label: 'Status', width: 90, render: (v) => (v.status === 'VOID' ? <Badge tone="danger">VOID</Badge> : <Badge tone="success">Active</Badge>) }
          ]}
          rows={filteredVendorCredits}
          onRowClick={setVcDetail}
          rowKey={(v) => v.id}
          empty={
            returnSearch ? (
              <EmptyState icon={Undo2} title="No returns match your search" />
            ) : (
              <EmptyState icon={Undo2} title="No returns recorded yet" hint="Open a purchase invoice and use “Return Items” to credit a vendor." />
            )
          }
        />
      )}

      {view === 'PAYMENTS MADE' && (
        <DataTable
          maxHeight="56vh"
          columns={[
            { key: 'date', label: 'Date', width: 100, render: (p) => fmtDate(p.date) },
            { key: 'vendorName', label: 'Vendor', render: (p) => p.vendorName },
            { key: 'amount', label: 'Amount', align: 'right', width: 120, render: (p) => <Money value={p.amount} className="font-bold" /> },
            { key: 'paymentMode', label: 'Mode', width: 110, render: (p) => p.paymentMode },
            { key: 'reference', label: 'Reference', render: (p) => p.reference || '—' },
            { key: 'voucherNo', label: 'Voucher', width: 90, render: (p) => <span className="tabular text-[10.5px] font-bold text-[color:var(--accent)]">{p.voucherNo}</span> }
          ]}
          rows={filteredPayments}
          rowKey={(p) => p.id}
          empty={
            paymentSearch ? (
              <EmptyState icon={Wallet} title="No payments match your search" />
            ) : (
              <EmptyState icon={Wallet} title="No vendor payments recorded yet" hint="Pay a vendor from the panel below to see it listed here." />
            )
          }
          footer={['', 'Total', money(filteredPayments.reduce((s, p) => s + (p.amount || 0), 0)), '', '', '']}
        />
      )}

      {(view === 'INVOICES' || view === 'PAYMENTS MADE') && (
        <VendorPayablesPanel vendors={vendors} onPay={setPayVendorTarget} />
      )}

      <NewPurchaseModal
        open={showNew}
        onClose={() => setShowNew(false)}
        vendors={vendors}
        products={products}
        accounts={ledgerAccounts}
        categories={categories}
        units={units}
        warehouses={warehouses}
        batchTrackingEnabled={Boolean(posSettings.enableBatchTracking)}
        storeNearExpiryDays={posSettings.nearExpiryDays}
        showToast={showToast}
        onProductCreated={loadProducts}
        onSaved={() => {
          setShowNew(false);
          loadPurchases();
          loadVendors();
          loadProducts();
          loadPurchaseOrders();
        }}
      />

      <NewPurchaseModal
        open={Boolean(receivePO)}
        onClose={() => setReceivePO(null)}
        vendors={vendors}
        products={products}
        accounts={ledgerAccounts}
        categories={categories}
        units={units}
        warehouses={warehouses}
        batchTrackingEnabled={Boolean(posSettings.enableBatchTracking)}
        storeNearExpiryDays={posSettings.nearExpiryDays}
        showToast={showToast}
        onProductCreated={loadProducts}
        poContext={receivePO}
        onSaved={() => {
          setReceivePO(null);
          setPoDetail(null);
          loadPurchases();
          loadVendors();
          loadProducts();
          loadPurchaseOrders();
        }}
      />

      <PurchaseDetailModal
        purchase={detail}
        vendorCredits={vendorCredits.filter((v) => v.purchaseId === detail?.id)}
        onClose={() => setDetail(null)}
        onVoid={handleVoidPurchase}
        onDownload={setDownloadTarget}
        onReturn={(p) => {
          setDetail(null);
          setReturnTarget(p);
        }}
        onAttachmentsChanged={(atts) => {
          setDetail((d) => (d ? { ...d, attachments: atts } : d));
          loadPurchases();
        }}
        showToast={showToast}
      />

      <PayVendorModal
        vendor={payVendorTarget}
        accounts={ledgerAccounts}
        showToast={showToast}
        onClose={() => setPayVendorTarget(null)}
        onPaid={() => {
          setPayVendorTarget(null);
          load();
        }}
      />

      <PurchaseOrderModal
        open={showNewPO}
        onClose={() => setShowNewPO(false)}
        vendors={vendors}
        products={products}
        categories={categories}
        units={units}
        warehouses={warehouses}
        batchTrackingEnabled={posSettings.enableBatchTracking}
        storeNearExpiryDays={posSettings.nearExpiryDays}
        showToast={showToast}
        onProductCreated={loadProducts}
        onSaved={() => {
          setShowNewPO(false);
          loadPurchaseOrders();
          loadVendors();
          loadProducts();
        }}
      />

      <PODetailModal
        po={poDetail}
        onClose={() => setPoDetail(null)}
        onCancel={handleCancelPO}
        onDownload={setDownloadTarget}
        onReceive={(po) => {
          setPoDetail(null);
          setReceivePO(po);
        }}
      />

      <PurchaseReturnModal
        purchase={returnTarget}
        vendorCredits={vendorCredits.filter((v) => v.purchaseId === returnTarget?.id)}
        showToast={showToast}
        onClose={() => setReturnTarget(null)}
        onSaved={() => {
          setReturnTarget(null);
          load();
        }}
      />

      <VendorCreditDetailModal vendorCredit={vcDetail} onClose={() => setVcDetail(null)} onVoid={handleVoidVendorCredit} />

      {/* 50% Screen Width Download / Export Format Selection Modal */}
      <Modal
        open={Boolean(downloadTarget)}
        onClose={() => setDownloadTarget(null)}
        title="Select Download Format"
        subtitle={`Export ${downloadTarget?.invoiceNo || downloadTarget?.poNumber || 'document'}`}
        icon={Download}
        size="custom"
        className="!max-w-[50vw] !w-[50vw]"
      >
        <div className="py-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleExecuteDownload('json', downloadTarget)}
              className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50 dark:bg-slate-900/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all text-center group"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Code className="w-6 h-6" />
              </div>
              <div className="font-bold text-sm text-slate-800 dark:text-slate-100">JSON File</div>
              <div className="text-xs text-slate-400 mt-0.5">.json format</div>
            </button>

            <button
              onClick={() => handleExecuteDownload('word', downloadTarget)}
              className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50 dark:bg-slate-900/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all text-center group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <div className="font-bold text-sm text-slate-800 dark:text-slate-100">Word Document</div>
              <div className="text-xs text-slate-400 mt-0.5">.doc format</div>
            </button>

            <button
              onClick={() => handleExecuteDownload('pdf', downloadTarget)}
              className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50 dark:bg-slate-900/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all text-center group"
            >
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Printer className="w-6 h-6" />
              </div>
              <div className="font-bold text-sm text-slate-800 dark:text-slate-100">PDF / Print</div>
              <div className="text-xs text-slate-400 mt-0.5">.pdf document</div>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Vendor Cash Payment — Module 6. Settling a supplier without leaving the
 * purchases screen; the money is applied to their oldest unpaid invoices
 * first, exactly as the backend does it.
 */
function VendorPayablesPanel({ vendors, onPay }) {
  const payable = useMemo(
    () => vendors.filter((v) => v.outstandingPayable > 0).sort((a, b) => b.outstandingPayable - a.outstandingPayable),
    [vendors]
  );

  return (
    <Panel>
      <SectionHeader
        eyebrow="Module 6"
        title="Vendor Payables"
        icon={Wallet}
        subtitle="Settling a vendor here posts a real voucher and clears their oldest unpaid invoices first."
      />
      <div className="mt-3">
        <DataTable
          maxHeight="40vh"
          dense
          columns={[
            { key: 'name', label: 'Vendor', render: (v) => <span className="font-semibold">{v.name}</span> },
            { key: 'phone', label: 'Phone', width: 120, render: (v) => <span className="text-[color:var(--text-muted)]">{v.phone || '—'}</span> },
            {
              key: 'outstandingPayable',
              label: 'Payable',
              align: 'right',
              width: 130,
              render: (v) => <Money value={v.outstandingPayable} className="font-bold" />
            },
            {
              key: 'advancePaid',
              label: 'Advance',
              align: 'right',
              width: 110,
              render: (v) => <Money value={v.advancePaid} showZero={false} className="text-emerald-600 dark:text-emerald-400" />
            },
            {
              key: 'action',
              label: '',
              width: 80,
              render: (v) => (
                <Button size="sm" variant="primary" onClick={() => onPay(v)}>
                  Pay
                </Button>
              )
            }
          ]}
          rows={payable}
          rowKey={(v) => v.id}
          empty={<EmptyState icon={Wallet} title="No vendors with an outstanding balance" />}
        />
      </div>
    </Panel>
  );
}

/** Status + paid-so-far badge shared by the invoice list and the detail modal. */
function PaymentStatusBadge({ purchase }) {
  if (purchase.status === 'VOID') {
    return <Badge tone="danger">VOID</Badge>;
  }
  const tone = purchase.paymentStatus === 'PAID' ? 'success' : purchase.paymentStatus === 'PARTIAL' ? 'info' : 'warning';
  const label = purchase.paymentStatus === 'PAID' ? 'Paid' : purchase.paymentStatus === 'PARTIAL' ? 'Partial' : 'Unpaid';
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Badge tone={tone}>{label}</Badge>
      {purchase.paymentStatus === 'PARTIAL' && (
        <span className="tabular text-[10px] text-[color:var(--text-muted)]">{money(purchase.paidAmount)} paid</span>
      )}
    </span>
  );
}

function PurchaseDetailModal({ purchase, vendorCredits = [], onClose, onVoid, onReturn, onDownload, onAttachmentsChanged, showToast }) {
  const isVoid = purchase?.status === 'VOID';
  return (
    <Modal
      open={Boolean(purchase)}
      onClose={onClose}
      title={purchase ? `Invoice ${purchase.invoiceNo}` : ''}
      subtitle={purchase ? `${purchase.vendorName} · ${fmtDate(purchase.date)} · Voucher ${purchase.voucherNo}` : ''}
      icon={Truck}
      size="xl"
      footer={
        <>
          {purchase && onDownload && (
            <Button variant="outline" icon={Download} onClick={() => onDownload(purchase)}>
              Download / Export
            </Button>
          )}
          {purchase && !isVoid && purchase.vendorId && (
            <Button variant="outline" icon={Undo2} onClick={() => onReturn(purchase)}>
              Return Items
            </Button>
          )}
          {purchase && !isVoid && (
            <Button variant="danger" onClick={() => onVoid(purchase)}>
              Void Purchase
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {purchase && (
        <div className="space-y-3">
          {isVoid && (
            <div className="rounded-xl px-3 py-2 text-[11.5px] font-semibold text-rose-600 dark:text-rose-400" style={{ background: 'var(--bg-subtle)' }}>
              This purchase was voided{purchase.voidedBy ? ` by ${purchase.voidedBy}` : ''}{purchase.voidedAt ? ` on ${fmtDate(purchase.voidedAt)}` : ''}. Stock and accounting entries were reversed.
            </div>
          )}
          {purchase.poNumber && (
            <div className="rounded-xl px-3 py-2 text-[11.5px] font-semibold text-indigo-600 dark:text-indigo-400" style={{ background: 'var(--bg-subtle)' }}>
              Received against purchase order {purchase.poNumber}.
            </div>
          )}
          <div className="grid grid-cols-4 gap-3">
            <Summary label="Payment status" value={<PaymentStatusBadge purchase={purchase} />} />
            <Summary label="Payment mode" value={purchase.paymentMode || '—'} />
            <Summary label="Received by" value={purchase.receivedBy || '—'} />
            <Summary
              label="Due date"
              value={
                purchase.dueDate ? (
                  <span className={purchase.isOverdue ? 'text-rose-600 dark:text-rose-400' : ''}>
                    {fmtDate(purchase.dueDate)}
                    {purchase.isOverdue ? ' (Overdue)' : ''}
                  </span>
                ) : (
                  '—'
                )
              }
            />
          </div>

          <DataTable
            maxHeight="40vh"
            dense
            columns={[
              { key: 'name', label: 'Product', render: (i) => i.name },
              { key: 'qty', label: 'Qty', align: 'right', width: 80, render: (i) => i.qty },
              { key: 'rate', label: 'Rate', align: 'right', width: 100, render: (i) => <Money value={i.rate} /> },
              { key: 'taxRate', label: 'Tax %', align: 'right', width: 80, render: (i) => `${i.taxRate || 0}%` },
              {
                key: 'amount',
                label: 'Amount',
                align: 'right',
                width: 120,
                render: (i) => (
                  <Money
                    value={i.total ?? Math.max(0, i.qty * i.rate * (1 + (i.taxRate || 0) / 100) - (i.discount || 0))}
                    className="font-bold"
                  />
                )
              }
            ]}
            rows={purchase.items || []}
            rowKey={(i, idx) => `${i.productId}_${idx}`}
            empty={<EmptyState title="No line items" />}
            footer={['', '', '', 'Taxable', money(purchase.subtotal)]}
          />

          <div className="flex justify-end gap-6 rounded-xl px-4 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
            <Summary label="Taxable Value" value={money(purchase.subtotal)} />
            <Summary label="GST" value={money(purchase.tax)} />
            <Summary label="Grand Total" value={money(purchase.totalAmount)} bold />
          </div>

          {purchase.totalAdditionalCharges > 0 && (
            <div>
              <div className="label-eyebrow mb-1.5">Landed cost (additional charges)</div>
              <div className="space-y-1">
                {(purchase.additionalCharges || []).map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11.5px] px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-subtle)' }}>
                    <span>{c.label}</span>
                    <Money value={c.amount} className="font-semibold" />
                  </div>
                ))}
              </div>
              <p className="text-[10.5px] text-[color:var(--text-muted)] mt-1">
                Capitalised into item cost — not included in the vendor's payable above.
              </p>
            </div>
          )}

          {purchase.notes && (
            <div className="text-[12px] text-[color:var(--text-secondary)]">
              <span className="label-eyebrow mr-1.5">Notes</span>
              {purchase.notes}
            </div>
          )}

          <AttachmentsPanel refType="PURCHASE" refId={purchase.id} attachments={purchase.attachments || []} onChanged={onAttachmentsChanged} showToast={showToast} />

          {vendorCredits.length > 0 && (
            <div>
              <div className="label-eyebrow mb-1.5">Returns against this invoice</div>
              <div className="space-y-1.5">
                {vendorCredits.map((vc) => (
                  <div
                    key={vc.id}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-[11.5px]"
                    style={{ background: 'var(--bg-subtle)' }}
                  >
                    <span className="font-semibold">
                      {fmtDate(vc.date)} · {vc.items?.length || 0} item(s) · {vc.reason}
                    </span>
                    <span className="flex items-center gap-2">
                      <Money value={vc.totalAmount} className="font-bold" />
                      {vc.status === 'VOID' && <Badge tone="danger">VOID</Badge>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Summary({ label, value, bold }) {
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <div className={`mt-0.5 text-[13px] text-[color:var(--text-primary)] ${bold ? 'font-bold' : 'font-semibold'}`}>{value}</div>
    </div>
  );
}

/** Compact inline stat used in a tab's own toolbar row — lighter than a full StatTile card. */
function MiniStat({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">{label}</span>
      <span className="text-sm font-extrabold text-[color:var(--text-primary)] tabular">{value}</span>
    </div>
  );
}

const resolveFileUrl = (url) => (url && url.startsWith('/') ? `${API_BASE.replace('/api/pos', '')}${url}` : url);

/**
 * Attaches a vendor invoice photo/PDF, delivery challan, etc. against a
 * purchase, PO, or vendor credit. Binary lives server-side (see
 * attachment.controller.js) — this only manages the lightweight metadata
 * list already sitting on the record.
 */
function AttachmentsPanel({ refType, refId, attachments = [], onChanged, showToast }) {
  const [uploading, setUploading] = useState(false);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('refType', refType);
      formData.append('refId', refId);
      const res = await api.post('/attachments', formData);
      showToast(res.message || 'File attached.');
      onChanged?.([...(attachments || []), res.data]);
    } catch (err) {
      showToast(api.message(err, 'Could not upload file.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (att) => {
    if (!window.confirm(`Remove "${att.originalName}"?`)) return;
    try {
      await api.del(`/attachments/${att.filename}`);
      showToast('Attachment removed.');
      onChanged?.((attachments || []).filter((a) => a.filename !== att.filename));
    } catch (err) {
      showToast(api.message(err, 'Could not remove attachment.'), 'error');
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label-eyebrow">Attachments</span>
        <label className="cursor-pointer">
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={upload} disabled={uploading} />
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-[10.5px] font-bold text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)]">
            <Paperclip className="h-3 w-3" />
            {uploading ? 'Uploading…' : 'Attach file'}
          </span>
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-[11px] text-[color:var(--text-muted)]">No files attached — add the vendor's invoice photo or PDF for the record.</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <div
              key={a.filename}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11.5px]"
              style={{ background: 'var(--bg-subtle)' }}
            >
              <a
                href={resolveFileUrl(a.url)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{a.originalName}</span>
              </a>
              <div className="flex items-center gap-2 shrink-0 text-[color:var(--text-muted)]">
                <span>{((a.size || 0) / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={() => remove(a)} className="rounded-lg p-1 hover:bg-black/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PAY_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

function PayVendorModal({ vendor, accounts, showToast, onClose, onPaid }) {
  const blankForm = () => ({
    amount: vendor ? vendor.outstandingPayable : 0,
    discount: 0,
    paymentMode: 'Cash',
    settlementAccountId: '',
    reference: '',
    notes: '',
    date: todayISO()
  });
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vendor) setForm(blankForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor]);

  const amount = Number(form.amount) || 0;
  const overpay = Boolean(vendor) && amount > vendor.outstandingPayable;
  const needsAccount = form.paymentMode !== 'Cash';
  const canSubmit = Boolean(vendor) && amount > 0 && (!needsAccount || Boolean(form.settlementAccountId));

  const submit = async (e) => {
    e.preventDefault();
    if (saving || !canSubmit) return;
    setSaving(true);
    try {
      const res = await api.post(`/vendors/${vendor.id}/pay`, {
        amount,
        discount: Number(form.discount) || 0,
        paymentMode: form.paymentMode,
        settlementAccountId: needsAccount ? form.settlementAccountId : undefined,
        reference: form.reference,
        notes: form.notes,
        date: form.date
      });
      const settled = res.data?.settled || [];
      const msg = settled.length
        ? `${res.message} Cleared: ${settled.map((s) => s.invoiceNo).join(', ')}.`
        : res.message;
      showToast(msg);
      onPaid();
    } catch (err) {
      showToast(api.message(err, 'Could not record the payment.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(vendor)}
      onClose={onClose}
      title="Pay Vendor"
      subtitle={vendor ? `${vendor.name} · Payable ${money(vendor.outstandingPayable)}` : ''}
      icon={Wallet}
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!canSubmit}>
            Record Payment
          </Button>
        </>
      }
    >
      {vendor && (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 rounded-xl px-4 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
            <Summary label="Vendor" value={vendor.name} />
            <Summary label="Current payable" value={money(vendor.outstandingPayable)} bold />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="text-right"
              />
            </Field>

            <Field label="Discount" hint="Waived off against the invoice, if any">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                className="text-right"
              />
            </Field>

            <Field label="Payment mode">
              <Select
                value={form.paymentMode}
                onChange={(e) => setForm({ ...form, paymentMode: e.target.value, settlementAccountId: '' })}
              >
                {PAY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>

            {needsAccount && (
              <Field label="Pay from" required className="sm:col-span-2">
                <Select value={form.settlementAccountId} onChange={(e) => setForm({ ...form, settlementAccountId: e.target.value })}>
                  <option value="">— Select account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Reference" hint="Cheque no. / UTR / transaction id" className="sm:col-span-2">
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </Field>
          </div>

          {overpay && (
            <div
              className="rounded-xl px-3 py-2 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300"
              style={{ background: 'var(--bg-subtle)' }}
            >
              This is more than the current payable — the extra will be recorded as an advance to the vendor.
            </div>
          )}

          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional narration" />
          </Field>
        </form>
      )}
    </Modal>
  );
}

const blankLine = () => ({
  productId: '',
  name: '',
  barcode: '',
  hsn: '',
  qty: 1,
  unit: 'pcs',
  rate: '',
  taxRate: 0,
  discount: 0,
  total: 0,
  isCustom: false,
  trackBatches: false,
  showBatch: false,
  batches: [
    {
      id: `b_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      batchNo: '',
      qty: 1,
      mfgDate: '',
      expiryDate: '',
      sellPrice: ''
    }
  ],
  batchNo: '',
  mfgDate: '',
  expiryDate: '',
  sellPrice: ''
});

const r2Local = (n) => Math.round((Number(n) || 0) * 100) / 100;
const addDaysISO = (dateStr, days) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Product Cell Display & Trigger Component for Purchase Invoices */
function ProductItemCell({ row, index, onOpenPicker, onUpdateName }) {
  if (row.isCustom) {
    return (
      <div className="flex items-center gap-1.5 w-full">
        <input
          type="text"
          className="field-input text-xs py-1.5 px-2.5 w-full rounded-xl font-medium"
          placeholder="Custom item / description…"
          value={row.name || ''}
          onChange={(e) => onUpdateName(index, e.target.value)}
          autoFocus
        />
        <button
          type="button"
          onClick={() => onOpenPicker(index)}
          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1.5 rounded-xl shrink-0 hover:bg-indigo-100 transition-colors"
          title="Pick from catalog instead"
        >
          Catalog
        </button>
      </div>
    );
  }

  if (!row.name) {
    return (
      <button
        type="button"
        onClick={() => onOpenPicker(index)}
        className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-400/60 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between transition-all"
      >
        <span className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 opacity-80" /> Click to Select Product…
        </span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>
    );
  }

  return (
    <div
      onClick={() => onOpenPicker(index)}
      className="p-1.5 px-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/50 hover:bg-[color:var(--bg-subtle)] cursor-pointer flex items-center justify-between gap-2 group transition-colors"
      title="Click to change product"
    >
      <div className="min-w-0 pr-1">
        <div className="font-bold text-xs text-[color:var(--text-primary)] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
          {row.name}
        </div>
        {row.barcode && (
          <div className="text-[10px] text-[color:var(--text-muted)] font-mono">{row.barcode}</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 opacity-80 group-hover:opacity-100">
        <span>Change</span>
        <Edit3 className="w-3 h-3" />
      </div>
    </div>
  );
}

/** Search-as-you-type product picker for purchase line items */
function PurchaseProductPickerModal({ open, onClose, products = [], onSelectProduct, onAddNew }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    if (open) {
      setSearch('');
      setCategoryFilter('ALL');
    }
  }, [open]);

  const categories = useMemo(() => {
    const cats = new Set();
    (products || []).forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (products || []).filter((p) => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(q)) ||
        (p.hsn && String(p.hsn).toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }, [products, search, categoryFilter]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select Product"
      subtitle={`Choose from ${products.length} catalog products, or add a new one for this purchase.`}
      icon={Boxes}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => {
              onAddNew();
              onClose();
            }}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            + Add new product (not in catalogue)
          </button>
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by product name, barcode, HSN, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-input text-xs pl-8 pr-8 w-full rounded-xl"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="field-input text-xs py-2 px-3 min-w-[140px] rounded-xl font-semibold cursor-pointer shrink-0"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)] divide-y divide-[color:var(--border-subtle)]">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="text-xs font-bold text-[color:var(--text-secondary)]">No products match your search</div>
              <div className="text-[11px] text-[color:var(--text-muted)]">
                Try another keyword, or add this as a new product below.
              </div>
            </div>
          ) : (
            filteredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectProduct(p);
                  onClose();
                }}
                className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-[color:var(--bg-subtle)] transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[color:var(--text-primary)] truncate">{p.name}</div>
                  <div className="text-[10.5px] text-[color:var(--text-muted)]">
                    {p.unit || 'pcs'}
                    {p.hsn ? ` · HSN ${p.hsn}` : ''}
                    {p.category ? ` · ${p.category}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-mono font-bold text-[color:var(--text-primary)]">
                    {money(p.purchasePrice ?? p.price ?? 0)}
                  </div>
                  <div className="text-[10px] text-[color:var(--text-muted)]">Stock {p.stock ?? 0}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

function NewPurchaseModal({
  open,
  onClose,
  vendors = [],
  products = [],
  accounts = [],
  categories = [],
  units = [],
  warehouses = [],
  batchTrackingEnabled = false,
  storeNearExpiryDays,
  showToast,
  onSaved,
  onProductCreated,
  poContext = null
}) {
  const [loading, setLoading] = useState(false);
  const [activePickerIndex, setActivePickerIndex] = useState(null);
  const [newProductLineIndex, setNewProductLineIndex] = useState(null);

  // Vendor Information & Auto-fill
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [vendorPan, setVendorPan] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorState, setVendorState] = useState('');
  const [vendorStateCode, setVendorStateCode] = useState('');

  // Invoice specifics
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => todayISO());
  const [dueDate, setDueDate] = useState('');
  const [paymentType, setPaymentType] = useState('UNPAID'); // 'FULL' | 'PARTIAL' | 'UNPAID'
  const [initialPaidAmount, setInitialPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [settlementAccountId, setSettlementAccountId] = useState('');
  const [isRoundOff, setIsRoundOff] = useState(true);
  const [notes, setNotes] = useState('');

  // Transport & Dispatch
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [dispatchFrom, setDispatchFrom] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [shipToName, setShipToName] = useState('');
  const [shipToAddress, setShipToAddress] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [shipBy, setShipBy] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [dispatchDocNo, setDispatchDocNo] = useState('');

  // Order References & Terms
  const [buyerOrderNo, setBuyerOrderNo] = useState('');
  const [buyerOrderDate, setBuyerOrderDate] = useState('');
  const [buyerRef, setBuyerRef] = useState('');
  const [buyerRefDate, setBuyerRefDate] = useState('');
  const [vendorCode, setVendorCode] = useState('');
  const [termsOfDelivery, setTermsOfDelivery] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');

  // Line items & Landed costs
  const [items, setItems] = useState([blankLine()]);
  const [charges, setCharges] = useState([]);

  useEffect(() => {
    if (open) {
      setLoading(false);
      setActivePickerIndex(null);
      setNewProductLineIndex(null);
      setCharges([]);
      setIsRoundOff(true);
      setNotes('');
      setInvoiceNo('');
      setInvoiceDate(todayISO());
      setDueDate('');
      setPaymentType('UNPAID');
      setInitialPaidAmount('');
      setPaymentMode('Cash');
      setPaymentRef('');
      setSettlementAccountId('');
      setPlaceOfSupply('');
      setDispatchFrom('');
      setDispatchDate('');
      setShipToName('');
      setShipToAddress('');
      setVehicleNo('');
      setShipBy('');
      setTransporterName('');
      setDispatchDocNo('');
      setTermsOfDelivery('');
      setPaymentTerms('');

      if (poContext) {
        setSelectedVendorId(poContext.vendorId || '');
        setVendorName(poContext.vendorName || '');
        setBuyerOrderNo(poContext.poNumber || '');
        setBuyerOrderDate(poContext.date ? String(poContext.date).slice(0, 10) : todayISO());
        
        const matchedVendor = vendors.find((v) => v.id === poContext.vendorId || v.name === poContext.vendorName);
        if (matchedVendor) {
          setVendorPhone(matchedVendor.phone || '');
          setVendorGstin(matchedVendor.gstin || '');
          setVendorPan(matchedVendor.pan || '');
          setVendorAddress(matchedVendor.address || '');
          setVendorState(matchedVendor.state || '');
          setVendorStateCode(matchedVendor.stateCode || '');
        }

        const remaining = (poContext.items || [])
          .filter((l) => Number(l.receivedQty || 0) < Number(l.orderedQty || 0) - 0.009)
          .map((l) => {
            const p = products.find((pr) => pr.id === l.productId);
            const qtyNum = r2Local(Number(l.orderedQty) - Number(l.receivedQty || 0));
            const rateNum = Number(l.rate) || 0;
            const taxNum = Number(l.taxRate) || 0;
            const sub = qtyNum * rateNum;
            const lineTot = Math.round((sub + (sub * taxNum) / 100) * 100) / 100;
            return {
              ...blankLine(),
              productId: l.productId,
              name: l.productName || p?.name || '',
              barcode: p?.barcode || '',
              hsn: l.hsn || p?.hsn || '',
              qty: qtyNum,
              rate: rateNum,
              taxRate: taxNum,
              unit: l.unit || p?.unit || 'pcs',
              total: lineTot,
              trackBatches: Boolean(p?.trackBatches),
              showBatch: Boolean(p?.trackBatches || batchTrackingEnabled),
              sellPrice: p?.price ?? ''
            };
          });
        setItems(remaining.length ? remaining : [blankLine()]);
      } else {
        setSelectedVendorId('');
        setVendorName('');
        setVendorPhone('');
        setVendorGstin('');
        setVendorPan('');
        setVendorAddress('');
        setVendorState('');
        setVendorStateCode('');
        setBuyerOrderNo('');
        setBuyerOrderDate('');
        setItems([blankLine()]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, poContext]);

  const isSoftMoney = ['UPI', 'Card', 'Net Banking', 'Bank Transfer', 'Cheque'].includes(paymentMode);

  // Vendor selection change
  const handleVendorChange = (id) => {
    setSelectedVendorId(id);
    if (!id) {
      setVendorName('');
      setVendorPhone('');
      setVendorGstin('');
      setVendorPan('');
      setVendorAddress('');
      setVendorState('');
      setVendorStateCode('');
      return;
    }
    const ven = vendors.find((v) => v.id === id);
    if (ven) {
      setVendorName(ven.name || '');
      setVendorPhone(ven.phone || '');
      setVendorGstin(ven.gstin || '');
      setVendorPan(ven.pan || '');
      setVendorAddress(ven.address || '');
      setVendorState(ven.state || '');
      setVendorStateCode(ven.stateCode || '');
    }
  };

  // Product selection
  const handleProductSelect = (index, prod) => {
    setItems((prev) => {
      const next = [...prev];
      const qty = Number(next[index]?.qty) || 1;
      const rate = prod.purchasePrice !== undefined && prod.purchasePrice !== '' ? Number(prod.purchasePrice) : Number(prod.price) || 0;
      const taxRate = Number(prod.taxRate || prod.gstRate) || 0;
      const discount = Number(next[index]?.discount) || 0;
      const sub = qty * rate;
      const taxAmt = (sub * taxRate) / 100;
      const total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);

      next[index] = {
        ...next[index],
        productId: prod.id || '',
        name: prod.name,
        barcode: prod.barcode || '',
        hsn: prod.hsn || '',
        unit: prod.unit || next[index]?.unit || 'pcs',
        rate: prod.purchasePrice !== undefined ? prod.purchasePrice : (prod.price ?? ''),
        taxRate,
        discount,
        total,
        isCustom: !prod.id,
        trackBatches: Boolean(prod.trackBatches),
        showBatch: Boolean(prod.trackBatches || batchTrackingEnabled),
        batches: [
          {
            id: `b_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            batchNo: '',
            qty,
            mfgDate: '',
            expiryDate: '',
            sellPrice: prod.price ?? ''
          }
        ],
        batchNo: '',
        mfgDate: '',
        expiryDate: '',
        sellPrice: prod.price ?? ''
      };

      const hasEmptyRowBelow = next.some((r, i) => i > index && (!r.name || !r.name.trim()));
      if (!hasEmptyRowBelow) {
        next.push(blankLine());
      }
      return next;
    });
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      const qty = Number(updated.qty) || 0;
      const rate = Number(updated.rate) || 0;
      const taxRate = Number(updated.taxRate) || 0;
      const discount = Number(updated.discount) || 0;
      const sub = qty * rate;
      const taxAmt = (sub * taxRate) / 100;
      updated.total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);

      if (field === 'qty' && Array.isArray(updated.batches) && updated.batches.length === 1) {
        updated.batches = [{ ...updated.batches[0], qty }];
      }
      next[index] = updated;
      return next;
    });
  };

  const addBatchToLine = (lineIdx) => {
    setItems((prev) => {
      const next = [...prev];
      const curItem = next[lineIdx];
      const curBatches = Array.isArray(curItem.batches) && curItem.batches.length > 0 ? curItem.batches : [];
      const totalQty = Number(curItem.qty) || 0;
      const allocated = curBatches.reduce((s, b) => s + (Number(b.qty) || 0), 0);
      const remaining = Math.max(0, r2Local(totalQty - allocated));

      const newBatch = {
        id: `b_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        batchNo: '',
        qty: remaining > 0 ? remaining : 1,
        mfgDate: '',
        expiryDate: '',
        sellPrice: curItem.sellPrice || ''
      };

      const updatedBatches = [...curBatches, newBatch];
      const newSumQty = updatedBatches.reduce((s, b) => s + (Number(b.qty) || 0), 0);
      const rate = Number(curItem.rate) || 0;
      const taxRate = Number(curItem.taxRate) || 0;
      const discount = Number(curItem.discount) || 0;
      const sub = newSumQty * rate;
      const taxAmt = (sub * taxRate) / 100;
      const total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);

      next[lineIdx] = {
        ...curItem,
        qty: newSumQty,
        total,
        trackBatches: true,
        showBatch: true,
        batches: updatedBatches
      };
      return next;
    });
  };

  const updateBatchInLine = (lineIdx, batchIdx, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const curItem = next[lineIdx];
      const curBatches = Array.isArray(curItem.batches) ? [...curItem.batches] : [];
      curBatches[batchIdx] = { ...curBatches[batchIdx], [field]: value };

      let newQty = curItem.qty;
      let newTotal = curItem.total;

      if (field === 'qty') {
        const sumQty = curBatches.reduce((s, b) => s + (Number(b.qty) || 0), 0);
        newQty = sumQty;
        const rate = Number(curItem.rate) || 0;
        const taxRate = Number(curItem.taxRate) || 0;
        const discount = Number(curItem.discount) || 0;
        const sub = sumQty * rate;
        const taxAmt = (sub * taxRate) / 100;
        newTotal = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);
      }

      next[lineIdx] = {
        ...curItem,
        qty: newQty,
        total: newTotal,
        trackBatches: true,
        batches: curBatches
      };
      return next;
    });
  };

  const removeBatchFromLine = (lineIdx, batchIdx) => {
    setItems((prev) => {
      const next = [...prev];
      const curItem = next[lineIdx];
      const curBatches = (curItem.batches || []).filter((_, i) => i !== batchIdx);
      if (curBatches.length === 0) return next;

      const sumQty = curBatches.reduce((s, b) => s + (Number(b.qty) || 0), 0);
      const rate = Number(curItem.rate) || 0;
      const taxRate = Number(curItem.taxRate) || 0;
      const discount = Number(curItem.discount) || 0;
      const sub = sumQty * rate;
      const taxAmt = (sub * taxRate) / 100;
      const total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);

      next[lineIdx] = {
        ...curItem,
        qty: sumQty,
        total,
        batches: curBatches
      };
      return next;
    });
  };

  const switchLineUnit = (index, line, newUnit) => {
    const product = products.find((pr) => pr.id === line.productId);
    if (!product) {
      handleItemChange(index, 'unit', newUnit);
      return;
    }
    const options = getProductUnitOptions(product);
    const opt = options.find((o) => o.unit === newUnit);
    const baseCost = Number(product.purchasePrice) || 0;
    const newRate = opt && baseCost ? r2Local(baseCost * Number(opt.factor || 1)) : line.rate;
    
    setItems((prev) => {
      const next = [...prev];
      const updated = { ...next[index], unit: newUnit, rate: newRate };
      const qty = Number(updated.qty) || 0;
      const rate = Number(updated.rate) || 0;
      const taxRate = Number(updated.taxRate) || 0;
      const discount = Number(updated.discount) || 0;
      const sub = qty * rate;
      const taxAmt = (sub * taxRate) / 100;
      updated.total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);
      next[index] = updated;
      return next;
    });
  };

  const addItemRow = () => setItems((prev) => [...prev, blankLine()]);
  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Additional landed charges
  const setCharge = (idx, patch) => setCharges((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const addCharge = () => setCharges((cs) => [...cs, { label: '', amount: '' }]);
  const removeCharge = (idx) => setCharges((cs) => cs.filter((_, i) => i !== idx));

  // Financial calculations
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const disc = Number(item.discount) || 0;

      const lineSub = qty * rate;
      const lineTax = (lineSub * taxRate) / 100;

      subtotal += lineSub;
      taxTotal += lineTax;
      discountTotal += disc;
    });

    const totalCharges = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const netBeforeRound = Math.max(0, subtotal + taxTotal - discountTotal + totalCharges);
    const roundedGrand = isRoundOff ? Math.round(netBeforeRound) : netBeforeRound;
    const roundOff = isRoundOff ? Math.round((roundedGrand - netBeforeRound) * 100) / 100 : 0;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(taxTotal * 100) / 100,
      discount: Math.round(discountTotal * 100) / 100,
      charges: Math.round(totalCharges * 100) / 100,
      roundOff,
      total: roundedGrand
    };
  }, [items, charges, isRoundOff]);

  const handleSaveWithStatus = async (targetStatus, customPaidAmount) => {
    const validItems = items.filter((i) => {
      if (!i.name || !i.name.trim()) return false;
      const qtyNum = Number(i.qty) || 0;
      return qtyNum > 0;
    });

    if (validItems.length === 0) {
      showToast('Please select or enter at least one valid product item for the purchase invoice.', 'error');
      return;
    }

    if (!vendorName.trim()) {
      showToast('Vendor name is required.', 'error');
      return;
    }

    let finalPaid = 0;
    if (targetStatus === 'UNPAID') {
      finalPaid = 0;
    } else if (targetStatus === 'PARTIALLY_PAID') {
      finalPaid = Math.min(totals.total, Math.max(0, Number(customPaidAmount !== undefined ? customPaidAmount : initialPaidAmount) || 0));
      if (finalPaid <= 0) {
        showToast('Please enter an initial payment amount greater than zero for partial payment.', 'error');
        return;
      }
    } else if (targetStatus === 'PAID') {
      finalPaid = totals.total;
    }

    if (finalPaid > 0 && isSoftMoney && !paymentRef.trim()) {
      const ok = window.confirm(`You are recording payment via ${paymentMode} without entering a Transaction Reference/UTR. Confirm that payment of ${money(finalPaid)} has been verified and settled with the vendor?`);
      if (!ok) return;
    }

    setLoading(true);
    try {
      const payload = {
        vendorId: selectedVendorId || undefined,
        vendorName: vendorName.trim(),
        vendorPhone: vendorPhone.trim(),
        vendorGstin: vendorGstin.trim(),
        vendorPan: vendorPan.trim(),
        vendorAddress: vendorAddress.trim(),
        vendorState: vendorState.trim(),
        vendorStateCode: vendorStateCode.trim(),
        invoiceNo: invoiceNo.trim() || undefined,
        date: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        paymentStatus: targetStatus === 'PARTIALLY_PAID' ? 'PARTIAL' : targetStatus,
        paymentMode: finalPaid > 0 ? paymentMode : undefined,
        paymentRef: paymentRef.trim() || '',
        paidAmount: finalPaid,
        settlementAccountId: finalPaid > 0 ? (settlementAccountId || undefined) : undefined,
        placeOfSupply: placeOfSupply.trim() || '',
        dispatchFrom: dispatchFrom.trim() || '',
        dispatchDate: dispatchDate ? new Date(dispatchDate).toISOString() : null,
        shipToName: shipToName.trim() || '',
        shipToAddress: shipToAddress.trim() || '',
        vehicleNo: vehicleNo.trim() || '',
        shipBy: shipBy.trim() || '',
        transporterName: transporterName.trim() || '',
        dispatchDocNo: dispatchDocNo.trim() || '',
        buyerOrderNo: buyerOrderNo.trim() || '',
        buyerOrderDate: buyerOrderDate ? new Date(buyerOrderDate).toISOString() : null,
        buyerRef: buyerRef.trim() || '',
        buyerRefDate: buyerRefDate ? new Date(buyerRefDate).toISOString() : null,
        vendorCode: vendorCode.trim() || '',
        termsOfDelivery: termsOfDelivery.trim() || '',
        paymentTerms: paymentTerms.trim() || '',
        poId: poContext?.id || undefined,
        notes: notes.trim() || '',
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        roundOff: totals.roundOff,
        items: validItems.map((l) => {
          const batches = Array.isArray(l.batches) && l.batches.length > 0 ? l.batches : [];
          const hasBatch = Boolean(l.trackBatches || l.showBatch || batches.length > 0 || l.batchNo || l.expiryDate || l.mfgDate);
          return {
            productId: l.productId || null,
            name: l.name,
            barcode: l.barcode || '',
            unit: l.unit || 'pcs',
            hsn: l.hsn || '',
            qty: Number(l.qty),
            rate: Number(l.rate) || 0,
            taxRate: Number(l.taxRate) || 0,
            discount: Number(l.discount) || 0,
            total: Number(l.total) || 0,
            batches: hasBatch && batches.length > 0
              ? batches.map((b) => ({
                  batchNo: b.batchNo || '',
                  qty: Number(b.qty) || 0,
                  mfgDate: b.mfgDate || null,
                  expiryDate: b.expiryDate || null,
                  sellPrice: b.sellPrice !== undefined && b.sellPrice !== '' ? b.sellPrice : l.sellPrice
                }))
              : undefined,
            batchNo: batches[0]?.batchNo || (hasBatch ? l.batchNo || '' : undefined),
            mfgDate: batches[0]?.mfgDate || (hasBatch ? l.mfgDate || '' : undefined),
            expiryDate: batches[0]?.expiryDate || (hasBatch ? l.expiryDate || '' : undefined),
            sellPrice: batches[0]?.sellPrice || (hasBatch ? l.sellPrice || '' : undefined)
          };
        }),
        additionalCharges: charges
          .filter((c) => Number(c.amount) > 0)
          .map((c) => ({ label: c.label || 'Other', amount: Number(c.amount) }))
      };

      const res = await api.post('/purchases', payload);
      if (res.data?.accountingError) {
        showToast(`Purchase saved, but accounting note: ${res.data.accountingError}`, 'error');
      }
      showToast(res.message || 'Vendor purchase invoice recorded successfully.');
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Failed to record purchase invoice.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={poContext ? `Receive Against PO #${poContext.poNumber}` : 'New Purchase Invoice'}
        subtitle={
          poContext
            ? `${poContext.vendorName} · Receiving stock against this purchase order with GST inputs, batch inward, and invoice settlement.`
            : 'Generate a formal purchase invoice with vendor details, product items, GST taxes, batch tracking, and inventory inward.'
        }
        icon={Receipt}
        size="xl"
      >
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {/* Vendor Information & Auto-fill Card */}
          <div className="p-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)] flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {poContext ? `Vendor & Invoice Details — PO #${poContext.poNumber}` : 'Vendor & Purchase Details'}
              </span>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                Auto-fills vendor details upon selection
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Select Registered Vendor">
                <Select
                  value={selectedVendorId}
                  disabled={Boolean(poContext)}
                  onChange={(e) => handleVendorChange(e.target.value)}
                >
                  <option value="">— Unregistered / Walk-in Supplier —</option>
                  {(vendors || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {Number(v.outstandingPayable) > 0 ? `(Payable: ${money(v.outstandingPayable)})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Vendor / Supplier Name *">
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Supplier / Company Name"
                  required
                />
              </Field>

              <Field label="Vendor Phone Number">
                <Input
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="Contact number"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Field label="Vendor Invoice / Bill No. *">
                <Input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="e.g. INV-2026-889"
                  required
                />
              </Field>

              <Field label="Vendor GSTIN / Tax ID">
                <Input
                  value={vendorGstin}
                  onChange={(e) => setVendorGstin(e.target.value)}
                  placeholder="Supplier GSTIN"
                />
              </Field>

              <Field label="Purchase Date *">
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </Field>

              <Field label="Payment Due Date">
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="flex-1"
                  />
                  {[
                    { label: '15d', days: 15 },
                    { label: '30d', days: 30 },
                    { label: '45d', days: 45 }
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDueDate(addDaysISO(invoiceDate, p.days))}
                      className="rounded-lg border border-[color:var(--border)] px-1.5 py-1 text-[10px] font-bold text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)]"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {/* Payment Method, Terms, and Settling Account */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Payment Method">
                <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  <option value="Cash">Cash (From Hand / Till)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                  <option value="Net Banking">Net Banking</option>
                  <option value="Credit (Udhar)">Credit / On Account (Pay Later)</option>
                  <option value="Cheque">Bank Cheque</option>
                </Select>
              </Field>

              <Field label="Payment Status / Terms">
                <Select
                  value={paymentType}
                  onChange={(e) => {
                    setPaymentType(e.target.value);
                    if (e.target.value === 'PARTIAL' && !initialPaidAmount) {
                      setInitialPaidAmount(String(Math.round(totals.total / 2)));
                    }
                  }}
                >
                  <option value="FULL">Full Payment (Paid in Full)</option>
                  <option value="PARTIAL">Partial Payment (Advance + Balance Due)</option>
                  <option value="UNPAID">Unpaid / Credit (Full Balance Due)</option>
                </Select>
              </Field>

              <Field label="Paid From Account" hint={paymentType === 'UNPAID' ? 'Disabled for unpaid purchase' : 'Bank or cash ledger'}>
                <Select
                  value={settlementAccountId}
                  disabled={paymentType === 'UNPAID'}
                  onChange={(e) => setSettlementAccountId(e.target.value)}
                >
                  <option value="">— Select payment account —</option>
                  {(accounts || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Partial Payment Configuration Card */}
            {paymentType === 'PARTIAL' && (
              <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Partial / Advance Payment Setup
                  </span>
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    Grand Total: {money(totals.total)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <Field label="Amount Paid Now (₹) *">
                    <Input
                      type="number"
                      min="0.01"
                      max={totals.total}
                      step="0.01"
                      value={initialPaidAmount}
                      onChange={(e) => setInitialPaidAmount(e.target.value)}
                      placeholder="Enter advance/partial amount"
                      className="font-bold font-mono text-sm bg-white dark:bg-slate-900"
                    />
                  </Field>

                  <div className="rounded-xl p-3 bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                    <div className="flex justify-between text-[11px] text-[color:var(--text-secondary)]">
                      <span>Advance Paid Now:</span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{money(Number(initialPaidAmount) || 0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-amber-800 dark:text-amber-300 border-t border-amber-100 dark:border-amber-900/60 pt-1">
                      <span>Remaining Balance Payable:</span>
                      <span className="font-mono">{money(Math.max(0, totals.total - (Number(initialPaidAmount) || 0)))}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isSoftMoney && paymentType !== 'UNPAID' && (
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div>
                    <div className="font-bold text-xs text-indigo-900 dark:text-indigo-300">
                      Soft Money Mode: {paymentMode}
                    </div>
                    <div className="text-[10.5px] text-indigo-700/80 dark:text-indigo-300/80">
                      Enter transaction reference / UTR code / Cheque number for payment records.
                    </div>
                  </div>
                </div>
                <div className="min-w-[220px]">
                  <Input
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g. UTR / Ref / Cheque #"
                    className="bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Vendor Address / Location">
                <Input value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} placeholder="Supplier city / office" />
              </Field>
              <Field label="Vendor State Name" hint="For GST place-of-supply check">
                <Input value={vendorState} onChange={(e) => setVendorState(e.target.value)} placeholder="e.g. Tamil Nadu" />
              </Field>
              <Field label="Vendor State Code (2-digit GST code)" hint="e.g. 33 for Tamil Nadu, 07 for Delhi">
                <Input value={vendorStateCode} onChange={(e) => setVendorStateCode(e.target.value)} placeholder="e.g. 33" maxLength={2} />
              </Field>
            </div>
          </div>

          {/* Optional Transport, Dispatch & Delivery Details */}
          <details className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/40 p-4 group">
            <summary className="text-xs font-bold text-[color:var(--text-secondary)] cursor-pointer select-none flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Transport, Dispatch & Inward Shipment Fields (Optional)</span>
              </span>
              <span className="text-[10.5px] font-normal text-[color:var(--text-muted)] group-open:hidden">Click to expand</span>
            </summary>
            <div className="mt-3 space-y-3 pt-3 border-t border-[color:var(--border)] text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Place of Supply">
                  <Input value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} placeholder="e.g. Tamil Nadu (33)" />
                </Field>
                <Field label="Dispatch From Address / Hub">
                  <Input value={dispatchFrom} onChange={(e) => setDispatchFrom(e.target.value)} placeholder="Supplier dispatch depot" />
                </Field>
                <Field label="Dispatch Date">
                  <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Receiving Hub / Site Name">
                  <Input value={shipToName} onChange={(e) => setShipToName(e.target.value)} placeholder="Main Store / Branch" />
                </Field>
                <Field label="Delivery Destination Address" className="md:col-span-2">
                  <Input value={shipToAddress} onChange={(e) => setShipToAddress(e.target.value)} placeholder="Warehouse address" />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Vehicle No.">
                  <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} placeholder="e.g. TN01AB1234" />
                </Field>
                <Field label="Ship By / Mode">
                  <Input value={shipBy} onChange={(e) => setShipBy(e.target.value)} placeholder="Road / Courier / Air" />
                </Field>
                <Field label="Transporter Name">
                  <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} placeholder="Logistics Agency" />
                </Field>
                <Field label="Dispatch Doc / LR No.">
                  <Input value={dispatchDocNo} onChange={(e) => setDispatchDocNo(e.target.value)} placeholder="e.g. LR-99882" />
                </Field>
              </div>
            </div>
          </details>

          {/* Optional Purchase Order & Supplier References */}
          <details className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/40 p-4 group">
            <summary className="text-xs font-bold text-[color:var(--text-secondary)] cursor-pointer select-none flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>PO Numbers, Supplier References & Terms (Optional)</span>
              </span>
              <span className="text-[10.5px] font-normal text-[color:var(--text-muted)] group-open:hidden">Click to expand</span>
            </summary>
            <div className="mt-3 space-y-3 pt-3 border-t border-[color:var(--border)] text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Purchase Order / PO No.">
                  <Input value={buyerOrderNo} onChange={(e) => setBuyerOrderNo(e.target.value)} placeholder="e.g. PO-2026-001" />
                </Field>
                <Field label="Purchase Order Date">
                  <Input type="date" value={buyerOrderDate} onChange={(e) => setBuyerOrderDate(e.target.value)} />
                </Field>
                <Field label="Supplier Reference / Quotation No.">
                  <Input value={buyerRef} onChange={(e) => setBuyerRef(e.target.value)} placeholder="e.g. QT-9981" />
                </Field>
                <Field label="Supplier Reference Date">
                  <Input type="date" value={buyerRefDate} onChange={(e) => setBuyerRefDate(e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Vendor Code (our customer code with vendor)">
                  <Input value={vendorCode} onChange={(e) => setVendorCode(e.target.value)} placeholder="e.g. CLI-8812" />
                </Field>
                <Field label="Terms of Delivery">
                  <Input value={termsOfDelivery} onChange={(e) => setTermsOfDelivery(e.target.value)} placeholder="e.g. Door Delivery / Ex-works" />
                </Field>
                <Field label="Terms of Payment">
                  <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 30 Days Net" />
                </Field>
              </div>
            </div>
          </details>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)]">
                Line Items &amp; Products ({items.length})
              </span>
              <Button size="xs" variant="outline" icon={Plus} onClick={addItemRow}>
                Add Blank Row
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] text-[10.5px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Product / Service Description</th>
                    <th className="py-2.5 px-3 w-20">HSN/SAC</th>
                    <th className="py-2.5 px-3 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-3 w-24">Unit</th>
                    <th className="py-2.5 px-3 w-24 text-right">Pur. Rate (₹)</th>
                    <th className="py-2.5 px-3 w-24 text-right text-indigo-600 dark:text-indigo-400">Sell Price (₹)</th>
                    <th className="py-2.5 px-3 w-20 text-right">GST %</th>
                    <th className="py-2.5 px-3 w-20 text-right">Disc (₹)</th>
                    <th className="py-2.5 px-3 w-24 text-right">Total (₹)</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {items.map((item, idx) => {
                    const product = products.find((pr) => pr.id === item.productId);
                    const unitOptions = product ? getProductUnitOptions(product) : [];

                    return (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-[color:var(--bg-subtle)]/50">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>

                          <td className="py-2.5 px-3 min-w-[200px]">
                            <ProductItemCell
                              row={item}
                              index={idx}
                              onOpenPicker={(i) => setActivePickerIndex(i)}
                              onUpdateName={(i, name) => handleItemChange(i, 'name', name)}
                            />
                            <div className="mt-1 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextVal = !(item.showBatch || item.trackBatches);
                                  handleItemChange(idx, 'showBatch', nextVal);
                                  if (nextVal) {
                                    handleItemChange(idx, 'trackBatches', true);
                                    if (!item.batches || item.batches.length === 0) {
                                      handleItemChange(idx, 'batches', [
                                        {
                                          id: `b_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                                          batchNo: '',
                                          qty: Number(item.qty) || 1,
                                          mfgDate: '',
                                          expiryDate: '',
                                          sellPrice: item.sellPrice || ''
                                        }
                                      ]);
                                    }
                                  }
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all inline-flex items-center gap-1 ${
                                  (item.batches && item.batches.length > 1) || item.batches?.[0]?.batchNo || item.batchNo || item.expiryDate
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <Boxes className="w-3 h-3 text-amber-600" />
                                {Array.isArray(item.batches) && item.batches.length > 1
                                  ? `${item.batches.length} Batches (${item.batches.reduce((s, b) => s + (Number(b.qty) || 0), 0)} ${item.unit || 'pcs'})`
                                  : item.batches?.[0]?.batchNo
                                  ? `Batch #${item.batches[0].batchNo}`
                                  : item.batchNo
                                  ? `Batch #${item.batchNo}`
                                  : (item.showBatch || item.trackBatches ? 'Hide Batch Details' : '+ Add Batch / Expiry')}
                              </button>
                            </div>
                          </td>

                          <td className="py-2 px-3">
                            <Input
                              value={item.hsn}
                              onChange={(e) => handleItemChange(idx, 'hsn', e.target.value)}
                              placeholder="HSN"
                              className="text-xs font-mono"
                            />
                          </td>

                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              step="any"
                              value={item.qty}
                              onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                              className="text-right text-xs font-mono font-bold"
                            />
                          </td>

                          <td className="py-2 px-3">
                            {unitOptions.length > 1 ? (
                              <Select
                                value={item.unit}
                                onChange={(e) => switchLineUnit(idx, item, e.target.value)}
                                className="text-xs"
                              >
                                {unitOptions.map((o) => (
                                  <option key={o.unit} value={o.unit}>
                                    {o.unit}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <Input
                                value={item.unit}
                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                className="text-xs"
                              />
                            )}
                          </td>

                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              step="any"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                              placeholder="0.00"
                              className="text-right text-xs font-mono font-bold"
                            />
                          </td>

                          <td className="py-2 px-3">
                            {Boolean(item.trackBatches || item.showBatch || (item.batches && item.batches.length > 1)) ? (
                              <div
                                className="text-right text-[11px] font-bold font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1.5 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                                title="Selling price is configured individually per batch in the drawer below"
                                onClick={() => handleItemChange(idx, 'showBatch', true)}
                              >
                                In Batch ↓
                              </div>
                            ) : (
                              <Input
                                type="number"
                                step="any"
                                value={item.sellPrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleItemChange(idx, 'sellPrice', val);
                                  if (Array.isArray(item.batches) && item.batches.length === 1) {
                                    updateBatchInLine(idx, 0, 'sellPrice', val);
                                  }
                                }}
                                placeholder="Sell ₹"
                                className="text-right text-xs font-mono"
                              />
                            )}
                          </td>

                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              step="any"
                              value={item.taxRate}
                              onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                              className="text-right text-xs font-mono"
                            />
                          </td>

                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              step="any"
                              value={item.discount}
                              onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                              className="text-right text-xs font-mono"
                            />
                          </td>

                          <td className="py-2 px-3 text-right font-mono font-bold text-xs text-[color:var(--text-primary)]">
                            {money(item.total)}
                          </td>

                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              disabled={items.length === 1}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors disabled:opacity-30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>

                        {/* Batch Inward Drawer */}
                        {(item.trackBatches || item.showBatch || (item.batches && item.batches.length > 0 && (item.batches.length > 1 || item.batches[0]?.batchNo || item.batches[0]?.expiryDate))) && (
                          <tr>
                            <td colSpan={10} className="!pt-0 !pb-3 bg-amber-50/20 dark:bg-amber-950/10">
                              <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/30 p-3 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-800/40 pb-2">
                                  <div className="space-y-0.5">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                      <Boxes className="w-3.5 h-3.5 text-amber-600" />
                                      Batch / Lot Inward for {item.name || 'this item'} ({item.batches?.length || 1} {item.batches?.length === 1 ? 'batch' : 'batches'})
                                    </span>
                                    <div className="text-[10.5px] text-amber-700/80 dark:text-amber-400/80">
                                      Total in batches: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{(item.batches || []).reduce((s, b) => s + (Number(b.qty) || 0), 0)} {item.unit || 'pcs'}</strong>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => addBatchToLine(idx)}
                                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors flex items-center gap-1 shadow-xs"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>+ Add Another Batch for this Product</span>
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  {(item.batches && item.batches.length > 0 ? item.batches : [{ id: 'b_0', batchNo: item.batchNo || '', qty: item.qty || 1, mfgDate: item.mfgDate || '', expiryDate: item.expiryDate || '', sellPrice: item.sellPrice || '' }]).map((batch, bIdx) => (
                                    <div
                                      key={batch.id || bIdx}
                                      className="flex flex-wrap items-end gap-2.5 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-white dark:bg-slate-900 shadow-xs"
                                    >
                                      <div className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 self-center px-1">
                                        Batch #{bIdx + 1}
                                      </div>

                                      <Field label="Batch / Lot No." className="min-w-[130px] flex-1">
                                        <Input
                                          value={batch.batchNo}
                                          onChange={(e) => updateBatchInLine(idx, bIdx, 'batchNo', e.target.value)}
                                          placeholder="Auto (1, 2, …) if blank"
                                          className="text-xs"
                                        />
                                      </Field>

                                      <Field label={`Qty (${item.unit || 'pcs'}) *`} className="w-24">
                                        <Input
                                          type="number"
                                          step="any"
                                          min="0.01"
                                          value={batch.qty}
                                          onChange={(e) => updateBatchInLine(idx, bIdx, 'qty', e.target.value)}
                                          className="text-right text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400"
                                        />
                                      </Field>

                                      <Field label="Mfg. Date" className="w-32">
                                        <Input
                                          type="date"
                                          value={batch.mfgDate}
                                          onChange={(e) => updateBatchInLine(idx, bIdx, 'mfgDate', e.target.value)}
                                          className="text-xs"
                                        />
                                      </Field>

                                      <Field label="Expiry Date" className="w-32">
                                        <Input
                                          type="date"
                                          value={batch.expiryDate}
                                          onChange={(e) => updateBatchInLine(idx, bIdx, 'expiryDate', e.target.value)}
                                          className="text-xs"
                                        />
                                      </Field>

                                      <Field label="Selling Price (₹)" hint="Blank = default" className="w-28">
                                        <Input
                                          type="number"
                                          step="any"
                                          value={batch.sellPrice}
                                          onChange={(e) => updateBatchInLine(idx, bIdx, 'sellPrice', e.target.value)}
                                          placeholder="Sell price"
                                          className="text-xs font-mono"
                                        />
                                      </Field>

                                      {(item.batches || []).length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => removeBatchFromLine(idx, bIdx)}
                                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors self-center mb-0.5"
                                          title="Remove this batch"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Additional Landed Cost Charges */}
          <div className="p-3.5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/40 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)]">
                  Additional Landed Cost Charges (Freight, Customs, Handling…)
                </span>
                <p className="text-[10.5px] text-[color:var(--text-muted)] mt-0.5">
                  Allocated across line items by value and capitalised into inventory cost.
                </p>
              </div>
              <Button type="button" size="xs" variant="outline" icon={Plus} onClick={addCharge}>
                Add Charge
              </Button>
            </div>

            {charges.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-surface)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] text-[10px] uppercase">
                      <th className="py-2 px-3">Charge Description</th>
                      <th className="py-2 px-3 w-40 text-right">Amount (₹)</th>
                      <th className="py-2 px-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {charges.map((c, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-3">
                          <Input
                            value={c.label}
                            onChange={(e) => setCharge(idx, { label: e.target.value })}
                            placeholder="e.g. Freight / Transport / Customs"
                            className="text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={c.amount}
                            onChange={(e) => setCharge(idx, { amount: e.target.value })}
                            className="text-right text-xs font-mono font-bold"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeCharge(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom Summary & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <Field label="Purchase Invoice Notes / Remarks">
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Narration, vendor payment terms, delivery notes…"
                />
              </Field>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-[color:var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={isRoundOff}
                  onChange={(e) => setIsRoundOff(e.target.checked)}
                  className="rounded border-[color:var(--border)] text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer accent-indigo-600"
                />
                <span>Automatically round off Grand Total to whole ₹</span>
              </label>
            </div>

            <div className="p-4 rounded-2xl bg-[color:var(--bg-subtle)] border border-[color:var(--border)] space-y-2">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-[color:var(--text-secondary)]">
                  <span>Subtotal (Taxable Value):</span>
                  <span className="font-mono font-semibold text-[color:var(--text-primary)]">{money(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Total Discount:</span>
                    <span className="font-mono">-{money(totals.discount)}</span>
                  </div>
                )}
                {totals.tax > 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-[color:var(--text-secondary)] font-medium">
                    <span>GST Input Tax:</span>
                    <span className="font-mono font-bold text-[color:var(--text-primary)]">{money(totals.tax)}</span>
                  </div>
                )}
                {totals.charges > 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-[color:var(--text-secondary)] font-medium">
                    <span>Landed Cost Charges:</span>
                    <span className="font-mono font-semibold">{money(totals.charges)}</span>
                  </div>
                )}
                {isRoundOff && totals.roundOff !== 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-[color:var(--text-muted)]">
                    <span>Round Off:</span>
                    <span className="font-mono">{money(totals.roundOff)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-t-2 border-[color:var(--border-strong)] mt-2">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Invoiced</div>
                  <div className="text-[13px] font-bold text-[color:var(--text-primary)]">Purchase Grand Total</div>
                </div>
                <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  {money(totals.total)}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[color:var(--border)]">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                loading={loading}
                icon={Clock}
                onClick={() => handleSaveWithStatus('UNPAID')}
              >
                Record as Unpaid (Due)
              </Button>
              {paymentType === 'PARTIAL' && (
                <Button
                  type="button"
                  variant="outline"
                  loading={loading}
                  icon={CreditCard}
                  onClick={() => handleSaveWithStatus('PARTIALLY_PAID', initialPaidAmount)}
                >
                  Record Partial Payment ({money(Number(initialPaidAmount) || 0)})
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                loading={loading}
                icon={CheckCircle2}
                onClick={() => handleSaveWithStatus('PAID')}
              >
                Save as Paid ({money(totals.total)})
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <PurchaseProductPickerModal
        open={activePickerIndex !== null}
        onClose={() => setActivePickerIndex(null)}
        products={products}
        onSelectProduct={(p) => {
          if (activePickerIndex !== null) handleProductSelect(activePickerIndex, p);
        }}
        onAddNew={() => {
          const idx = activePickerIndex;
          setActivePickerIndex(null);
          setNewProductLineIndex(idx !== null ? idx : items.length - 1);
        }}
      />

      <ProductFormModal
        open={newProductLineIndex !== null}
        editing={null}
        categories={categories}
        units={units}
        warehouses={warehouses}
        products={products}
        batchTrackingEnabled={batchTrackingEnabled}
        storeNearExpiryDays={storeNearExpiryDays}
        hideBatches={true}
        showToast={showToast}
        onClose={() => setNewProductLineIndex(null)}
        onSaved={(newProduct) => {
          const idx = newProductLineIndex;
          setNewProductLineIndex(null);
          if (newProduct && idx !== null) handleProductSelect(idx, newProduct);
          onProductCreated?.(newProduct);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Purchase Orders
 * ------------------------------------------------------------------ */

function POStatusBadge({ po }) {
  const map = {
    ISSUED: { tone: 'info', label: 'Open' },
    PARTIALLY_RECEIVED: { tone: 'warning', label: 'Partially Received' },
    RECEIVED: { tone: 'success', label: 'Received' },
    CANCELLED: { tone: 'danger', label: 'Cancelled' }
  };
  const cfg = map[po.status] || { tone: 'neutral', label: po.status };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

const blankPOLine = () => ({
  productId: '',
  name: '',
  barcode: '',
  hsn: '',
  qty: 1,
  unit: 'pcs',
  rate: '',
  sellPrice: '',
  taxRate: 0,
  total: 0,
  isCustom: false
});

function PurchaseOrderModal({
  open,
  onClose,
  vendors = [],
  products = [],
  categories = [],
  units = [],
  warehouses = [],
  batchTrackingEnabled = false,
  storeNearExpiryDays,
  showToast,
  onSaved,
  onProductCreated
}) {
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [poDate, setPoDate] = useState(() => todayISO());
  const [expectedDate, setExpectedDate] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([blankPOLine()]);
  const [saving, setSaving] = useState(false);
  const [activePickerIndex, setActivePickerIndex] = useState(null);
  const [newProductLineIndex, setNewProductLineIndex] = useState(null);

  useEffect(() => {
    if (open) {
      setSelectedVendorId('');
      setVendorName('');
      setVendorPhone('');
      setVendorGstin('');
      setVendorAddress('');
      setPoDate(todayISO());
      setExpectedDate('');
      setSupplierRef('');
      setNotes('');
      setLines([blankPOLine()]);
      setActivePickerIndex(null);
      setNewProductLineIndex(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleVendorChange = (id) => {
    setSelectedVendorId(id);
    if (!id) {
      setVendorName('');
      setVendorPhone('');
      setVendorGstin('');
      setVendorAddress('');
      return;
    }
    const ven = vendors.find((v) => v.id === id);
    if (ven) {
      setVendorName(ven.name || '');
      setVendorPhone(ven.phone || '');
      setVendorGstin(ven.gstin || '');
      setVendorAddress(ven.address || '');
    }
  };

  const addLine = () => setLines((ls) => [...ls, blankPOLine()]);
  const removeLine = (idx) => {
    if (lines.length === 1) return;
    setLines((ls) => ls.filter((_, i) => i !== idx));
  };

  const handleProductSelect = (index, prod) => {
    setLines((prev) => {
      const next = [...prev];
      const qty = Number(next[index]?.qty) || 1;
      const rate = prod.purchasePrice !== undefined && prod.purchasePrice !== '' ? Number(prod.purchasePrice) : Number(prod.price) || 0;
      const taxRate = Number(prod.taxRate || prod.gstRate) || 0;
      const sub = qty * rate;
      const taxAmt = (sub * taxRate) / 100;
      const total = Math.round((sub + taxAmt) * 100) / 100;

      next[index] = {
        ...next[index],
        productId: prod.id || '',
        name: prod.name,
        barcode: prod.barcode || '',
        hsn: prod.hsn || '',
        unit: prod.unit || next[index]?.unit || 'pcs',
        rate: prod.purchasePrice !== undefined && prod.purchasePrice !== '' ? prod.purchasePrice : (prod.price ?? ''),
        sellPrice: prod.price !== undefined ? prod.price : '',
        taxRate,
        total,
        isCustom: !prod.id
      };

      const hasEmptyBelow = next.some((r, i) => i > index && (!r.name || !r.name.trim()));
      if (!hasEmptyBelow) next.push(blankPOLine());
      return next;
    });
  };

  const handleLineChange = (index, field, value) => {
    setLines((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      const qty = Number(updated.qty) || 0;
      const rate = Number(updated.rate) || 0;
      const taxRate = Number(updated.taxRate) || 0;
      const sub = qty * rate;
      const taxAmt = (sub * taxRate) / 100;
      updated.total = Math.max(0, Math.round((sub + taxAmt) * 100) / 100);
      next[index] = updated;
      return next;
    });
  };

  const switchLineUnit = (idx, line, newUnit) => {
    const product = products.find((pr) => pr.id === line.productId);
    if (!product) {
      handleLineChange(idx, 'unit', newUnit);
      return;
    }
    const options = getProductUnitOptions(product);
    const opt = options.find((o) => o.unit === newUnit);
    const baseCost = Number(product.purchasePrice) || 0;
    const newRate = opt && baseCost ? r2Local(baseCost * Number(opt.factor || 1)) : line.rate;

    setLines((prev) => {
      const next = [...prev];
      const updated = { ...next[idx], unit: newUnit, rate: newRate };
      const qty = Number(updated.qty) || 0;
      const rate = Number(updated.rate) || 0;
      const taxRate = Number(updated.taxRate) || 0;
      const sub = qty * rate;
      const taxAmt = (sub * taxRate) / 100;
      updated.total = Math.max(0, Math.round((sub + taxAmt) * 100) / 100);
      next[idx] = updated;
      return next;
    });
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    lines.forEach((l) => {
      const qty = Number(l.qty) || 0;
      const rate = Number(l.rate) || 0;
      const taxRate = Number(l.taxRate) || 0;
      const lineSub = qty * rate;
      subtotal += lineSub;
      taxTotal += (lineSub * taxRate) / 100;
    });
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(taxTotal * 100) / 100,
      grandTotal: Math.round((subtotal + taxTotal) * 100) / 100
    };
  }, [lines]);

  const lineIsValid = (l) => Boolean(l.name && l.name.trim()) && Number(l.qty) > 0;
  const canSubmit = Boolean(vendorName.trim()) && lines.some(lineIsValid);

  const submit = async (e) => {
    e.preventDefault();
    if (saving || !canSubmit) return;
    setSaving(true);
    try {
      const res = await api.post('/purchase-orders', {
        vendorId: selectedVendorId || undefined,
        vendorName: vendorName.trim(),
        vendorPhone: vendorPhone.trim(),
        vendorGstin: vendorGstin.trim(),
        vendorAddress: vendorAddress.trim(),
        supplierRef: supplierRef.trim(),
        items: lines.filter(lineIsValid).map((l) => ({
          productId: l.productId || null,
          productName: l.name,
          barcode: l.barcode || '',
          unit: l.unit || 'pcs',
          hsn: l.hsn || '',
          qty: Number(l.qty),
          rate: Number(l.rate) || 0,
          sellPrice: l.sellPrice !== undefined && l.sellPrice !== '' ? Number(l.sellPrice) : undefined,
          taxRate: Number(l.taxRate) || 0,
          total: Number(l.total) || 0
        })),
        expectedDate: expectedDate || undefined,
        notes: notes.trim(),
        date: poDate
      });
      showToast(res.message || 'Purchase order created successfully.');
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not create the purchase order.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="New Purchase Order (PO)"
        subtitle="Place an order commitment with a vendor. Physical stock and accounting entries are updated when you receive against it."
        icon={FileText}
        size="half"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={submit} loading={saving} disabled={!canSubmit} icon={Plus}>
              Create Purchase Order ({money(totals.grandTotal)})
            </Button>
          </div>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          {/* Vendor & Order Details Card */}
          <div className="p-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)] flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Vendor &amp; PO Details
              </span>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                Auto-fills vendor details on selection
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Select Registered Vendor">
                <Select value={selectedVendorId} onChange={(e) => handleVendorChange(e.target.value)}>
                  <option value="">— Unregistered / Custom Vendor —</option>
                  {(vendors || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {Number(v.outstandingPayable) > 0 ? `(Payable: ${money(v.outstandingPayable)})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Vendor / Supplier Name *" required>
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Supplier / Company Name"
                  required
                />
              </Field>

              <Field label="Vendor Contact Phone">
                <Input
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="Contact phone number"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="PO Date *">
                <Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} required />
              </Field>

              <Field label="Expected Delivery Date">
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="flex-1"
                  />
                  {[
                    { label: '7d', days: 7 },
                    { label: '15d', days: 15 },
                    { label: '30d', days: 30 }
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setExpectedDate(addDaysISO(poDate, p.days))}
                      className="rounded-lg border border-[color:var(--border)] px-1.5 py-1 text-[10px] font-bold text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)]"
                    >
                      +{p.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Supplier Quote / Reference No.">
                <Input
                  value={supplierRef}
                  onChange={(e) => setSupplierRef(e.target.value)}
                  placeholder="e.g. QT-9901"
                />
              </Field>
            </div>

            {(vendorGstin || vendorAddress) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-[color:var(--border-subtle)] text-xs text-[color:var(--text-secondary)]">
                {vendorGstin && <div><strong>GSTIN:</strong> <span className="font-mono">{vendorGstin}</span></div>}
                {vendorAddress && <div><strong>Address:</strong> {vendorAddress}</div>}
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)]">
                Order Line Items ({lines.length})
              </span>
              <Button size="xs" variant="outline" icon={Plus} onClick={addLine}>
                Add Blank Row
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] text-[10.5px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Product / Item Description</th>
                    <th className="py-2.5 px-3 w-20">HSN/SAC</th>
                    <th className="py-2.5 px-3 w-24 text-right">Order Qty</th>
                    <th className="py-2.5 px-3 w-24">Unit</th>
                    <th className="py-2.5 px-3 w-24 text-right">Pur. Rate (₹)</th>
                    <th className="py-2.5 px-3 w-24 text-right text-indigo-600 dark:text-indigo-400">Sell Price (₹)</th>
                    <th className="py-2.5 px-3 w-20 text-right">GST %</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {lines.map((line, idx) => {
                    const product = products.find((pr) => pr.id === line.productId);
                    const unitOptions = product ? getProductUnitOptions(product) : [];

                    return (
                      <tr key={idx} className="hover:bg-[color:var(--bg-subtle)]/50">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>

                        <td className="py-2.5 px-3 min-w-[200px]">
                          <ProductItemCell
                            row={line}
                            index={idx}
                            onOpenPicker={(i) => setActivePickerIndex(i)}
                            onUpdateName={(i, name) => handleLineChange(i, 'name', name)}
                          />
                        </td>

                        <td className="py-2 px-3">
                          <Input
                            value={line.hsn}
                            onChange={(e) => handleLineChange(idx, 'hsn', e.target.value)}
                            placeholder="HSN"
                            className="text-xs font-mono"
                          />
                        </td>

                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            step="any"
                            min="0.01"
                            value={line.qty}
                            onChange={(e) => handleLineChange(idx, 'qty', e.target.value)}
                            className="text-right text-xs font-mono font-bold"
                          />
                        </td>

                        <td className="py-2 px-3">
                          {unitOptions.length > 1 ? (
                            <Select
                              value={line.unit}
                              onChange={(e) => switchLineUnit(idx, line, e.target.value)}
                              className="text-xs"
                            >
                              {unitOptions.map((o) => (
                                <option key={o.unit} value={o.unit}>
                                  {o.unit}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Input
                              value={line.unit}
                              onChange={(e) => handleLineChange(idx, 'unit', e.target.value)}
                              className="text-xs"
                            />
                          )}
                        </td>

                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            step="any"
                            value={line.rate}
                            onChange={(e) => handleLineChange(idx, 'rate', e.target.value)}
                            placeholder="0.00"
                            className="text-right text-xs font-mono font-bold"
                          />
                        </td>

                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            step="any"
                            value={line.sellPrice}
                            onChange={(e) => handleLineChange(idx, 'sellPrice', e.target.value)}
                            placeholder="Sell ₹"
                            className="text-right text-xs font-mono"
                          />
                        </td>

                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            step="any"
                            value={line.taxRate}
                            onChange={(e) => handleLineChange(idx, 'taxRate', e.target.value)}
                            className="text-right text-xs font-mono"
                          />
                        </td>

                        <td className="py-2 px-3 text-right font-mono font-bold text-xs text-[color:var(--text-primary)]">
                          {money(line.total)}
                        </td>

                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length === 1}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Summary & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <Field label="Purchase Order Notes / Instructions to Vendor">
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Delivery instructions, freight terms, warehouse gate directions…"
              />
            </Field>

            <div className="p-4 rounded-2xl bg-[color:var(--bg-subtle)] border border-[color:var(--border)] space-y-2 flex flex-col justify-between">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-[color:var(--text-secondary)]">
                  <span>Subtotal (Taxable Value):</span>
                  <span className="font-mono font-semibold text-[color:var(--text-primary)]">{money(totals.subtotal)}</span>
                </div>
                {totals.tax > 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-[color:var(--text-secondary)] font-medium">
                    <span>Estimated GST:</span>
                    <span className="font-mono font-bold text-[color:var(--text-primary)]">{money(totals.tax)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-t-2 border-[color:var(--border-strong)] mt-2">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Order Estimated Total</div>
                  <div className="text-[13px] font-bold text-[color:var(--text-primary)]">PO Grand Total</div>
                </div>
                <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  {money(totals.grandTotal)}
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <PurchaseProductPickerModal
        open={activePickerIndex !== null}
        onClose={() => setActivePickerIndex(null)}
        products={products}
        onSelectProduct={(p) => {
          if (activePickerIndex !== null) handleProductSelect(activePickerIndex, p);
        }}
        onAddNew={() => {
          const idx = activePickerIndex;
          setActivePickerIndex(null);
          setNewProductLineIndex(idx !== null ? idx : lines.length - 1);
        }}
      />

      <ProductFormModal
        open={newProductLineIndex !== null}
        editing={null}
        categories={categories}
        units={units}
        warehouses={warehouses}
        products={products}
        batchTrackingEnabled={batchTrackingEnabled}
        storeNearExpiryDays={storeNearExpiryDays}
        hideBatches={true}
        showToast={showToast}
        onClose={() => setNewProductLineIndex(null)}
        onSaved={(createdProduct) => {
          onProductCreated?.(createdProduct);
          if (newProductLineIndex !== null && createdProduct) {
            handleProductSelect(newProductLineIndex, createdProduct);
          }
          setNewProductLineIndex(null);
        }}
      />
    </>
  );
}

function PODetailModal({ po, onClose, onCancel, onReceive, onDownload }) {
  const canReceive = Boolean(po) && (po.status === 'ISSUED' || po.status === 'PARTIALLY_RECEIVED');
  const canCancel = canReceive && !(po?.items || []).some((l) => Number(l.receivedQty) > 0);

  return (
    <Modal
      open={Boolean(po)}
      onClose={onClose}
      title={po ? `Purchase Order ${po.poNumber}` : ''}
      subtitle={po ? `${po.vendorName} · ${fmtDate(po.date)}` : ''}
      icon={FileText}
      size="xl"
      footer={
        <>
          {po && onDownload && (
            <Button variant="outline" icon={Download} onClick={() => onDownload(po)}>
              Download / Export
            </Button>
          )}
          {canCancel && (
            <Button variant="danger" icon={Ban} onClick={() => onCancel(po)}>
              Cancel PO
            </Button>
          )}
          {canReceive && (
            <Button variant="primary" onClick={() => onReceive(po)}>
              Receive Items
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {po && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Summary label="Status" value={<POStatusBadge po={po} />} />
            <Summary label="Expected delivery" value={po.expectedDate ? fmtDate(po.expectedDate) : '—'} />
            <Summary label="Created by" value={po.createdBy || '—'} />
          </div>

          <DataTable
            maxHeight="40vh"
            dense
            columns={[
              { key: 'name', label: 'Product', render: (i) => i.productName },
              { key: 'ordered', label: 'Ordered', align: 'right', width: 90, render: (i) => i.orderedQty },
              {
                key: 'received',
                label: 'Received',
                align: 'right',
                width: 90,
                render: (i) => (
                  <span className={Number(i.receivedQty) >= Number(i.orderedQty) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                    {i.receivedQty || 0}
                  </span>
                )
              },
              { key: 'rate', label: 'Rate', align: 'right', width: 100, render: (i) => <Money value={i.rate} /> },
              {
                key: 'amount',
                label: 'Amount',
                align: 'right',
                width: 120,
                render: (i) => <Money value={i.orderedQty * i.rate * (1 + (i.taxRate || 0) / 100)} className="font-bold" />
              }
            ]}
            rows={po.items || []}
            rowKey={(i, idx) => `${i.productId}_${idx}`}
            empty={<EmptyState title="No line items" />}
          />

          <div className="flex justify-end gap-6 rounded-xl px-4 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
            <Summary label="Taxable Value" value={money(po.subtotal)} />
            <Summary label="GST" value={money(po.tax)} />
            <Summary label="Grand Total" value={money(po.totalAmount)} bold />
          </div>

          {po.notes && (
            <div className="text-[12px] text-[color:var(--text-secondary)]">
              <span className="label-eyebrow mr-1.5">Notes</span>
              {po.notes}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Vendor Credits (Purchase Returns)
 * ------------------------------------------------------------------ */

const RETURN_REASONS = ['Damaged', 'Wrong Item', 'Expired', 'Quality Issue', 'Price Adjustment', 'Other'];

function PurchaseReturnModal({ purchase, vendorCredits = [], showToast, onClose, onSaved }) {
  const [qtys, setQtys] = useState({});
  const [reason, setReason] = useState('Damaged');
  const [customReason, setCustomReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (purchase) {
      setQtys({});
      setReason('Damaged');
      setCustomReason('');
    }
  }, [purchase]);

  const alreadyCredited = (productId, batchId) =>
    vendorCredits
      .filter((vc) => vc.status !== 'VOID')
      .reduce(
        (sum, vc) =>
          sum +
          (vc.items || [])
            .filter((it) => it.productId === productId && (it.batchId || null) === (batchId || null))
            .reduce((s, it) => s + Number(it.qty || 0), 0),
        0
      );

  const lines = (purchase?.items || [])
    .map((line, idx) => {
      const key = `${line.productId}_${line.batchId || ''}_${idx}`;
      const credited = alreadyCredited(line.productId, line.batchId);
      const max = r2Local(Number(line.qty) - credited);
      return { ...line, key, credited, max };
    })
    .filter((l) => l.max > 0.009);

  const setQty = (key, v) => setQtys((q) => ({ ...q, [key]: v }));

  const selected = lines.filter((l) => Number(qtys[l.key]) > 0);
  const canSubmit = selected.length > 0 && selected.every((l) => Number(qtys[l.key]) <= l.max + 0.009);

  const submit = async (e) => {
    e.preventDefault();
    if (saving || !canSubmit || !purchase) return;
    setSaving(true);
    try {
      const res = await api.post(`/purchases/${purchase.id}/return`, {
        items: selected.map((l) => ({ productId: l.productId, batchId: l.batchId || undefined, qty: Number(qtys[l.key]) })),
        reason: reason === 'Other' ? customReason || 'Other' : reason
      });
      showToast(res.message);
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not record the return.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(purchase)}
      onClose={onClose}
      title="Return Items to Vendor"
      subtitle={purchase ? `Against invoice ${purchase.invoiceNo} · ${purchase.vendorName}` : ''}
      icon={Undo2}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!canSubmit}>
            Record Return
          </Button>
        </>
      }
    >
      {purchase && (
        <form onSubmit={submit} className="space-y-4">
          {lines.length === 0 ? (
            <EmptyState icon={Undo2} title="Nothing left to return" hint="Every item on this invoice has already been fully returned." />
          ) : (
            <div className="surface overflow-hidden rounded-2xl">
              <table className="ledger-table w-full border-collapse">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Product</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Purchased</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Returnable</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Return Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key}>
                      <td>
                        <div className="text-xs font-semibold">{l.name}</div>
                        {l.batchNo && <div className="text-[10px] text-[color:var(--text-muted)]">Batch {l.batchNo}</div>}
                      </td>
                      <td className="tabular text-right">
                        {l.qty} {l.unit}
                      </td>
                      <td className="tabular text-right font-bold">
                        {l.max} {l.unit}
                      </td>
                      <td>
                        <Input
                          type="number"
                          min="0"
                          max={l.max}
                          step="any"
                          value={qtys[l.key] || ''}
                          onChange={(e) => setQty(l.key, e.target.value)}
                          className="text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reason">
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            {reason === 'Other' && (
              <Field label="Specify reason">
                <Input value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
              </Field>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}

function VendorCreditDetailModal({ vendorCredit, onClose, onVoid }) {
  const isVoid = vendorCredit?.status === 'VOID';
  return (
    <Modal
      open={Boolean(vendorCredit)}
      onClose={onClose}
      title={vendorCredit ? `Return — ${vendorCredit.vendorName}` : ''}
      subtitle={vendorCredit ? `Against invoice ${vendorCredit.purchaseInvoiceNo} · ${fmtDate(vendorCredit.date)}` : ''}
      icon={Undo2}
      size="lg"
      footer={
        <>
          {vendorCredit && !isVoid && (
            <Button variant="danger" onClick={() => onVoid(vendorCredit)}>
              Void Return
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {vendorCredit && (
        <div className="space-y-3">
          {isVoid && (
            <div className="rounded-xl px-3 py-2 text-[11.5px] font-semibold text-rose-600 dark:text-rose-400" style={{ background: 'var(--bg-subtle)' }}>
              This return was voided{vendorCredit.voidedBy ? ` by ${vendorCredit.voidedBy}` : ''}{vendorCredit.voidedAt ? ` on ${fmtDate(vendorCredit.voidedAt)}` : ''}. Stock was restored.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Summary label="Reason" value={vendorCredit.reason} />
            <Summary label="Voucher" value={vendorCredit.voucherNo || '—'} />
          </div>
          <DataTable
            maxHeight="40vh"
            dense
            columns={[
              { key: 'name', label: 'Product', render: (i) => i.productName },
              { key: 'batch', label: 'Batch', width: 100, render: (i) => i.batchNo || '—' },
              { key: 'qty', label: 'Qty', align: 'right', width: 90, render: (i) => `${i.qty} ${i.unit || ''}` },
              { key: 'rate', label: 'Rate', align: 'right', width: 100, render: (i) => <Money value={i.rate} /> },
              { key: 'amount', label: 'Amount', align: 'right', width: 120, render: (i) => <Money value={i.lineTotal} className="font-bold" /> }
            ]}
            rows={vendorCredit.items || []}
            rowKey={(i, idx) => `${i.productId}_${idx}`}
            empty={<EmptyState title="No line items" />}
          />
          <div className="flex justify-end gap-6 rounded-xl px-4 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
            <Summary label="Taxable Value" value={money(vendorCredit.subtotal)} />
            <Summary label="GST" value={money(vendorCredit.tax)} />
            <Summary label="Total Credited" value={money(vendorCredit.totalAmount)} bold />
          </div>
        </div>
      )}
    </Modal>
  );
}
