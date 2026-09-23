import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Select } from '../lib/ui';
import { money } from '../lib/api';

/** Product cell: catalog picker, or a free-text row when switched to "Custom". Shared by every line-items table in the app. */
export function ProductItemCell({ row, index, products = [], onSelectProduct, onOpenNewProduct, onUpdateName, onSwitchToCustom, onSwitchToCatalog }) {
  const currentId = row.productId || row.id;
  const hasMatch = currentId ? products.some((p) => p.id === currentId) : false;
  // A row from an existing invoice whose product no longer matches the catalog (deleted product, or it was never a catalog item) would otherwise render an empty <select> — fall back to showing its stored name as text unless the user explicitly picks "Catalog" to replace it.
  const showAsText = row.isCustom === true || (row.isCustom === undefined && Boolean(row.name) && !hasMatch);

  if (showAsText) {
    return (
      <div className="flex items-center gap-1.5 w-full">
        <input
          type="text"
          className="field-input text-xs py-1.5 px-2.5 w-full rounded-xl font-medium"
          placeholder="Custom item / service name…"
          value={row.name || ''}
          onChange={(e) => onUpdateName(index, e.target.value)}
          autoFocus
          required
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
      value={row.productId || row.id || ''}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '__new__') return onOpenNewProduct?.(index);
        if (val === '__custom__') return onSwitchToCustom(index);
        const prod = products.find((p) => p.id === val);
        if (prod) onSelectProduct(index, prod);
      }}
    >
      <option value="">— Select Product —</option>
      {onOpenNewProduct && <option value="__new__">+ Create New Product…</option>}
      <option value="__custom__">+ Custom Item / Service…</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}{p.sku ? ` (SKU: ${p.sku})` : ''}
        </option>
      ))}
    </Select>
  );
}

const blankRow = (priceField) => ({
  id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  hsn: '',
  qty: 1,
  unit: 'pcs',
  [priceField]: 0,
  taxRate: 0,
  discount: 0,
  total: 0,
  isCustom: false
});

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Editable line-items table shared by invoice/purchase creation and editing.
 * `priceField` is 'price' for sales, 'rate' for purchases — the two schemas disagree on this one field name.
 * `showDiscount` hides the per-line discount column for purchases, which don't carry one.
 */
export default function LineItemsTable({
  items,
  onChange,
  products = [],
  onOpenNewProduct,
  priceField = 'price',
  showDiscount = true,
  hsnLabel = 'HSN/SAC',
  minRows = 1,
  taxInclusive = false,
  gstEnabled = true
}) {
  // A price under an INCLUSIVE tax mode already contains its tax — don't add tax again on top of it. Mirrors POS billing's and Create Invoice's tax math.
  const recompute = (item) => {
    const qty = Number(item.qty) || 0;
    const price = Number(item[priceField]) || 0;
    const taxRate = gstEnabled ? Number(item.taxRate) || 0 : 0;
    const discount = showDiscount ? Number(item.discount) || 0 : 0;
    const gross = qty * price;
    const taxAmt = taxInclusive ? 0 : (gross * taxRate) / 100;
    return round2(gross + taxAmt - discount);
  };

  const handleFieldChange = (index, field, value) => {
    const next = [...items];
    const item = { ...next[index], [field]: value };
    item.total = recompute(item);
    next[index] = item;
    onChange(next);
  };

  const handleSelectProduct = (index, product) => {
    const next = [...items];
    const item = {
      ...next[index],
      productId: product.id,
      id: product.id,
      name: product.name,
      hsn: product.hsn || '',
      unit: product.unit || product.saleUnit || 'pcs',
      [priceField]: Number(product.price ?? product.purchasePrice) || 0,
      taxRate: Number(product.taxRate) || 0,
      isCustom: false,
      qty: next[index].qty || 1
    };
    item.total = recompute(item);
    next[index] = item;
    if (index === next.length - 1) next.push(blankRow(priceField));
    onChange(next);
  };

  const addRow = () => onChange([...items, blankRow(priceField)]);
  const removeRow = (index) => {
    if (items.length <= minRows) return;
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
              <th className="p-2 w-8">#</th>
              <th className="p-2 min-w-[180px]">Product / Service</th>
              <th className="p-2 w-24">{hsnLabel}</th>
              <th className="p-2 w-20">Qty</th>
              <th className="p-2 w-20">Unit</th>
              <th className="p-2 w-24">{priceField === 'rate' ? 'Rate (₹)' : 'Price (₹)'}</th>
              <th className="p-2 w-20">GST %</th>
              {showDiscount && <th className="p-2 w-24">Disc (₹)</th>}
              <th className="p-2 w-28 text-right">Total (₹)</th>
              <th className="p-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id || idx} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-subtle, var(--border))' }}>
                <td className="p-2 text-[color:var(--text-muted)]">{idx + 1}</td>
                <td className="p-2">
                  <ProductItemCell
                    row={item}
                    index={idx}
                    products={products}
                    onSelectProduct={handleSelectProduct}
                    onOpenNewProduct={onOpenNewProduct}
                    onUpdateName={(i, name) => handleFieldChange(i, 'name', name)}
                    onSwitchToCustom={(i) => handleFieldChange(i, 'isCustom', true)}
                    onSwitchToCatalog={(i) => handleFieldChange(i, 'isCustom', false)}
                  />
                </td>
                <td className="p-2">
                  <input className="field-input text-xs py-1.5 px-2 w-full rounded-lg" value={item.hsn || ''} onChange={(e) => handleFieldChange(idx, 'hsn', e.target.value)} />
                </td>
                <td className="p-2">
                  <input type="number" className="field-input text-xs py-1.5 px-2 w-full rounded-lg tabular" value={item.qty} onChange={(e) => handleFieldChange(idx, 'qty', e.target.value)} />
                </td>
                <td className="p-2">
                  <input className="field-input text-xs py-1.5 px-2 w-full rounded-lg" value={item.unit || 'pcs'} onChange={(e) => handleFieldChange(idx, 'unit', e.target.value)} />
                </td>
                <td className="p-2">
                  <input type="number" className="field-input text-xs py-1.5 px-2 w-full rounded-lg tabular" value={item[priceField]} onChange={(e) => handleFieldChange(idx, priceField, e.target.value)} />
                </td>
                <td className="p-2">
                  <input type="number" className="field-input text-xs py-1.5 px-2 w-full rounded-lg tabular" value={item.taxRate} onChange={(e) => handleFieldChange(idx, 'taxRate', e.target.value)} />
                </td>
                {showDiscount && (
                  <td className="p-2">
                    <input type="number" className="field-input text-xs py-1.5 px-2 w-full rounded-lg tabular" value={item.discount || 0} onChange={(e) => handleFieldChange(idx, 'discount', e.target.value)} />
                  </td>
                )}
                <td className="p-2 text-right font-mono font-bold tabular">{money(item.total, { decimals: false })}</td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    disabled={items.length <= minRows}
                    className="text-rose-500 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> Add Blank Row
      </button>
    </div>
  );
}
