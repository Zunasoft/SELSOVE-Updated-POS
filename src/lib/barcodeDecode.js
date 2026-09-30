/**
 * Client-side mirror of the backend's weight-embedded barcode decoder
 * (SELSOLVE-updated-backend/modules/barcodeFormat.js — tryDecodeForProduct / decodeBarcodeFormat).
 * Lets the POS resolve a scan instantly without a network round trip; the backend's own
 * `validateBarcode` stays the authoritative fallback for anything this local copy doesn't recognize.
 *
 * The barcode field SHAPE (lengths/precision) is one store-wide setting now (Settings → Barcode),
 * not per-product — only each product's own id number (`embeddedId`) and W/P/custom flag letter
 * (`weightFlag`) are per-product.
 *
 * This logic has drifted from the backend's before (once over the check-digit field, once over
 * min/max bounds) — each time a silent, hard-to-spot bug rather than a loud one. Kept in its own
 * plain module (no React/JSX) specifically so scripts/test-barcode-format-sync.js can exercise it
 * head-to-head against the backend's real encoder on every change, instead of relying on someone
 * remembering to update both copies by hand.
 */

export const DEFAULT_BARCODE_FORMAT_FIELDS = [
  { type: 'id', length: 5 },
  { type: 'sku', enabled: false, length: 5 },
  { type: 'flag', length: 1 },
  { type: 'value', length: 5, precision: 3 },
  { type: 'pieces', length: 4 }
];

const WEIGHT_UNITS = ['kg', 'kgs', 'g', 'gm', 'gms', 'gram', 'grams', 'lb', 'lbs', 'ltr', 'litre', 'l', 'ml'];

/** W = sold by weight/volume, P = sold by piece — decided by the unit. Only a custom letter saved on the product overrides it. */
export function expectedFlag(product) {
  const saved = String(product?.weightFlag || '').toUpperCase();
  if (saved && saved !== 'W' && saved !== 'P') return saved;
  const unit = String(product?.unit || '').toLowerCase();
  if (!unit) return saved || 'W';
  return WEIGHT_UNITS.includes(unit) ? 'W' : 'P';
}

/**
 * Piece labels (flag P) read their count from the separate `pieces` field (a whole number), weight
 * labels from `value`. Stores saved before the split have no `pieces` row, so P falls back to `value`.
 */
function fieldsForLabelType(fields, isPiece) {
  const hasPieces = fields.some((f) => f.type === 'pieces' && (Number(f.length) || 0) > 0);
  if (isPiece && hasPieces) {
    return fields.filter((f) => f.type !== 'value').map((f) => (f.type === 'pieces' ? { type: 'value', length: f.length, precision: 0 } : f));
  }
  return fields.filter((f) => f.type !== 'pieces');
}

/**
 * One decode attempt against a fixed field layout. `fields` here carries exactly ONE identifier
 * type (`id` or `sku`) — the other was already dropped by the caller, since a real scan carries one
 * identifier segment, never both back to back. Also requires the whole code to be consumed (not
 * just each field to fit) — without that, a shorter layout tried against a longer code would
 * silently read a later field's digits as an earlier field's value instead of rejecting the code.
 */
function tryDecodeOnceLocal(fields, product, code, impliedQty = null) {
  let pos = 0;
  let hasIdentifier = false;
  let valueRaw = null;
  let precision = 0;

  for (const f of fields) {
    const len = Number(f.length) || 0;
    if (!len || pos + len > code.length) return null;
    const chunk = code.slice(pos, pos + len);
    pos += len;

    if (f.type === 'id') {
      hasIdentifier = true;
      // A label's id segment is the product's Product ID, or — for items that only have a plain
      // barcode — that barcode itself.
      const ids = [product?.embeddedId, product?.barcode, ...(product?.barcodes || [])]
        .filter(Boolean)
        .map((v) => String(v).padStart(len, '0'));
      if (!ids.includes(chunk)) return null;
    } else if (f.type === 'sku') {
      hasIdentifier = true;
      const expected = String(product?.sku || '').slice(-len).padStart(len, '0');
      if (!product?.sku || chunk !== expected) return null;
    } else if (f.type === 'flag') {
      const expected = expectedFlag(product);
      if (chunk.trim().toUpperCase() !== expected) return null;
    } else if (f.type === 'value') {
      valueRaw = chunk;
      precision = Number(f.precision) || 0;
    }
  }

  if (pos !== code.length) return null;
  // A piece label with no count digits at all means exactly 1 piece.
  if (valueRaw === null && impliedQty !== null) valueRaw = String(impliedQty);
  if (!hasIdentifier || valueRaw === null) return null;
  const raw = Number(valueRaw);
  if (!Number.isFinite(raw) || raw < 0) return null;
  // Piece labels are a whole count (000001 = 1 piece), whatever the store's weight precision is.
  if (expectedFlag(product) === 'P') precision = 0;
  return Math.round((raw / Math.pow(10, precision)) * 1000) / 1000;
}

/**
 * Mirrors the backend's tryDecodeForProduct() — the store's shared field shape plus this product's
 * own id/flag/sku. A scan identifies the product by its Product ID OR its SKU — never both in the
 * same code — so when the SKU field is enabled, this tries the Product-ID layout first and the SKU
 * layout second, each with the other identifier type dropped entirely.
 */
export function tryDecodeForProductLocal(storeFields, product, code) {
  const fields = fieldsForLabelType(Array.isArray(storeFields) && storeFields.length ? storeFields : DEFAULT_BARCODE_FORMAT_FIELDS, expectedFlag(product) === 'P');
  const hasIdField = fields.some((f) => f.type === 'id' && (Number(f.length) || 0) > 0);
  const hasSkuField = fields.some((f) => f.type === 'sku' && f.enabled !== false && (Number(f.length) || 0) > 0);

  const attempts = [];
  if (hasIdField) attempts.push(fields.filter((f) => f.type !== 'sku'));
  if (hasSkuField) attempts.push(fields.filter((f) => f.type !== 'id'));
  if (!attempts.length) attempts.push(fields.filter((f) => f.type !== 'sku'));

  // Piece items also accept the short form — identifier + flag with no count digits = 1 piece.
  const tries = attempts.map((v) => [v, null]);
  if (expectedFlag(product) === 'P') attempts.forEach((v) => tries.push([v.filter((f) => f.type !== 'value'), 1]));

  for (const [variant, implied] of tries) {
    const quantity = tryDecodeOnceLocal(variant, product, code, implied);
    if (quantity !== null) return quantity;
  }
  return null;
}

export const SCALE_UNIT_TO_KG = { kg: 1, kgs: 1, g: 0.001, gm: 0.001, gms: 0.001, gram: 0.001, grams: 0.001, lb: 0.45359237, lbs: 0.45359237 };

/** Mirrors the backend's decodeBarcodeFormat() — tries the store's shared format against every weighed product's own id/flag. */
export function decodeBarcodeFormatLocal(settings, code, products) {
  const storeFields = Array.isArray(settings?.barcodeFormat) && settings.barcodeFormat.length
    ? settings.barcodeFormat
    : DEFAULT_BARCODE_FORMAT_FIELDS;
  const candidates = (products || []).filter((p) => p.requiresWeight || p.embeddedId || p.sku || p.barcode);
  for (const product of candidates) {
    const quantity = tryDecodeForProductLocal(storeFields, product, code);
    if (quantity !== null) return { product, quantity };
  }
  return null;
}
