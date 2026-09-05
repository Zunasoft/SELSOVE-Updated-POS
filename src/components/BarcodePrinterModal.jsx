import React, { useEffect, useState } from 'react';
import { Printer, Tag, Check, X, Sliders } from 'lucide-react';
import { Modal, Button, Field, Input, Select, Money } from '../lib/ui';
import { money } from '../lib/api';

/** Simple SVG Code 128 barcode pattern generator */
function BarcodeSVG({ value = '123456789012', height = 40 }) {
  const str = String(value || '000000000');
  // Simple deterministic pseudo-barcode pattern for preview and print
  const bars = [];
  let x = 10;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const w1 = (code % 3) + 1;
    const w2 = ((code * 2) % 3) + 1;
    const w3 = ((code * 3) % 3) + 1;

    bars.push(<rect key={`b1_${i}`} x={x} y="0" width={w1 * 1.5} height={height} fill="#000" />);
    x += w1 * 1.5 + w2 * 1.2;
    bars.push(<rect key={`b2_${i}`} x={x} y="0" width={w3 * 1.5} height={height} fill="#000" />);
    x += w3 * 1.5 + w1 * 1.2;
  }

  return (
    <svg viewBox={`0 0 ${Math.max(x + 10, 160)} ${height}`} className="w-full h-auto max-h-12 overflow-visible">
      {bars}
    </svg>
  );
}

export default function BarcodePrinterModal({ product, companyName, onClose, showToast }) {
  const storeName = companyName || 'Your Store';
  const [quantity, setQuantity] = useState(12);
  const [labelSize, setLabelSize] = useState('50x25');
  const [showCompany, setShowCompany] = useState(true);
  const [showRegionalName, setShowRegionalName] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [showBatchInfo, setShowBatchInfo] = useState(true);

  const allBarcodes = React.useMemo(() => {
    let list = [];
    if (Array.isArray(product?.barcodes) && product.barcodes.length > 0) {
      list = product.barcodes.map(String).map((b) => b.trim()).filter(Boolean);
    }
    if (product?.barcode && !list.includes(String(product.barcode).trim())) {
      list.unshift(String(product.barcode).trim());
    }
    return list.length ? list : [product?.barcode || '123456789'];
  }, [product]);

  const [selectedBarcode, setSelectedBarcode] = useState(product?.barcode || '');

  useEffect(() => {
    setSelectedBatchId('');
    setSelectedBarcode(product?.barcode || allBarcodes[0] || '');
  }, [product?.id, allBarcodes]);

  if (!product) return null;

  const activeBarcode = selectedBarcode || product.barcode || allBarcodes[0] || '123456789';
  const sellableBatches = product.trackBatches
    ? (product.batches || []).filter((b) => Number(b.qty) > 0)
    : [];
  const selectedBatch = sellableBatches.find((b) => b.id === selectedBatchId) || null;
  const labelPrice = selectedBatch?.sellPrice != null ? selectedBatch.sellPrice : product.price;

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) {
      showToast?.('Please allow popups to enable label printing.', 'error');
      return;
    }

    const labelsHTML = Array.from({ length: Number(quantity) || 1 })
      .map(
        (_, i) => `
        <div class="label-box size-${labelSize}">
          ${showCompany ? `<div class="company-name">${storeName}</div>` : ''}
          <div class="prod-name">${product.name}</div>
          ${showRegionalName && (product.regionalName || product.printName) ? `<div class="regional-name">${product.regionalName || product.printName}</div>` : ''}
          <div class="barcode-wrapper">
            <svg viewBox="0 0 160 40" class="barcode-svg">
              ${Array.from({ length: (activeBarcode || '123456').length })
                .map((_, idx) => {
                  const code = (activeBarcode || '123456').charCodeAt(idx);
                  const x = 10 + idx * 11;
                  return `<rect x="${x}" y="0" width="${(code % 3) + 1}" height="40" fill="#000" />
                          <rect x="${x + (code % 3) + 3}" y="0" width="${((code * 2) % 3) + 1}" height="40" fill="#000" />`;
                })
                .join('')}
            </svg>
          </div>
          <div class="barcode-num">${activeBarcode}</div>
          ${showBatchInfo && selectedBatch ? `<div class="batch-row">Batch: ${selectedBatch.batchNo}${selectedBatch.expiryDate ? ` · Exp: ${String(selectedBatch.expiryDate).slice(0, 10)}` : ''}</div>` : ''}
          <div class="price-row">
            ${showMrp && product.mrp ? `<span class="mrp">MRP: ₹${product.mrp}</span>` : ''}
            ${showPrice ? `<span class="sale-price">OUR PRICE: ₹${labelPrice}</span>` : ''}
          </div>
        </div>
      `
      )
      .join('');

    printWin.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Print Barcode Labels - ${product.name}</title>
  <style>
    * { box-sizing: border-box; margin:0; padding:0; }
    body { font-family: -apple-system, sans-serif; background:#fff; color:#000; padding:10px; }
    .grid { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-start; }
    .label-box {
      border: 1px dashed #ccc;
      padding: 4px 6px;
      text-align: center;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
    }
    .size-50x25 { width: 50mm; height: 25mm; }
    .size-40x20 { width: 40mm; height: 20mm; font-size: 8px; }
    .size-38x25 { width: 38mm; height: 25mm; }
    .company-name { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .prod-name { font-size: 10px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .regional-name { font-size: 9px; color: #333; }
    .barcode-wrapper { width: 85%; height: 22px; margin: 2px 0; }
    .barcode-svg { width: 100%; height: 100%; }
    .barcode-num { font-size: 9px; font-family: monospace; letter-spacing: 1px; }
    .batch-row { font-size: 7.5px; color: #444; margin-top: 1px; }
    .price-row { display: flex; justify-content: space-around; width: 100%; font-size: 9px; font-weight: bold; margin-top: 2px; }
    .mrp { text-decoration: line-through; color: #555; }
    .sale-price { color: #000; font-size: 10px; }
    @media print {
      body { padding: 0; }
      .label-box { border: none; }
      @page { margin: 2mm; }
    }
  </style>
</head>
<body>
  <div class="grid">${labelsHTML}</div>
  <script>
    window.onload = () => {
      setTimeout(() => { window.print(); window.close(); }, 300);
    };
  <\/script>
</body>
</html>`);
    printWin.document.close();
  };

  return (
    <Modal open={true} title="Print Barcode Labels" icon={Printer} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl p-3 bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)] flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-[color:var(--text-primary)]">{product.name}</h4>
            {(product.regionalName || product.printName) && (
              <p className="text-xs text-indigo-600 font-medium">{product.regionalName || product.printName}</p>
            )}
            <p className="text-xs text-[color:var(--text-muted)] font-mono mt-0.5">Barcode: {product.barcode}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-emerald-600">{money(labelPrice)}</div>
            {product.mrp && <div className="text-xs text-[color:var(--text-muted)] line-through">MRP: {money(product.mrp)}</div>}
          </div>
        </div>

        {allBarcodes.length > 1 && (
          <Field label="Select Barcode to Print" hint="This product has multiple barcodes configured">
            <Select value={activeBarcode} onChange={(e) => setSelectedBarcode(e.target.value)}>
              {allBarcodes.map((bc, idx) => (
                <option key={bc} value={bc}>
                  {bc} {bc === product.barcode ? '(Primary Barcode)' : `(Alternate Barcode #${idx})`}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {sellableBatches.length > 0 && (
          <Field label="Batch" hint="Prints this batch's number/expiry and uses its price override, if any">
            <Select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
              <option value="">No specific batch (product-level label)</option>
              {sellableBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchNo}{b.expiryDate ? ` — exp ${String(b.expiryDate).slice(0, 10)}` : ''}{b.sellPrice != null ? ` — ₹${b.sellPrice}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Label Quantity">
            <Input type="number" min="1" max="500" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Sticker Size">
            <Select value={labelSize} onChange={(e) => setLabelSize(e.target.value)}>
              <option value="50x25">50mm × 25mm (Standard)</option>
              <option value="40x20">40mm × 20mm (Compact)</option>
              <option value="38x25">38mm × 25mm (Jewelry)</option>
            </Select>
          </Field>
        </div>

        <div className="space-y-2 pt-2 border-t border-[color:var(--border-subtle)]">
          <label className="text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5" /> Label Display Options
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showCompany} onChange={(e) => setShowCompany(e.target.checked)} className="rounded text-indigo-600" />
              <span>Show Store Name</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showRegionalName} onChange={(e) => setShowRegionalName(e.target.checked)} className="rounded text-indigo-600" />
              <span>Show Regional Name</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showMrp} onChange={(e) => setShowMrp(e.target.checked)} className="rounded text-indigo-600" />
              <span>Show MRP</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="rounded text-indigo-600" />
              <span>Show Selling Price</span>
            </label>
            {selectedBatch && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showBatchInfo} onChange={(e) => setShowBatchInfo(e.target.checked)} className="rounded text-indigo-600" />
                <span>Show Batch No. / Expiry</span>
              </label>
            )}
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="border border-dashed border-[color:var(--border-strong)] rounded-xl p-4 bg-white flex flex-col items-center justify-center text-black space-y-1 max-w-xs mx-auto shadow-sm">
          {showCompany && <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{storeName}</div>}
          <div className="text-xs font-bold text-slate-900 truncate max-w-full">{product.name}</div>
          {showRegionalName && (product.regionalName || product.printName) && (
            <div className="text-[10px] text-indigo-700 font-medium">{product.regionalName || product.printName}</div>
          )}
          <div className="w-full py-1">
            <BarcodeSVG value={activeBarcode} />
          </div>
          <div className="text-[10px] font-mono tracking-widest text-slate-700">{activeBarcode}</div>
          {showBatchInfo && selectedBatch && (
            <div className="text-[9px] text-slate-500">
              Batch: {selectedBatch.batchNo}{selectedBatch.expiryDate ? ` · Exp: ${String(selectedBatch.expiryDate).slice(0, 10)}` : ''}
            </div>
          )}
          <div className="flex justify-between w-full text-[10px] font-bold pt-1 border-t border-slate-200">
            {showMrp && product.mrp && <span className="line-through text-slate-400">MRP: ₹{product.mrp}</span>}
            {showPrice && <span className="text-emerald-700">PRICE: ₹{labelPrice}</span>}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Printer} onClick={handlePrint}>
            Print {quantity} Label(s)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
