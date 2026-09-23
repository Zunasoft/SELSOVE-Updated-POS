import React, { useState, useEffect, useMemo } from 'react';
import { Edit3, History, Save, ArrowRight, Clock, ListChecks } from 'lucide-react';
import api, { fmtDateTime, money } from '../lib/api';
import { Modal, Field, Input, Textarea, Button, Badge, EmptyState } from '../lib/ui';
import LineItemsTable from './LineItemsTable';

const SALE_FIELD_GROUPS = [
  {
    title: 'Customer & Billing',
    fields: [
      { key: 'customerName', label: 'Customer Name' },
      { key: 'customerPhone', label: 'Phone' },
      { key: 'customerGstin', label: 'GSTIN' },
      { key: 'customerPan', label: 'PAN' },
      { key: 'customerAddress', label: 'Address', textarea: true },
      { key: 'customerState', label: 'State' },
      { key: 'customerStateCode', label: 'State Code' }
    ]
  },
  {
    title: 'Notes & Terms',
    fields: [
      { key: 'notes', label: 'Notes', textarea: true },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'paymentRef', label: 'Payment Reference' },
      { key: 'paymentTerms', label: 'Payment Terms' },
      { key: 'termsOfDelivery', label: 'Terms of Delivery' }
    ]
  },
  {
    title: 'Shipping & Dispatch Details',
    collapsible: true,
    fields: [
      { key: 'placeOfSupply', label: 'Place of Supply' },
      { key: 'vendorCode', label: 'Vendor Code' },
      { key: 'dispatchFrom', label: 'Dispatch From' },
      { key: 'dispatchDate', label: 'Dispatch Date', type: 'date' },
      { key: 'dispatchDocNo', label: 'Dispatch Doc No' },
      { key: 'shipToName', label: 'Ship To Name' },
      { key: 'shipToAddress', label: 'Ship To Address', textarea: true },
      { key: 'vehicleNo', label: 'Vehicle No' },
      { key: 'shipBy', label: 'Ship By' },
      { key: 'transporterName', label: 'Transporter Name' },
      { key: 'buyerRef', label: 'Buyer Reference' },
      { key: 'buyerRefDate', label: 'Buyer Reference Date', type: 'date' },
      { key: 'buyerOrderNo', label: 'Buyer Order No' },
      { key: 'buyerOrderDate', label: 'Buyer Order Date', type: 'date' }
    ]
  }
];

const PURCHASE_FIELD_GROUPS = [
  {
    title: 'Vendor & Billing',
    fields: [
      { key: 'vendorName', label: 'Vendor Name' },
      { key: 'vendorPhone', label: 'Phone' },
      { key: 'vendorGstin', label: 'GSTIN' },
      { key: 'vendorPan', label: 'PAN' },
      { key: 'vendorAddress', label: 'Address', textarea: true },
      { key: 'vendorState', label: 'State' },
      { key: 'vendorStateCode', label: 'State Code' },
      { key: 'invoiceNo', label: "Vendor's Invoice No" }
    ]
  },
  {
    title: 'Notes & Terms',
    fields: [
      { key: 'notes', label: 'Notes', textarea: true },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'paymentRef', label: 'Payment Reference' },
      { key: 'paymentTerms', label: 'Payment Terms' },
      { key: 'termsOfDelivery', label: 'Terms of Delivery' }
    ]
  },
  {
    title: 'Shipping & Dispatch Details',
    collapsible: true,
    fields: [
      { key: 'placeOfSupply', label: 'Place of Supply' },
      { key: 'dispatchFrom', label: 'Dispatch From' },
      { key: 'dispatchDate', label: 'Dispatch Date', type: 'date' },
      { key: 'dispatchDocNo', label: 'Dispatch Doc No' },
      { key: 'shipToName', label: 'Ship To Name' },
      { key: 'shipToAddress', label: 'Ship To Address', textarea: true },
      { key: 'vehicleNo', label: 'Vehicle No' },
      { key: 'shipBy', label: 'Ship By' },
      { key: 'transporterName', label: 'Transporter Name' },
      { key: 'buyerOrderNo', label: 'Buyer Order No' },
      { key: 'buyerOrderDate', label: 'Buyer Order Date', type: 'date' }
    ]
  }
];

const KIND_CONFIG = {
  sale: {
    fieldGroups: SALE_FIELD_GROUPS,
    idField: 'orderId',
    endpoint: (id) => `/orders/${id}`,
    displayNo: (doc) => `#${doc.orderId}`,
    priceField: 'price',
    showDiscount: true,
    totalField: 'total',
    subtitle: 'Every field is editable — including items, quantities and prices. Payment status/amount stay under Record Payment.'
  },
  purchase: {
    fieldGroups: PURCHASE_FIELD_GROUPS,
    idField: 'id',
    endpoint: (id) => `/purchases/${id}`,
    displayNo: (doc) => doc.invoiceNo || `#${doc.id}`,
    priceField: 'rate',
    showDiscount: false,
    totalField: 'totalAmount',
    subtitle: 'Every field is editable — including items, quantities and rates. Payment status/amount stay under vendor payments.'
  }
};

function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Full edit modal shared across InvoicesManager, POSTerminal and PurchaseManager — header/party fields, line items, and a Change History & Audit tab. */
export default function InvoiceEditModal({ invoice, kind = 'sale', products = [], settings, onClose, onSaved, showToast }) {
  const config = KIND_CONFIG[kind] || KIND_CONFIG.sale;
  const fieldGroups = config.fieldGroups;
  const allFields = fieldGroups.flatMap((g) => g.fields);
  const taxInclusive = settings?.tax?.taxMode === 'INCLUSIVE';
  const gstEnabled = settings?.tax?.enableGst !== false;

  const [activeTab, setActiveTab] = useState('edit');
  const [values, setValues] = useState({});
  const [items, setItems] = useState([]);
  const [itemsTouched, setItemsTouched] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [showShipping, setShowShipping] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    const next = {};
    allFields.forEach((f) => {
      const raw = invoice[f.key];
      next[f.key] = f.type === 'date' ? toDateInputValue(raw) : raw ?? '';
    });
    setValues(next);
    setItems(Array.isArray(invoice.items) ? invoice.items.map((it) => ({ ...it })) : []);
    setItemsTouched(false);
    setChangeReason('');
    setShowShipping(false);
    setActiveTab('edit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, kind]);

  const itemTotals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;
    items.forEach((it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it[config.priceField]) || 0;
      const taxRate = gstEnabled ? Number(it.taxRate) || 0 : 0;
      const gross = qty * price;
      // A price under an INCLUSIVE tax mode already contains its tax — extract the taxable value rather than adding tax again on top.
      const taxable = taxInclusive && taxRate > 0 ? gross / (1 + taxRate / 100) : gross;
      subtotal += taxable;
      tax += (taxable * taxRate) / 100;
      if (config.showDiscount) discount += Number(it.discount) || 0;
    });
    return {
      subtotal: round2(subtotal),
      tax: round2(tax),
      discount: round2(discount),
      total: round2(Math.max(0, subtotal + tax - discount))
    };
  }, [items, config.priceField, config.showDiscount, taxInclusive, gstEnabled]);

  if (!invoice) return null;

  const handleItemsChange = (next) => {
    setItems(next);
    setItemsTouched(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...values };
      if (itemsTouched) {
        payload.items = items;
        payload.subtotal = itemTotals.subtotal;
        payload.tax = itemTotals.tax;
        if (config.showDiscount) payload.discount = itemTotals.discount;
        payload[config.totalField] = itemTotals.total;
        if (changeReason.trim()) payload.changeReason = changeReason.trim();
      }
      const res = await api.put(config.endpoint(invoice[config.idField]), payload);
      showToast?.(res.message, 'success');
      onSaved?.(res.data);
    } catch (err) {
      showToast?.(api.message(err, 'Failed to update.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const history = Array.isArray(invoice.editHistory) ? invoice.editHistory : [];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${kind === 'purchase' ? 'Purchase' : 'Invoice'} — ${config.displayNo(invoice)}`}
      subtitle={config.subtitle}
      icon={Edit3}
      size="xl"
      allowFullscreen
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Save} loading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-1 rounded-xl bg-[color:var(--bg-subtle)] p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('edit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'edit' ? 'bg-indigo-600 text-white shadow-xs' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
          }`}
        >
          <ListChecks className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'history' ? 'bg-indigo-600 text-white shadow-xs' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
          }`}
        >
          <History className="h-3.5 w-3.5" /> Change History & Audit ({history.length})
        </button>
      </div>

      {activeTab === 'edit' ? (
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)]">
                Line Items
              </div>
              {itemsTouched && (
                <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400">
                  Editing this will reverse and re-post the ledger entry for this {kind === 'purchase' ? 'purchase' : 'invoice'}.
                </span>
              )}
            </div>
            <LineItemsTable
              items={items}
              onChange={handleItemsChange}
              products={products}
              priceField={config.priceField}
              showDiscount={config.showDiscount}
              taxInclusive={taxInclusive}
              gstEnabled={gstEnabled}
            />
            <div className="flex items-center justify-end gap-4 rounded-xl bg-[color:var(--bg-subtle)] px-4 py-2.5 text-xs font-semibold">
              <span>Subtotal: <span className="font-mono">{money(itemTotals.subtotal, { decimals: false })}</span></span>
              <span>Tax: <span className="font-mono">{money(itemTotals.tax, { decimals: false })}</span></span>
              {config.showDiscount && <span>Discount: <span className="font-mono">{money(itemTotals.discount, { decimals: false })}</span></span>}
              <span className="text-sm">Total: <span className="font-mono font-black">{money(itemTotals.total, { decimals: false })}</span></span>
            </div>
            {itemsTouched && (
              <Field label="Reason for this edit (optional)" hint="Shown in the Change History tab for audit purposes">
                <Input value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="e.g. Corrected quantity typo" />
              </Field>
            )}
          </div>

          {fieldGroups.map((group) => {
            if (group.collapsible && !showShipping) {
              return (
                <button
                  key={group.title}
                  type="button"
                  onClick={() => setShowShipping(true)}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + {group.title} (optional)
                </button>
              );
            }
            return (
              <div key={group.title} className="space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)]">
                  {group.title}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {group.fields.map((f) => (
                    <Field key={f.key} label={f.label} className={f.textarea ? 'sm:col-span-2' : ''}>
                      {f.textarea ? (
                        <Textarea
                          rows={2}
                          value={values[f.key] || ''}
                          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        />
                      ) : (
                        <Input
                          type={f.type || 'text'}
                          value={values[f.key] || ''}
                          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        />
                      )}
                    </Field>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[color:var(--text-primary)]">Edit Trail</span>
              <p className="text-[11px] text-[color:var(--text-muted)]">Every field and line-item change made after this record was created.</p>
            </div>
            <Badge tone="accent">
              <Clock className="w-3 h-3" /> {history.length} Event{history.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {history.length === 0 ? (
            <EmptyState icon={History} title="No Edits Yet" hint="Any future changes to this record will be tracked here." />
          ) : (
            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {history.map((h, i) => (
                <div key={h.id || i} className="rounded-xl p-3 border border-[color:var(--border)] bg-[color:var(--surface)] space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-xs flex-wrap gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[color:var(--text-primary)] font-mono text-[11.5px]">{fmtDateTime(h.editedAt)}</span>
                      <Badge tone="neutral">By: {h.editedBy || 'Unknown'}</Badge>
                    </div>
                    {h.reason && (
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                        {h.reason}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[color:var(--border-subtle)] text-xs">
                    {(h.changes || []).map((c, idx) => (
                      <div key={idx} className="flex flex-col gap-1 p-2 rounded-lg bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
                        <span className="text-[10.5px] font-bold text-[color:var(--text-secondary)] uppercase">{c.label}</span>
                        <div className="flex items-center gap-1.5 text-[11.5px] font-mono flex-wrap">
                          <span className="text-slate-400 line-through truncate max-w-[140px]">{String(c.oldValue ?? '—')}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[160px]">{String(c.newValue ?? '—')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
