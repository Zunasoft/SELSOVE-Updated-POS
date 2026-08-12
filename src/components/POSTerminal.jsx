import React, { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, Printer, Scale, Barcode,
  QrCode, PauseCircle, X, Receipt, User, Lock, Unlock, ArrowDownToLine,
  ArrowUpFromLine, LayoutGrid, Star, RotateCcw, Wallet, CheckCircle2
} from 'lucide-react';

import api, { money, fmtDateTime, fmtDate } from '../lib/api';
import {
  Panel, Button, Modal, Field, Input, Select, Textarea, Badge, Money,
  Spinner, EmptyState, SegmentedControl, DataTable, StatTile
} from '../lib/ui';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Credit (Udhar)'];
const DISCOUNT_PRESETS = [0, 5, 10, 15, 20];

/**
 * The billing terminal — SOW Module 3.
 * Physical hardware is treated as a first-class input: the barcode scanner is a
 * keyboard wedge, so keystrokes are captured globally rather than requiring the
 * search box to hold focus, and weighed items pull a stable read from the scale.
 */
export default function POSTerminal({ tenant, showToast, settings: appSettings }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tables, setTables] = useState([]);
  const [settings, setSettings] = useState(appSettings);
  const [session, setSession] = useState(null);
  const [heldBills, setHeldBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [tableId, setTableId] = useState('');
  const [note, setNote] = useState('');

  const [weightModal, setWeightModal] = useState(null);
  const [weightInput, setWeightInput] = useState('1.000');
  const [scaleReading, setScaleReading] = useState(false);
  const [liveWeight, setLiveWeight] = useState(0);

  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [cashTendered, setCashTendered] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [receipt, setReceipt] = useState(null);
  const [showHeld, setShowHeld] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [showTables, setShowTables] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  const searchRef = useRef(null);
  const scanBuffer = useRef('');
  const scanTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/init');
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setCustomers(data.customers || []);
      setSession(data.session || null);
      setHeldBills(data.heldBills || []);
      setTables(data.tables || []);
      setSettings(data.settings || null);
    } catch (err) {
      showToast(api.message(err, 'Could not load the terminal.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------- cart maths ------------------------- */

  const customer = customers.find((c) => c.id === customerId) || null;
  const taxInclusive = settings?.tax?.taxMode === 'INCLUSIVE';
  const gstEnabled = settings?.tax?.enableGst !== false;

  const totals = useMemo(() => {
    const lineValue = (item) => item.qty * item.price;

    // For inclusive pricing the printed price already contains GST, so the
    // taxable value has to be extracted rather than added on top.
    const subtotal = cart.reduce((s, i) => {
      const gross = lineValue(i);
      return s + (taxInclusive && gstEnabled ? gross / (1 + (i.taxRate || 0) / 100) : gross);
    }, 0);

    const discountAmount = (subtotal * discountPercent) / 100;
    const discountFactor = subtotal > 0 ? 1 - discountAmount / subtotal : 1;

    const tax = !gstEnabled
      ? 0
      : cart.reduce((s, i) => {
          const gross = lineValue(i);
          const taxable = taxInclusive ? gross / (1 + (i.taxRate || 0) / 100) : gross;
          return s + (taxable * discountFactor * (i.taxRate || 0)) / 100;
        }, 0);

    const beforeRound = subtotal - discountAmount + tax;
    const grand = settings?.billing?.roundOff ? Math.round(beforeRound) : Math.round(beforeRound * 100) / 100;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      roundOff: Math.round((grand - beforeRound) * 100) / 100,
      grand
    };
  }, [cart, discountPercent, taxInclusive, gstEnabled, settings]);

  /* ------------------------- loyalty redemption -------------------------
   * Points are worth a fixed rupee value the shop sets. They come off the bill
   * before payment, so the tendered amount, the change and the receipt all
   * refer to what the customer actually hands over.
   */
  const loyalty = useMemo(() => {
    const pos = settings?.pos || {};
    const rate = Number(pos.loyaltyRedeemValue) || 0;
    const available = customer?.loyaltyPoints || 0;
    const minPoints = Number(pos.loyaltyMinRedeemPoints) || 0;

    // Never let points turn a bill into a refund.
    const maxByBill = rate > 0 ? Math.floor(totals.grand / rate) : 0;
    const maxPoints = Math.max(0, Math.min(available, maxByBill));

    const points = Math.min(Number(redeemPoints) || 0, maxPoints);
    return {
      enabled: pos.enableLoyalty !== false && rate > 0 && Boolean(customer),
      rate,
      available,
      minPoints,
      maxPoints,
      points,
      amount: Math.round(points * rate * 100) / 100,
      belowMinimum: available > 0 && available < minPoints
    };
  }, [settings, customer, totals.grand, redeemPoints]);

  const payable = Math.round((totals.grand - loyalty.amount) * 100) / 100;

  // Points reset whenever the bill or the customer changes — a stale redemption
  // against a different total is the one thing that must never happen here.
  useEffect(() => {
    setRedeemPoints(0);
  }, [customerId, cart.length]);

  const changeDue = Math.max(0, (parseFloat(cashTendered) || 0) - payable);

  /* ------------------------- adding items ------------------------- */

  const addToCart = useCallback(
    (product, qty = 1) => {
      if (product.requiresWeight && qty === 1) {
        setWeightModal(product);
        setWeightInput('1.000');
        return;
      }

      setCart((prev) => {
        const idx = prev.findIndex((i) => i.id === product.id);
        if (idx >= 0) {
          const next = [...prev];
          const merged = { ...next[idx], qty: Math.round((next[idx].qty + qty) * 1000) / 1000 };
          merged.total = Math.round(merged.qty * merged.price * 100) / 100;
          next[idx] = merged;
          return next;
        }
        return [...prev, { ...product, qty, total: Math.round(qty * product.price * 100) / 100 }];
      });
    },
    []
  );

  /**
   * Weight-embedded labels encode "21" + item digits + grams, so a scan of a
   * pre-packed weighed item adds the exact quantity without a scale prompt.
   */
  const resolveScan = useCallback(
    async (code) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      const prefix = settings?.hardware?.weighingScale?.embeddedBarcodePrefix || '21';

      if (trimmed.length >= 12 && trimmed.startsWith(prefix)) {
        const itemPart = trimmed.slice(prefix.length, prefix.length + 5);
        const grams = Number(trimmed.slice(prefix.length + 5, prefix.length + 10));
        const match = products.find(
          (p) => String(p.barcode).slice(-5) === itemPart || (p.barcodes || []).some((b) => String(b).slice(-5) === itemPart)
        );
        if (match && Number.isFinite(grams)) {
          addToCart(match, grams / 1000);
          showToast(`${match.name} — ${(grams / 1000).toFixed(3)} kg added from label.`);
          return;
        }
      }

      const local = products.find((p) => p.barcode === trimmed || (p.barcodes || []).includes(trimmed));
      if (local) {
        addToCart(local);
        showToast(`Scanned ${local.name}`);
        return;
      }

      // The server knows every barcode, including alternate-unit codes and any
      // weight-embedded layout this shop has configured.
      try {
        const decoded = await api.get(`/hardware/decode-barcode/${encodeURIComponent(trimmed)}`);
        addToCart(decoded.product, decoded.quantity || 1);
        showToast(
          decoded.embedded
            ? `${decoded.product.name} — ${Number(decoded.quantity).toFixed(3)} ${decoded.product.unit} from label.`
            : `Scanned ${decoded.product.name}`
        );
        return;
      } catch {
        /* fall through to the plain product lookup */
      }

      try {
        const found = await api.get(`/products/lookup/${encodeURIComponent(trimmed)}`);
        addToCart(found);
        showToast(`Scanned ${found.name}`);
      } catch {
        showToast(`No product matches barcode ${trimmed}`, 'error');
      }
    },
    [products, addToCart, showToast, settings]
  );

  // Global keyboard-wedge capture: a scanner types fast and ends with Enter.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (showCheckout || weightModal || showSession) return;

      const tag = document.activeElement?.tagName;
      const typingInField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Enter') {
        if (scanBuffer.current.length >= 6) {
          resolveScan(scanBuffer.current);
          scanBuffer.current = '';
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (typingInField) return;

      if (/^[0-9]$/.test(e.key)) {
        scanBuffer.current += e.key;
        clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => {
          scanBuffer.current = '';
        }, 250);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resolveScan, showCheckout, weightModal, showSession]);

  const readScale = async () => {
    setScaleReading(true);
    try {
      const res = await api.get('/hardware/weight');
      const grams = Number(res.weight) || 0;
      setLiveWeight(grams);
      setWeightInput(grams.toFixed(3));
      showToast(`Stable weight: ${grams.toFixed(3)} kg${res.simulated ? ' (simulated — scale not connected)' : ''}`);
    } catch (err) {
      showToast(api.message(err, 'Scale did not respond.'), 'error');
    } finally {
      setScaleReading(false);
    }
  };

  const confirmWeight = () => {
    const value = parseFloat(weightInput) || 0;
    if (value <= 0) {
      showToast('Enter a weight greater than zero.', 'error');
      return;
    }
    const product = weightModal;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        const qty = Math.round((next[idx].qty + value) * 1000) / 1000;
        next[idx] = { ...next[idx], qty, total: Math.round(qty * next[idx].price * 100) / 100 };
        return next;
      }
      return [...prev, { ...product, qty: value, total: Math.round(value * product.price * 100) / 100 }];
    });
    setWeightModal(null);
    showToast(`${value} ${product.unit} of ${product.name} added.`);
  };

  const updateQty = (id, delta) =>
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i;
          const step = 1;
          const qty = Math.round(Math.max(0, i.qty + delta * step) * 1000) / 1000;
          return { ...i, qty, total: Math.round(qty * i.price * 100) / 100 };
        })
        .filter((i) => i.qty > 0)
    );

  const setLinePrice = (id, price) =>
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, price: Number(price) || 0, total: Math.round(i.qty * (Number(price) || 0) * 100) / 100 } : i))
    );

  const setLineQty = (id, val) =>
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const newQty = val === '' ? '' : Number(val);
        const safeQty = Number(newQty) || 0;
        return { ...i, qty: newQty, total: Math.round(safeQty * i.price * 100) / 100 };
      })
    );

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setNote('');
    setTableId('');
  };

  /* ------------------------- bill actions ------------------------- */

  const holdBill = async () => {
    if (cart.length === 0) return;
    try {
      const res = await api.post('/bills/hold', {
        customerName: customer?.name || 'Walk-in Customer',
        customerId: customer?.id || null,
        items: cart,
        total: totals.grand,
        notes: note || 'Hold bill',
        tableId: tableId || null
      });
      showToast(res.message);
      clearCart();
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not hold the bill.'), 'error');
    }
  };

  const resumeBill = async (bill) => {
    setCart(bill.items);
    setCustomerId(bill.customerId || '');
    setTableId(bill.tableId || '');
    setNote(bill.notes || '');
    try {
      await api.del(`/bills/held/${bill.id}`);
      setShowHeld(false);
      load();
      showToast('Held bill resumed.');
    } catch (err) {
      showToast(api.message(err, 'Could not resume the bill.'), 'error');
    }
  };

  const maxDiscount = settings?.pos?.maxDiscountPercent ?? 100;

  const checkout = async () => {
    if (cart.length === 0) return;
    if (paymentMode === 'Credit (Udhar)' && !customer) {
      showToast('Select a customer for a credit sale.', 'error');
      return;
    }
    if (customer?.creditLimit > 0 && paymentMode === 'Credit (Udhar)') {
      const projected = (customer.outstanding || 0) + payable;
      if (projected > customer.creditLimit) {
        showToast(
          `Warning: ${customer.name} will exceed their ${money(customer.creditLimit)} credit limit (${money(projected)}).`,
          'error'
        );
      }
    }

    try {
      const res = await api.post('/orders', {
        customerId: customer?.id || null,
        customerName: customer?.name || 'Walk-in Customer',
        customerPhone: customer?.phone || null,
        paymentMethod: paymentMode,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discountAmount,
        total: totals.grand,
        redeemPoints: loyalty.points || 0,
        items: cart,
        tableId: tableId || null,
        notes: note
      });

      setReceipt(res.data);
      setShowCheckout(false);
      clearCart();
      setCashTendered('');
      setRedeemPoints(0);
      load();
      (res.warnings || []).forEach((w) => showToast(w, 'error'));
      showToast(res.message);

      if (settings?.billing?.printAfterCheckout) setTimeout(() => window.print(), 400);
    } catch (err) {
      showToast(api.message(err, 'Checkout failed.'), 'error');
    }
  };

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filtered = useMemo(() => {
    const needle = deferredSearchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.regionalName || p.printName || '').toLowerCase().includes(needle) ||
        p.id.toLowerCase().includes(needle) ||
        (p.barcodes || [p.barcode]).some((b) => String(b).includes(needle))
      );
    });
  }, [products, selectedCategory, deferredSearchQuery]);

  if (loading) return <Spinner label="Opening the billing terminal…" />;

  const sessionOpen = session?.status === 'open';

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
      {/* ----------------------------- Catalogue ----------------------------- */}
      <div className="space-y-3 lg:col-span-7">
        <Panel className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              ref={searchRef}
              className="field-input"
              style={{ paddingLeft: '2.1rem' }}
              placeholder="Scan barcode or search items… (F2)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length === 1) {
                  addToCart(filtered[0]);
                  setSearchQuery('');
                }
              }}
            />
          </div>

          <Badge tone={settings?.hardware?.barcodeScanner?.enabled !== false ? 'success' : 'neutral'}>
            <Barcode className="h-3 w-3" />
            Scanner {settings?.hardware?.barcodeScanner?.enabled !== false ? 'armed' : 'off'}
          </Badge>

          {/* Live weight display — the counter operator needs the scale reading
              visible without opening a dialog first. */}
          {settings?.hardware?.weighingScale?.enabled !== false && (
            <button
              type="button"
              onClick={readScale}
              title="Read the weighing scale"
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11.5px] font-bold transition-colors"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
            >
              <Scale className={`h-3.5 w-3.5 ${scaleReading ? 'animate-pulse text-amber-500' : 'text-[color:var(--accent)]'}`} />
              <span className="tabular text-[color:var(--text-primary)]">
                {scaleReading ? '— — —' : `${Number(liveWeight || 0).toFixed(3)} kg`}
              </span>
            </button>
          )}

          {settings?.pos?.enableTables && (
            <Button icon={LayoutGrid} onClick={() => setShowTables(true)}>
              {tableId ? tables.find((t) => t.id === tableId)?.name : 'Table'}
            </Button>
          )}

          <Button icon={Receipt} onClick={() => setShowRecent(true)}>
            Reprint
          </Button>

          <Button
            icon={sessionOpen ? Unlock : Lock}
            variant={sessionOpen ? 'subtle' : 'primary'}
            onClick={() => setShowSession(true)}
          >
            {sessionOpen ? money(session.currentCash, { decimals: false }) : 'Open Session'}
          </Button>
        </Panel>

        {!sessionOpen && (
          <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-[12px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Lock className="h-4 w-4" />
            The counter session is closed. Open a session to track cash for this shift.
          </div>
        )}

        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-all ${
              selectedCategory === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'surface text-[color:var(--text-secondary)]'
            }`}
          >
            All items ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'surface text-[color:var(--text-secondary)]'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.name}
                <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <Panel>
            <EmptyState title="No items match" hint="Clear the search or pick another category." />
          </Panel>
        ) : (
          <div className="grid max-h-[calc(100vh-19rem)] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4 pb-12">
            {filtered.slice(0, 150).map((p) => {
              const out = p.stock <= 0;
              return (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => addToCart(p)}
                  className="surface group flex flex-col justify-between rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="tabular truncate text-[9.5px] font-bold text-[color:var(--text-muted)]">
                        {p.barcode}
                      </span>
                      {p.requiresWeight && <Scale className="h-3 w-3 shrink-0 text-cyan-600 dark:text-cyan-400" />}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[12px] font-bold leading-snug text-[color:var(--text-primary)] group-hover:text-[color:var(--accent)]">
                      {p.name}
                    </div>
                    {p.printName && (
                      <div className="truncate text-[10px] text-[color:var(--text-muted)]">{p.printName}</div>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-end justify-between gap-1 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                    <Money value={p.price} decimals={false} className="text-[14px] font-bold" />
                    <span
                      className={`tabular rounded-md px-1.5 py-0.5 text-[9.5px] font-bold ${
                        out
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : Number(p.stock) <= Number(p.minStock ?? 5)
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'text-[color:var(--text-muted)]'
                      }`}
                      style={!out && Number(p.stock) > Number(p.minStock ?? 5) ? { background: 'var(--bg-subtle)' } : undefined}
                    >
                      {p.stock} {p.unit}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------- Cart ------------------------------- */}
      <div className="lg:sticky lg:top-20 lg:col-span-5">
        <Panel className="space-y-3">
          <div className="flex items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-[color:var(--accent)]" />
              <span className="text-[13px] font-bold text-[color:var(--text-primary)]">Current Bill</span>
              {cart.length > 0 && <Badge tone="accent">{cart.length} items</Badge>}
            </div>
            <div className="flex items-center gap-1.5">
              {heldBills.length > 0 && (
                <Button size="sm" icon={PauseCircle} onClick={() => setShowHeld(true)}>
                  {heldBills.length}
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={clearCart} disabled={cart.length === 0}>
                Clear
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Customer">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.outstanding > 0 ? `· due ${money(c.outstanding, { decimals: false })}` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={`Discount % (max ${maxDiscount}%)`}>
              <Select
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Math.min(maxDiscount, Number(e.target.value)))}
              >
                {DISCOUNT_PRESETS.filter((d) => d <= maxDiscount).map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? 'No discount' : `${d}% off`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {customer && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-[11px]" style={{ background: 'var(--bg-subtle)' }}>
              <User className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />
              <span className="font-semibold text-[color:var(--text-primary)]">{customer.phone || 'No phone'}</span>
              <Badge tone="accent">
                <Star className="h-2.5 w-2.5" />
                {customer.loyaltyPoints || 0} pts
              </Badge>
              {customer.outstanding > 0 && <Badge tone="warning">Due {money(customer.outstanding, { decimals: false })}</Badge>}
            </div>
          )}

          <div className="max-h-[34vh] space-y-1.5 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Cart is empty"
                hint="Scan a barcode or tap an item to start billing."
              />
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-bold text-[color:var(--text-primary)]">{item.name}</div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => setLinePrice(item.id, e.target.value)}
                        className="tabular w-16 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-[10.5px] text-[color:var(--text-muted)]">×</span>
                      <input
                        type="number"
                        step="1"
                        value={item.qty}
                        onChange={(e) => setLineQty(item.id, e.target.value)}
                        className="tabular w-12 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-center"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                      <span className="tabular text-[10.5px] text-[color:var(--text-muted)]">
                        {item.unit}
                        {item.taxRate ? ` · GST ${item.taxRate}%` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="rounded-md p-1 text-[color:var(--text-secondary)]"
                      style={{ background: 'var(--surface)' }}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="rounded-md p-1 text-[color:var(--text-secondary)]"
                      style={{ background: 'var(--surface)' }}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <Money value={item.total} decimals={false} className="w-16 text-right text-[12.5px] font-bold" />
                    <button onClick={() => setCart(cart.filter((i) => i.id !== item.id))} className="p-1 text-rose-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-1 border-t pt-2.5 text-[12px]" style={{ borderColor: 'var(--border)' }}>
            <Row label={`Subtotal${taxInclusive ? ' (tax extracted)' : ''}`} value={totals.subtotal} />
            {totals.discountAmount > 0 && (
              <Row label={`Discount (${discountPercent}%)`} value={-totals.discountAmount} tone="success" />
            )}
            {gstEnabled && <Row label="GST" value={totals.tax} />}
            {totals.roundOff !== 0 && <Row label="Round off" value={totals.roundOff} />}
            <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[13px] font-bold text-[color:var(--text-primary)]">Grand Total</span>
              <Money value={totals.grand} className="text-[20px] font-bold text-[color:var(--accent)]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button icon={PauseCircle} onClick={holdBill} disabled={cart.length === 0}>
              Hold Bill
            </Button>
            <Button variant="primary" size="lg" onClick={() => setShowCheckout(true)} disabled={cart.length === 0}>
              Checkout
            </Button>
          </div>
        </Panel>
      </div>

      {/* ----------------------------- Modals ----------------------------- */}

      <Modal
        open={Boolean(weightModal)}
        onClose={() => setWeightModal(null)}
        title={weightModal ? `Weigh — ${weightModal.name}` : ''}
        subtitle={weightModal ? `${money(weightModal.price)} per ${weightModal.unit}` : ''}
        icon={Scale}
        size="sm"
        footer={
          <>
            <Button onClick={() => setWeightModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={confirmWeight}>
              Add to Bill
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Button icon={Scale} onClick={readScale} loading={scaleReading} className="w-full" variant="outline">
            Read from weighing scale
          </Button>

          <Field label={`Weight (${weightModal?.unit || 'kg'})`}>
            <Input
              type="number"
              step="0.001"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="tabular text-center text-[24px] font-bold"
              autoFocus
            />
          </Field>

          <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
            <span className="text-[11.5px] font-bold text-[color:var(--text-secondary)]">Line amount</span>
            <Money value={(parseFloat(weightInput) || 0) * (weightModal?.price || 0)} className="text-[17px] font-bold" />
          </div>
        </div>
      </Modal>

      <Modal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        title={`Collect ${money(payable)}`}
        subtitle={customer ? `From ${customer.name}` : 'Walk-in customer'}
        icon={Wallet}
        size="md"
        footer={
          <>
            <Button onClick={() => setShowCheckout(false)}>Cancel</Button>
            <Button variant="success" icon={CheckCircle2} onClick={checkout}>
              Confirm Payment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {loyalty.enabled && loyalty.available > 0 && (
            <div
              className="space-y-2 rounded-xl px-3 py-2.5"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[color:var(--text-secondary)]">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  Loyalty points
                </span>
                <Badge tone="accent">{loyalty.available} pts available</Badge>
              </div>

              {loyalty.belowMinimum ? (
                <div className="text-[10.5px] font-semibold text-[color:var(--text-muted)]">
                  {loyalty.minPoints} points are needed before they can be redeemed.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max={loyalty.maxPoints}
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(Math.max(0, Math.min(loyalty.maxPoints, Number(e.target.value) || 0)))}
                      className="tabular w-24 text-center font-bold"
                    />
                    <Button size="sm" onClick={() => setRedeemPoints(loyalty.maxPoints)} disabled={loyalty.maxPoints === 0}>
                      Use max
                    </Button>
                    {redeemPoints > 0 && (
                      <Button size="sm" onClick={() => setRedeemPoints(0)}>
                        Clear
                      </Button>
                    )}
                    <span className="ml-auto text-[10.5px] font-semibold text-[color:var(--text-muted)]">
                      1 pt = {money(loyalty.rate)}
                    </span>
                  </div>

                  {loyalty.amount > 0 && (
                    <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[11.5px] font-semibold text-[color:var(--text-secondary)]">
                        {loyalty.points} pts redeemed
                      </span>
                      <span className="tabular text-[12.5px] font-bold text-emerald-600 dark:text-emerald-400">
                        −{money(loyalty.amount)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {loyalty.amount > 0 && (
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
              <div className="text-[11.5px] font-semibold text-[color:var(--text-secondary)]">
                Bill {money(totals.grand)} − points {money(loyalty.amount)}
              </div>
              <Money value={payable} className="text-[18px] font-bold text-[color:var(--accent)]" />
            </div>
          )}

          <Field label="Payment mode">
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`rounded-xl border px-3 py-2.5 text-[12px] font-bold transition-all ${
                    paymentMode === mode
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                      : 'text-[color:var(--text-secondary)]'
                  }`}
                  style={paymentMode === mode ? undefined : { background: 'var(--bg-subtle)', borderColor: 'var(--border)' }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </Field>

          {paymentMode === 'Cash' && (
            <>
              <Field label="Cash tendered">
                <Input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={String(payable)}
                  className="tabular text-[19px] font-bold"
                  autoFocus
                />
              </Field>
              <div className="flex gap-1.5">
                {[payable, ...(settings?.pos?.quickAmountPills || [500, 1000, 2000])].map((amount, i) => (
                  <Button key={i} size="sm" onClick={() => setCashTendered(String(amount))}>
                    {money(amount, { decimals: false })}
                  </Button>
                ))}
              </div>
              {parseFloat(cashTendered) > payable && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/40">
                  <span className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300">Change due</span>
                  <Money value={changeDue} className="text-[19px] font-bold text-emerald-700 dark:text-emerald-300" />
                </div>
              )}
            </>
          )}

          {paymentMode === 'UPI' && (
            <div className="rounded-2xl px-4 py-5 text-center" style={{ background: 'var(--bg-subtle)' }}>
              <QrCode className="mx-auto h-16 w-16 text-[color:var(--accent)]" />
              <div className="tabular mt-2 text-[13px] font-bold text-[color:var(--text-primary)]">
                Scan to pay {money(payable)}
              </div>
              <div className="text-[10.5px] text-[color:var(--text-muted)]">
                {settings?.company?.name} · confirm once the customer's app shows success
              </div>
            </div>
          )}

          {paymentMode === 'Credit (Udhar)' && (
            <div
              className={`rounded-xl px-3 py-2.5 text-[12px] font-semibold ${
                customer
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              {customer
                ? `${customer.name}'s balance will rise from ${money(customer.outstanding || 0)} to ${money((customer.outstanding || 0) + payable)}.`
                : 'Select a customer above — a credit sale needs a named party.'}
            </div>
          )}

          <Field label="Bill note">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note printed on the bill" />
          </Field>
        </div>
      </Modal>

      <ReceiptModal
        receipt={receipt}
        settings={settings}
        tenant={tenant}
        onClose={() => setReceipt(null)}
      />

      <Modal open={showHeld} onClose={() => setShowHeld(false)} title={`Held Bills (${heldBills.length})`} icon={PauseCircle} size="lg">
        {heldBills.length === 0 ? (
          <EmptyState title="No held bills" />
        ) : (
          <div className="space-y-2">
            {heldBills.map((bill) => (
              <div
                key={bill.id}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'var(--bg-subtle)' }}
              >
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-bold text-[color:var(--text-primary)]">{bill.customerName}</div>
                  <div className="text-[10.5px] text-[color:var(--text-muted)]">
                    {bill.items.length} items · {fmtDateTime(bill.heldAt)} · {bill.heldBy}
                    {bill.tableId ? ` · ${tables.find((t) => t.id === bill.tableId)?.name || 'Table'}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Money value={bill.total} className="font-bold" />
                  <Button size="sm" variant="primary" onClick={() => resumeBill(bill)}>
                    Resume
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <SessionModal
        open={showSession}
        session={session}
        onClose={() => setShowSession(false)}
        showToast={showToast}
        onChanged={load}
      />

      <TablesModal
        open={showTables}
        tables={tables}
        selectedId={tableId}
        onSelect={(id) => {
          setTableId(id);
          setShowTables(false);
        }}
        onClose={() => setShowTables(false)}
        showToast={showToast}
        onChanged={load}
      />

      <RecentBillsModal open={showRecent} onClose={() => setShowRecent(false)} onReprint={setReceipt} showToast={showToast} />
    </div>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--text-secondary)]">{label}</span>
      <Money
        value={value}
        className={tone === 'success' ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold'}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Receipt
 * ------------------------------------------------------------------ */

function ReceiptModal({ receipt, settings, tenant, onClose }) {
  if (!receipt) return null;
  const company = receipt.company || settings?.company || { name: tenant?.name };
  const billing = receipt.billing || settings?.billing || {};
  const showGst = billing.showGstBreakup !== false;

  // GST is grouped by rate so the printed bill shows a compliant slab summary.
  const gstSlabs = {};
  (receipt.items || []).forEach((item) => {
    const rate = item.taxRate || 0;
    if (!rate) return;
    if (!gstSlabs[rate]) gstSlabs[rate] = { taxable: 0, tax: 0 };
    gstSlabs[rate].taxable += item.total;
    gstSlabs[rate].tax += (item.total * rate) / 100;
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Invoice ${receipt.orderId}`}
      subtitle={receipt.voucherNo ? `Accounting voucher ${receipt.voucherNo}` : undefined}
      icon={Receipt}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={Printer} onClick={() => window.print()}>
            Print Bill
          </Button>
        </>
      }
    >
      <div id="printable-thermal-receipt" className="font-mono text-[11.5px] text-[color:var(--text-primary)]">
        <div className="border-b border-dashed pb-2 text-center" style={{ borderColor: 'var(--border-strong)' }}>
          <div className="text-[13px] font-bold uppercase">{company.name}</div>
          {company.address && <div className="text-[10px]">{company.address}</div>}
          {(company.city || company.phone) && (
            <div className="text-[10px]">
              {company.city}
              {company.city && company.phone ? ' · ' : ''}
              {company.phone}
            </div>
          )}
          {company.gstin && <div className="text-[10px]">GSTIN: {company.gstin}</div>}
        </div>

        <div className="flex justify-between border-b border-dashed py-1.5 text-[10px]" style={{ borderColor: 'var(--border-strong)' }}>
          <div>
            <div>Bill: {receipt.orderId}</div>
            <div>{fmtDateTime(receipt.date)}</div>
          </div>
          <div className="text-right">
            <div>{receipt.customerName}</div>
            {receipt.customerPhone && receipt.customerPhone !== 'N/A' && <div>{receipt.customerPhone}</div>}
            <div>Cashier: {receipt.cashier}</div>
          </div>
        </div>

        <table className="w-full py-1">
          <thead>
            <tr className="border-b border-dashed text-[9.5px] uppercase" style={{ borderColor: 'var(--border-strong)' }}>
              <th className="py-1 text-left">Item</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Rate</th>
              <th className="py-1 text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {(receipt.items || []).map((item, i) => (
              <tr key={i}>
                <td className="py-0.5 pr-1">{item.printName || item.name}</td>
                <td className="tabular py-0.5 text-right">{item.qty}</td>
                <td className="tabular py-0.5 text-right">{Number(item.price).toFixed(2)}</td>
                <td className="tabular py-0.5 text-right">{Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-0.5 border-t border-dashed pt-1.5" style={{ borderColor: 'var(--border-strong)' }}>
          <ReceiptRow label="Subtotal" value={receipt.subtotal} />
          {receipt.discount > 0 && <ReceiptRow label="Discount" value={-receipt.discount} />}
          {receipt.tax > 0 && <ReceiptRow label="GST" value={receipt.tax} />}
          {receipt.loyaltyRedeemed > 0 && (
            <ReceiptRow label={`Points redeemed (${receipt.pointsRedeemed})`} value={-receipt.loyaltyRedeemed} />
          )}
          <div className="flex justify-between border-t border-dashed pt-1 text-[14px] font-bold" style={{ borderColor: 'var(--border-strong)' }}>
            <span>TOTAL</span>
            <span className="tabular">₹{Number(receipt.total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Paid by {receipt.paymentMethod}</span>
            {receipt.loyaltyEarned > 0 && <span>+{receipt.loyaltyEarned} pts</span>}
          </div>
          {receipt.loyaltyBalance !== undefined && (
            <div className="text-[9.5px]">Points balance: {receipt.loyaltyBalance}</div>
          )}
        </div>

        {showGst && Object.keys(gstSlabs).length > 0 && (
          <div className="mt-2 border-t border-dashed pt-1.5 text-[9.5px]" style={{ borderColor: 'var(--border-strong)' }}>
            <div className="mb-0.5 font-bold uppercase">GST Summary</div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">Slab</th>
                  <th className="text-right">Taxable</th>
                  <th className="text-right">CGST</th>
                  <th className="text-right">SGST</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(gstSlabs).map(([rate, v]) => (
                  <tr key={rate}>
                    <td>{rate}%</td>
                    <td className="tabular text-right">{v.taxable.toFixed(2)}</td>
                    <td className="tabular text-right">{(v.tax / 2).toFixed(2)}</td>
                    <td className="tabular text-right">{(v.tax / 2).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-2 border-t border-dashed pt-1.5 text-center text-[9.5px]" style={{ borderColor: 'var(--border-strong)' }}>
          {billing.termsText && <div>{billing.termsText}</div>}
          <div className="mt-0.5 font-bold">{billing.footerText || 'Thank you, visit again!'}</div>
        </div>
      </div>
    </Modal>
  );
}

function ReceiptRow({ label, value }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span>{label}</span>
      <span className="tabular">₹{Number(value).toFixed(2)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Session, tables, reprint
 * ------------------------------------------------------------------ */

const CASH_REASONS = [
  'Cash deposited to bank',
  'Petty expense paid',
  'Change float added',
  'Owner drawing',
  'Vendor paid in cash',
  'Opening float top-up'
];

function SessionModal({ open, session, onClose, showToast, onChanged }) {
  const [openingCash, setOpeningCash] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [entry, setEntry] = useState({ type: 'OUT', amount: '', reason: CASH_REASONS[0] });
  const [busy, setBusy] = useState(false);

  const isOpen = session?.status === 'open';

  const act = async (fn) => {
    setBusy(true);
    try {
      const res = await fn();
      showToast(res.message);
      onChanged();
    } catch (err) {
      showToast(api.message(err, 'Action failed.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const cashIn = (session?.cashEntries || []).filter((e) => e.type === 'IN').reduce((s, e) => s + e.amount, 0);
  const cashOut = (session?.cashEntries || []).filter((e) => e.type === 'OUT').reduce((s, e) => s + e.amount, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isOpen ? 'Counter Session' : 'Open Counter Session'}
      subtitle={isOpen ? `Opened ${fmtDateTime(session.openedAt)} by ${session.openedBy}` : 'Declare the cash float you are starting with.'}
      icon={Wallet}
      size="lg"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {!isOpen ? (
        <div className="space-y-3">
          <Field label="Opening cash float" required>
            <Input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="2000"
              className="tabular text-[19px] font-bold"
              autoFocus
            />
          </Field>
          <Button
            variant="primary"
            icon={Unlock}
            loading={busy}
            onClick={() => act(() => api.post('/session/open', { openingCash })).then(onClose)}
            className="w-full"
          >
            Open Session
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <StatTile label="Opening" value={money(session.openingCash, { decimals: false })} />
            <StatTile label="Cash In" value={money(cashIn, { decimals: false })} tone="success" />
            <StatTile label="Cash Out" value={money(cashOut, { decimals: false })} tone="danger" />
            <StatTile label="Drawer" value={money(session.currentCash, { decimals: false })} tone="accent" />
          </div>

          <div className="space-y-2 rounded-xl p-3" style={{ background: 'var(--bg-subtle)' }}>
            <div className="label-eyebrow">Record a cash movement</div>
            <div className="grid gap-2 sm:grid-cols-4">
              <SegmentedControl
                value={entry.type}
                onChange={(type) => setEntry({ ...entry, type })}
                options={[
                  { value: 'IN', label: 'Cash In' },
                  { value: 'OUT', label: 'Cash Out' }
                ]}
              />
              <Input
                type="number"
                value={entry.amount}
                onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
                placeholder="Amount"
              />
              <Select value={entry.reason} onChange={(e) => setEntry({ ...entry, reason: e.target.value })}>
                {CASH_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
              <Button
                variant="primary"
                icon={entry.type === 'IN' ? ArrowDownToLine : ArrowUpFromLine}
                loading={busy}
                disabled={!entry.amount}
                onClick={() => act(() => api.post('/session/cash-entry', entry)).then(() => setEntry({ ...entry, amount: '' }))}
              >
                Record
              </Button>
            </div>
          </div>

          {(session.cashEntries || []).length > 0 && (
            <DataTable
              maxHeight="30vh"
              dense
              columns={[
                { key: 'time', label: 'Time', width: 140, render: (e) => fmtDateTime(e.time) },
                { key: 'type', label: 'Type', width: 90, render: (e) => <Badge tone={e.type === 'IN' ? 'success' : 'danger'}>{e.type}</Badge> },
                { key: 'reason', label: 'Reason' },
                { key: 'amount', label: 'Amount', align: 'right', width: 110, render: (e) => <Money value={e.amount} /> }
              ]}
              rows={[...session.cashEntries].reverse()}
              rowKey={(e, i) => i}
            />
          )}

          <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <Field label="Physically counted cash" hint="Any variance is recorded against this session">
              <Input
                type="number"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder={String(session.currentCash)}
                className="tabular font-bold"
              />
            </Field>
            {countedCash !== '' && (
              <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
                <span className="text-[11.5px] font-bold text-[color:var(--text-secondary)]">Variance</span>
                <Money value={Number(countedCash) - session.currentCash} colored className="font-bold" />
              </div>
            )}
            <Button
              variant="danger"
              icon={Lock}
              loading={busy}
              onClick={() => act(() => api.post('/session/close', { countedCash: countedCash || undefined })).then(onClose)}
              className="w-full"
            >
              Close Session
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Table management — SOW Module 19.
 *
 * Three things happen on one grid, so the grid works in modes: normally a tap
 * assigns the current bill to a table; while a move is armed the next tap is the
 * destination. Transfer needs a free destination, merge needs a busy one, which
 * is why the armed mode dims the tables that cannot receive the action.
 */
function TablesModal({ open, tables, selectedId, onSelect, onClose, showToast, onChanged }) {
  const [pending, setPending] = useState(null); // { mode: 'TRANSFER' | 'MERGE', tableId }
  const [busy, setBusy] = useState(false);

  // Arming a move and then closing the sheet should not leave it armed.
  useEffect(() => {
    if (!open) setPending(null);
  }, [open]);

  const source = pending ? tables.find((t) => t.id === pending.tableId) : null;

  const runMove = async (target) => {
    if (!pending || target.id === pending.tableId) {
      setPending(null);
      return;
    }

    setBusy(true);
    try {
      const res =
        pending.mode === 'MERGE'
          ? await api.post('/tables/merge', { sourceTableId: pending.tableId, targetTableId: target.id })
          : await api.post('/tables/transfer', { fromTableId: pending.tableId, toTableId: target.id });

      showToast(res.message);
      setPending(null);
      onChanged();
    } catch (err) {
      showToast(
        api.message(err, pending.mode === 'MERGE' ? 'Could not merge the tables.' : 'Could not transfer the table.'),
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  // Transfer needs an empty table; merge needs another running bill to fold into.
  const canReceive = (table) => {
    if (!pending) return true;
    if (table.id === pending.tableId) return false;
    return pending.mode === 'MERGE' ? table.status === 'OCCUPIED' && table.bill : table.status !== 'OCCUPIED';
  };

  const handleTap = (table) => {
    if (busy) return;
    if (pending) {
      if (!canReceive(table)) {
        showToast(
          pending.mode === 'MERGE'
            ? `${table.name} has no running bill to merge into.`
            : `${table.name} is occupied — merge instead of transferring.`,
          'error'
        );
        return;
      }
      runMove(table);
      return;
    }
    onSelect(table.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tables"
      subtitle={
        pending
          ? pending.mode === 'MERGE'
            ? `Pick the table to merge ${source?.name} into.`
            : `Pick the free table to move ${source?.name} to.`
          : 'Assign this bill to a table, move a running bill, or merge two tables.'
      }
      icon={LayoutGrid}
      size="lg"
      footer={
        <>
          {pending ? (
            <Button className="mr-auto" onClick={() => setPending(null)}>
              Cancel {pending.mode === 'MERGE' ? 'merge' : 'transfer'}
            </Button>
          ) : (
            selectedId && (
              <Button className="mr-auto" onClick={() => onSelect('')}>
                Clear table
              </Button>
            )
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {tables.length === 0 ? (
        <EmptyState title="No tables configured" hint="Add tables under Settings → Tables." />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {tables.map((table) => {
            const occupied = table.status === 'OCCUPIED';
            const isSelected = selectedId === table.id;
            const isSource = pending?.tableId === table.id;
            const receivable = canReceive(table);

            return (
              <div
                key={table.id}
                onClick={() => handleTap(table)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleTap(table)}
                className={`surface cursor-pointer rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 ${
                  isSelected ? 'ring-2 ring-indigo-500' : ''
                } ${isSource ? 'ring-2 ring-amber-500' : ''} ${
                  pending && !receivable ? 'pointer-events-none opacity-40' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[15px] font-bold text-[color:var(--text-primary)]">{table.name}</span>
                  <Badge tone={isSource ? 'accent' : occupied ? 'warning' : 'success'}>
                    {isSource ? 'Moving' : occupied ? 'Busy' : 'Free'}
                  </Badge>
                </div>
                <div className="mt-1 text-[10.5px] text-[color:var(--text-muted)]">
                  {table.area} · {table.seats} seats
                </div>

                {table.bill && (
                  <div className="mt-2 border-t pt-1.5" style={{ borderColor: 'var(--border)' }}>
                    <Money value={table.bill.total} className="text-[13px] font-bold" />
                    <div className="text-[10px] text-[color:var(--text-muted)]">
                      {table.bill.items.length} items running
                    </div>

                    {!pending && (
                      <div className="mt-1 flex items-center gap-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPending({ mode: 'TRANSFER', tableId: table.id });
                          }}
                          className="text-[10px] font-bold text-[color:var(--accent)]"
                        >
                          Transfer →
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPending({ mode: 'MERGE', tableId: table.id });
                          }}
                          className="text-[10px] font-bold text-amber-600 dark:text-amber-400"
                        >
                          Merge ⇢
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pending?.mode === 'MERGE' && (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Merging moves every item from {source?.name} onto the destination's bill and frees {source?.name}. Matching
          items are combined rather than duplicated.
        </div>
      )}
    </Modal>
  );
}

function RecentBillsModal({ open, onClose, onReprint, showToast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get('/orders', { limit: 60 })
      .then(setOrders)
      .catch((err) => showToast(api.message(err), 'error'))
      .finally(() => setLoading(false));
  }, [open]);

  const voidBill = async (order) => {
    if (!window.confirm(`Void ${order.orderId}? Stock will be restored and the accounting entries reversed.`)) return;
    try {
      const res = await api.post(`/orders/${order.orderId}/void`);
      showToast(res.message);
      setOrders((prev) => prev.map((o) => (o.orderId === order.orderId ? { ...o, status: 'VOID' } : o)));
    } catch (err) {
      showToast(api.message(err, 'Could not void the bill.'), 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Recent Bills" subtitle="Reprint a receipt or void a mistaken bill." icon={Receipt} size="xl">
      {loading ? (
        <Spinner />
      ) : (
        <DataTable
          maxHeight="56vh"
          dense
          columns={[
            { key: 'orderId', label: 'Invoice', width: 150, render: (o) => <span className="tabular font-bold">{o.orderId}</span> },
            { key: 'date', label: 'When', width: 150, render: (o) => fmtDateTime(o.date) },
            { key: 'customerName', label: 'Customer', render: (o) => <span className="font-semibold">{o.customerName}</span> },
            { key: 'paymentMethod', label: 'Mode', width: 120, render: (o) => <Badge>{o.paymentMethod}</Badge> },
            { key: 'total', label: 'Total', align: 'right', width: 120, render: (o) => <Money value={o.total} className="font-bold" /> },
            {
              key: 'status',
              label: 'Status',
              width: 90,
              render: (o) => <Badge tone={o.status === 'VOID' ? 'danger' : 'success'}>{o.status === 'VOID' ? 'Void' : 'OK'}</Badge>
            },
            {
              key: 'actions',
              label: '',
              align: 'right',
              width: 150,
              render: (o) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" icon={Printer} onClick={() => onReprint(o)}>
                    Reprint
                  </Button>
                  {o.status !== 'VOID' && (
                    <Button size="sm" variant="ghost" icon={X} onClick={() => voidBill(o)} className="text-rose-500" />
                  )}
                </div>
              )
            }
          ]}
          rows={orders}
          rowKey={(o) => o.orderId}
          empty={<EmptyState icon={Receipt} title="No bills yet today" />}
        />
      )}
    </Modal>
  );
}
