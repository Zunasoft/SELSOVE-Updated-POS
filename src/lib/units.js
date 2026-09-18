/**
 * Units that count discrete, indivisible items — as opposed to weight/volume/
 * length units (kg, g, litre, ml, metre) which are naturally fractional.
 * "1.5 pcs" or "2.3 boxes" doesn't mean anything on a shop floor, so these
 * stay whole numbers everywhere a quantity is entered: Add Product stock,
 * purchase receiving lines, stock adjustments and billing.
 *
 * Mirrors WHOLE_NUMBER_UNITS in the backend's controllers/unitConversion.js —
 * keep the two lists in sync if a new unit is added to either.
 */
export const WHOLE_NUMBER_UNITS = new Set([
  'pcs', 'nos', 'pack', 'box', 'dozen', 'bundle', 'plate', 'set', 'pair', 'bag', 'carton'
]);

export function isWholeNumberUnit(unit) {
  return WHOLE_NUMBER_UNITS.has(String(unit || '').toLowerCase().trim());
}

/** Rounds a quantity to a whole number when it's denominated in a whole-number unit; decimal-friendly units pass through unchanged. */
export function enforceQtyPrecision(unit, qty) {
  const n = Number(qty) || 0;
  return isWholeNumberUnit(unit) ? Math.round(n) : n;
}
