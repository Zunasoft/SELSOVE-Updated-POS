// Discrete, indivisible units ("1.5 pcs" means nothing) — mirrors WHOLE_NUMBER_UNITS in the backend's controllers/unitConversion.js.
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
