import React, { useEffect, useMemo, useState } from 'react';
import { Truck, Plus, Trash2, ClipboardList, Wallet, X, Search, Boxes } from 'lucide-react';

import api, { money, fmtDate, todayISO, monthStartISO } from '../lib/api';
import {
  Panel, SectionHeader, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, DateRange, StatTile, SegmentedControl, DataTable
} from '../lib/ui';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];

/**
 * Purchase (goods inward) register. Recording an invoice here receives stock,
 * refreshes each item's cost price, and posts Inventory + GST Input against
 * the vendor — so the "new purchase" flow is the heart of this screen.
 */
export default function PurchaseManager({ tenant, token, showToast }) {
  const [range, setRange] = useState({ from: monthStartISO(), to: todayISO() });
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [ledgerAccounts, setLedgerAccounts] = useState([]);
  const [report, setReport] = useState({ rows: [], byVendor: [], total: 0, totalTax: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('INVOICES');
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState(null);
  const [payVendorTarget, setPayVendorTarget] = useState(null);

  const loadPurchases = () => api.get('/purchases', { from: range.from, to: range.to }).then((d) => setPurchases(d || []));
  const loadVendors = () => api.get('/vendors').then((d) => setVendors(d || []));
  const loadProducts = () => api.get('/products').then((d) => setProducts(d || []));

  const load = async () => {
    setLoading(true);
    try {
      const [p, v, pr, tr, rep] = await Promise.all([
        api.get('/purchases', { from: range.from, to: range.to }),
        api.get('/vendors'),
        api.get('/products'),
        api.get('/accounts/transfers'),
        api.get('/reports/purchases', { from: range.from, to: range.to })
      ]);
      setPurchases(p || []);
      setVendors(v || []);
      setProducts(pr || []);
      setLedgerAccounts(tr?.accounts || []);
      setReport(rep || { rows: [], byVendor: [], total: 0, totalTax: 0 });
    } catch (err) {
      showToast(api.message(err, 'Could not load purchase data.'), 'error');
    } finally {
      setLoading(false);
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

  // api.get() unwraps to the raw array, so period totals are derived here
  // rather than read from a summary envelope.
  const summary = useMemo(() => {
    const count = purchases.length;
    const total = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const unpaid = purchases.reduce(
      (s, p) => s + (p.paymentStatus === 'PAID' ? 0 : (p.totalAmount || 0) - (p.paidAmount || 0)),
      0
    );
    return { count, total, unpaid };
  }, [purchases]);

  const byVendorTotals = useMemo(
    () => ({
      invoices: report.byVendor.reduce((s, v) => s + v.invoices, 0),
      total: report.byVendor.reduce((s, v) => s + v.total, 0),
      unpaid: report.byVendor.reduce((s, v) => s + v.unpaid, 0)
    }),
    [report.byVendor]
  );

  if (loading) return <Spinner label="Loading purchases…" />;

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Purchases" value={money(summary.total, { decimals: false })} sub="Selected period" icon={Truck} tone="accent" />
        <StatTile label="Invoices" value={summary.count} sub="Selected period" icon={ClipboardList} />
        <StatTile label="Unpaid" value={money(summary.unpaid, { decimals: false })} tone="warning" sub="Outstanding to vendors" />
        <StatTile label="GST Input Credit" value={money(report.totalTax, { decimals: false })} tone="success" sub="Reclaimable this period" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRange from={range.from} to={range.to} onChange={setRange} />
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: 'INVOICES', label: 'Invoices' },
            { value: 'BY VENDOR', label: 'By Vendor' }
          ]}
        />
      </div>

      {view === 'INVOICES' ? (
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
            }
          ]}
          rows={purchases}
          onRowClick={setDetail}
          empty={<EmptyState icon={Truck} title="No purchases in this period" hint="Record a purchase invoice to receive stock." />}
          footer={[
            '', '', '', '',
            money(purchases.reduce((s, p) => s + (p.subtotal || 0), 0)),
            money(purchases.reduce((s, p) => s + (p.tax || 0), 0)),
            money(purchases.reduce((s, p) => s + (p.totalAmount || 0), 0)),
            '', ''
          ]}
        />
      ) : (
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
          footer={['Total', money(byVendorTotals.invoices, { decimals: false }), money(byVendorTotals.total), money(byVendorTotals.unpaid)]}
        />
      )}

      <VendorPayablesPanel vendors={vendors} onPay={setPayVendorTarget} />

      <NewPurchaseModal
        open={showNew}
        onClose={() => setShowNew(false)}
        vendors={vendors}
        products={products}
        accounts={ledgerAccounts}
        showToast={showToast}
        onSaved={() => {
          setShowNew(false);
          loadPurchases();
          loadVendors();
          loadProducts();
        }}
      />

      <PurchaseDetailModal purchase={detail} onClose={() => setDetail(null)} onVoid={handleVoidPurchase} />

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
    </div>
  );
}

/**
 * Vendor Cash Payment — Module 6. Settling a supplier without leaving the
 * purchases screen; the money is applied to their oldest unpaid invoices
 * first, exactly as the backend does it.
 */
function VendorPayablesPanel({ vendors, onPay }) {
  const payable = vendors.filter((v) => v.outstandingPayable > 0).sort((a, b) => b.outstandingPayable - a.outstandingPayable);

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

function PurchaseDetailModal({ purchase, onClose, onVoid }) {
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
          <div className="grid grid-cols-3 gap-3">
            <Summary label="Payment status" value={<PaymentStatusBadge purchase={purchase} />} />
            <Summary label="Payment mode" value={purchase.paymentMode || '—'} />
            <Summary label="Received by" value={purchase.receivedBy || '—'} />
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
                render: (i) => <Money value={i.qty * i.rate * (1 + (i.taxRate || 0) / 100)} className="font-bold" />
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

          {purchase.notes && (
            <div className="text-[12px] text-[color:var(--text-secondary)]">
              <span className="label-eyebrow mr-1.5">Notes</span>
              {purchase.notes}
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

const blankLine = () => ({ productId: '', name: '', qty: '', rate: '', taxRate: 0, unit: 'pcs', hsn: '', isNew: false });

/** Search-as-you-type product picker for purchase line items — mirrors the Invoice section's product picker,
 * but surfaces purchase price / stock instead of sale price, since this is a goods-inward flow. */
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

function NewPurchaseModal({ open, onClose, vendors, products, accounts, showToast, onSaved }) {
  const blankForm = {
    vendorId: '', invoiceNo: '', date: todayISO(), paymentStatus: 'UNPAID',
    paymentMode: 'Cash', settlementAccountId: '', notes: ''
  };
  const [form, setForm] = useState(blankForm);
  const [lines, setLines] = useState([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [activePickerIndex, setActivePickerIndex] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(blankForm);
      setLines([blankLine()]);
      setActivePickerIndex(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const vendor = vendors.find((v) => v.id === form.vendorId);

  const setLine = (idx, patch) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx));

  const pickProduct = (idx, productId) => {
    if (productId === '__new__') {
      setLine(idx, { productId: '', name: '', rate: '', taxRate: 0, unit: 'pcs', hsn: '', isNew: true });
      return;
    }
    const p = products.find((pr) => pr.id === productId);
    setLines((ls) => {
      const next = ls.map((l, i) =>
        i === idx
          ? {
              ...l,
              productId,
              name: p?.name || '',
              rate: p?.purchasePrice ?? '',
              taxRate: p?.taxRate ?? 0,
              unit: p?.unit || 'pcs',
              hsn: p?.hsn || '',
              isNew: false
            }
          : l
      );

      const hasEmptyBelow = next.some((l, i) => i > idx && !l.productId && !l.name.trim());
      if (!hasEmptyBelow) {
        next.push(blankLine());
      }
      return next;
    });
  };

  const backToCatalog = (idx) => setLine(idx, { productId: '', name: '', rate: '', taxRate: 0, unit: 'pcs', hsn: '', isNew: false });

  const lineAmount = (l) => (Number(l.qty) || 0) * (Number(l.rate) || 0) * (1 + (Number(l.taxRate) || 0) / 100);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0), [lines]);
  const tax = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0) * ((Number(l.taxRate) || 0) / 100), 0),
    [lines]
  );
  const grandTotal = subtotal + tax;

  const lineIsValid = (l) => (l.productId || (l.isNew && l.name.trim())) && Number(l.qty) > 0;
  const canSubmit = Boolean(form.vendorId) && lines.some(lineIsValid);

  const submit = async (e) => {
    e.preventDefault();
    if (saving || !canSubmit) return;
    setSaving(true);
    try {
      const res = await api.post('/purchases', {
        vendorId: form.vendorId,
        vendorName: vendor?.name || '',
        invoiceNo: form.invoiceNo,
        items: lines
          .filter(lineIsValid)
          .map((l) => ({
            productId: l.productId || null,
            name: l.name,
            unit: l.unit || 'pcs',
            hsn: l.hsn || '',
            qty: Number(l.qty),
            rate: Number(l.rate) || 0,
            taxRate: Number(l.taxRate) || 0
          })),
        totalAmount: grandTotal,
        tax,
        paymentStatus: form.paymentStatus,
        paymentMode: form.paymentStatus === 'PAID' ? form.paymentMode : undefined,
        settlementAccountId: form.paymentStatus === 'PAID' ? form.settlementAccountId : undefined,
        notes: form.notes,
        date: form.date
      });
      showToast(res.message);
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not record the purchase.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title="New Purchase Invoice"
      subtitle="Receives stock and books Inventory + GST Input against the vendor."
      icon={Plus}
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!canSubmit}>
            Save Purchase
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Vendor" required className="lg:col-span-2">
            <Select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
              <option value="">— Select vendor —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — Payable {money(v.outstandingPayable)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Invoice no.">
            <Input value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} placeholder="Vendor's invoice no." />
          </Field>

          <Field label="Invoice date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>

          <Field label="Payment status">
            <Select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}>
              <option value="UNPAID">Unpaid</option>
              <option value="PAID">Paid</option>
            </Select>
          </Field>

          <Field label="Payment mode" hint={form.paymentStatus !== 'PAID' ? 'Only used when marked Paid' : undefined}>
            <Select
              value={form.paymentMode}
              disabled={form.paymentStatus !== 'PAID'}
              onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Paid from" required={form.paymentStatus === 'PAID'} hint={form.paymentStatus !== 'PAID' ? 'Only used when marked Paid' : undefined}>
            <Select
              value={form.settlementAccountId}
              disabled={form.paymentStatus !== 'PAID'}
              onChange={(e) => setForm({ ...form, settlementAccountId: e.target.value })}
            >
              <option value="">— Select account —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label-eyebrow">Line items</span>
            <Button type="button" size="sm" icon={Plus} onClick={addLine}>
              Add line
            </Button>
          </div>

          <div className="surface overflow-hidden rounded-2xl">
            <table className="ledger-table w-full border-collapse">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Product</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Qty</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Rate</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Tax %</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Amount</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td>
                      {line.isNew ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 space-y-1">
                            <Input
                              autoFocus
                              value={line.name}
                              onChange={(e) => setLine(idx, { name: e.target.value })}
                              placeholder="New product name"
                            />
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={line.unit}
                                onChange={(e) => setLine(idx, { unit: e.target.value })}
                                placeholder="Unit (pcs)"
                                className="w-20 text-xs"
                              />
                              <Input
                                value={line.hsn}
                                onChange={(e) => setLine(idx, { hsn: e.target.value })}
                                placeholder="HSN (optional)"
                                className="w-28 text-xs"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => backToCatalog(idx)}
                            title="Pick from catalogue instead"
                            className="rounded-lg p-1.5 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--bg-subtle)]"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActivePickerIndex(idx)}
                          className="field-input flex items-center justify-between gap-2 w-full text-left text-xs min-h-[36px]"
                        >
                          <span className="truncate">
                            {line.name || <span className="text-[color:var(--text-muted)]">— Select product —</span>}
                          </span>
                          <Search className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" />
                        </button>
                      )}
                    </td>
                    <td>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={line.qty}
                        onChange={(e) => setLine(idx, { qty: e.target.value })}
                        className="text-right"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.rate}
                        onChange={(e) => setLine(idx, { rate: e.target.value })}
                        className="text-right"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.taxRate}
                        onChange={(e) => setLine(idx, { taxRate: e.target.value })}
                        className="text-right"
                      />
                    </td>
                    <td className="tabular text-right font-bold text-[color:var(--text-primary)]">{money(lineAmount(line))}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        className="rounded-lg p-1.5 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--bg-subtle)] disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-6 rounded-xl px-4 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
          <Summary label="Taxable Value" value={money(subtotal)} />
          <Summary label="GST" value={money(tax)} />
          <Summary label="Grand Total" value={money(grandTotal)} bold />
        </div>

        <Field label="Notes">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional narration" />
        </Field>
      </form>
    </Modal>

    <PurchaseProductPickerModal
      open={activePickerIndex !== null}
      onClose={() => setActivePickerIndex(null)}
      products={products}
      onSelectProduct={(p) => {
        if (activePickerIndex !== null) pickProduct(activePickerIndex, p.id);
      }}
      onAddNew={() => {
        if (activePickerIndex !== null) pickProduct(activePickerIndex, '__new__');
      }}
    />
    </>
  );
}
