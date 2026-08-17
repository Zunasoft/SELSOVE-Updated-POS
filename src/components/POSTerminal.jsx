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

export function getProductUnitOptions(product) {
  if (!product) return [{ unit: 'pcs', factor: 1, price: 0, isBase: true }];
  const baseUnit = String(product.unit || 'pcs').toLowerCase().trim();
  const basePrice = Number(product.price) || 0;
  const options = [
    { unit: product.unit || 'pcs', factor: 1, price: basePrice, isBase: true }
  ];

  // 1. Custom sub-unit (e.g. g for kg, ml for ltr, pcs for box/dozen)
  if (product.customSubUnitName && Number(product.customSubUnitFactor) > 0) {
    const subName = product.customSubUnitName.trim();
    const factorNum = Number(product.customSubUnitFactor);
    const subPrice = product.customSubUnitPrice ? Number(product.customSubUnitPrice) : basePrice / factorNum;
    options.push({
      unit: subName,
      factor: 1 / factorNum,
      price: subPrice,
      subFactor: factorNum,
      isSub: true
    });
  }

  // 2. Standard kg -> g
  if (baseUnit === 'kg' && !options.some(o => o.unit.toLowerCase() === 'g')) {
    options.push({
      unit: 'g',
      factor: 0.001,
      price: basePrice / 1000,
      subFactor: 1000,
      isSub: true
    });
  } else if ((baseUnit === 'ltr' || baseUnit === 'litre' || baseUnit === 'liter') && !options.some(o => o.unit.toLowerCase() === 'ml')) {
    options.push({
      unit: 'ml',
      factor: 0.001,
      price: basePrice / 1000,
      subFactor: 1000,
      isSub: true
    });
  }

  // 3. Alt units (e.g. boxes, cartons)
  if (Array.isArray(product.altUnits)) {
    product.altUnits.forEach((alt) => {
      if (alt && alt.unit && !options.some(o => o.unit.toLowerCase() === String(alt.unit).toLowerCase())) {
        const factor = Number(alt.factor) || 1;
        const price = alt.price !== undefined && alt.price !== null && alt.price !== '' ? Number(alt.price) : basePrice * factor;
        options.push({
          unit: alt.unit,
          factor,
          price,
          isAlt: true
        });
      }
    });
  }

  return options;
}

export function getProductRemainingStock(product, cart = [], allProducts = []) {
  if (!product) return { remaining: 0, text: '0', isLow: false, isOut: true };
  const prodId = product.id;
  const isComposite = product.isComposite || product.productType === 'composite';

  // 1. Composite item: compute availability from recipe raw materials
  if (isComposite) {
    const ingredients = product.recipe?.ingredients || product.recipeItems || [];
    if (ingredients.length > 0 && Array.isArray(allProducts) && allProducts.length > 0) {
      let maxCanMake = Infinity;
      ingredients.forEach((ing) => {
        const raw = allProducts.find((p) => p.id === ing.productId);
        if (!raw) return;
        const ingStock = getProductRemainingStock(raw, cart, allProducts);
        const reqQty = Number(ing.qty) || 1;
        const canMakeThis = Math.floor(Math.max(0, ingStock.remaining) / reqQty);
        if (canMakeThis < maxCanMake) maxCanMake = canMakeThis;
      });
      if (maxCanMake === Infinity) maxCanMake = 0;

      // Subtract composite units already in cart
      const inCartComposite = cart.reduce((sum, item) => {
        if (item.id === prodId || item.name === product.name) {
          return sum + (Number(item.qty) || 0);
        }
        return sum;
      }, 0);

      const remaining = Math.max(0, maxCanMake - inCartComposite);
      const isOut = remaining <= 0;
      const isLow = remaining <= 5;
      const text = `${remaining} ${product.unit || 'portions'} left`;
      return { remaining, text, isLow, isOut };
    }
  }

  // 2. Raw Material / Standard Product: calculate in-cart deduction (direct sales + composite recipes consuming this product)
  const inCartBase = cart.reduce((sum, item) => {
    if (item.id === prodId || item.name === product.name) {
      const factor = Number(item.unitFactor) || (String(item.unit).toLowerCase() === String(product.unit).toLowerCase() ? 1 : 1);
      return sum + (Number(item.qty) || 0) * factor;
    }
    const isComp = item.isComposite || item.productType === 'composite';
    if (isComp) {
      const ingredients = item.recipe?.ingredients || item.recipeItems || [];
      const matched = ingredients.find((ing) => ing.productId === prodId);
      if (matched) {
        const reqQty = Number(matched.qty) || 0;
        const soldQty = Number(item.qty) || 0;
        return sum + (reqQty * soldQty);
      }
    }
    return sum;
  }, 0);

  const rawRemaining = Number(product.stock || 0) - inCartBase;
  const remaining = Math.max(0, Math.round(rawRemaining * 10000) / 10000);
  const isOut = remaining <= 0;
  const isLow = remaining <= Number(product.minStock ?? 5);

  const options = getProductUnitOptions(product);
  const subOption = options.find((o) => o.isSub);

  let text = `${remaining} ${product.unit}`;
  if (subOption && subOption.subFactor && remaining > 0) {
    const remainingSub = Math.round(remaining * subOption.subFactor * 100) / 100;
    text = `${remaining} ${product.unit} (${remainingSub} ${subOption.unit})`;
  }

  return { remaining, text, isLow, isOut };
}

export function playScanSound(type = 'add') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'add') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'remove') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (_) {}
}

export function resolveProductPricing(product, customer, priceSheets = []) {
  if (!product) return { price: 0, discountPercent: 0, ruleSource: null };

  let basePrice = Number(product.price || 0);
  let discountPercent = 0;
  let ruleSource = null;

  // 1. Direct customer custom price override (REQ-02)
  if (customer?.customPrices && customer.customPrices[product.id] !== undefined) {
    const custPrice = Number(customer.customPrices[product.id]);
    if (Number.isFinite(custPrice) && custPrice >= 0) {
      return {
        price: custPrice,
        discountPercent: Number(customer.discountPercent || 0),
        ruleSource: 'Customer Price'
      };
    }
  }

  // 2. Customer Price Sheet or Customer Group Price Sheet (REQ-01 & REQ-02)
  const targetSheetId = customer?.priceSheetId;
  const targetGroup = customer?.group;
  const activeSheet = priceSheets.find(
    (s) => s.isActive && (s.id === targetSheetId || (targetGroup && String(s.customerType || '').toLowerCase() === String(targetGroup).toLowerCase()))
  );

  if (activeSheet) {
    if (activeSheet.pricingMap && activeSheet.pricingMap[product.id] !== undefined) {
      basePrice = Number(activeSheet.pricingMap[product.id]);
      ruleSource = `Price Sheet (${activeSheet.name})`;
    }
    if (activeSheet.discountMap && activeSheet.discountMap[product.id] !== undefined) {
      discountPercent = Number(activeSheet.discountMap[product.id]);
      ruleSource = ruleSource || `Price Sheet (${activeSheet.name})`;
    } else if (Number(activeSheet.defaultDiscountPercent) > 0) {
      discountPercent = Number(activeSheet.defaultDiscountPercent);
      ruleSource = ruleSource || `Price Sheet (${activeSheet.name})`;
    }
  }

  // 3. Customer default discount
  if (discountPercent === 0 && Number(customer?.discountPercent) > 0) {
    discountPercent = Number(customer.discountPercent);
    ruleSource = 'Customer Discount';
  }

  return { price: basePrice, discountPercent, ruleSource };
}

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
  const [vendors, setVendors] = useState([]);
  const [priceSheets, setPriceSheets] = useState([]);
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
  const [weightUnit, setWeightUnit] = useState('kg');
  const [weightInput, setWeightInput] = useState('1');
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
  const [recentInvoices, setRecentInvoices] = useState([]);

  const searchRef = useRef(null);
  const scanBuffer = useRef('');
  const scanTimer = useRef(null);

  const fetchRecent = useCallback(async () => {
    try {
      const rec = await api.get('/orders', { limit: 5 });
      setRecentInvoices(rec || []);
    } catch (_) {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, rec] = await Promise.all([
        api.get('/init'),
        api.get('/orders', { limit: 5 }).catch(() => [])
      ]);
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setCustomers(data.customers || []);
      setVendors(data.vendors || []);
      setPriceSheets(data.priceSheets || []);
      setSession(data.session || null);
      setHeldBills(data.heldBills || []);
      setTables(data.tables || []);
      setSettings(data.settings || null);
      setRecentInvoices(rec || []);
    } catch (err) {
      showToast(api.message(err, 'Could not load the terminal.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Customer-Specific Pricing & Price Sheet Auto-Application (REQ-01 & REQ-02)
  useEffect(() => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;

    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart;
      return prevCart.map((item) => {
        const prod = products.find((p) => p.id === item.id) || item;
        const pricing = resolveProductPricing(prod, cust, priceSheets);
        const unitOpts = getProductUnitOptions(prod);
        const opt = unitOpts.find((o) => o.unit === item.unit) || unitOpts[0];
        const factor = opt?.factor || 1;
        const unitPrice = opt?.isAlt || opt?.isSub ? opt.price : pricing.price * factor;
        const total = Math.round(item.qty * unitPrice * 100) / 100;
        return {
          ...item,
          price: unitPrice,
          total,
          pricingRule: pricing.ruleSource,
          itemDiscountPercent: pricing.discountPercent
        };
      });
    });
  }, [customerId, customers, priceSheets, products]);

  /* ------------------------- cart maths ------------------------- */

  const customer = customers.find((c) => c.id === customerId) || null;
  const taxInclusive = settings?.tax?.taxMode === 'INCLUSIVE';
  const gstEnabled = settings?.tax?.enableGst !== false;

  const totals = useMemo(() => {
    const lineValue = (item) => item.qty * item.price;

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

  /* ------------------------- loyalty redemption ------------------------- */
  const loyalty = useMemo(() => {
    const pos = settings?.pos || {};
    const rate = Number(pos.loyaltyRedeemValue) || 0;
    const available = customer?.loyaltyPoints || 0;
    const minPoints = Number(pos.loyaltyMinRedeemPoints) || 0;

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

  useEffect(() => {
    setRedeemPoints(0);
  }, [customerId, cart.length]);

  const changeDue = Math.max(0, (parseFloat(cashTendered) || 0) - payable);

  /* ------------------------- adding items ------------------------- */

  const addToCart = useCallback(
    (product, qty = 1) => {
      const cust = customers.find((c) => c.id === customerId);
      const pricing = resolveProductPricing(product, cust, priceSheets);
      const options = getProductUnitOptions({ ...product, price: pricing.price });
      const isWeighedOrSubUnit = product.requiresWeight || product.unit === 'kg' || product.unit === 'g' || product.unit === 'ltr' || product.customSubUnitName;

      if (isWeighedOrSubUnit && qty === 1) {
        setWeightModal({ ...product, price: pricing.price });
        const hasGrams = options.some((o) => o.unit === 'g');
        const defaultUnit = hasGrams ? 'g' : options[0]?.unit || product.unit || 'pcs';
        setWeightUnit(defaultUnit);
        setWeightInput(defaultUnit === 'g' ? '500' : '1');
        return;
      }

      const defaultOpt = options[0] || { unit: product.unit || 'pcs', factor: 1, price: pricing.price };

      setCart((prev) => {
        const idx = prev.findIndex((i) => i.id === product.id && i.unit === defaultOpt.unit);
        if (idx >= 0) {
          const next = [...prev];
          const merged = { ...next[idx], qty: Math.round((next[idx].qty + qty) * 1000) / 1000 };
          merged.total = Math.round(merged.qty * merged.price * 100) / 100;
          next[idx] = merged;
          return next;
        }
        return [
          ...prev,
          {
            ...product,
            qty,
            unit: defaultOpt.unit,
            saleUnit: defaultOpt.unit,
            unitFactor: defaultOpt.factor || 1,
            price: defaultOpt.price,
            total: Math.round(qty * defaultOpt.price * 100) / 100,
            pricingRule: pricing.ruleSource,
            itemDiscountPercent: pricing.discountPercent
          }
        ];
      });
    },
    [customerId, customers, priceSheets]
  );

  const removeFromCart = useCallback((product, qty = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === product.id || i.name === product.name);
      if (idx < 0) {
        showToast(`${product.name} is not in the bill.`, 'error');
        playScanSound('error');
        return prev;
      }
      const current = prev[idx];
      const newQty = Math.round((current.qty - qty) * 1000) / 1000;
      if (newQty <= 0) {
        showToast(`Removed ${product.name} from bill.`);
        playScanSound('remove');
        return prev.filter((_, i) => i !== idx);
      }
      const next = [...prev];
      next[idx] = {
        ...current,
        qty: newQty,
        total: Math.round(newQty * current.price * 100) / 100
      };
      showToast(`Decremented ${product.name} (qty: ${newQty})`);
      playScanSound('remove');
      return next;
    });
  }, [showToast]);

  /**
   * Weight-embedded and standard barcode scanner handling
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
          playScanSound('add');
          showToast(`${match.name} — ${(grams / 1000).toFixed(3)} kg added from label.`);
          return;
        }
      }

      const local = products.find((p) => p.barcode === trimmed || (p.barcodes || []).includes(trimmed));
      if (local) {
        addToCart(local, 1);
        playScanSound('add');
        showToast(`Scanned ${local.name}`);
        return;
      }

      try {
        const decoded = await api.get(`/hardware/decode-barcode/${encodeURIComponent(trimmed)}`);
        addToCart(decoded.product, decoded.quantity || 1);
        playScanSound('add');
        showToast(
          decoded.embedded
            ? `${decoded.product.name} — ${Number(decoded.quantity).toFixed(3)} ${decoded.product.unit} from label.`
            : `Scanned ${decoded.product.name}`
        );
        return;
      } catch {
        /* fall through to product lookup */
      }

      try {
        const found = await api.get(`/products/lookup/${encodeURIComponent(trimmed)}`);
        addToCart(found, 1);
        playScanSound('add');
        showToast(`Scanned ${found.name}`);
      } catch {
        playScanSound('error');
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

      if (weightUnit === 'g' || weightUnit === 'gm' || weightUnit === 'grams') {
        setWeightInput(String(grams));
      } else {
        setWeightInput((grams / 1000).toFixed(3));
      }

      showToast(`Scale reading: ${grams} g (${(grams / 1000).toFixed(3)} kg)${res.simulated ? ' (simulated)' : ''}`);
    } catch (err) {
      showToast(api.message(err, 'Scale did not respond.'), 'error');
    } finally {
      setScaleReading(false);
    }
  };

  const confirmWeight = () => {
    const value = parseFloat(weightInput) || 0;
    if (value <= 0) {
      showToast('Enter a quantity / weight greater than zero.', 'error');
      return;
    }
    const product = weightModal;
    const options = getProductUnitOptions(product);
    const selectedOpt = options.find((o) => o.unit.toLowerCase() === weightUnit.toLowerCase()) || options[0];
    const unitPrice = selectedOpt.price;
    const unitFactor = selectedOpt.factor || 1;
    const lineTotal = Math.round(value * unitPrice * 100) / 100;

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === product.id && i.unit === selectedOpt.unit);
      if (idx >= 0) {
        const next = [...prev];
        const qty = Math.round((next[idx].qty + value) * 1000) / 1000;
        next[idx] = { ...next[idx], qty, total: Math.round(qty * next[idx].price * 100) / 100 };
        return next;
      }
      return [
        ...prev,
        {
          ...product,
          qty: value,
          saleUnit: selectedOpt.unit,
          unit: selectedOpt.unit,
          unitFactor,
          price: unitPrice,
          total: lineTotal
        }
      ];
    });

    setWeightModal(null);
    showToast(`${value} ${selectedOpt.unit} of ${product.name} added (${money(lineTotal)}).`);
  };

  const switchCartItemUnit = (cartItemId, targetUnit) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartItemId) return item;
        const product = products.find((p) => p.id === item.id) || item;
        const options = getProductUnitOptions(product);
        const currentOpt = options.find((o) => o.unit.toLowerCase() === String(item.unit).toLowerCase()) || { factor: item.unitFactor || 1, price: item.price };
        const newOpt = options.find((o) => o.unit.toLowerCase() === String(targetUnit).toLowerCase()) || options[0];

        // Base quantity currently in cart:
        const currentBaseQty = (Number(item.qty) || 0) * (currentOpt.factor || 1);
        // New quantity in target unit:
        const newQty = newOpt.factor > 0 ? Math.round((currentBaseQty / newOpt.factor) * 1000) / 1000 : item.qty;
        const newPrice = newOpt.price;
        const total = Math.round(newQty * newPrice * 100) / 100;

        return {
          ...item,
          unit: newOpt.unit,
          saleUnit: newOpt.unit,
          unitFactor: newOpt.factor,
          price: newPrice,
          qty: newQty,
          total
        };
      })
    );
  };

  const updateQty = (id, delta) =>
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i;
          const step = i.unit === 'g' || i.unit === 'ml' ? 50 : 1;
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
        <Panel className="flex flex-wrap items-center gap-2 relative">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              ref={searchRef}
              className="field-input"
              style={{ paddingLeft: '2.1rem' }}
              placeholder="Scan barcode or search items… (F2)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length >= 1) {
                  if (scanMode === 'REMOVE') {
                    removeFromCart(filtered[0], 1);
                  } else {
                    addToCart(filtered[0], 1);
                    playScanSound('add');
                  }
                  setSearchQuery('');
                }
              }}
            />

            {/* Search with Dropdown selection (REQ-12) */}
            {searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-2 shadow-2xl backdrop-blur-md max-h-72 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] flex justify-between items-center">
                  <span>Matching Items ({filtered.length})</span>
                  <span className="text-[9px] lowercase">press Enter or click</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="p-3 text-center text-xs text-[color:var(--text-muted)]">No matching products found</div>
                ) : (
                  filtered.slice(0, 8).map((p) => {
                    const stockInfo = getProductRemainingStock(p, cart, products);
                    const cust = customers.find((c) => c.id === customerId);
                    const pricing = resolveProductPricing(p, cust, priceSheets);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          addToCart(p, 1);
                          playScanSound('add');
                          setSearchQuery('');
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-[color:var(--bg-subtle)] cursor-pointer text-xs transition-colors group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-[color:var(--text-primary)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-[color:var(--text-muted)] flex items-center gap-2 mt-0.5">
                            {p.barcode && <span className="font-mono bg-[color:var(--bg-subtle)] px-1.5 py-0.2 rounded">{p.barcode}</span>}
                            <span>{p.unit || 'pcs'}</span>
                            <span className={stockInfo.isOut ? 'text-rose-500 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
                              {stockInfo.text}
                            </span>
                            {pricing.ruleSource && (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">
                                {pricing.ruleSource}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <Money value={pricing.price} decimals={false} className="font-bold text-[13px]" />
                          <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            + Add
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <Badge tone={settings?.hardware?.barcodeScanner?.enabled !== false ? 'success' : 'neutral'}>
            <Barcode className="h-3 w-3" />
            {settings?.hardware?.barcodeScanner?.enabled !== false ? 'Scanner Armed' : 'Scanner Off'}
          </Badge>

          {/* Live weight display */}
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
            title="Counter Opening, Cash In / Out, Internal Expenses & Cash Movements"
          >
            {sessionOpen ? `Drawer: ${money(session.currentCash, { decimals: false })}` : 'Open Counter'}
          </Button>
        </Panel>

        {!sessionOpen && (
          <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-[12px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Lock className="h-4 w-4" />
            The counter session is closed. Open a session to track cash float and denominations for this shift.
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
              const stockInfo = getProductRemainingStock(p, cart, products);
              const out = stockInfo.isOut;
              const isLow = stockInfo.isLow;
              const cust = customers.find((c) => c.id === customerId);
              const pricing = resolveProductPricing(p, cust, priceSheets);

              return (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    addToCart(p, 1);
                    playScanSound('add');
                  }}
                  className="surface group flex flex-col justify-between rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
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
                    {pricing.ruleSource && (
                      <div className="mt-0.5 text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400">
                        {pricing.ruleSource}
                      </div>
                    )}
                    {p.printName && (
                      <div className="truncate text-[10px] text-[color:var(--text-muted)]">{p.printName}</div>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-end justify-between gap-1 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                    <Money value={pricing.price} decimals={false} className="text-[14px] font-bold" />
                    <span
                      className={`tabular rounded-md px-1.5 py-0.5 text-[9.5px] font-bold ${
                        out
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : isLow
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'text-[color:var(--text-muted)]'
                      }`}
                      style={!out && !isLow ? { background: 'var(--bg-subtle)' } : undefined}
                      title={`Stock: ${stockInfo.text}`}
                    >
                      {out ? 'Out of stock' : stockInfo.text}
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
                {customers.map((c) => {
                  const hasCustom = c.customPrices && Object.keys(c.customPrices).length > 0;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} {hasCustom ? '★ Custom Price' : ''} {c.outstanding > 0 ? `· due ${money(c.outstanding, { decimals: false })}` : ''}
                    </option>
                  );
                })}
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
              {customer.group && (
                <Badge tone="neutral">Group: {customer.group}</Badge>
              )}
              {customer.customPrices && Object.keys(customer.customPrices).length > 0 && (
                <Badge tone="success">★ Customer-Specific Pricing</Badge>
              )}
              {customer.priceSheetId && (
                <Badge tone="accent">Price Sheet Linked</Badge>
              )}
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
              cart.map((item) => {
                const prod = products.find((p) => p.id === item.id) || item;
                const unitOpts = getProductUnitOptions(prod);
                const stockInfo = getProductRemainingStock(prod, cart, products);

                return (
                  <div
                    key={`${item.id}_${item.unit}`}
                    className="flex flex-col gap-1.5 rounded-xl px-2.5 py-2"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-bold text-[color:var(--text-primary)]">{item.name}</div>
                        <div className="text-[10px] text-[color:var(--text-muted)]">
                          Stock left: <span className="font-semibold text-[color:var(--text-secondary)]">{stockInfo.text}</span>
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
                        <button onClick={() => setCart(cart.filter((i) => !(i.id === item.id && i.unit === item.unit)))} className="p-1 text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-[color:var(--border-subtle)] text-[11px]">
                      <span className="text-[10.5px] text-[color:var(--text-muted)]">Rate:</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={item.price}
                        onChange={(e) => setLinePrice(item.id, e.target.value)}
                        className="tabular w-20 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-[10.5px] text-[color:var(--text-muted)]">×</span>
                      <input
                        type="number"
                        step="any"
                        value={item.qty}
                        onChange={(e) => setLineQty(item.id, e.target.value)}
                        className="tabular w-16 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-center"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />

                      {unitOpts.length > 1 ? (
                        <select
                          value={item.unit}
                          onChange={(e) => switchCartItemUnit(item.id, e.target.value)}
                          className="tabular rounded-md px-1 py-0.5 text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                        >
                          {unitOpts.map((opt) => (
                            <option key={opt.unit} value={opt.unit}>
                              {opt.unit}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="tabular text-[10.5px] font-bold text-[color:var(--text-secondary)]">
                          {item.unit}
                        </span>
                      )}

                      {item.taxRate ? <span className="text-[10px] text-[color:var(--text-muted)] ml-auto">GST {item.taxRate}%</span> : null}
                    </div>
                  </div>
                );
              })
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

        {/* Invoices Section in rows near the billing cart */}
        <Panel className="space-y-2 mt-3">
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[12px] font-bold text-[color:var(--text-primary)]">Recent Invoices</span>
              {recentInvoices.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  {recentInvoices.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowRecent(true)}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              All Invoices →
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="py-2.5 text-center text-[11px] text-[color:var(--text-muted)]">
              No recent bills for this shift
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--border-subtle)]">
              {recentInvoices.slice(0, 4).map((inv) => (
                <div
                  key={inv.orderId}
                  className="flex items-center justify-between py-2 text-xs hover:bg-[color:var(--bg-subtle)] px-2 rounded-xl transition-colors group cursor-pointer"
                  onClick={() => setReceipt(inv)}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11.5px] group-hover:underline">
                        {inv.orderId}
                      </span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">
                        {fmtDateTime(inv.date).slice(11)}
                      </span>
                    </div>
                    <div className="truncate text-[11px] font-semibold text-[color:var(--text-primary)]">
                      {inv.customerName || 'Walk-in'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-[12px] text-[color:var(--text-primary)]">
                        {money(inv.total)}
                      </div>
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
                        inv.status === 'VOID'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {inv.status === 'VOID' ? 'VOID' : 'PAID'}
                      </span>
                    </div>

                    <button
                      type="button"
                      title="Reprint Receipt"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReceipt(inv);
                        setTimeout(() => window.print(), 200);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ----------------------------- Modals ----------------------------- */}

      <Modal
        open={Boolean(weightModal)}
        onClose={() => setWeightModal(null)}
        title={weightModal ? `Quantity & Weight — ${weightModal.name}` : ''}
        subtitle={weightModal ? `Base Price: ${money(weightModal.price)} per ${weightModal.unit}` : ''}
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
        {weightModal && (() => {
          const options = getProductUnitOptions(weightModal);
          const currentOpt = options.find((o) => o.unit.toLowerCase() === weightUnit.toLowerCase()) || options[0];
          const val = parseFloat(weightInput) || 0;
          const lineAmount = Math.round(val * currentOpt.price * 100) / 100;
          const stockInfo = getProductRemainingStock(weightModal, cart, products);

          // Calculate remaining after this proposed sale
          const baseQtyToAdd = val * (currentOpt.factor || 1);
          const remainingAfter = Math.max(0, Math.round((stockInfo.remaining - baseQtyToAdd) * 1000) / 1000);

          const subOpt = options.find(o => o.isSub);
          let remainingAfterText = `${remainingAfter} ${weightModal.unit}`;
          if (subOpt && subOpt.subFactor && remainingAfter > 0) {
            remainingAfterText = `${remainingAfter} ${weightModal.unit} (${Math.round(remainingAfter * subOpt.subFactor * 100) / 100} ${subOpt.unit})`;
          }

          const handleUnitSwitch = (newUnit) => {
            const newOpt = options.find((o) => o.unit.toLowerCase() === newUnit.toLowerCase()) || options[0];
            const currentBase = (parseFloat(weightInput) || 0) * (currentOpt.factor || 1);
            const convertedVal = newOpt.factor > 0 ? Math.round((currentBase / newOpt.factor) * 1000) / 1000 : weightInput;
            setWeightUnit(newOpt.unit);
            setWeightInput(String(convertedVal || (newOpt.unit === 'g' ? '500' : '1')));
          };

          return (
            <div className="space-y-3">
              {/* Unit selection tabs */}
              {options.length > 1 && (
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
                  {options.map((opt) => (
                    <button
                      key={opt.unit}
                      type="button"
                      onClick={() => handleUnitSwitch(opt.unit)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        weightUnit.toLowerCase() === opt.unit.toLowerCase()
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                      }`}
                    >
                      {opt.unit === 'g' ? 'Grams (g)' : opt.unit === 'kg' ? 'Kilograms (kg)' : opt.unit}
                    </button>
                  ))}
                </div>
              )}

              <Button icon={Scale} onClick={readScale} loading={scaleReading} className="w-full" variant="outline">
                Read from weighing scale
              </Button>

              <Field label={`Enter Quantity (${weightUnit})`}>
                <Input
                  type="number"
                  step="any"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="tabular text-center text-[24px] font-bold"
                  autoFocus
                />
              </Field>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5">
                {(weightUnit === 'g' || weightUnit === 'gm' || weightUnit === 'grams'
                  ? [100, 250, 500, 750, 1000, 2000]
                  : weightUnit === 'kg'
                  ? [0.25, 0.5, 1, 2, 5]
                  : [1, 2, 5, 10, 12, 24]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWeightInput(String(preset))}
                    className="px-2.5 py-1 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[11px] font-bold text-[color:var(--text-secondary)] hover:border-indigo-500 hover:text-indigo-600 transition-all"
                  >
                    {preset} {weightUnit}
                  </button>
                ))}
              </div>

              {/* Calculation & Remaining Stock summary */}
              <div className="space-y-2 rounded-xl p-3 bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)] text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--text-secondary)] font-medium">Unit Rate:</span>
                  <span className="font-bold text-[color:var(--text-primary)]">
                    {money(currentOpt.price)} / {weightUnit}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--text-secondary)] font-medium">Line Amount:</span>
                  <Money value={lineAmount} className="text-[17px] font-bold text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="pt-2 border-t border-[color:var(--border-subtle)] flex items-center justify-between text-[11px]">
                  <span className="text-[color:var(--text-muted)] font-medium">Stock after this sale:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {remainingAfterText}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
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
        vendors={vendors}
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
  'Change float added',
  'Cash deposited to bank',
  'Petty expense paid',
  'Owner drawing',
  'Vendor paid in cash',
  'Opening float top-up',
  'Miscellaneous cash in/out'
];

const EXPENSE_CATEGORIES = [
  'Tea & Refreshments',
  'Logistics & Delivery',
  'Repairs & Maintenance',
  'Office Supplies',
  'Staff Meal & Welfare',
  'Utilities & Bills',
  'Cleaning & Sanitation',
  'Miscellaneous'
];

const CURRENCY_DENOMINATIONS = [
  { key: '2000', label: '₹2,000', value: 2000 },
  { key: '500', label: '₹500', value: 500 },
  { key: '200', label: '₹200', value: 200 },
  { key: '100', label: '₹100', value: 100 },
  { key: '50', label: '₹50', value: 50 },
  { key: '20', label: '₹20', value: 20 },
  { key: '10', label: '₹10', value: 10 },
  { key: 'coins', label: 'Coins', value: 1 }
];

function SessionModal({ open, session, vendors = [], onClose, showToast, onChanged }) {
  const [openingMode, setOpeningMode] = useState('DENOMINATIONS'); // 'DENOMINATIONS' or 'LUMPSUM'
  const [openingCash, setOpeningCash] = useState('');
  const [denominations, setDenominations] = useState({
    '2000': 0, '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, coins: 0
  });

  const [activeTab, setActiveTab] = useState('CASH_IN'); // 'CASH_IN' | 'CASH_OUT' | 'EXPENSE' | 'CLOSE' | 'HISTORY'
  const [cashInKind, setCashInKind] = useState('GENERAL'); // 'GENERAL' | 'VENDOR_REPAY'
  const [entry, setEntry] = useState({
    type: 'IN',
    amount: '',
    reason: CASH_REASONS[0],
    person: '',
    vendorId: '',
    purpose: '',
    classification: 'OFFICIAL', // 'OFFICIAL' | 'UNOFFICIAL' | 'VENDOR_REPAY'
    expenseCategory: EXPENSE_CATEGORIES[0]
  });

  const [closingMode, setClosingMode] = useState('DENOMINATIONS');
  const [closingDenominations, setClosingDenominations] = useState({
    '2000': 0, '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, coins: 0
  });
  const [countedCash, setCountedCash] = useState('');
  const [busy, setBusy] = useState(false);

  const isOpen = session?.status === 'open';

  // Compute opening cash sum from denominations (REQ-03)
  const denominationTotal = useMemo(() => {
    return CURRENCY_DENOMINATIONS.reduce((sum, d) => {
      const count = Number(denominations[d.key]) || 0;
      return sum + count * d.value;
    }, 0);
  }, [denominations]);

  // Compute closing cash sum from denominations (REQ-03)
  const closingDenominationTotal = useMemo(() => {
    return CURRENCY_DENOMINATIONS.reduce((sum, d) => {
      const count = Number(closingDenominations[d.key]) || 0;
      return sum + count * d.value;
    }, 0);
  }, [closingDenominations]);

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

  const handleOpenSession = async () => {
    const finalAmount = openingMode === 'DENOMINATIONS' ? denominationTotal : Number(openingCash);
    if (!finalAmount || finalAmount < 0) {
      showToast('Please enter a valid opening cash float.', 'error');
      return;
    }
    await act(() =>
      api.post('/session/open', {
        openingCash: finalAmount,
        denominations: openingMode === 'DENOMINATIONS' ? denominations : undefined
      })
    );
    onClose();
  };

  const handleRecordEntry = async () => {
    if (!entry.amount || Number(entry.amount) <= 0) {
      showToast('Enter a valid amount.', 'error');
      return;
    }

    const isRepay = activeTab === 'CASH_IN' && cashInKind === 'VENDOR_REPAY';
    const finalClassification =
      activeTab === 'EXPENSE'
        ? 'EXPENSE'
        : isRepay
        ? 'VENDOR_REPAY'
        : entry.classification;

    await act(() =>
      api.post('/session/cash-entry', {
        type: activeTab === 'CASH_OUT' || activeTab === 'EXPENSE' ? 'OUT' : 'IN',
        amount: Number(entry.amount),
        reason:
          activeTab === 'EXPENSE'
            ? `Internal Expense: ${entry.expenseCategory}`
            : isRepay
            ? `Vendor Debt Repayment: ${entry.person || 'Vendor'}`
            : entry.purpose || entry.reason,
        person: entry.person,
        vendorId: isRepay ? entry.vendorId : undefined,
        purpose:
          activeTab === 'EXPENSE'
            ? entry.purpose || entry.expenseCategory
            : isRepay
            ? entry.purpose || `Vendor Debt Repayment (${entry.person || 'Vendor'})`
            : entry.purpose || entry.reason,
        classification: finalClassification,
        expenseCategory: activeTab === 'EXPENSE' ? entry.expenseCategory : undefined
      })
    );

    setEntry({
      type: 'IN',
      amount: '',
      reason: CASH_REASONS[0],
      person: '',
      vendorId: '',
      purpose: '',
      classification: 'OFFICIAL',
      expenseCategory: EXPENSE_CATEGORIES[0]
    });
  };

  const handleCloseSession = async () => {
    const finalCounted = closingMode === 'DENOMINATIONS' ? closingDenominationTotal : (countedCash !== '' ? Number(countedCash) : undefined);
    await act(() =>
      api.post('/session/close', {
        countedCash: finalCounted,
        closingDenominations: closingMode === 'DENOMINATIONS' ? closingDenominations : undefined
      })
    );
    onClose();
  };

  const cashIn = (session?.cashEntries || []).filter((e) => e.type === 'IN').reduce((s, e) => s + e.amount, 0);
  const cashOut = (session?.cashEntries || []).filter((e) => e.type === 'OUT').reduce((s, e) => s + e.amount, 0);

  const effectiveCounted = closingMode === 'DENOMINATIONS' ? closingDenominationTotal : (countedCash !== '' ? Number(countedCash) : session?.currentCash || 0);
  const variance = effectiveCounted - (session?.currentCash || 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isOpen ? 'Counter Cash & Drawer Management' : 'Open Counter Cash Float'}
      subtitle={
        isOpen
          ? `Opened ${fmtDateTime(session.openedAt)} by ${session.openedBy} · Current Drawer Balance: ${money(session.currentCash, { decimals: false })}`
          : 'Record opening cash denominations and float to start shift.'
      }
      icon={Wallet}
      size="xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {!isOpen ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <span className="text-xs font-bold text-[color:var(--text-primary)]">Opening Cash Marking</span>
              <p className="text-[11px] text-[color:var(--text-muted)]">Count notes by denomination or enter lumpsum opening cash</p>
            </div>
            <SegmentedControl
              value={openingMode}
              onChange={setOpeningMode}
              options={[
                { value: 'DENOMINATIONS', label: 'By Notes (Denominations)' },
                { value: 'LUMPSUM', label: 'Quick Lumpsum' }
              ]}
            />
          </div>

          {openingMode === 'DENOMINATIONS' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {CURRENCY_DENOMINATIONS.map((d) => {
                  const count = denominations[d.key] || 0;
                  const rowSum = count * d.value;
                  return (
                    <div
                      key={d.key}
                      className="p-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-indigo-600 dark:text-indigo-400 font-mono">{d.label}</span>
                        <span className="tabular text-[11px] text-[color:var(--text-secondary)]">₹{rowSum.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[color:var(--text-muted)]">Count:</span>
                        <input
                          type="number"
                          min="0"
                          value={denominations[d.key] === 0 ? '' : denominations[d.key]}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                            setDenominations({ ...denominations, [d.key]: val });
                          }}
                          placeholder="0"
                          className="tabular w-full px-2 py-1 text-xs font-bold rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-xl p-3.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800">
                <div>
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Total Opening Cash Calculated</span>
                  <p className="text-[11px] text-indigo-700/70 dark:text-indigo-300/70">Sum of all currency note denominations</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    ₹{denominationTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <Field label="Opening cash float amount" required>
              <Input
                type="number"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="e.g. 2000"
                className="tabular text-[19px] font-bold"
                autoFocus
              />
            </Field>
          )}

          <Button
            variant="primary"
            icon={Unlock}
            size="lg"
            loading={busy}
            onClick={handleOpenSession}
            className="w-full"
          >
            Confirm & Open Counter Session
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatTile label="Opening Float" value={money(session.openingCash, { decimals: false })} />
            <StatTile label="Cash Received (In)" value={money(cashIn, { decimals: false })} tone="success" />
            <StatTile label="Cash Issued (Out)" value={money(cashOut, { decimals: false })} tone="danger" />
            <StatTile label="Live Drawer Balance" value={money(session.currentCash, { decimals: false })} tone="accent" />
          </div>

          <div className="flex border-b border-[color:var(--border-subtle)] gap-1 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('CASH_IN')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'CASH_IN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              + Cash In (REQ-04)
            </button>
            <button
              onClick={() => setActiveTab('CASH_OUT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'CASH_OUT'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              − Cash Out (REQ-04)
            </button>
            <button
              onClick={() => setActiveTab('EXPENSE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'EXPENSE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              💼 Internal Expense (REQ-06)
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              📜 Movements Log ({session.cashEntries?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('CLOSE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ml-auto ${
                activeTab === 'CLOSE'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 hover:bg-red-100'
              }`}
            >
              🔒 Close Shift
            </button>
          </div>

          {activeTab === 'CASH_IN' && (
            <div className="space-y-3 rounded-2xl p-3.5 bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-xs text-[color:var(--text-primary)]">Record Cash In</span>
                  <p className="text-[10.5px] text-[color:var(--text-muted)]">
                    Record float addition, customer advance, or vendor debt repayment / refund
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SegmentedControl
                    value={cashInKind}
                    onChange={(val) => {
                      setCashInKind(val);
                      if (val === 'VENDOR_REPAY') {
                        setEntry((prev) => ({
                          ...prev,
                          purpose: prev.person ? `Debt clearance repayment from ${prev.person}` : 'Vendor Cash Debt Repayment',
                          classification: 'OFFICIAL'
                        }));
                      } else {
                        setEntry((prev) => ({ ...prev, vendorId: '', purpose: '' }));
                      }
                    }}
                    options={[
                      { value: 'GENERAL', label: '💵 General Cash In' },
                      { value: 'VENDOR_REPAY', label: '🤝 Vendor Cash Repay' }
                    ]}
                  />

                  {cashInKind === 'GENERAL' && (
                    <SegmentedControl
                      value={entry.classification}
                      onChange={(cls) => setEntry({ ...entry, classification: cls })}
                      options={[
                        { value: 'OFFICIAL', label: 'Official Inflow' },
                        { value: 'UNOFFICIAL', label: 'Unofficial (REQ-05)' }
                      ]}
                    />
                  )}
                </div>
              </div>

              {cashInKind === 'VENDOR_REPAY' && (
                <div className="rounded-xl p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-900 dark:text-purple-200">
                      Vendor Debt Repayment / Refund Entry
                    </span>
                    <span className="text-[11px] text-purple-700/80 dark:text-purple-300/80 font-medium">
                      Credits vendor ledger & debits cash drawer
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Field label="Select Vendor from Database" hint="Picks existing registered vendor">
                      <Select
                        value={entry.vendorId || ''}
                        onChange={(e) => {
                          const vId = e.target.value;
                          const found = vendors.find((v) => v.id === vId);
                          setEntry({
                            ...entry,
                            vendorId: vId,
                            person: found ? found.name : entry.person,
                            purpose: found ? `Debt repayment from ${found.name}` : 'Vendor Cash Repay'
                          });
                        }}
                      >
                        <option value="">-- Select Vendor from Database --</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} {v.phone ? `(${v.phone})` : ''} {v.outstanding > 0 ? `· Due: ₹${v.outstanding}` : ''}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Vendor Name (or Custom / Unlisted)" required>
                      <Input
                        value={entry.person}
                        onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                        placeholder="Vendor / Supplier Name"
                      />
                    </Field>
                  </div>

                  {entry.vendorId && (
                    <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-purple-100/70 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 font-semibold">
                      <span>
                        Registered Vendor: {vendors.find((v) => v.id === entry.vendorId)?.name}
                      </span>
                      <span>
                        Current Balance / Payable: {money(vendors.find((v) => v.id === entry.vendorId)?.outstanding || 0)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Field label="Amount (₹)" required>
                  <Input
                    type="number"
                    value={entry.amount}
                    onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
                    placeholder="e.g. 1000"
                    className="tabular font-bold"
                    autoFocus
                  />
                </Field>

                {cashInKind === 'GENERAL' && (
                  <Field label="Received From (Person / Source)" required>
                    <Input
                      value={entry.person}
                      onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                      placeholder="e.g. Cashier / Owner / Bank"
                    />
                  </Field>
                )}

                <Field label="Purpose / Notes" className={cashInKind === 'VENDOR_REPAY' ? 'sm:col-span-2' : ''}>
                  <Input
                    value={entry.purpose}
                    onChange={(e) => setEntry({ ...entry, purpose: e.target.value })}
                    placeholder={cashInKind === 'VENDOR_REPAY' ? 'e.g. Small debt clearance / Return refund' : 'e.g. Added change float / top-up'}
                  />
                </Field>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="primary"
                  icon={ArrowDownToLine}
                  loading={busy}
                  disabled={!entry.amount || (cashInKind === 'VENDOR_REPAY' && !entry.person)}
                  onClick={handleRecordEntry}
                >
                  {cashInKind === 'VENDOR_REPAY'
                    ? `Record Vendor Cash Repay (${entry.person || 'Vendor'})`
                    : `Record Cash In (${entry.classification})`}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'CASH_OUT' && (
            <div className="space-y-3 rounded-2xl p-3.5 bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-[color:var(--text-primary)]">Record Cash Out</span>
                  <p className="text-[10.5px] text-[color:var(--text-muted)]">Record cash withdrawn for bank deposit, vendor payment, or owner drawing</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-[color:var(--text-muted)] font-semibold">Classification:</span>
                  <SegmentedControl
                    value={entry.classification}
                    onChange={(cls) => setEntry({ ...entry, classification: cls })}
                    options={[
                      { value: 'OFFICIAL', label: 'Official Outflow' },
                      { value: 'UNOFFICIAL', label: 'Unofficial (REQ-05)' }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Field label="Amount (₹)" required>
                  <Input
                    type="number"
                    value={entry.amount}
                    onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
                    placeholder="e.g. 500"
                    className="tabular font-bold"
                    autoFocus
                  />
                </Field>

                <Field label="Paid To / Issued To (Person)" required>
                  <Input
                    value={entry.person}
                    onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                    placeholder="e.g. Delivery agent / Supplier / Owner"
                  />
                </Field>

                <Field label="Purpose / Reason">
                  <Input
                    value={entry.purpose}
                    onChange={(e) => setEntry({ ...entry, purpose: e.target.value })}
                    placeholder="e.g. Bank deposit / Vendor cash"
                  />
                </Field>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="primary"
                  icon={ArrowUpFromLine}
                  loading={busy}
                  disabled={!entry.amount}
                  onClick={handleRecordEntry}
                >
                  Record Cash Out ({entry.classification})
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'EXPENSE' && (
            <div className="space-y-3 rounded-2xl p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
              <div>
                <span className="font-bold text-xs text-amber-900 dark:text-amber-200">Internal Business Expense Entry (REQ-06)</span>
                <p className="text-[10.5px] text-amber-700/80 dark:text-amber-300/80">
                  Records shop operational expense paid directly from counter drawer cash. Automatically posts an accounting expense voucher.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <Field label="Amount (₹)" required>
                  <Input
                    type="number"
                    value={entry.amount}
                    onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
                    placeholder="e.g. 150"
                    className="tabular font-bold"
                    autoFocus
                  />
                </Field>

                <Field label="Expense Category" required>
                  <Select
                    value={entry.expenseCategory}
                    onChange={(e) => setEntry({ ...entry, expenseCategory: e.target.value })}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Paid To / Vendor">
                  <Input
                    value={entry.person}
                    onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                    placeholder="e.g. Tea shop / Courier / Electrician"
                  />
                </Field>

                <Field label="Remarks / Details">
                  <Input
                    value={entry.purpose}
                    onChange={(e) => setEntry({ ...entry, purpose: e.target.value })}
                    placeholder="e.g. Evening staff tea & snacks"
                  />
                </Field>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="primary"
                  icon={ArrowUpFromLine}
                  loading={busy}
                  disabled={!entry.amount}
                  onClick={handleRecordEntry}
                >
                  Record Internal Expense
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'HISTORY' && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-[color:var(--text-primary)]">Shift Cash Movements & Audit History</span>
              {(session.cashEntries || []).length === 0 ? (
                <div className="py-6 text-center text-xs text-[color:var(--text-muted)]">No cash movements recorded yet in this shift</div>
              ) : (
                <DataTable
                  maxHeight="30vh"
                  dense
                  columns={[
                    { key: 'time', label: 'Time', width: 130, render: (e) => fmtDateTime(e.time) },
                    {
                      key: 'type',
                      label: 'Type',
                      width: 90,
                      render: (e) => (
                        <Badge tone={e.type === 'IN' ? 'success' : 'danger'}>
                          {e.type === 'IN' ? 'CASH IN' : 'CASH OUT'}
                        </Badge>
                      )
                    },
                    {
                      key: 'classification',
                      label: 'Classification',
                      width: 130,
                      render: (e) => (
                        <Badge
                          tone={
                            e.classification === 'VENDOR_REPAY'
                              ? 'accent'
                              : e.classification === 'EXPENSE'
                              ? 'warning'
                              : e.classification === 'UNOFFICIAL'
                              ? 'neutral'
                              : 'success'
                          }
                        >
                          {e.classification === 'VENDOR_REPAY' ? '🤝 VENDOR REPAY' : e.classification || 'OFFICIAL'}
                        </Badge>
                      )
                    },
                    {
                      key: 'person',
                      label: 'Person / Recipient',
                      render: (e) => e.person || '—'
                    },
                    { key: 'reason', label: 'Reason / Purpose' },
                    {
                      key: 'amount',
                      label: 'Amount',
                      align: 'right',
                      width: 110,
                      render: (e) => <Money value={e.amount} />
                    }
                  ]}
                  rows={[...session.cashEntries].reverse()}
                  rowKey={(e, i) => i}
                />
              )}
            </div>
          )}

          {activeTab === 'CLOSE' && (
            <div className="space-y-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[color:var(--text-primary)]">Counter Closing & Cash Count (REQ-03)</span>
                  <p className="text-[11px] text-[color:var(--text-muted)]">Count closing physical cash to reconcile drawer and compute variance</p>
                </div>
                <SegmentedControl
                  value={closingMode}
                  onChange={setClosingMode}
                  options={[
                    { value: 'DENOMINATIONS', label: 'Count by Notes' },
                    { value: 'LUMPSUM', label: 'Quick Lumpsum' }
                  ]}
                />
              </div>

              {closingMode === 'DENOMINATIONS' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CURRENCY_DENOMINATIONS.map((d) => {
                    const count = closingDenominations[d.key] || 0;
                    const rowSum = count * d.value;
                    return (
                      <div
                        key={d.key}
                        className="p-2 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] flex flex-col justify-between gap-1"
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-indigo-600 dark:text-indigo-400 font-mono">{d.label}</span>
                          <span className="tabular text-[10.5px] text-[color:var(--text-secondary)]">₹{rowSum.toLocaleString('en-IN')}</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={closingDenominations[d.key] === 0 ? '' : closingDenominations[d.key]}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                            setClosingDenominations({ ...closingDenominations, [d.key]: val });
                          }}
                          placeholder="0"
                          className="tabular w-full px-2 py-0.5 text-xs font-bold rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-right"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Field label="Physically counted cash" hint="Any variance is recorded against this session">
                  <Input
                    type="number"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    placeholder={String(session.currentCash)}
                    className="tabular font-bold"
                  />
                </Field>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[color:var(--text-muted)]">Expected Cash</span>
                  <div className="text-sm font-bold font-mono text-[color:var(--text-primary)]">
                    {money(session.currentCash)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[color:var(--text-muted)]">Physically Counted</span>
                  <div className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    ₹{effectiveCounted.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-[color:var(--text-muted)]">Variance</span>
                  <div className={`text-sm font-bold font-mono ${variance === 0 ? 'text-emerald-600' : variance > 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                    {variance >= 0 ? `+₹${variance.toLocaleString('en-IN')}` : `-₹${Math.abs(variance).toLocaleString('en-IN')}`}
                    {variance === 0 ? ' (Matched)' : variance > 0 ? ' (Excess)' : ' (Shortage)'}
                  </div>
                </div>
              </div>

              <Button
                variant="danger"
                icon={Lock}
                size="lg"
                loading={busy}
                onClick={handleCloseSession}
                className="w-full"
              >
                Confirm & Close Counter Session
              </Button>
            </div>
          )}
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
