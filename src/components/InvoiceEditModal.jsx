import React, { useState, useEffect } from 'react';
import { Edit3, History, Save } from 'lucide-react';
import api, { fmtDateTime } from '../lib/api';
import { Modal, Field, Input, Textarea, Button } from '../lib/ui';

/**
 * Field groups for the "Edit Details" form on an already-issued sales
 * invoice/bill. Items, quantities, prices and totals are intentionally left
 * out — the backend rejects them outright for a non-draft order (see
 * LOCKED_FIELDS_ON_ISSUED in routes/sales.js). Correcting an amount means
 * Void or a Sales Return, not a silent edit here.
 */
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

/**
 * Same idea, mirrored for a received purchase invoice — vendor/header fields
 * only. See PURCHASE_LOCKED_FIELDS in routes/parties.js.
 */
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
    lockedNotice: 'Customer, notes and shipping details only. Items and amounts are locked — use Void or Sales Return for those.'
  },
  purchase: {
    fieldGroups: PURCHASE_FIELD_GROUPS,
    idField: 'id',
    endpoint: (id) => `/purchases/${id}`,
    displayNo: (doc) => doc.invoiceNo || `#${doc.id}`,
    lockedNotice: 'Vendor, notes and shipping details only. Items and amounts are locked — use Void or a Return instead.'
  }
};

function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // Local calendar date, not toISOString()'s UTC date — see src/lib/api.js localDateParts.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * "Edit Details" modal for a finalized sales invoice/bill or a received
 * purchase invoice — shared across InvoicesManager, POSTerminal and
 * PurchaseManager. Only header/party fields are editable; the backend
 * enforces the same restriction independently. Shows the document's own
 * edit history (who changed what, and when) underneath the form.
 */
export default function InvoiceEditModal({ invoice, kind = 'sale', onClose, onSaved, showToast }) {
  const config = KIND_CONFIG[kind] || KIND_CONFIG.sale;
  const fieldGroups = config.fieldGroups;
  const allFields = fieldGroups.flatMap((g) => g.fields);

  const [values, setValues] = useState({});
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
    setShowShipping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, kind]);

  if (!invoice) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put(config.endpoint(invoice[config.idField]), values);
      showToast?.(res.message, 'success');
      onSaved?.(res.data);
    } catch (err) {
      showToast?.(api.message(err, 'Failed to update details.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const history = Array.isArray(invoice.editHistory) ? invoice.editHistory : [];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit Details — ${config.displayNo(invoice)}`}
      subtitle={config.lockedNotice}
      icon={Edit3}
      size="lg"
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
      <div className="space-y-5">
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

        {history.length > 0 && (
          <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)]">
              <History className="h-3.5 w-3.5" /> Edit History
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)] p-2.5 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2 font-semibold text-[color:var(--text-primary)]">
                    <span>{entry.editedBy || 'Unknown'}</span>
                    <span className="font-normal text-[color:var(--text-muted)]">{fmtDateTime(entry.editedAt)}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {(entry.changes || []).map((c, idx) => (
                      <li key={idx} className="text-[color:var(--text-secondary)]">
                        <span className="font-semibold">{c.label}:</span>{' '}
                        <span className="text-rose-500 line-through">{c.oldValue || '—'}</span> →{' '}
                        <span className="text-emerald-600 dark:text-emerald-400">{c.newValue || '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
