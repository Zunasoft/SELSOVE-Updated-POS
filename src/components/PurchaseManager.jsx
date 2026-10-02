import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Plus,
  Trash2,
  ClipboardList,
  Wallet,
  Boxes,
  FileText,
  Undo2,
  Ban,
  AlertTriangle,
  Printer,
  Paperclip,
  CreditCard,
  Clock,
  CheckCircle2,
  Edit3,
  Receipt,
  Eye,
  Tag
} from 'lucide-react';

import api, { money, fmtDate, todayISO, financialYearStartISO, API_BASE } from '../lib/api';
import { getProductUnitOptions } from './POSTerminal';
import { ProductFormModal } from './InventoryManager';
import { PartyFormModal } from './CustomerVendorLedger';
import InvoiceEditModal from './InvoiceEditModal';
import {
  Panel, SectionHeader, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, DateRange, StatTile, DataTable, cx, SearchInput
} from '../lib/ui';
import { isWholeNumberUnit } from '../lib/units';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];

// Same wrapping icon+label pill-tab pattern as Inventory — easier to scan than a segmented control once there are 5 tabs.
const PURCHASE_TABS = [
  { id: 'INVOICES', label: 'Invoices', icon: Truck },
  { id: 'BY VENDOR', label: 'By Vendor', icon: ClipboardList },
  { id: 'PURCHASE ORDERS', label: 'Purchase Orders', icon: FileText },
  { id: 'RETURNS', label: 'Returns', icon: Undo2 },
  { id: 'PAYMENTS MADE', label: 'Payments Made', icon: Wallet }
];

/** Purchase (goods inward) register: recording an invoice receives stock, refreshes cost price, and posts Inventory + GST Input against the vendor. */
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
  const [editTarget, setEditTarget] = useState(null);
  const [payVendorTarget, setPayVendorTarget] = useState(null);
  const [showNewPO, setShowNewPO] = useState(false);
  const [receivePO, setReceivePO] = useState(null);
  const [poDetail, setPoDetail] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [vcDetail, setVcDetail] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [printTarget, setPrintTarget] = useState(null);
  const [poSearch, setPoSearch] = useState('');
  const [returnSearch, setReturnSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [posSettings, setPosSettings] = useState({});
  const [settingsFull, setSettingsFull] = useState({});

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
      setSettingsFull(settings || {});
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

  const handlePrint = (target) => {
    if (!target) return;
    setPrintTarget(target);
    showToast(`Opening Print / Save as PDF for "${target.invoiceNo || target.poNumber}"...`);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleExecuteDownload = (a, b) => {
    handlePrint(b || a);
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

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="space-y-4"
        >
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
              {
                key: 'invoiceNo',
                label: 'Invoice No',
                render: (p) => (
                  <span className="flex items-center gap-1.5">
                    <span className="font-bold">{p.invoiceNo}</span>
                    {p.isEdited && <Badge tone="info">Edited</Badge>}
                  </span>
                )
              },
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
                width: 130,
                render: (p) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail(p);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      title="View Purchase Invoice"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {p.status !== 'VOID' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTarget(p);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                        title="Edit vendor, notes & shipping details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrint(p);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      title="Print / Save as PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
            { key: 'status', label: 'Status', width: 150, render: (p) => <POStatusBadge po={p} /> },
            {
              key: 'action',
              label: '',
              width: 50,
              render: (p) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrint(p);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                  title="Print / Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              )
            }
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
        </motion.div>
      </AnimatePresence>

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
        settings={settingsFull}
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
        settings={settingsFull}
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
        onDownload={handlePrint}
        onEdit={setEditTarget}
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

      {editTarget && (
        <InvoiceEditModal
          invoice={editTarget}
          kind="purchase"
          products={products}
          settings={settingsFull}
          showToast={showToast}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setEditTarget(null);
            setDetail((d) => (d && d.id === updated?.id ? updated : d));
            loadPurchases();
          }}
        />
      )}

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
        onDownload={handlePrint}
        onReceive={(po) => {
          setPoDetail(null);
          setReceivePO(po);
        }}
      />

      <PurchaseReturnModal
        purchase={returnTarget}
        products={products}
        vendorCredits={vendorCredits.filter((v) => v.purchaseId === returnTarget?.id)}
        showToast={showToast}
        onClose={() => setReturnTarget(null)}
        onSaved={() => {
          setReturnTarget(null);
          load();
        }}
      />

      <VendorCreditDetailModal vendorCredit={vcDetail} onClose={() => setVcDetail(null)} onVoid={handleVoidVendorCredit} />

      {/* Off-screen Printable Document for Purchases & Purchase Orders */}
      <PrintablePurchaseDocument target={printTarget} tenant={tenant} />
    </div>
  );
}

/** Vendor Cash Payment (Module 6): applies to the vendor's oldest unpaid invoices first, exactly as the backend does. */
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

function PurchaseDetailModal({ purchase, vendorCredits = [], onClose, onVoid, onReturn, onDownload, onEdit, onAttachmentsChanged, showToast }) {
  const isVoid = purchase?.status === 'VOID';
  return (
    <Modal
      open={Boolean(purchase)}
      onClose={onClose}
      title={purchase ? `Invoice ${purchase.invoiceNo}` : ''}
      subtitle={
        purchase ? (
          <span className="inline-flex items-center gap-2">
            {`${purchase.vendorName} · ${fmtDate(purchase.date)} · Voucher ${purchase.voucherNo}`}
            {purchase.isEdited && <Badge tone="info">EDITED</Badge>}
          </span>
        ) : (
          ''
        )
      }
      icon={Truck}
      size="xl"
      footer={
        <>
          {purchase && onDownload && (
            <Button variant="outline" icon={Printer} onClick={() => onDownload(purchase)}>
              Print / PDF
            </Button>
          )}
          {purchase && !isVoid && onEdit && (
            <Button variant="outline" icon={Edit3} onClick={() => onEdit(purchase)}>
              Edit Details
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

/** Attaches vendor invoice photos/PDFs etc. to a purchase, PO, or vendor credit; binary lives server-side, this manages only the metadata list. */
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
  sellPrice: '',
  trackSerials: false,
  showSerial: false,
  serials: [],
  // Which warehouse this line's stock is received into — empty means "the shop's default", same as
  // if this were never set (backward compatible with every purchase created before this existed).
  warehouseId: ''
});

const r2Local = (n) => Math.round((Number(n) || 0) * 100) / 100;
const addDaysISO = (dateStr, days) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** What a price sheet charges for a product today: its own override, else the standard price less the sheet's default discount. */
const sheetCurrentPrice = (sheet, product) => {
  const override = sheet?.pricingMap?.[product.id];
  if (override !== undefined && override !== '') return Number(override) || 0;
  const std = Number(product.price) || 0;
  return r2Local(std * (1 - (Number(sheet?.defaultDiscountPercent) || 0) / 100));
};

/** The Global Sheet's own cost / MRP for a product (the Global Matrix values until the sheet has been edited). */
const sheetCost = (sheet, product) => {
  const own = sheet?.costMap?.[product.id];
  return own !== undefined && own !== '' ? Number(own) || 0 : Number(product.purchasePrice) || 0;
};
const sheetMrp = (sheet, product) => {
  const own = sheet?.mrpMap?.[product.id];
  return own !== undefined && own !== '' ? Number(own) || 0 : Number(product.mrp) || 0;
};

/**
 * Sheet price that keeps the product's margin when this purchase changes its cost. Null (price stays as it is) for
 * batch-tracked products — each batch carries its own price — and when there's no usable old/new cost to compare.
 */
const sheetAutoPrice = (sheet, product, line) => {
  if (!product || product.trackBatches) return null;
  const oldCost = sheet?.isLocal ? sheetCost(sheet, product) : Number(product.purchasePrice) || 0;
  const newCost = Number(line?.rate) || 0;
  if (oldCost <= 0 || newCost <= 0 || Math.abs(newCost - oldCost) < 0.005) return null;
  // The line is quoted in another unit than the product's own, so its rate isn't comparable to the stored cost.
  if (line.unit && product.unit && line.unit !== product.unit) return null;
  const current = sheetCurrentPrice(sheet, product);
  return current > 0 ? r2Local((current * newCost) / oldCost) : null;
};

/** Edit one price sheet from inside a purchase: purchased items by default, every product on request. */
function PriceSheetPanel({ sheets, sheetId, onSheetChange, products, items, edits, onEdit, extra, onExtraEdit, showAll, onShowAll, editedSheetIds }) {
  const [query, setQuery] = useState('');
  // "Show all item prices" can mean thousands of rows; they are drawn a page at a time.
  const [limit, setLimit] = useState(100);
  // What's being typed in a Margin box, so a half-typed "12." isn't rewritten from the price it produced.
  const [marginDraft, setMarginDraft] = useState({});
  const sheet = sheets.find((s) => s.id === sheetId);

  const rows = useMemo(() => {
    if (!sheet) return [];
    const lineFor = new Map();
    items.forEach((l) => {
      if (l.productId && !lineFor.has(l.productId)) lineFor.set(l.productId, l);
    });
    const q = query.trim().toLowerCase();
    const source = showAll ? products : products.filter((p) => lineFor.has(p.id));
    return source
      .filter((p) => !q || `${p.name} ${p.barcode || ''} ${p.sku || ''}`.toLowerCase().includes(q))
      .map((p) => {
        const line = lineFor.get(p.id);
        const current = sheetCurrentPrice(sheet, p);
        const auto = line ? sheetAutoPrice(sheet, p, line) : null;
        return { product: p, line, current, auto };
      });
  }, [sheet, products, items, showAll, query]);

  return (
    <div className="p-3.5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/40 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)]">
            Update Price Sheet
          </span>
          <p className="text-[10.5px] text-[color:var(--text-muted)] mt-0.5">
            Saved with this purchase. Switch sheets to edit more than one. Non-batch items keep their margin when the cost changes; batch items keep their price.
          </p>
        </div>
        <Select value={sheetId} onChange={(e) => onSheetChange(e.target.value)} className="sm:w-64">
          <option value="">No price sheet</option>
          {sheets.filter((s) => s.isActive !== false).map((s) => (
            <option key={s.id} value={s.id}>{s.name}{editedSheetIds.has(s.id) ? ' ✓ edited' : ''}</option>
          ))}
        </Select>
      </div>

      {sheet && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-indigo-600 dark:text-indigo-400">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => onShowAll(e.target.checked)}
                className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              Show all item prices
            </label>
            {showAll && (
              <SearchInput value={query} onChange={setQuery} placeholder="Search products..." className="w-full sm:w-64" />
            )}
          </div>

          <div className="max-h-72 overflow-auto rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-surface)]">
            {rows.length === 0 ? (
              <div className="p-4 text-center text-xs text-[color:var(--text-muted)]">
                {showAll ? 'No products match.' : 'Add products to the purchase to edit their prices here, or tick "Show all item prices".'}
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-[color:var(--bg-subtle)] text-[10.5px] uppercase tracking-wider font-bold text-[color:var(--text-secondary)]">
                  <tr>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3 text-right">{sheet.isLocal ? 'Cost (₹)' : 'Cost'}</th>
                    {!sheet.isLocal && <th className="py-2 px-3 text-right">Standard</th>}
                    <th className="py-2 px-3 text-right w-36">{sheet.isLocal ? 'Selling price (₹)' : `${sheet.name} price (₹)`}</th>
                    {sheet.isLocal && <th className="py-2 px-3 text-right w-28">MRP (₹)</th>}
                    <th className="py-2 px-3 text-right w-24">Margin (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {rows.slice(0, limit).map(({ product: p, line, current, auto }) => {
                    const manual = edits[p.id];
                    const hasManual = manual !== undefined && manual !== '';
                    const newCost = line ? Number(line.rate) || 0 : null;
                    return (
                      <tr key={p.id}>
                        <td className="py-2 px-3 font-bold text-[color:var(--text-primary)]">
                          {p.name}
                          {p.trackBatches && line && <Badge tone="neutral" className="ml-1.5">Batch · price kept</Badge>}
                        </td>
                        {sheet.isLocal ? (
                          <td className="py-2 px-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={extra[p.id]?.cost ?? (newCost !== null && newCost > 0 ? newCost : sheetCost(sheet, p))}
                              onChange={(e) => onExtraEdit(p.id, 'cost', e.target.value)}
                              className="w-24 text-right ml-auto"
                            />
                            {newCost !== null && newCost > 0 && extra[p.id]?.cost === undefined && newCost !== sheetCost(sheet, p) && (
                              <div className="text-[10px] text-emerald-600 mt-0.5">Purchase rate · was {money(sheetCost(sheet, p))}</div>
                            )}
                          </td>
                        ) : (
                          <td className="py-2 px-3 text-right font-mono">
                            {newCost !== null && newCost !== Number(p.purchasePrice) ? (
                              <span>{money(p.purchasePrice || 0)} → <b>{money(newCost)}</b></span>
                            ) : (
                              money(p.purchasePrice || 0)
                            )}
                          </td>
                        )}
                        {!sheet.isLocal && <td className="py-2 px-3 text-right font-mono">{money(p.price || 0)}</td>}
                        <td className="py-2 px-3 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={hasManual ? manual : auto !== null ? auto : ''}
                            placeholder={current.toFixed(2)}
                            onChange={(e) => onEdit(p.id, e.target.value)}
                            className="w-28 text-right font-bold ml-auto"
                          />
                          {!hasManual && auto !== null && (
                            <div className="text-[10px] text-emerald-600 mt-0.5">Auto · was {money(current)}</div>
                          )}
                        </td>
                        {sheet.isLocal && (
                          <td className="py-2 px-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={extra[p.id]?.mrp ?? sheetMrp(sheet, p)}
                              onChange={(e) => onExtraEdit(p.id, 'mrp', e.target.value)}
                              className="w-24 text-right ml-auto"
                            />
                          </td>
                        )}
                        <td className="py-2 px-3 text-right">
                          {(() => {
                            // Margin is taken on the cost this purchase pays; a product not in the purchase uses its stored cost.
                            const typedCost = extra[p.id]?.cost;
                            const cost = sheet.isLocal
                              ? Number(typedCost !== undefined && typedCost !== '' ? typedCost : newCost !== null && newCost > 0 ? newCost : sheetCost(sheet, p)) || 0
                              : newCost !== null && newCost > 0 ? newCost : Number(p.purchasePrice) || 0;
                            const shown = hasManual ? Number(manual) : auto !== null ? auto : current;
                            const margin = cost > 0 && Number.isFinite(shown) ? r2Local(((shown - cost) / cost) * 100) : '';
                            return (
                              <Input
                                type="number"
                                step="0.01"
                                disabled={cost <= 0}
                                title={cost > 0 ? 'Type a margin to set this sheet price from the cost' : 'No cost to take a margin on'}
                                value={marginDraft[p.id] ?? margin}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setMarginDraft((prev) => ({ ...prev, [p.id]: v }));
                                  onEdit(p.id, v === '' ? '' : String(r2Local(cost * (1 + (Number(v) || 0) / 100))));
                                }}
                                onBlur={() => setMarginDraft((prev) => { const n = { ...prev }; delete n[p.id]; return n; })}
                                className="w-20 text-right ml-auto"
                              />
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {rows.length > limit && (
            <div className="flex items-center justify-center gap-3 text-xs">
              <span className="text-[color:var(--text-secondary)] font-semibold">Showing {limit} of {rows.length} products</span>
              <Button size="xs" variant="outline" onClick={() => setLimit((n) => n + 100)}>Show 100 more</Button>
              <Button size="xs" variant="outline" onClick={() => setLimit(rows.length)}>Show all</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Product Cell Display & Trigger Component for Purchase Invoices */
function ProductItemCell({ row, index, products = [], onSelectProduct, onOpenNewProduct, onUpdateName, onSwitchToCustom, onSwitchToCatalog }) {
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
          onClick={() => onSwitchToCatalog(index)}
          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1.5 rounded-xl shrink-0 hover:bg-indigo-100 transition-colors"
          title="Pick from catalog instead"
        >
          Catalog
        </button>
      </div>
    );
  }

  return (
    <Select
      value={row.productId || ''}
      onChange={(e) => {
        const prod = products.find((p) => p.id === e.target.value);
        if (prod) onSelectProduct(index, prod);
      }}
    >
      <option value="">— Select Product —</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}{p.sku ? ` (SKU: ${p.sku})` : ''}
        </option>
      ))}
    </Select>
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
  poContext = null,
  settings
}) {
  const [loading, setLoading] = useState(false);
  const [newProductLineIndex, setNewProductLineIndex] = useState(null);
  // showVendorForm opens the real "New Vendor" form from Parties when
  // "+ Create New Vendor…" is picked in the dropdown.
  const [showVendorForm, setShowVendorForm] = useState(false);
  // Vendors created via "+ Create new vendor" below, ahead of the parent's
  // own `vendors` prop catching up on its next refetch.
  const [addedVendors, setAddedVendors] = useState([]);
  const allVendors = useMemo(() => [...addedVendors, ...vendors], [addedVendors, vendors]);

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

  // Price sheets edited from this purchase. Each sheet keeps its own typed edits, so switching the dropdown to
  // another sheet never loses the first one — every visited sheet is saved with the purchase.
  const [priceSheets, setPriceSheets] = useState([]);
  const [sheetId, setSheetId] = useState('');
  const [sheetEdits, setSheetEdits] = useState({}); // { [sheetId]: { [productId]: typed price } }
  const [visitedSheetIds, setVisitedSheetIds] = useState([]);
  const [showAllSheetItems, setShowAllSheetItems] = useState(false);
  const [sheetExtra, setSheetExtra] = useState({}); // Global Sheet only: { [sheetId]: { [productId]: { cost, mrp } } }

  const sheetUpdates = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const lineFor = new Map();
    items.forEach((l) => {
      if (l.productId && !lineFor.has(l.productId)) lineFor.set(l.productId, l);
    });
    return visitedSheetIds
      .map((id) => {
        const sheet = priceSheets.find((s) => s.id === id);
        if (!sheet) return null;
        const edits = sheetEdits[id] || {};
        const extra = sheetExtra[id] || {};
        const prices = {};
        const costs = {};
        const mrps = {};
        new Set([...lineFor.keys(), ...Object.keys(edits), ...Object.keys(extra)]).forEach((pid) => {
          const product = byId.get(pid);
          if (!product) return;
          if (sheet.isLocal) {
            // The purchase itself already sets each product's cost (landed charges included), so cost and MRP are only
            // sent when typed over by hand.
            const typedCost = extra[pid]?.cost;
            if (typedCost !== undefined && typedCost !== '' && Math.abs(Number(typedCost) - sheetCost(sheet, product)) >= 0.005) costs[pid] = r2Local(Number(typedCost));
            const typedMrp = extra[pid]?.mrp;
            if (typedMrp !== undefined && typedMrp !== '' && Math.abs(Number(typedMrp) - sheetMrp(sheet, product)) >= 0.005) mrps[pid] = r2Local(Number(typedMrp));
          }
          const typed = edits[pid];
          const value = typed !== undefined && typed !== '' ? Number(typed) : sheetAutoPrice(sheet, product, lineFor.get(pid));
          if (value === null || !Number.isFinite(value) || value < 0) return;
          // Only real changes go to the sheet — an untouched price would otherwise become a needless override.
          if (Math.abs(value - sheetCurrentPrice(sheet, product)) < 0.005) return;
          prices[pid] = r2Local(value);
        });
        return Object.keys(prices).length || Object.keys(costs).length || Object.keys(mrps).length
          ? { sheetId: id, prices, ...(sheet.isLocal ? { costs, mrps } : {}) }
          : null;
      })
      .filter(Boolean);
  }, [visitedSheetIds, priceSheets, sheetEdits, sheetExtra, items, products]);
  const editedSheetIds = useMemo(() => new Set(sheetUpdates.map((u) => u.sheetId)), [sheetUpdates]);

  useEffect(() => {
    if (open) {
      setSheetId('');
      setSheetEdits({});
      setSheetExtra({});
      setVisitedSheetIds([]);
      setShowAllSheetItems(false);
      // Ignore the answer if the window was closed (or reopened) before it arrived.
      let current = true;
      api
        .get('/price-sheets')
        .then((res) => current && setPriceSheets(Array.isArray(res) ? res : res?.data || []))
        .catch(() => current && setPriceSheets([]));
      return () => {
        current = false;
      };
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (open) {
      setLoading(false);
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
              showBatch: Boolean(p?.trackBatches),
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

  // Vendor selection
  const handleSelectVendor = (ven) => {
    setSelectedVendorId(ven.id);
    setVendorName(ven.name || '');
    setVendorPhone(ven.phone || '');
    setVendorGstin(ven.gstin || '');
    setVendorPan(ven.pan || '');
    setVendorAddress(ven.address || '');
    setVendorState(ven.state || '');
    setVendorStateCode(ven.stateCode || '');
  };

  const clearSelectedVendor = () => {
    setSelectedVendorId('');
    setVendorName('');
    setVendorPhone('');
    setVendorGstin('');
    setVendorPan('');
    setVendorAddress('');
    setVendorState('');
    setVendorStateCode('');
  };

  // Dropdown onChange — the last option ("__new__") opens the real
  // Parties create-vendor form instead of selecting a party.
  const handleVendorDropdownChange = (value) => {
    if (value === '__new__') {
      setShowVendorForm(true);
      return;
    }
    if (!value) {
      clearSelectedVendor();
      return;
    }
    const ven = allVendors.find((v) => v.id === value);
    if (ven) handleSelectVendor(ven);
  };

  // Tax mode/GST-on-off must be respected the same way billing and invoices do — a rate marked INCLUSIVE already has its tax baked in.
  const taxInclusive = settings?.tax?.taxMode === 'INCLUSIVE';
  const gstEnabled = settings?.tax?.enableGst !== false;
  const computeLineTotal = ({ qty, rate, taxRate, discount }) => {
    const gross = (Number(qty) || 0) * (Number(rate) || 0);
    const taxAmt = taxInclusive ? 0 : (gross * (Number(taxRate) || 0)) / 100;
    return Math.max(0, Math.round((gross + taxAmt - (Number(discount) || 0)) * 100) / 100);
  };

  // Product selection
  const handleProductSelect = (index, prod) => {
    setItems((prev) => {
      const next = [...prev];
      const qty = Number(next[index]?.qty) || 1;
      const rate = prod.purchasePrice !== undefined && prod.purchasePrice !== '' ? Number(prod.purchasePrice) : Number(prod.price) || 0;
      const taxRate = gstEnabled ? Number(prod.taxRate || prod.gstRate) || 0 : 0;
      const discount = Number(next[index]?.discount) || 0;
      const total = computeLineTotal({ qty, rate, taxRate, discount });

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
        sellPriceManual: false,
        isCustom: !prod.id,
        // Only applies when the product itself is batch-tracked — the backend silently discards batch/expiry data otherwise.
        trackBatches: Boolean(prod.trackBatches),
        showBatch: Boolean(prod.trackBatches),
        batches: [
          {
            id: `b_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            batchNo: '',
            qty,
            mfgDate: '',
            expiryDate: '',
            sellPrice: prod.price ?? '',
            mrp: prod.mrp ?? ''
          }
        ],
        batchNo: '',
        mfgDate: '',
        expiryDate: '',
        sellPrice: prod.price ?? '',
        // Mirrors the batch guard above; every unit received needs its own serial row, so the drawer starts with exactly `qty` blanks.
        trackSerials: Boolean(prod.trackSerials),
        showSerial: Boolean(prod.trackSerials),
        serials: Boolean(prod.trackSerials)
          ? Array.from({ length: Math.max(1, Math.round(qty)) }, () => ({
              id: `sr_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
              serialNo: '',
              imei: ''
            }))
          : []
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
      // Whole-number units (pcs, box, dozen, ...) can't carry a fractional
      // received quantity — same rule Billing enforces on the way out.
      const cleanValue = field === 'qty' && isWholeNumberUnit(next[index]?.unit) ? String(value).replace(/\./g, '') : value;
      const updated = { ...next[index], [field]: cleanValue };
      const qty = Number(updated.qty) || 0;
      updated.total = computeLineTotal({ qty: updated.qty, rate: updated.rate, taxRate: updated.taxRate, discount: updated.discount });

      // Cost changed on a plain (non-batch) product: its selling price follows, keeping the same margin, until the
      // price is typed by hand. Saving the purchase writes this price to the product. Batch products price per batch.
      if (field === 'rate' && !updated.sellPriceManual && !updated.trackBatches && !updated.showBatch) {
        const prod = products.find((p) => p.id === updated.productId);
        const oldCost = Number(prod?.purchasePrice) || 0;
        const oldPrice = Number(prod?.price) || 0;
        const newCost = Number(cleanValue) || 0;
        // A line in another unit than the product's own isn't comparable to the stored cost.
        if (prod && oldCost > 0 && oldPrice > 0 && newCost > 0 && (!updated.unit || updated.unit === prod.unit)) {
          updated.sellPrice = r2Local((oldPrice * newCost) / oldCost);
          if (Array.isArray(updated.batches) && updated.batches.length === 1) {
            updated.batches = [{ ...updated.batches[0], sellPrice: updated.sellPrice }];
          }
        }
      }

      if (field === 'qty' && Array.isArray(updated.batches) && updated.batches.length === 1) {
        updated.batches = [{ ...updated.batches[0], qty }];
      }
      if (field === 'qty' && (updated.trackSerials || updated.showSerial)) {
        const wholeQty = Math.max(0, Math.round(qty));
        const curSerials = Array.isArray(updated.serials) ? updated.serials : [];
        if (wholeQty > curSerials.length) {
          updated.serials = [
            ...curSerials,
            ...Array.from({ length: wholeQty - curSerials.length }, () => ({
              id: `sr_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
              serialNo: '',
              imei: ''
            }))
          ];
        } else if (wholeQty < curSerials.length) {
          updated.serials = curSerials.slice(0, Math.max(wholeQty, 0));
        }
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
        sellPrice: curItem.sellPrice || '',
        mrp: curItem.batches?.[0]?.mrp ?? ''
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

  // Unlike batches, a serial row is always exactly 1 unit, so adding/removing a row moves qty in lockstep instead of its own qty field.
  const addSerialToLine = (lineIdx) => {
    setItems((prev) => {
      const next = [...prev];
      const curItem = next[lineIdx];
      const curSerials = Array.isArray(curItem.serials) ? curItem.serials : [];
      const updatedSerials = [
        ...curSerials,
        { id: `sr_${Date.now()}_${Math.floor(Math.random() * 1000000)}`, serialNo: '', imei: '' }
      ];
      const newQty = updatedSerials.length;
      const rate = Number(curItem.rate) || 0;
      const taxRate = Number(curItem.taxRate) || 0;
      const discount = Number(curItem.discount) || 0;
      const sub = newQty * rate;
      const taxAmt = (sub * taxRate) / 100;
      const total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);

      next[lineIdx] = {
        ...curItem,
        qty: newQty,
        total,
        trackSerials: true,
        showSerial: true,
        serials: updatedSerials
      };
      return next;
    });
  };

  const updateSerialInLine = (lineIdx, serialIdx, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const curItem = next[lineIdx];
      const curSerials = Array.isArray(curItem.serials) ? [...curItem.serials] : [];
      curSerials[serialIdx] = { ...curSerials[serialIdx], [field]: value };
      next[lineIdx] = { ...curItem, serials: curSerials, trackSerials: true };
      return next;
    });
  };

  const removeSerialFromLine = (lineIdx, serialIdx) => {
    setItems((prev) => {
      const next = [...prev];
      const curItem = next[lineIdx];
      const curSerials = (curItem.serials || []).filter((_, i) => i !== serialIdx);
      if (curSerials.length === 0) return next;

      const newQty = curSerials.length;
      const rate = Number(curItem.rate) || 0;
      const taxRate = Number(curItem.taxRate) || 0;
      const discount = Number(curItem.discount) || 0;
      const sub = newQty * rate;
      const taxAmt = (sub * taxRate) / 100;
      const total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);

      next[lineIdx] = {
        ...curItem,
        qty: newQty,
        total,
        serials: curSerials
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
      const taxRate = gstEnabled ? Number(item.taxRate) || 0 : 0;
      const disc = Number(item.discount) || 0;
      const gross = qty * rate;

      // A rate under an INCLUSIVE tax mode already contains its tax — extract the taxable value rather than adding tax again on top.
      const taxable = taxInclusive && taxRate > 0 ? gross / (1 + taxRate / 100) : gross;
      const lineTax = (taxable * taxRate) / 100;

      subtotal += taxable;
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
  }, [items, charges, isRoundOff, taxInclusive, gstEnabled]);

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
          const hasSerials = Boolean(l.trackSerials || l.showSerial) && Array.isArray(l.serials) && l.serials.length > 0;
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
            warehouseId: l.warehouseId || undefined,
            batches: hasBatch && batches.length > 0
              ? batches.map((b) => ({
                  batchNo: b.batchNo || '',
                  qty: Number(b.qty) || 0,
                  mfgDate: b.mfgDate || null,
                  expiryDate: b.expiryDate || null,
                  sellPrice: b.sellPrice !== undefined && b.sellPrice !== '' ? b.sellPrice : l.sellPrice,
                  mrp: b.mrp !== undefined && b.mrp !== '' ? Number(b.mrp) : undefined
                }))
              : undefined,
            mrp: hasBatch && batches[0]?.mrp !== undefined && batches[0]?.mrp !== '' ? Number(batches[0].mrp) : undefined,
            batchNo: batches[0]?.batchNo || (hasBatch ? l.batchNo || '' : undefined),
            mfgDate: batches[0]?.mfgDate || (hasBatch ? l.mfgDate || '' : undefined),
            expiryDate: batches[0]?.expiryDate || (hasBatch ? l.expiryDate || '' : undefined),
            sellPrice: batches[0]?.sellPrice || (hasBatch ? l.sellPrice || '' : undefined),
            serials: hasSerials
              ? l.serials.map((s) => ({ serialNo: s.serialNo || '', imei: s.imei || '' }))
              : undefined
          };
        }),
        additionalCharges: charges
          .filter((c) => Number(c.amount) > 0)
          .map((c) => ({ label: c.label || 'Other', amount: Number(c.amount) })),
        priceSheetUpdates: sheetUpdates
      };

      const res = await api.post('/purchases', payload);
      if (res.data?.accountingError) {
        showToast(`Purchase saved, but accounting note: ${res.data.accountingError}`, 'error');
      }
      if (Array.isArray(res.data?.batchNoWarnings) && res.data.batchNoWarnings.length) {
        res.data.batchNoWarnings.forEach((w) => showToast(w, 'error'));
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
        size="2xl"
        allowFullscreen={true}
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
              <Field label="Vendor *" className="md:col-span-2">
                {poContext ? (
                  <div className="p-1.5 px-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/50 flex items-center justify-between gap-2">
                    <div className="min-w-0 pr-1">
                      <div className="font-bold text-xs text-[color:var(--text-primary)] truncate">{vendorName}</div>
                      {vendorPhone && <div className="text-[10px] text-[color:var(--text-muted)] font-mono">{vendorPhone}</div>}
                    </div>
                  </div>
                ) : (
                  <Select
                    value={selectedVendorId}
                    onChange={(e) => handleVendorDropdownChange(e.target.value)}
                  >
                    <option value="">— Select a Vendor —</option>
                    <option value="__new__">+ Create New Vendor…</option>
                    {allVendors.map((v) => {
                      const out = Number(v.outstandingPayable || 0);
                      const adv = Number(v.advancePaid || 0);
                      const op = Number(v.openingBalance || 0);
                      const label = out > 0
                        ? `(Due: ${money(out)})`
                        : adv > 0
                        ? `(Advance Paid: ${money(adv)})`
                        : op > 0
                        ? `(All Dues Paid · Opening: ${money(op)})`
                        : '(All Dues Paid)';
                      return (
                        <option key={v.id} value={v.id}>
                          {v.name} {label}
                        </option>
                      );
                    })}
                  </Select>
                )}
              </Field>

              <Field label="Vendor Phone Number">
                <Input
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="Contact number"
                />
              </Field>

              {/* Vendor Info & Status Strip */}
              {(() => {
                const ven = allVendors.find((v) => v.id === selectedVendorId) || (poContext?.vendorId ? allVendors.find((v) => v.id === poContext.vendorId) : null);
                if (!ven) return null;
                const out = Number(ven.outstandingPayable || 0);
                const op = Number(ven.openingBalance || 0);
                const adv = Number(ven.advancePaid || 0);
                return (
                  <div className="md:col-span-3 -mt-1 p-2.5 px-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)]/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[color:var(--text-primary)] flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        {ven.name}
                      </span>
                      {op > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-[11px] font-semibold text-[color:var(--text-secondary)] border border-[color:var(--border-subtle)]" title="Initial 1-time opening balance recorded at vendor creation">
                          <span className="text-[color:var(--text-muted)]">Opening Balance:</span>
                          <span className="font-mono font-bold">{money(op)}</span>
                        </span>
                      )}
                      {ven.gstin && (
                        <span className="text-[11px] font-mono text-[color:var(--text-muted)]">
                          GSTIN: {ven.gstin}
                        </span>
                      )}
                    </div>
                    <div>
                      {out > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 font-mono">
                          <span>Current Outstanding Due:</span>
                          <span>{money(out)}</span>
                        </span>
                      ) : adv > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900/60 font-mono">
                          <span>Advance Credit Available:</span>
                          <span>{money(adv)}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>All Dues Paid in Full</span>
                        </span>
                      )}
                    </div>
                    {adv > 0 && (
                      <div className="md:col-span-3 w-full text-[10.5px] text-indigo-700/90 dark:text-indigo-300/80 flex items-center gap-1.5 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>
                          This advance is held on the vendor's own ledger account — it's netted automatically against whatever this purchase leaves unpaid, no separate step needed. Net payable after this purchase: {money(Math.max(0, totals.total - adv))}.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
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
                              products={products}
                              onSelectProduct={handleProductSelect}
                              onOpenNewProduct={(i) => setNewProductLineIndex(i)}
                              onUpdateName={(i, name) => handleItemChange(i, 'name', name)}
                              onSwitchToCustom={(i) => {
                                handleItemChange(i, 'isCustom', true);
                                handleItemChange(i, 'productId', '');
                              }}
                              onSwitchToCatalog={(i) => {
                                handleItemChange(i, 'isCustom', false);
                                handleItemChange(i, 'name', '');
                              }}
                            />
                            {/* Only shown once there's actually a choice to make — a single-warehouse
                                shop (the common case) never sees this, and every existing line still
                                defaults to the shop's default warehouse exactly as before. */}
                            {warehouses.length > 1 && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="text-[10px] text-[color:var(--text-muted)]">Receive into</span>
                                <select
                                  value={item.warehouseId || ''}
                                  onChange={(e) => handleItemChange(idx, 'warehouseId', e.target.value)}
                                  className="text-[10.5px] rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-1.5 py-0.5"
                                >
                                  <option value="">{warehouses.find((w) => w.isDefault)?.name || 'Default warehouse'}</option>
                                  {warehouses.filter((w) => !w.isDefault).map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {/* Batch entry is only ever offered for a product that's
                                already batch-tracked in the catalog — the backend
                                only creates batches when product.trackBatches is
                                true, so this can no longer be used to turn batching
                                on ad hoc for a normal product mid-purchase. To start
                                batching a product, mark it "Track by Batch" in
                                Inventory first. */}
                            {Boolean(product?.trackBatches) && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextVal = !(item.showBatch || item.trackBatches);
                                    handleItemChange(idx, 'showBatch', nextVal);
                                    if (nextVal && (!item.batches || item.batches.length === 0)) {
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
                                    : (item.showBatch || item.trackBatches ? 'Hide Batch Details' : 'Add Batch / Expiry')}
                                </button>
                              </div>
                            )}
                            {/* Serial entry is only ever offered for a product that's
                                already serial-tracked in the catalog — mirrors the
                                batch-entry guard above. A line built from a PO doesn't
                                pre-fill serial rows, so this is how those lines open
                                the drawer to enter them. */}
                            {Boolean(product?.trackSerials) && (
                              <div className="mt-1 flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextVal = !(item.showSerial || item.trackSerials);
                                    handleItemChange(idx, 'showSerial', nextVal);
                                    if (nextVal && (!item.serials || item.serials.length === 0)) {
                                      handleItemChange(
                                        idx,
                                        'serials',
                                        Array.from({ length: Math.max(1, Math.round(Number(item.qty) || 1)) }, () => ({
                                          id: `sr_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                                          serialNo: '',
                                          imei: ''
                                        }))
                                      );
                                    }
                                  }}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all inline-flex items-center gap-1 ${
                                    (item.serials && item.serials.length > 0)
                                      ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                                      : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 border-slate-200 dark:border-slate-800'
                                  }`}
                                >
                                  <Tag className="w-3 h-3 text-indigo-600" />
                                  {item.serials && item.serials.length > 0
                                    ? `${item.serials.length} Serial${item.serials.length === 1 ? '' : 's'}`
                                    : (item.showSerial || item.trackSerials ? 'Hide Serial Entry' : 'Add Serial Numbers')}
                                </button>
                              </div>
                            )}
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
                              step={isWholeNumberUnit(item.unit) ? '1' : 'any'}
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
                                  handleItemChange(idx, 'sellPriceManual', true);
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

                                      <Field label="MRP (₹)" hint="Printed on this lot" className="w-28">
                                        <Input
                                          type="number"
                                          step="any"
                                          value={batch.mrp ?? ''}
                                          onChange={(e) => updateBatchInLine(idx, bIdx, 'mrp', e.target.value)}
                                          placeholder="MRP"
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

                        {/* Serial Number Inward Drawer */}
                        {(item.trackSerials || item.showSerial) && (
                          <tr>
                            <td colSpan={10} className="!pt-0 !pb-3 bg-indigo-50/20 dark:bg-indigo-950/10">
                              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200/60 dark:border-indigo-800/40 pb-2">
                                  <div className="space-y-0.5">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                                      Serial Numbers Inward for {item.name || 'this item'} ({(item.serials || []).length} {(item.serials || []).length === 1 ? 'unit' : 'units'})
                                    </span>
                                    <div className="text-[10.5px] text-indigo-700/80 dark:text-indigo-400/80">
                                      Each unit needs its own serial — add or remove rows to match quantity received.
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => addSerialToLine(idx)}
                                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors flex items-center gap-1 shadow-xs"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>+ Add Another Serial</span>
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  {(item.serials && item.serials.length > 0 ? item.serials : [{ id: 'sr_0', serialNo: '', imei: '' }]).map((serial, sIdx) => (
                                    <div
                                      key={serial.id || sIdx}
                                      className="flex flex-wrap items-end gap-2.5 p-2.5 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 bg-white dark:bg-slate-900 shadow-xs"
                                    >
                                      <div className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-400 self-center px-1">
                                        Unit #{sIdx + 1}
                                      </div>

                                      <Field label="Serial No. / IMEI" className="min-w-[160px] flex-1">
                                        <Input
                                          value={serial.serialNo}
                                          onChange={(e) => updateSerialInLine(idx, sIdx, 'serialNo', e.target.value)}
                                          placeholder="Auto (1, 2, …) if blank"
                                          className="text-xs font-mono"
                                        />
                                      </Field>

                                      <Field label="IMEI (optional)" className="min-w-[140px] flex-1">
                                        <Input
                                          value={serial.imei}
                                          onChange={(e) => updateSerialInLine(idx, sIdx, 'imei', e.target.value)}
                                          placeholder="IMEI number"
                                          className="text-xs font-mono"
                                        />
                                      </Field>

                                      {(item.serials || []).length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => removeSerialFromLine(idx, sIdx)}
                                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors self-center mb-0.5"
                                          title="Remove this serial"
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

          {priceSheets.length > 0 && (
            <PriceSheetPanel
              sheets={priceSheets}
              sheetId={sheetId}
              onSheetChange={(id) => {
                setSheetId(id);
                if (id) setVisitedSheetIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
              }}
              products={products}
              items={items}
              edits={sheetEdits[sheetId] || {}}
              extra={sheetExtra[sheetId] || {}}
              onExtraEdit={(pid, field, value) =>
                setSheetExtra((prev) => ({
                  ...prev,
                  [sheetId]: { ...(prev[sheetId] || {}), [pid]: { ...((prev[sheetId] || {})[pid] || {}), [field]: value } }
                }))
              }
              onEdit={(pid, value) =>
                setSheetEdits((prev) => {
                  const mine = { ...(prev[sheetId] || {}) };
                  if (value === '') delete mine[pid];
                  else mine[pid] = value;
                  return { ...prev, [sheetId]: mine };
                })
              }
              showAll={showAllSheetItems}
              onShowAll={setShowAllSheetItems}
              editedSheetIds={editedSheetIds}
            />
          )}

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
              <div className="overflow-x-auto rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-surface)]">
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
              {paymentType === 'UNPAID' ? (
                <Button
                  type="button"
                  variant="primary"
                  loading={loading}
                  icon={Clock}
                  onClick={() => handleSaveWithStatus('UNPAID')}
                >
                  Record as Unpaid (Due)
                </Button>
              ) : paymentType === 'PARTIAL' ? (
                <Button
                  type="button"
                  variant="primary"
                  loading={loading}
                  icon={CreditCard}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => handleSaveWithStatus('PARTIALLY_PAID', initialPaidAmount)}
                >
                  Record Partial Payment ({money(Number(initialPaidAmount) || 0)})
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  loading={loading}
                  icon={CheckCircle2}
                  onClick={() => handleSaveWithStatus('PAID')}
                >
                  Save as Paid ({money(totals.total)})
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal>

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

      <PartyFormModal
        open={showVendorForm}
        isCustomer={false}
        editing={null}
        groups={[]}
        onClose={() => setShowVendorForm(false)}
        showToast={showToast}
        onSaved={(newVendor) => {
          setShowVendorForm(false);
          if (newVendor) {
            setAddedVendors((prev) => [newVendor, ...prev]);
            handleSelectVendor(newVendor);
          }
        }}
      />
    </>
  );
}

/* ------------------------------- Purchase Orders ------------------------------- */

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
  const [newProductLineIndex, setNewProductLineIndex] = useState(null);
  // showVendorForm opens the real "New Vendor" form from Parties when
  // "+ Create New Vendor…" is picked in the dropdown.
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [addedVendors, setAddedVendors] = useState([]);
  const allVendors = useMemo(() => [...addedVendors, ...vendors], [addedVendors, vendors]);

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
      setNewProductLineIndex(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelectVendor = (ven) => {
    setSelectedVendorId(ven.id);
    setVendorName(ven.name || '');
    setVendorPhone(ven.phone || '');
    setVendorGstin(ven.gstin || '');
    setVendorAddress(ven.address || '');
  };

  const clearSelectedVendor = () => {
    setSelectedVendorId('');
    setVendorName('');
    setVendorPhone('');
    setVendorGstin('');
    setVendorAddress('');
  };

  // Dropdown onChange — the last option ("__new__") opens the real
  // Parties create-vendor form instead of selecting a party.
  const handleVendorDropdownChange = (value) => {
    if (value === '__new__') {
      setShowVendorForm(true);
      return;
    }
    if (!value) {
      clearSelectedVendor();
      return;
    }
    const ven = allVendors.find((v) => v.id === value);
    if (ven) handleSelectVendor(ven);
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
      const cleanValue = field === 'qty' && isWholeNumberUnit(next[index]?.unit) ? String(value).replace(/\./g, '') : value;
      const updated = { ...next[index], [field]: cleanValue };
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
        size="2xl"
        allowFullscreen={true}
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
              <Field label="Vendor *" className="md:col-span-2">
                <Select
                  value={selectedVendorId}
                  onChange={(e) => handleVendorDropdownChange(e.target.value)}
                >
                  <option value="">— Select a Vendor —</option>
                  <option value="__new__">+ Create New Vendor…</option>
                  {allVendors.map((v) => {
                    const out = Number(v.outstandingPayable || 0);
                    const adv = Number(v.advancePaid || 0);
                    const op = Number(v.openingBalance || 0);
                    const label = out > 0
                      ? `(Due: ${money(out)})`
                      : adv > 0
                      ? `(Advance Paid: ${money(adv)})`
                      : op > 0
                      ? `(All Dues Paid · Opening: ${money(op)})`
                      : '(All Dues Paid)';
                    return (
                      <option key={v.id} value={v.id}>
                        {v.name} {label}
                      </option>
                    );
                  })}
                </Select>
              </Field>

              <Field label="Vendor Contact Phone">
                <Input
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="Contact phone number"
                />
              </Field>

              {/* Vendor Info & Status Strip */}
              {(() => {
                const ven = allVendors.find((v) => v.id === selectedVendorId);
                if (!ven) return null;
                const out = Number(ven.outstandingPayable || 0);
                const op = Number(ven.openingBalance || 0);
                const adv = Number(ven.advancePaid || 0);
                return (
                  <div className="md:col-span-3 -mt-1 p-2.5 px-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)]/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[color:var(--text-primary)] flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        {ven.name}
                      </span>
                      {op > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-[11px] font-semibold text-[color:var(--text-secondary)] border border-[color:var(--border-subtle)]" title="Initial 1-time opening balance recorded at vendor creation">
                          <span className="text-[color:var(--text-muted)]">Opening Balance:</span>
                          <span className="font-mono font-bold">{money(op)}</span>
                        </span>
                      )}
                      {ven.gstin && (
                        <span className="text-[11px] font-mono text-[color:var(--text-muted)]">
                          GSTIN: {ven.gstin}
                        </span>
                      )}
                    </div>
                    <div>
                      {out > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 font-mono">
                          <span>Current Outstanding Due:</span>
                          <span>{money(out)}</span>
                        </span>
                      ) : adv > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900/60 font-mono">
                          <span>Advance Credit Available:</span>
                          <span>{money(adv)}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>All Dues Paid in Full</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
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
                            products={products}
                            onSelectProduct={handleProductSelect}
                            onOpenNewProduct={(i) => setNewProductLineIndex(i)}
                            onUpdateName={(i, name) => handleLineChange(i, 'name', name)}
                            onSwitchToCustom={(i) => {
                              handleLineChange(i, 'isCustom', true);
                              handleLineChange(i, 'productId', '');
                            }}
                            onSwitchToCatalog={(i) => {
                              handleLineChange(i, 'isCustom', false);
                              handleLineChange(i, 'name', '');
                            }}
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
                            step={isWholeNumberUnit(line.unit) ? '1' : 'any'}
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

      <PartyFormModal
        open={showVendorForm}
        isCustomer={false}
        editing={null}
        groups={[]}
        onClose={() => setShowVendorForm(false)}
        showToast={showToast}
        onSaved={(newVendor) => {
          setShowVendorForm(false);
          if (newVendor) {
            setAddedVendors((prev) => [newVendor, ...prev]);
            handleSelectVendor(newVendor);
          }
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
            <Button variant="outline" icon={Printer} onClick={() => onDownload(po)}>
              Print / PDF
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

/* ------------------------------- Vendor Credits (Purchase Returns) ------------------------------- */

const RETURN_REASONS = ['Damaged', 'Wrong Item', 'Expired', 'Quality Issue', 'Price Adjustment', 'Other'];

function PurchaseReturnModal({ purchase, products = [], vendorCredits = [], showToast, onClose, onSaved }) {
  const [qtys, setQtys] = useState({});
  const [selectedSerials, setSelectedSerials] = useState({});
  const [reason, setReason] = useState('Damaged');
  const [customReason, setCustomReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (purchase) {
      setQtys({});
      setSelectedSerials({});
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

  // Serial-tracked lines return specific units: "returnable" is whichever serials from this line are still IN_STOCK.
  const lines = (purchase?.items || [])
    .map((line, idx) => {
      const key = `${line.productId}_${line.batchId || ''}_${idx}`;
      if (Array.isArray(line.serialIds) && line.serialIds.length > 0) {
        const product = products.find((p) => p.id === line.productId);
        const returnableSerials = (product?.serials || []).filter(
          (s) => line.serialIds.includes(s.id) && s.status === 'IN_STOCK'
        );
        return { ...line, key, isSerial: true, returnableSerials };
      }
      const credited = alreadyCredited(line.productId, line.batchId);
      const max = r2Local(Number(line.qty) - credited);
      return { ...line, key, credited, max };
    })
    .filter((l) => (l.isSerial ? l.returnableSerials.length > 0 : l.max > 0.009));

  const setQty = (key, v) => setQtys((q) => ({ ...q, [key]: v }));
  const toggleSerial = (key, serialId) => {
    setSelectedSerials((prev) => {
      const cur = new Set(prev[key] || []);
      if (cur.has(serialId)) cur.delete(serialId);
      else cur.add(serialId);
      return { ...prev, [key]: cur };
    });
  };

  const selected = lines.filter((l) => (l.isSerial ? (selectedSerials[l.key]?.size || 0) > 0 : Number(qtys[l.key]) > 0));
  const canSubmit =
    selected.length > 0 && selected.every((l) => (l.isSerial ? true : Number(qtys[l.key]) <= l.max + 0.009));

  const submit = async (e) => {
    e.preventDefault();
    if (saving || !canSubmit || !purchase) return;
    setSaving(true);
    try {
      const res = await api.post(`/purchases/${purchase.id}/return`, {
        items: selected.map((l) =>
          l.isSerial
            ? { productId: l.productId, serialIds: Array.from(selectedSerials[l.key] || []) }
            : { productId: l.productId, batchId: l.batchId || undefined, qty: Number(qtys[l.key]) }
        ),
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
            <div className="surface overflow-x-auto rounded-2xl">
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
                        {l.isSerial && <div className="text-[10px] text-[color:var(--text-muted)]">Serial-tracked</div>}
                      </td>
                      <td className="tabular text-right">
                        {l.isSerial ? l.serialIds.length : l.qty} {l.unit}
                      </td>
                      <td className="tabular text-right font-bold">
                        {l.isSerial ? l.returnableSerials.length : l.max} {l.unit}
                      </td>
                      <td>
                        {l.isSerial ? (
                          <div className="flex flex-wrap justify-end gap-1.5 max-w-[240px] ml-auto">
                            {l.returnableSerials.map((s) => {
                              const checked = selectedSerials[l.key]?.has(s.id);
                              return (
                                <label
                                  key={s.id}
                                  className={`text-[10.5px] font-mono font-bold px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                                    checked
                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={Boolean(checked)}
                                    onChange={() => toggleSerial(l.key, s.id)}
                                  />
                                  {s.serialNo}
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            max={l.max}
                            step="any"
                            value={qtys[l.key] || ''}
                            onChange={(e) => setQty(l.key, e.target.value)}
                            className="text-right"
                          />
                        )}
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

/** Printable Purchase Invoice/PO, rendered with id="printable-tax-invoice" to hook into the app's global print CSS. */
function PrintablePurchaseDocument({ target, tenant = {} }) {
  if (!target) return null;
  const isPO = target.type === 'po' || Boolean(target.poNumber);

  const docNumber = target.invoiceNo || target.poNumber || 'PURCHASE';
  const docDate = target.date ? fmtDate(target.date) : fmtDate(new Date());
  const vendorName = target.vendorName || target.vendor?.name || 'Vendor';
  const vendorGstin = target.vendorGstin || target.vendor?.gstin || '';
  const vendorPhone = target.vendorPhone || target.vendor?.phone || '';
  const vendorAddress = target.vendorAddress || target.vendor?.address || '';
  const items = target.items || [];
  const subtotal = Number(target.subtotal || 0);
  const tax = Number(target.tax || 0);
  const total = Number(target.totalAmount || target.total || (subtotal + tax));

  return (
    <div
      id="printable-tax-invoice"
      className="hidden print:block p-8 bg-white text-slate-900 font-sans text-xs leading-normal"
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            {tenant?.name || tenant?.legalName || 'Selsolve Retail'}
          </h1>
          {tenant?.address && <div className="text-slate-600 mt-1">{tenant.address}</div>}
          {(tenant?.city || tenant?.state || tenant?.pincode) && (
            <div className="text-slate-600">
              {[tenant.city, tenant.state, tenant.pincode].filter(Boolean).join(', ')}
            </div>
          )}
          {tenant?.gstin && (
            <div className="text-slate-700 font-semibold mt-0.5">GSTIN: {tenant.gstin}</div>
          )}
          {tenant?.phone && <div className="text-slate-600">Phone: {tenant.phone}</div>}
        </div>
        <div className="text-right">
          <div className="text-base font-black tracking-wider uppercase text-slate-800">
            {isPO ? 'Purchase Order' : 'Purchase Invoice'}
          </div>
          <div className="font-bold text-sm text-slate-900 mt-1">
            {isPO ? `PO #: ${docNumber}` : `Inv #: ${docNumber}`}
          </div>
          <div className="text-slate-600 mt-0.5">Date: {docDate}</div>
          {isPO && target.expectedDate && (
            <div className="text-slate-600">Expected: {fmtDate(target.expectedDate)}</div>
          )}
          {!isPO && target.dueDate && (
            <div className="text-slate-600">Due Date: {fmtDate(target.dueDate)}</div>
          )}
          {!isPO && target.voucherNo && (
            <div className="text-slate-600">Voucher: {target.voucherNo}</div>
          )}
          <div className="mt-1">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded border border-slate-300 uppercase">
              {isPO ? (target.status || 'ISSUED') : (target.paymentStatus || 'UNPAID')}
            </span>
          </div>
        </div>
      </div>

      {/* Vendor & Details */}
      <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Vendor / Supplier
          </div>
          <div className="font-bold text-sm text-slate-900">{vendorName}</div>
          {vendorAddress && <div className="text-slate-600 mt-0.5">{vendorAddress}</div>}
          {vendorGstin && <div className="text-slate-700 font-medium">GSTIN: {vendorGstin}</div>}
          {vendorPhone && <div className="text-slate-600">Phone: {vendorPhone}</div>}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Transaction Details
          </div>
          {!isPO && target.paymentMode && (
            <div className="text-slate-700">Payment Mode: <span className="font-semibold">{target.paymentMode}</span></div>
          )}
          {!isPO && target.receivedBy && (
            <div className="text-slate-700">Received By: <span className="font-semibold">{target.receivedBy}</span></div>
          )}
          {target.notes && (
            <div className="text-slate-600 italic mt-1 text-[11px]">"{target.notes}"</div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-slate-300 text-left mb-4">
        <thead>
          <tr className="bg-slate-100 text-slate-800 text-[11px] font-bold uppercase">
            <th className="border border-slate-300 px-2 py-1.5 text-center w-10">#</th>
            <th className="border border-slate-300 px-3 py-1.5">Item & Description</th>
            <th className="border border-slate-300 px-2 py-1.5 text-center w-20">HSN</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right w-20">Qty</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right w-24">Rate (₹)</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right w-20">Tax %</th>
            <th className="border border-slate-300 px-3 py-1.5 text-right w-28">Amount (₹)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((it, idx) => {
            const qty = Number(it.qty || it.quantity || 1);
            const rate = Number(it.rate || it.purchasePrice || 0);
            const taxRate = Number(it.taxRate || 0);
            const lineSubtotal = qty * rate;
            const lineTax = (lineSubtotal * taxRate) / 100;
            const lineTotal = Number(it.lineTotal || (lineSubtotal + lineTax));

            return (
              <tr key={idx} className="text-slate-800">
                <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                <td className="border border-slate-300 px-3 py-1.5">
                  <div className="font-semibold text-slate-900">{it.name || it.productName || 'Item'}</div>
                  {(it.batchNo || it.expiryDate || it.serialNumber) && (
                    <div className="text-[10px] text-slate-500 mt-0.5 space-x-2">
                      {it.batchNo && <span>Batch: {it.batchNo}</span>}
                      {it.expiryDate && <span>Exp: {it.expiryDate}</span>}
                      {it.serialNumber && <span>Serial: {it.serialNumber}</span>}
                    </div>
                  )}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{it.hsn || '—'}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right font-medium">{qty} {it.unit || 'pcs'}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{rate.toFixed(2)}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{taxRate > 0 ? `${taxRate}%` : '0%'}</td>
                <td className="border border-slate-300 px-3 py-1.5 text-right font-bold tabular-nums">{lineTotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals Summary */}
      <div className="flex justify-end mb-6">
        <div className="w-72 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-semibold text-slate-800 tabular-nums">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>GST / Tax:</span>
            <span className="font-semibold text-slate-800 tabular-nums">₹{tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-300 pt-1.5">
            <span>Total Amount:</span>
            <span className="tabular-nums">₹{total.toFixed(2)}</span>
          </div>
          {!isPO && target.paidAmount > 0 && (
            <div className="flex justify-between text-slate-600 pt-1">
              <span>Amount Paid:</span>
              <span className="font-medium text-emerald-700 tabular-nums">₹{Number(target.paidAmount).toFixed(2)}</span>
            </div>
          )}
          {!isPO && (Number(target.totalAmount || 0) - Number(target.paidAmount || 0)) > 0 && (
            <div className="flex justify-between text-rose-700 font-bold">
              <span>Balance Due:</span>
              <span className="tabular-nums">₹{(Number(target.totalAmount || 0) - Number(target.paidAmount || 0)).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Notes */}
      <div className="border-t border-slate-200 pt-4 text-[10px] text-slate-500 flex justify-between items-end">
        <div>
          <div>This is a computer-generated document from {tenant?.name || 'Selsolve Smart POS'}.</div>
          <div>Printed on: {new Date().toLocaleString('en-IN')}</div>
        </div>
        <div className="text-right">
          <div className="h-10"></div>
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}
