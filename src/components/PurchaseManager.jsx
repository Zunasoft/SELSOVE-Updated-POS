import React, { useEffect, useMemo, useState } from 'react';
import { Truck, Plus, Trash2, ClipboardList } from 'lucide-react';

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

  const loadPurchases = () => api.get('/purchases', { from: range.from, to: range.to }).then((d) => setPurchases(d || []));
  const loadVendors = () => api.get('/vendors').then((d) => setVendors(d || []));

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

  // api.get() unwraps to the raw array, so period totals are derived here
  // rather than read from a summary envelope.
  const summary = useMemo(() => {
    const count = purchases.length;
    const total = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const unpaid = purchases.reduce((s, p) => s + (p.paymentStatus === 'PAID' ? 0 : p.totalAmount || 0), 0);
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
              width: 90,
              render: (p) => <Badge tone={p.paymentStatus === 'PAID' ? 'success' : 'warning'}>{p.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}</Badge>
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
        }}
      />

      <PurchaseDetailModal purchase={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function PurchaseDetailModal({ purchase, onClose }) {
  return (
    <Modal
      open={Boolean(purchase)}
      onClose={onClose}
      title={purchase ? `Invoice ${purchase.invoiceNo}` : ''}
      subtitle={purchase ? `${purchase.vendorName} · ${fmtDate(purchase.date)} · Voucher ${purchase.voucherNo}` : ''}
      icon={Truck}
      size="xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {purchase && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Summary label="Payment status" value={<Badge tone={purchase.paymentStatus === 'PAID' ? 'success' : 'warning'}>{purchase.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}</Badge>} />
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

const blankLine = () => ({ productId: '', name: '', qty: '', rate: '', taxRate: 0 });

function NewPurchaseModal({ open, onClose, vendors, products, accounts, showToast, onSaved }) {
  const blankForm = {
    vendorId: '', invoiceNo: '', date: todayISO(), paymentStatus: 'UNPAID',
    paymentMode: 'Cash', settlementAccountId: '', notes: ''
  };
  const [form, setForm] = useState(blankForm);
  const [lines, setLines] = useState([blankLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(blankForm);
      setLines([blankLine()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const vendor = vendors.find((v) => v.id === form.vendorId);

  const setLine = (idx, patch) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx));

  const pickProduct = (idx, productId) => {
    const p = products.find((pr) => pr.id === productId);
    setLine(idx, {
      productId,
      name: p?.name || '',
      rate: p?.purchasePrice ?? '',
      taxRate: p?.taxRate ?? 0
    });
  };

  const lineAmount = (l) => (Number(l.qty) || 0) * (Number(l.rate) || 0) * (1 + (Number(l.taxRate) || 0) / 100);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0), [lines]);
  const tax = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0) * ((Number(l.taxRate) || 0) / 100), 0),
    [lines]
  );
  const grandTotal = subtotal + tax;

  const canSubmit = Boolean(form.vendorId) && lines.some((l) => l.productId && Number(l.qty) > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await api.post('/purchases', {
        vendorId: form.vendorId,
        vendorName: vendor?.name || '',
        invoiceNo: form.invoiceNo,
        items: lines
          .filter((l) => l.productId && Number(l.qty) > 0)
          .map((l) => ({ productId: l.productId, name: l.name, qty: Number(l.qty), rate: Number(l.rate) || 0, taxRate: Number(l.taxRate) || 0 })),
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
                      <Select value={line.productId} onChange={(e) => pickProduct(idx, e.target.value)}>
                        <option value="">— Select product —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
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
  );
}
