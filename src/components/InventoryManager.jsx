import React, { useEffect, useMemo, useState, useDeferredValue, useRef } from 'react';
import {
  Package,
  Plus,
  Edit3,
  Trash2,
  Upload,
  AlertTriangle,
  Barcode,
  Tag,
  Boxes,
  History,
  IndianRupee,
  Save,
  Printer,
  Layers,
  ScanLine,
  Building2,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Eye,
  CheckCircle,
  ArrowRightLeft,
  XCircle,
  Image as ImageIcon,
  Sliders,
  Scissors,
  Check,
  Search,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  X as XIcon
} from 'lucide-react';

import api, { money, API_BASE, fmtDateTime } from '../lib/api';
import { useDragReorder, DragHandle, moveItem } from '../lib/dragReorder';
import {
  Panel,
  SectionHeader,
  StatTile,
  Button,
  Modal,
  Field,
  Input,
  Select,
  MultiSelect,
  Textarea,
  Badge,
  Spinner,
  EmptyState,
  SearchInput,
  cx
} from '../lib/ui';
import { exportReport } from '../lib/exporters';
import BarcodePrinterModal from './BarcodePrinterModal';
import { getProductAutoVisual, getProductImageUrl, fetchRealProductPhoto, formatUnitBreakdown } from './POSTerminal';
import { getCategoryTheme, AVAILABLE_CATEGORY_COLORS, getNextAvailableColor } from '../lib/categoryTheme';
import { isWholeNumberUnit } from '../lib/units';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Package },
  { id: 'products', label: 'Products', icon: Tag },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'units', label: 'Units', icon: Sliders },
  { id: 'warehouses', label: 'Warehouses & Transfers', icon: Building2 },
  { id: 'adjust', label: 'Stock Adjustment', icon: Boxes },
  { id: 'history', label: 'Stock History', icon: History },
  { id: 'batches', label: 'Batch Tracking', icon: AlertTriangle },
  { id: 'serials', label: 'Serial Tracking', icon: ScanLine },
  { id: 'pricesheet', label: 'Price Sheets', icon: IndianRupee },
  { id: 'importexport', label: 'Import / Export', icon: FileSpreadsheet }
];

const MOVEMENT_TONE = {
  SALE: 'danger',
  PURCHASE: 'success',
  ADJUSTMENT: 'warning',
  TRANSFER: 'info',
  RECIPE: 'info',
  OPENING: 'neutral',
  RETURN: 'accent'
};

export function canonicalProductType(val) {
  if (!val) return 'standard';
  const clean = String(val).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.includes('both') || (clean.includes('raw') && (clean.includes('standard') || clean.includes('std') || clean.includes('product')))) {
    return 'both';
  }
  if (clean.includes('service') || clean.includes('repair')) return 'service';
  if (clean.includes('combo') || clean.includes('bundle')) return 'combo';
  if (clean.includes('composite') || clean.includes('recipe')) return 'composite';
  if (clean === 'raw' || clean === 'rawmaterial' || clean === 'rm' || clean.includes('raw')) {
    return 'raw';
  }
  return 'standard';
}

const PRODUCT_TYPE_LABELS = {
  standard: { label: 'Standard Product', tone: 'neutral' },
  raw: { label: 'Raw Material', tone: 'warning' },
  both: { label: 'Both Raw Material & Standard Product', tone: 'accent' },
  service: { label: 'Service', tone: 'info' },
  combo: { label: 'Combo Bundle', tone: 'accent' },
  composite: { label: 'Composite (Recipe)', tone: 'success' }
};

export default function InventoryManager({ products, categories, onRefresh, showToast, tenant, settings }) {
  const [tab, setTab] = useState('products');
  const [units, setUnits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [posSettings, setPosSettings] = useState({});
  const defaultTaxRate = Number(settings?.tax?.defaultTaxRate) || 5;

  const fetchAuxData = () => {
    api.get('/units').then((res) => setUnits(Array.isArray(res) ? res : res?.data || [])).catch(() => {});
    api.get('/warehouses').then((res) => setWarehouses(Array.isArray(res) ? res : res?.data || [])).catch(() => {});
    api.get('/inventory/summary').then((res) => setSummary(res?.data || res)).catch(() => {});
    api.get('/settings').then((res) => setPosSettings((res?.data || res)?.pos || {})).catch(() => {});
  };

  useEffect(() => {
    onRefresh?.();
    fetchAuxData();
  }, []);

  useEffect(() => {
    fetchAuxData();
  }, [products]);

  const refreshAll = () => {
    onRefresh();
    fetchAuxData();
  };

  const batchAlertCount = useMemo(
    () => findExpiringBatches(products, posSettings.nearExpiryDays).length,
    [products, posSettings.nearExpiryDays]
  );

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Inventory Management"
        title="Products, Stock & Warehouses"
        icon={Package}
        subtitle="Manage product catalog, regional names, multi-barcodes, raw materials, services, multi-warehouse stock transfers, and price sheets."
      />

      <div className="flex flex-wrap gap-1.5 border-b border-[color:var(--border-subtle)] pb-3">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                  : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-subtle)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {t.id === 'batches' && batchAlertCount > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold ${active ? 'bg-white text-indigo-700' : 'bg-red-500 text-white'}`}>
                  {batchAlertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'dashboard' && (
        <DashboardTab summary={summary} products={products} setTab={setTab} nearExpiryDays={posSettings.nearExpiryDays} />
      )}

      {tab === 'products' && (
        <ProductsTab
          products={products}
          categories={categories}
          units={units}
          warehouses={warehouses}
          showToast={showToast}
          onRefresh={refreshAll}
          defaultTaxRate={defaultTaxRate}
          batchTrackingEnabled={Boolean(posSettings.enableBatchTracking)}
          serialTrackingEnabled={Boolean(posSettings.enableSerialTracking)}
          storeNearExpiryDays={posSettings.nearExpiryDays}
          tenant={tenant}
          settings={settings}
        />
      )}

      {tab === 'categories' && (
        <CategoriesTab categories={categories} products={products} showToast={showToast} onRefresh={refreshAll} />
      )}

      {tab === 'units' && (
        <UnitsTab units={units} showToast={showToast} onRefresh={refreshAll} />
      )}

      {tab === 'warehouses' && (
        <WarehousesTab warehouses={warehouses} products={products} showToast={showToast} onRefresh={refreshAll} />
      )}

      {tab === 'adjust' && (
        <AdjustTab products={products} warehouses={warehouses} showToast={showToast} onRefresh={refreshAll} />
      )}

      {tab === 'history' && <HistoryTab products={products} />}

      {tab === 'batches' && (
        <BatchesTab
          products={products}
          showToast={showToast}
          onRefresh={refreshAll}
          storeNearExpiryDays={posSettings.nearExpiryDays}
        />
      )}

      {tab === 'serials' && <SerialsTab products={products} />}

      {tab === 'pricesheet' && (
        <PricesheetTab products={products} categories={categories} showToast={showToast} onRefresh={refreshAll} />
      )}

      {tab === 'importexport' && (
        <ImportExportTab products={products} categories={categories} units={units} showToast={showToast} onRefresh={refreshAll} />
      )}
    </div>
  );
}

/* ------------------------------- Dashboard Tab ------------------------------- */

export function resolveProductStockInfo(p, allProducts = []) {
  if (!p || p.productType === 'service') {
    return { stock: Infinity, effectiveStock: 0, isService: true, isLow: false, isOut: false, label: 'Service (No stock)' };
  }

  const isComposite = p.isComposite || p.productType === 'composite';
  const isCombo = p.productType === 'combo';
  const minStock = Number(p.minStock ?? 5);

  if (isComposite) {
    const ingredients = p.recipe?.ingredients || p.recipeItems || [];
    if (!ingredients.length) {
      return { stock: 0, effectiveStock: 0, isComposite: true, isLow: true, isOut: true, label: `0 ${p.unit || 'portions'} (No ingredients)` };
    }
    let maxCanMake = Infinity;
    for (const ing of ingredients) {
      const raw = allProducts.find((prod) => prod.id === ing.productId);
      const reqQty = Number(ing.qty) || 1;
      const rawStock = raw ? Math.max(0, Number(raw.stock || 0)) : 0;
      const canMake = Math.floor(rawStock / reqQty);
      if (canMake < maxCanMake) maxCanMake = canMake;
    }
    const producible = maxCanMake === Infinity ? 0 : maxCanMake;
    return {
      stock: producible,
      effectiveStock: producible,
      isComposite: true,
      isLow: producible <= minStock,
      isOut: producible <= 0,
      label: `${producible} ${p.unit || 'portions'} (Producible)`
    };
  }

  if (isCombo) {
    const comboItems = p.comboItems || [];
    if (!comboItems.length) {
      return { stock: 0, effectiveStock: 0, isCombo: true, isLow: true, isOut: true, label: `0 ${p.unit || 'combos'} (No items)` };
    }
    let maxCanMake = Infinity;
    for (const item of comboItems) {
      const raw = allProducts.find((prod) => prod.id === item.productId);
      const reqQty = Number(item.qty) || 1;
      const rawStock = raw ? Math.max(0, Number(raw.stock || 0)) : 0;
      const canMake = Math.floor(rawStock / reqQty);
      if (canMake < maxCanMake) maxCanMake = canMake;
    }
    const comboBuyable = maxCanMake === Infinity ? 0 : maxCanMake;
    return {
      stock: comboBuyable,
      effectiveStock: comboBuyable,
      isCombo: true,
      isLow: comboBuyable <= minStock,
      isOut: comboBuyable <= 0,
      label: `${comboBuyable} ${p.unit || 'combos'} (Available)`
    };
  }

  const stk = Number(p.stock || 0);
  return {
    stock: stk,
    effectiveStock: stk,
    isLow: stk <= minStock,
    isOut: stk <= 0,
    label: `${stk} ${p.unit || 'pcs'}`
  };
}

const NEAR_EXPIRY_DAYS = 30;

/** The near-expiry warning window: product's own override, else store-wide default, else the hard fallback. */
function resolveNearExpiryDays(product, storeDefaultDays) {
  return Number(product?.nearExpiryDays) || Number(storeDefaultDays) || NEAR_EXPIRY_DAYS;
}

/** Every batch (across all batch-tracked products) expiring within its product's alert window, or already expired. */
function findExpiringBatches(products, storeDefaultDays = NEAR_EXPIRY_DAYS) {
  const today = new Date();
  const rows = [];
  (products || []).forEach((p) => {
    if (!p.trackBatches || !Array.isArray(p.batches)) return;
    const windowDays = resolveNearExpiryDays(p, storeDefaultDays);
    p.batches.forEach((b) => {
      if (!b.expiryDate || !(Number(b.qty) > 0)) return;
      const days = Math.ceil((new Date(b.expiryDate) - today) / 86400000);
      if (days <= windowDays) rows.push({ product: p, batch: b, days });
    });
  });
  return rows.sort((a, b) => a.days - b.days);
}

function DashboardTab({ summary, products, setTab, nearExpiryDays }) {
  const evaluated = useMemo(
    () => (products || []).map((p) => ({
      product: p,
      stockInfo: resolveProductStockInfo(p, products)
    })),
    [products]
  );

  const lowStock = useMemo(() => evaluated.filter((e) => !e.stockInfo.isService && e.stockInfo.isLow), [evaluated]);
  const outOfStock = useMemo(() => evaluated.filter((e) => !e.stockInfo.isService && e.stockInfo.isOut), [evaluated]);
  const expiringBatches = useMemo(
    () => findExpiringBatches(products, Number(nearExpiryDays) || NEAR_EXPIRY_DAYS),
    [products, nearExpiryDays]
  );

  const recentlyUpdated = useMemo(
    () =>
      [...(products || [])]
        .filter((p) => p.updatedAt)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 8),
    [products]
  );

  if (!summary) return <Spinner text="Loading inventory insights..." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Total Products" value={summary.totalProducts} sub={`${summary.totalUnits || 0} units total`} icon={Package} />
        <StatTile label="Stock Value (Cost)" value={money(summary.stockValueAtCost, { decimals: false })} icon={IndianRupee} />
        <StatTile label="Stock Value (Retail)" value={money(summary.stockValueAtRetail, { decimals: false })} tone="accent" />
        <StatTile
          label="Low Stock Alert"
          value={summary.lowStockCount}
          sub="Requires reorder"
          icon={AlertTriangle}
          tone={summary.lowStockCount > 0 ? 'warning' : 'success'}
        />
        <StatTile
          label="Out of Stock"
          value={summary.outOfStockCount}
          sub="Zero quantity"
          icon={XCircle}
          tone={summary.outOfStockCount > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex items-center justify-between">
          <div>
            <div className="text-xs text-[color:var(--text-muted)] font-medium uppercase">Raw Materials</div>
            <div className="text-2xl font-bold text-[color:var(--text-primary)] mt-1">{summary.rawCount || 0}</div>
          </div>
          <Tag className="h-7 w-7 text-amber-500 opacity-80" />
        </div>
        <div className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex items-center justify-between">
          <div>
            <div className="text-xs text-[color:var(--text-muted)] font-medium uppercase">Services</div>
            <div className="text-2xl font-bold text-[color:var(--text-primary)] mt-1">{summary.serviceCount || 0}</div>
          </div>
          <Scissors className="h-7 w-7 text-sky-500 opacity-80" />
        </div>
        <div className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex items-center justify-between">
          <div>
            <div className="text-xs text-[color:var(--text-muted)] font-medium uppercase">Combos & Bundles</div>
            <div className="text-2xl font-bold text-[color:var(--text-primary)] mt-1">{summary.comboCount || 0}</div>
          </div>
          <Layers className="h-7 w-7 text-indigo-500 opacity-80" />
        </div>
        <div className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex items-center justify-between">
          <div>
            <div className="text-xs text-[color:var(--text-muted)] font-medium uppercase">Composite Items</div>
            <div className="text-2xl font-bold text-[color:var(--text-primary)] mt-1">{summary.compositeCount || 0}</div>
          </div>
          <Boxes className="h-7 w-7 text-emerald-500 opacity-80" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Critical Stock Alerts */}
        <Panel title="Critical Stock Alerts" icon={AlertTriangle} action={<Button size="sm" variant="secondary" onClick={() => setTab('adjust')}>Adjust Stock</Button>}>
          {lowStock.length === 0 ? (
            <EmptyState icon={CheckCircle} title="All Stock Levels Healthy" description="No products are currently at or below minimum stock threshold." />
          ) : (
            <div className="divide-y divide-[color:var(--border-subtle)] max-h-64 overflow-y-auto">
              {lowStock.slice(0, 10).map(({ product: p, stockInfo }) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[color:var(--text-primary)]">{p.name}</div>
                    {p.regionalName && <div className="text-xs text-indigo-600 font-medium">{p.regionalName}</div>}
                    <div className="text-xs text-[color:var(--text-muted)]">
                      {stockInfo.isComposite ? 'Composite Recipe' : stockInfo.isCombo ? 'Combo Bundle' : `Barcode: ${p.barcode || '—'}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${stockInfo.isOut ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      {stockInfo.stock} / {p.minStock ?? 5} {p.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Quick Inventory Actions */}
        <Panel title="Quick Inventory Actions" icon={Package}>
          <div className="grid grid-cols-2 gap-3 p-2">
            <button onClick={() => setTab('products')} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] hover:border-indigo-500 text-left transition-all">
              <Plus className="h-5 w-5 text-indigo-600 mb-2" />
              <div className="font-bold text-sm text-[color:var(--text-primary)]">Add New Product</div>
              <div className="text-xs text-[color:var(--text-muted)]">Create items with regional names, prices & barcodes</div>
            </button>

            <button onClick={() => setTab('warehouses')} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] hover:border-indigo-500 text-left transition-all">
              <ArrowRightLeft className="h-5 w-5 text-indigo-600 mb-2" />
              <div className="font-bold text-sm text-[color:var(--text-primary)]">Warehouse Stock Transfer</div>
              <div className="text-xs text-[color:var(--text-muted)]">Move stock between Main Warehouse & Shop</div>
            </button>

            <button onClick={() => setTab('importexport')} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] hover:border-indigo-500 text-left transition-all">
              <Upload className="h-5 w-5 text-indigo-600 mb-2" />
              <div className="font-bold text-sm text-[color:var(--text-primary)]">Bulk Excel Import</div>
              <div className="text-xs text-[color:var(--text-muted)]">Import catalogue from Excel/CSV template</div>
            </button>

            <button onClick={() => setTab('pricesheet')} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] hover:border-indigo-500 text-left transition-all">
              <IndianRupee className="h-5 w-5 text-indigo-600 mb-2" />
              <div className="font-bold text-sm text-[color:var(--text-primary)]">Manage Price Sheets</div>
              <div className="text-xs text-[color:var(--text-muted)]">Update wholesale, retail & VIP price tiers</div>
            </button>
          </div>
        </Panel>
      </div>

      {expiringBatches.length > 0 && (
        <Panel
          title="Near Expiry / Expired Batches"
          icon={AlertTriangle}
          action={<Button size="sm" variant="secondary" onClick={() => setTab('products')}>Manage Batches</Button>}
        >
          <div className="divide-y divide-[color:var(--border-subtle)] max-h-64 overflow-y-auto">
            {expiringBatches.slice(0, 15).map(({ product: p, batch: b, days }) => {
              const expired = days < 0;
              return (
                <div key={b.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[color:var(--text-primary)]">{p.name}</div>
                    <div className="text-xs text-[color:var(--text-muted)]">
                      Batch {b.batchNo} — {b.qty} {p.unit} — Expires {String(b.expiryDate).slice(0, 10)}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${expired ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'}`}>
                    {expired ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `${days}d left`}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {recentlyUpdated.length > 0 && (
        <Panel
          title="Recently Updated Products"
          icon={RefreshCw}
          action={<Button size="sm" variant="secondary" onClick={() => setTab('products')}>View All Products</Button>}
        >
          <div className="divide-y divide-[color:var(--border-subtle)] max-h-64 overflow-y-auto">
            {recentlyUpdated.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[color:var(--text-primary)]">{p.name}</div>
                  <div className="text-xs text-[color:var(--text-muted)]">
                    {p.isActive === false ? 'Inactive · ' : ''}Barcode: {p.barcode || '—'} · {money(p.price)} / {p.unit}
                  </div>
                </div>
                <span className="text-xs font-medium text-[color:var(--text-muted)]">{fmtDateTime(p.updatedAt)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------- Products Tab ------------------------------- */

function getDefaultSubUnit(unitName, units = []) {
  const u = String(unitName || '').toLowerCase().trim();

  // Look up from unit definitions (new object format)
  const unitObj = units.find((def) => (def.name || def) === u);
  if (unitObj && typeof unitObj === 'object' && unitObj.subUnit) {
    return { name: unitObj.subUnit, factor: unitObj.factor || '' };
  }

  // Hardcoded fallback for backward compat
  if (u === 'kg') return { name: 'g', factor: 1000 };
  if (['ltr', 'l', 'liter', 'liters', 'litre', 'litres'].includes(u)) return { name: 'ml', factor: 1000 };
  if (u === 'dozen') return { name: 'pcs', factor: 12 };
  if (['box', 'carton', 'case'].includes(u)) return { name: 'pcs', factor: 12 };
  if (['m', 'meter', 'metre'].includes(u)) return { name: 'cm', factor: 100 };
  return { name: '', factor: '' };
}

/**
 * Default bigger pack unit to offer as an Additional Unit alongside the base
 * unit — e.g. a 25 kg bag of rice. Purely a starting suggestion; the row is
 * fully editable/removable in the form.
 */
function getDefaultBigUnit(unitName) {
  const u = String(unitName || '').toLowerCase().trim();
  if (u === 'kg') return { unit: 'bag', factor: 25 };
  return null;
}

/** Recomputes Price/MRP for sub-unit and Additional Unit rows still flagged "auto"; a field stops auto-updating once the user types into it directly. */
function recomputeAutoUnitPricing(f) {
  const price = Number(f.price) || 0;
  const mrp = Number(f.mrp) || 0;
  const factorNum = Number(f.customSubUnitFactor) || 0;

  const customSubUnitPrice = f.customSubUnitPriceAuto !== false && factorNum > 0
    ? (price > 0 ? (price / factorNum).toFixed(4) : '')
    : f.customSubUnitPrice;

  const customSubUnitMrp = f.customSubUnitMrpAuto !== false && factorNum > 0
    ? (mrp > 0 ? (mrp / factorNum).toFixed(4) : '')
    : f.customSubUnitMrp;

  const altUnits = Array.isArray(f.altUnits)
    ? f.altUnits.map((u) => {
        const factor = Number(u.factor) || 0;
        const nextPrice = u.priceAuto !== false && factor > 0
          ? (price > 0 ? (price * factor).toFixed(2) : '')
          : u.price;
        const nextMrp = u.mrpAuto !== false && factor > 0
          ? (mrp > 0 ? (mrp * factor).toFixed(2) : '')
          : u.mrp;
        return nextPrice === u.price && nextMrp === u.mrp ? u : { ...u, price: nextPrice, mrp: nextMrp };
      })
    : f.altUnits;

  return { ...f, customSubUnitPrice, customSubUnitMrp, altUnits };
}

// Stable per-row key so removing a row from the middle doesn't reuse the wrong row's state (an index-based key would).
let rowKeySeq = 0;
const genRowKey = () => `row_${Date.now()}_${rowKeySeq++}`;

// Mirrors DEFAULT_CUSTOM_LABELS in the backend's controllers/serials.js.
const DEFAULT_SERIAL_CUSTOM_LABELS = ['Custom Field 1', 'Custom Field 2', 'Custom Field 3', 'Custom Field 4'];

const blankProduct = (categories, defaultTaxRate = 5) => ({
  name: '',
  isActive: true,
  regionalName: '',
  printName: '',
  description: '',
  categoryId: categories[0]?.id || '',
  categoryIds: categories[0]?.id ? [categories[0].id] : [],
  productType: 'standard',
  productTypes: ['standard'],
  barcode: '',
  // Multiple scannable barcodes for the same product (packaging, outer carton, supplier codes,
  // ...) — the "primary" row is always kept in sync with `barcode` above, which is what every
  // other part of the form (Generate/Scan/duplicate-check) reads and writes.
  barcodeList: [{ _key: genRowKey(), code: '', type: 'primary' }],
  sku: '',
  hsn: '',
  unit: 'pcs',
  price: '',
  mrp: '',
  purchasePrice: '',
  marginPercentSp: '',
  marginPercentMrp: '',
  specialPrice: '',
  stock: '',
  minStock: '5',
  imageUrl: '',
  warehouses: { wh_main: 0, wh_shop: 0 },
  
  taxRate: defaultTaxRate,
  dozenQuantity: 12,
  recipeItems: [],
  recipeNotes: '',
  comboItems: [],
  useCustomPricing: false,
  enableMinorUnit: false,
  customSubUnitName: '',
  customSubUnitFactor: '',
  customSubUnitPrice: '',
  customSubUnitPriceAuto: true,
  customSubUnitMrp: '',
  customSubUnitMrpAuto: true,
  customSubUnitBarcode: '',
  altUnits: [],
  requiresWeight: false,
  trackBatches: false,
  batches: [],
  nearExpiryDays: '',
  // Legacy single-string serial list, still used by the Stock Adjustment
  // screen's quick "type comma-separated serials" flow — left untouched.
  trackSerial: false,
  serialNumbers: [],
  // Per-unit serial sheet (Serial No + IMEI + 4 custom fields), managed from
  // the popup this screen opens once "Track Serial Numbers" is checked.
  trackSerials: false,
  serials: [],
  serialCustomLabels: [...DEFAULT_SERIAL_CUSTOM_LABELS],
  // Warranty — the clock starts at the sale, not when the product was added
  // to the catalogue (see markSerialSold on the backend).
  hasWarranty: false,
  warrantyDurationValue: '12',
  warrantyDurationUnit: 'months'
});

/** Live cost math for the recipe builder — mirrors the server's `decorateRecipe` in modules/recipes.js so the UI never surprises the user once it round-trips. */
function computeRecipeTotals(ingredients, products) {
  const rows = (ingredients || [])
    .map((ing) => {
      const material = (products || []).find((p) => p.id === ing.productId);
      const qty = Number(ing.qty) || 0;
      const cost = material ? Number(material.purchasePrice) || 0 : 0;
      return { productId: ing.productId, material, qty, cost, lineCost: qty * cost };
    })
    .filter((r) => r.productId && r.qty > 0);

  const unitCost = rows.reduce((sum, r) => sum + r.lineCost, 0);

  const producible = rows.length
    ? Math.floor(
        Math.min(...rows.map((r) => (r.qty > 0 ? (r.material?.stock || 0) / r.qty : 0)))
      )
    : 0;

  return { rows, unitCost, producible: Math.max(0, Number.isFinite(producible) ? producible : 0) };
}

/** Serial Number Sheet: one row per physical unit — row count always matches the product's Opening Stock quantity. */
function SerialSheetModal({ open, qty, serials, customLabels, onClose, onSave }) {
  const [rows, setRows] = useState([]);
  const [labels, setLabels] = useState(DEFAULT_SERIAL_CUSTOM_LABELS);

  useEffect(() => {
    if (!open) return;
    // Keep existing rows by position, pad with blanks if stock went up, drop from the end if it came back down.
    const base = Array.from({ length: qty }, (_, i) => {
      const existing = serials[i];
      return existing
        ? { ...existing, customFields: Array.isArray(existing.customFields) ? [...existing.customFields] : ['', '', '', ''] }
        : {
            id: `new_serial_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
            serialNo: '',
            imei: '',
            customFields: ['', '', '', ''],
            status: 'IN_STOCK'
          };
    });
    setRows(base);
    setLabels(Array.isArray(customLabels) && customLabels.length === 4 ? [...customLabels] : [...DEFAULT_SERIAL_CUSTOM_LABELS]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qty]);

  const updateRow = (idx, patch) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const autoFillAll = () => {
    setRows((prev) => {
      const used = new Set(prev.map((r) => (r.serialNo || '').trim()).filter(Boolean));
      let seq = 0;
      prev.forEach((r) => {
        const n = parseInt(r.serialNo, 10);
        if (!isNaN(n) && String(n) === String(r.serialNo).trim() && n > seq) seq = n;
      });
      return prev.map((r) => {
        if ((r.serialNo || '').trim()) return r;
        let candidate;
        do {
          seq += 1;
          candidate = String(seq);
        } while (used.has(candidate));
        used.add(candidate);
        return { ...r, serialNo: candidate };
      });
    });
  };

  const duplicateSerials = useMemo(() => {
    const counts = new Map();
    rows.forEach((r) => {
      const v = (r.serialNo || '').trim();
      if (!v) return;
      counts.set(v, (counts.get(v) || 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([v]) => v));
  }, [rows]);

  const filledCount = rows.filter((r) => (r.serialNo || '').trim()).length;

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Serial Number Sheet — ${qty} unit${qty === 1 ? '' : 's'}`}
      subtitle={`${filledCount} of ${qty} serial number(s) entered`}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <span className="text-[11px] text-[color:var(--text-muted)]">
            Blank rows get an auto-generated number on save.
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              type="button"
              variant="primary"
              disabled={duplicateSerials.size > 0}
              onClick={() => onSave(rows, labels)}
            >
              Save Serial Sheet
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {labels.map((lbl, i) => (
            <Field key={i} label={`Custom Field ${i + 1} Label`}>
              <Input
                value={lbl}
                onChange={(e) => setLabels((prev) => prev.map((l, li) => (li === i ? e.target.value : l)))}
                placeholder={DEFAULT_SERIAL_CUSTOM_LABELS[i]}
              />
            </Field>
          ))}
        </div>

        <div className="flex items-center justify-between">
          {duplicateSerials.size > 0 ? (
            <span className="text-[11px] font-semibold text-rose-600">
              Duplicate serial number(s): {[...duplicateSerials].join(', ')} — fix before saving.
            </span>
          ) : <span />}
          <Button type="button" size="sm" variant="secondary" onClick={autoFillAll}>
            Auto-fill blank Serial Numbers
          </Button>
        </div>

        <div className="overflow-x-auto border border-[color:var(--border-subtle)] rounded-lg max-h-[50vh]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[color:var(--bg-subtle)]">
              <tr className="text-left">
                <th className="p-2 w-10">#</th>
                <th className="p-2 min-w-[140px]">Serial No. (max 10 digits)</th>
                <th className="p-2 min-w-[140px]">IMEI</th>
                {labels.map((lbl, i) => (
                  <th key={i} className="p-2 min-w-[120px]">{lbl}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isDup = duplicateSerials.has((row.serialNo || '').trim());
                return (
                  <tr key={row.id || idx} className="border-t border-[color:var(--border-subtle)]">
                    <td className="p-2 text-[color:var(--text-muted)]">{idx + 1}</td>
                    <td className="p-2">
                      <Input
                        value={row.serialNo || ''}
                        onChange={(e) => updateRow(idx, { serialNo: e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 10) })}
                        placeholder="Auto if blank"
                        className={isDup ? 'border-rose-500' : ''}
                      />
                      {isDup && <div className="text-[10px] text-rose-600 mt-0.5">Duplicate</div>}
                    </td>
                    <td className="p-2">
                      <Input
                        value={row.imei || ''}
                        onChange={(e) => updateRow(idx, { imei: e.target.value.replace(/\D/g, '').slice(0, 17) })}
                        placeholder="15–17 digit IMEI"
                      />
                    </td>
                    {[0, 1, 2, 3].map((ci) => (
                      <td className="p-2" key={ci}>
                        <Input
                          value={row.customFields?.[ci] || ''}
                          onChange={(e) => {
                            const cf = [...(row.customFields || ['', '', '', ''])];
                            cf[ci] = e.target.value;
                            updateRow(idx, { customFields: cf });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

/** Summary + trigger for the serial sheet — mirrors the batch table section's role for batch-tracked products. */
function SerialNumberSection({ form, setForm }) {
  const [showSheet, setShowSheet] = useState(false);
  const qty = Math.max(0, Math.floor(Number(form.stock) || 0));
  const entered = (form.serials || []).filter((s) => (s.serialNo || '').trim()).length;

  return (
    <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Serial Number Sheet
          </div>
          <div className="text-[11px] text-[color:var(--text-muted)]">
            {qty > 0
              ? `${entered} of ${qty} unit(s) have a serial number recorded.`
              : 'Set Opening Stock above first — one serial row is created per unit.'}
          </div>
        </div>
        <Button type="button" size="sm" variant="secondary" icon={Tag} onClick={() => setShowSheet(true)} disabled={qty <= 0}>
          {form.serials?.length ? 'Manage Serial Numbers' : 'Open Serial Number Sheet'}
        </Button>
      </div>

      <SerialSheetModal
        open={showSheet}
        qty={qty}
        serials={form.serials || []}
        customLabels={form.serialCustomLabels || DEFAULT_SERIAL_CUSTOM_LABELS}
        onClose={() => setShowSheet(false)}
        onSave={(serials, serialCustomLabels) => {
          setForm((f) => ({ ...f, serials, serialCustomLabels }));
          setShowSheet(false);
        }}
      />
    </div>
  );
}

/* ------------------------------- Reusable Category Creation & Edit Modal ------------------------------- */

export function CategoryFormModal({ open, editing = null, categories = [], showToast, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', icon: '📦', description: '', kotPrinter: '', color: 'indigo' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const currentColor = editing.color || getCategoryTheme(editing)?.id || 'indigo';
      setForm({
        name: editing.name || '',
        icon: editing.icon || '📦',
        description: editing.description || '',
        kotPrinter: editing.kotPrinter || '',
        color: currentColor
      });
    } else {
      const newColor = getNextAvailableColor(categories);
      setForm({
        name: '',
        icon: '📦',
        description: '',
        kotPrinter: '',
        color: newColor
      });
    }
  }, [open, editing, categories]);

  if (!open) return null;

  const save = async (e) => {
    e?.preventDefault();
    if (!form.name?.trim()) {
      showToast?.('Category name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = editing
        ? await api.put(`/categories/${editing.id}`, form)
        : await api.post('/categories', form);

      showToast?.(res.message || (editing ? 'Category updated.' : 'Category created.'));
      const savedCategory = res.data || res;
      onSaved?.(savedCategory);
      onClose?.();
    } catch (err) {
      showToast?.(api.message(err, 'Failed to save category.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} title={editing ? 'Edit Category' : 'Create Category'} icon={Layers} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Category Name *">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
        </Field>
        <Field label="Emoji Icon">
          <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🍎" />
        </Field>

        <Field label="Category Color Theme">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
            {AVAILABLE_CATEGORY_COLORS.map((col) => {
              const isSelected = form.color === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setForm({ ...form, color: col.id })}
                  className={`group relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/50 ring-2 ring-indigo-500/30'
                      : 'border-[color:var(--border-subtle)] hover:border-[color:var(--border)] bg-[color:var(--bg-subtle)]/50'
                  }`}
                  title={col.label}
                >
                  <div
                    className="h-6 w-6 rounded-full shadow-xs flex items-center justify-center text-white transition-transform group-hover:scale-110"
                    style={{ backgroundColor: col.hex }}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-[10px] font-bold text-[color:var(--text-secondary)] truncate max-w-full text-center">
                    {col.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button icon={Save} type="submit" loading={saving} disabled={saving}>Save Category</Button>
        </div>
      </form>
    </Modal>
  );
}

/** The full product create/edit form as its own reusable modal, so screens other than Inventory > Products (e.g. Purchases' quick-add) can open it too. */
export function ProductFormModal({
  open,
  editing,
  categories,
  units,
  warehouses,
  products,
  defaultTaxRate = 5,
  batchTrackingEnabled,
  serialTrackingEnabled,
  storeNearExpiryDays,
  showToast,
  settings,
  onClose,
  onSaved,
  onCategoryCreated,
  hideBatches = false
}) {
  // Scan buttons only make sense if the shop has actually set up a scanner in Settings > Hardware —
  // there's no way for a browser to detect a real USB/Bluetooth scanner directly (it just emulates
  // a keyboard), so this declared configuration is the closest available signal.
  // The Settings → Hardware on/off switch; a missing `enabled` (older saved settings) means on.
  const scannerConnected = settings?.hardware?.barcodeScanner?.enabled !== false;
  const [form, setForm] = useState(() => blankProduct(categories, defaultTaxRate));
  const [localCategories, setLocalCategories] = useState(categories || []);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [findingPhoto, setFindingPhoto] = useState(false);
  const [writeOffTarget, setWriteOffTarget] = useState(null);
  const [writeOffForm, setWriteOffForm] = useState({ qty: '', reason: 'Expired' });
  const [writingOff, setWritingOff] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const [barcodeWarning, setBarcodeWarning] = useState(null);
  const [barcodeExample, setBarcodeExample] = useState(null);
  const barcodeInputRef = useRef(null);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [skuWarning, setSkuWarning] = useState(null);

  const skuFormatField = (settings?.barcodeFormat || []).find((f) => f.type === 'sku');
  const idFormatField = (settings?.barcodeFormat || []).find((f) => f.type === 'id');
  const targetSkuLength = Number(skuFormatField?.enabled !== false && skuFormatField?.length ? skuFormatField.length : (idFormatField?.length || 5)) || 5;
  const targetBarcodeLength = Number(settings?.barcode?.digits) || Number(idFormatField?.length) || 6;
  const barcodePrefix = settings?.barcode?.prefix || '';
  

  useEffect(() => {
    setLocalCategories(categories || []);
  }, [categories]);

  const handleCategorySaved = (newCat) => {
    if (!newCat || !newCat.id) return;
    setLocalCategories((prev) => (prev.some((c) => c.id === newCat.id) ? prev : [...prev, newCat]));
    setForm((prev) => {
      const currentIds = Array.isArray(prev.categoryIds) ? prev.categoryIds : (prev.categoryId ? [prev.categoryId] : []);
      const updatedIds = currentIds.includes(newCat.id) ? currentIds : [...currentIds, newCat.id];
      return {
        ...prev,
        categoryIds: updatedIds,
        categoryId: prev.categoryId || newCat.id
      };
    });
    setShowCategoryModal(false);
    onCategoryCreated?.(newCat);
  };

  // Locked on until every batch is sold/written off to zero, measured against `editing` (persisted) so it can't be gamed via unsaved `form` edits.
  const lockedBatchRemainingQty = useMemo(() => {
    if (!editing?.trackBatches) return 0;
    return (editing.batches || []).reduce((sum, b) => sum + (Number(b.qty) || 0), 0);
  }, [editing]);
  const lockTrackBatchesOff = lockedBatchRemainingQty > 0;

  const unitNameList = useMemo(
    () => (units || []).map((u) => (typeof u === 'object' ? u.name : u)).filter(Boolean),
    [units]
  );

  // Seeds `form` from the product being edited whenever the modal opens or the target changes (mirrors the old openAdd/openEdit logic).
  useEffect(() => {
    if (!open) return;
    if (!editing) {
      setForm(blankProduct(categories, defaultTaxRate));
      return;
    }
    const product = editing;
    const def = getDefaultSubUnit(product.unit, units);
    const hasCustom = !!product.customSubUnitName && Number(product.customSubUnitFactor) > 0;
    const enableMinor = product.enableMinorUnit !== undefined ? Boolean(product.enableMinorUnit) : (!!def.name || hasCustom);

    const subName = product.customSubUnitName || def.name || '';
    const subFactor = product.customSubUnitFactor || def.factor || '';
    const subPrice = product.customSubUnitPrice || (subFactor && product.price ? (Number(product.price) / Number(subFactor)).toFixed(4) : '');
    const subMrp = product.customSubUnitMrp || (subFactor && product.mrp ? (Number(product.mrp) / Number(subFactor)).toFixed(4) : '');

    const rawType = product.productType || (Array.isArray(product.productTypes) && product.productTypes.length > 1 ? 'both' : product.productTypes?.[0]) || 'standard';
    const primaryType = canonicalProductType(rawType);
    const resolvedTypes = primaryType === 'both' ? ['standard', 'raw'] : [primaryType];

    let rawBarcodes = [];
    if (Array.isArray(product.barcodes) && product.barcodes.length > 0) {
      rawBarcodes = product.barcodes.map(String).map((b) => b.trim()).filter(Boolean);
    } else if (typeof product.barcodes === 'string' && product.barcodes.trim()) {
      rawBarcodes = product.barcodes.split(',').map((b) => b.trim()).filter(Boolean);
    }
    const primaryBarcode = String(product.barcode || rawBarcodes[0] || '').trim();
    if (primaryBarcode && !rawBarcodes.includes(primaryBarcode)) rawBarcodes.unshift(primaryBarcode);

    let barcodeList = [];
    if (Array.isArray(product.barcodeDetails) && product.barcodeDetails.length > 0) {
      barcodeList = product.barcodeDetails.map((b) => ({
        _key: genRowKey(),
        code: b.code || '',
        type: b.type || (b.code === primaryBarcode ? 'primary' : 'alternate')
      }));
    } else {
      barcodeList = rawBarcodes.map((code, idx) => ({
        _key: genRowKey(),
        code,
        type: code === primaryBarcode || (idx === 0 && !primaryBarcode) ? 'primary' : 'alternate'
      }));
    }
    if (barcodeList.length === 0) barcodeList = [{ _key: genRowKey(), code: '', type: 'primary' }];

    setForm({
      ...blankProduct(categories),
      ...product,
      categoryIds: Array.isArray(product.categoryIds) && product.categoryIds.length
        ? product.categoryIds
        : product.categoryId
        ? [product.categoryId]
        : [],
      productType: primaryType,
      productTypes: resolvedTypes,
      regionalName: product.regionalName || product.printName || '',
      sku: product.sku || '',
      barcode: primaryBarcode,
      barcodeList,
      warehouses: product.warehouses || {},
      dozenQuantity: product.dozenQuantity || 12,
      enableMinorUnit: enableMinor,
      customSubUnitName: subName,
      customSubUnitFactor: subFactor,
      customSubUnitPrice: subPrice,
      customSubUnitPriceAuto: !product.customSubUnitPrice,
      customSubUnitMrp: subMrp,
      customSubUnitMrpAuto: !product.customSubUnitMrp,
      customSubUnitBarcode: product.customSubUnitBarcode || '',
      altUnits: Array.isArray(product.altUnits)
        ? product.altUnits
            .filter((u) => u && u.unit && String(u.unit).toLowerCase() !== String(subName).toLowerCase())
            .map((u) => ({ ...u, priceAuto: !u.price, mrpAuto: !u.mrp }))
        : [],
      requiresWeight: Boolean(product.requiresWeight),
      trackBatches: Boolean(product.trackBatches),
      batches: Array.isArray(product.batches) ? product.batches.map((b) => ({ ...b })) : [],
      nearExpiryDays: product.nearExpiryDays ?? '',
      trackSerial: Boolean(product.trackSerial || (Array.isArray(product.serialNumbers) && product.serialNumbers.length > 0)),
      serialNumbers: Array.isArray(product.serialNumbers) ? [...product.serialNumbers] : [],
      trackSerials: Boolean(product.trackSerials),
      serials: Array.isArray(product.serials) ? product.serials.map((s) => ({ ...s })) : [],
      serialCustomLabels: Array.isArray(product.serialCustomLabels) && product.serialCustomLabels.length === 4
        ? [...product.serialCustomLabels]
        : [...DEFAULT_SERIAL_CUSTOM_LABELS],
      hasWarranty: Boolean(product.hasWarranty),
      warrantyDurationValue: product.warrantyDurationValue ?? '12',
      warrantyDurationUnit: product.warrantyDurationUnit || 'months',
      comboItems: Array.isArray(product.comboItems) ? product.comboItems.map((i) => ({ ...i, _key: genRowKey() })) : [],
      recipeItems: Array.isArray(product.recipeItems) && product.recipeItems.length > 0
        ? product.recipeItems.map((i) => ({ ...i, _key: genRowKey() }))
        : Array.isArray(product.recipe?.ingredients)
        ? product.recipe.ingredients.map((i) => ({ ...i, _key: genRowKey() }))
        : [],

      recipeNotes: product.recipeNotes || product.recipe?.notes || '',
      useCustomPricing: product.useCustomPricing || false,
      // Re-derive both from the actual saved Purchase Price/Selling Price/MRP whenever possible,
      // rather than trusting a stored margin — that field only gets set by typing into one of the
      // Margin %, Selling Price or MRP boxes in this same form, so an older product (or one priced
      // by typing Purchase Price after Selling Price) can have real prices but a blank margin.
      marginPercentSp: (() => {
        const pp = Number(product.purchasePrice) || 0;
        if (pp > 0 && product.price) return (((Number(product.price) - pp) / pp) * 100).toFixed(1);
        return product.marginPercentSp || '';
      })(),
      marginPercentMrp: (() => {
        const pp = Number(product.purchasePrice) || 0;
        if (pp > 0 && product.mrp) return (((Number(product.mrp) - pp) / pp) * 100).toFixed(1);
        return product.marginPercentMrp || '';
      })()
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const addIngredient = () => {
    setForm((f) => ({
      ...f,
      recipeItems: [...(f.recipeItems || []), { productId: '', qty: '', _key: genRowKey() }]
    }));
  };

  const updateIngredient = (index, patch) => {
    setForm((f) => {
      const recipeItems = [...(f.recipeItems || [])];
      recipeItems[index] = { ...recipeItems[index], ...patch };
      return { ...f, recipeItems };
    });
  };

  const removeIngredient = (index) => {
    setForm((f) => ({
      ...f,
      recipeItems: (f.recipeItems || []).filter((_, i) => i !== index)
    }));
  };

  const addComboItem = () => {
    setForm((f) => ({
      ...f,
      comboItems: [...(f.comboItems || []), { productId: '', qty: '', _key: genRowKey() }]
    }));
  };

  const updateComboItem = (index, patch) => {
    setForm((f) => {
      const comboItems = [...(f.comboItems || [])];
      comboItems[index] = { ...comboItems[index], ...patch };
      return { ...f, comboItems };
    });
  };

  const removeComboItem = (index) => {
    setForm((f) => ({
      ...f,
      comboItems: (f.comboItems || []).filter((_, i) => i !== index)
    }));
  };

  const addAltUnit = () => {
    setForm((f) => ({
      ...f,
      altUnits: [...(f.altUnits || []), { unit: '', factor: '', price: '', mrp: '', barcode: '', priceAuto: true, mrpAuto: true }]
    }));
  };

  const updateAltUnit = (index, patch) => {
    setForm((f) => {
      const altUnits = [...(f.altUnits || [])];
      altUnits[index] = { ...altUnits[index], ...patch };
      return recomputeAutoUnitPricing({ ...f, altUnits });
    });
  };

  const removeAltUnit = (index) => {
    setForm((f) => ({
      ...f,
      altUnits: (f.altUnits || []).filter((_, i) => i !== index)
    }));
  };

  /** Reserves the next sequential barcode (Settings > Barcode Generation's prefix+digits) — for a normal, piece-sold product's own barcode. */
  const generateBarcode = async () => {
    setGeneratingBarcode(true);
    try {
      const res = await api.post('/products/generate-barcode', {});
      const code = res.data?.barcode || res.barcode;
      setForm((f) => ({ ...f, barcode: code }));
      setBarcodeWarning(null);
    } catch (err) {
      showToast(api.message(err, 'Could not generate a barcode.'), 'error');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  /** Multiple scannable barcodes for the same product (packaging, outer carton, supplier codes, ...) — the "primary" row's code is always mirrored into `form.barcode`, which is what Scan/duplicate-check/save already read. */
  const addBarcodeRow = (initialCode = '') => {
    setForm((f) => {
      const list = Array.isArray(f.barcodeList) ? [...f.barcodeList] : [];
      const isFirst = list.length === 0;
      const newRow = { _key: genRowKey(), code: initialCode || '', type: isFirst ? 'primary' : 'alternate' };
      const nextList = [...list, newRow];
      const primaryCode = nextList.find((b) => b.type === 'primary')?.code || nextList[0]?.code || '';
      return { ...f, barcodeList: nextList, barcode: primaryCode };
    });
  };

  /** Reserves the next sequential barcode from the server (same prefix+digits generator the single Generate button uses) and adds it as a new row. */
  const addGeneratedBarcodeRow = async () => {
    setGeneratingBarcode(true);
    try {
      const res = await api.post('/products/generate-barcode', {});
      const code = res.data?.barcode || res.barcode;
      addBarcodeRow(code);
    } catch (err) {
      showToast(api.message(err, 'Could not generate a barcode.'), 'error');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const updateBarcodeRow = (index, patch) => {
    setForm((f) => {
      const list = Array.isArray(f.barcodeList) ? [...f.barcodeList] : [];
      if (!list[index]) return f;
      const updated = { ...list[index], ...patch };
      const nextList = list.map((item, i) => {
        if (i === index) return updated;
        if (patch.type === 'primary' && item.type === 'primary') return { ...item, type: 'alternate' };
        return item;
      });
      const primaryCode = nextList.find((b) => b.type === 'primary')?.code || nextList[0]?.code || '';
      return { ...f, barcodeList: nextList, barcode: primaryCode };
    });
    setBarcodeWarning(null);
  };

  /** Regenerates one row's code from the sequential server generator (used by that row's own Generate button, including the primary row). */
  const regenerateBarcodeRow = async (index) => {
    setGeneratingBarcode(true);
    try {
      const res = await api.post('/products/generate-barcode', {});
      const code = res.data?.barcode || res.barcode;
      updateBarcodeRow(index, { code });
    } catch (err) {
      showToast(api.message(err, 'Could not generate a barcode.'), 'error');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  /** Everything already typed on this form that a newly generated barcode must not repeat. */
  const formCodesInUse = () => [
    form.sku,
    form.customSubUnitBarcode,
    ...(form.barcodeList || []).map((b) => b.code),
    ...(form.altUnits || []).map((u) => u.barcode)
  ].filter(Boolean);

  /** Reserves the next sequential barcode for the Minor Unit (the smaller sub-unit). */
  const generateMinorUnitBarcode = async () => {
    setGeneratingBarcode(true);
    try {
      const res = await api.post('/products/generate-barcode', { exclude: formCodesInUse() });
      const code = res.data?.barcode || res.barcode;
      setForm((f) => ({ ...f, customSubUnitBarcode: code }));
    } catch (err) {
      showToast(api.message(err, 'Could not generate a barcode.'), 'error');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  /** Reserves the next sequential barcode for one Additional Unit row (bag/box/case). Everything already typed on this form is sent as `exclude`, so generating for several rows never hands out the same number twice. */
  const generateAltUnitBarcode = async (index) => {
    setGeneratingBarcode(true);
    try {
      const res = await api.post('/products/generate-barcode', { exclude: formCodesInUse() });
      const code = res.data?.barcode || res.barcode;
      updateAltUnit(index, { barcode: code });
    } catch (err) {
      showToast(api.message(err, 'Could not generate a barcode.'), 'error');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const makePrimaryBarcode = (index) => {
    setForm((f) => {
      const list = Array.isArray(f.barcodeList) ? [...f.barcodeList] : [];
      if (!list[index]) return f;
      const nextList = list.map((item, i) => ({ ...item, type: i === index ? 'primary' : (item.type === 'primary' ? 'alternate' : item.type) }));
      return { ...f, barcodeList: nextList, barcode: nextList[index]?.code || '' };
    });
  };

  const removeBarcodeRow = (index) => {
    setForm((f) => {
      const list = Array.isArray(f.barcodeList) ? [...f.barcodeList] : [];
      if (list.length <= 1) {
        return { ...f, barcodeList: [{ ...(list[0] || { _key: genRowKey() }), code: '', type: 'primary' }], barcode: '' };
      }
      const wasPrimary = list[index]?.type === 'primary';
      const nextList = list.filter((_, i) => i !== index);
      if (wasPrimary && nextList.length > 0) nextList[0] = { ...nextList[0], type: 'primary' };
      const primaryCode = nextList.find((b) => b.type === 'primary')?.code || nextList[0]?.code || '';
      return { ...f, barcodeList: nextList, barcode: primaryCode };
    });
  };

  const checkBarcodeDuplicate = async (code) => {
    const trimmed = String(code || '').trim();
    if (!trimmed) {
      setBarcodeWarning(null);
      return;
    }
    // Instant local catalogue collision check
    const localConflict = (products || []).find((p) => {
      if (p.id === editing?.id) return false;
      const mainMatch = String(p.barcode || '').trim() === trimmed;
      const altMatch = Array.isArray(p.barcodes) && p.barcodes.some((alt) => String(alt || '').trim() === trimmed);
      return mainMatch || altMatch;
    });
    if (localConflict) {
      setBarcodeWarning(`Barcode "${trimmed}" is already used by "${localConflict.name}"`);
      return;
    }
    try {
      const found = await api.get(`/products/lookup/${encodeURIComponent(trimmed)}`);
      const match = found?.data || found;
      setBarcodeWarning(match && match.id && match.id !== editing?.id ? `Already used by "${match.name}"` : null);
    } catch {
      setBarcodeWarning(null);
    }
  };

  const startScanningBarcode = () => {
    setScanningBarcode(true);
    barcodeInputRef.current?.focus();
  };

  /** Reserves the next sequential SKU from the server padded to target length. */
  const generateSku = async () => {
    setGeneratingSku(true);
    try {
      const res = await api.post('/products/generate-sku');
      const rawSku = res.data?.sku || res.sku;
      let clean = String(rawSku || '').replace(/\D/g, '');

      // Sequence sync: ensure generated SKU strictly succeeds all existing catalog items
      const localMax = (products || []).reduce((max, p) => {
        const num = parseInt(String(p.sku || '').replace(/\D/g, ''), 10);
        return Number.isFinite(num) && num > max ? num : max;
      }, 0);
      const serverNum = parseInt(clean, 10) || 0;
      if (localMax >= serverNum) {
        clean = String(localMax + 1);
      }

      const sku = clean ? clean.padStart(targetSkuLength, '0').slice(-targetSkuLength) : '';
      setForm((f) => ({ ...f, sku }));
      setSkuWarning(null);
    } catch (err) {
      showToast(api.message(err, 'Could not generate a SKU.'), 'error');
    } finally {
      setGeneratingSku(false);
    }
  };

  /** Checks whether a typed/generated SKU already belongs to a different product. */
  const checkSkuDuplicate = async (sku) => {
    const clean = String(sku || '').replace(/\D/g, '').trim();
    if (!clean) {
      setSkuWarning(null);
      return;
    }
    if (clean.length !== targetSkuLength) {
      setSkuWarning(`Settings specify ${targetSkuLength} digits (currently ${clean.length} digits)`);
      return;
    }
    // Instant local catalogue collision check
    const localConflict = (products || []).find((p) => p.id !== editing?.id && String(p.sku || '').trim() === clean);
    if (localConflict) {
      setSkuWarning(`Already used by "${localConflict.name}"`);
      return;
    }
    try {
      const found = await api.get(`/products/lookup/${encodeURIComponent(clean)}`);
      const match = found?.data || found;
      setSkuWarning(match && match.id && match.id !== editing?.id ? `Already used by "${match.name}"` : null);
    } catch {
      setSkuWarning(null);
    }
  };

  const handleSkuBlur = () => {
    if (form.sku) {
      const clean = String(form.sku).replace(/\D/g, '');
      if (clean && clean.length < targetSkuLength) {
        const padded = clean.padStart(targetSkuLength, '0');
        setForm((f) => ({ ...f, sku: padded }));
        checkSkuDuplicate(padded);
        return;
      }
      checkSkuDuplicate(clean);
    } else {
      setSkuWarning(null);
    }
  };

  // Keep every auto-tracked unit price/MRP in sync whenever the main Price or MRP changes.
  useEffect(() => {
    setForm((f) => recomputeAutoUnitPricing(f));
  }, [form.price, form.mrp]);

  

  const addBatchRow = () => {
    setForm((f) => {
      const existing = f.batches || [];
      let maxNum = 0;
      existing.forEach((b) => {
        const num = parseInt(b.batchNo, 10);
        if (!isNaN(num) && String(num) === String(b.batchNo).trim() && num > maxNum) {
          maxNum = num;
        }
      });
      const nextBatchNo = maxNum > 0 ? String(maxNum + 1) : String(existing.length + 1);
      const defaultWh = f.primaryWarehouse || (warehouses || []).find((w) => w.isDefault)?.id || warehouses?.[0]?.id || 'wh_main';

      const newBatches = [
        ...existing,
        {
          id: `new_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          batchNo: nextBatchNo,
          mfgDate: '',
          expiryDate: '',
          qty: '',
          costPrice: f.purchasePrice || '',
          sellPrice: '',
          mrp: f.mrp || '',
          warehouseId: defaultWh
        }
      ];

      const whMap = {};
      newBatches.forEach((b) => {
        const whId = b.warehouseId || defaultWh;
        whMap[whId] = (whMap[whId] || 0) + (Number(b.qty) || 0);
      });
      const stock = newBatches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);

      return {
        ...f,
        batches: newBatches,
        warehouses: whMap,
        stock: Math.round(stock * 10000) / 10000
      };
    });
  };

  const updateBatchRow = (index, patch) => {
    setForm((f) => {
      const batches = [...(f.batches || [])];
      batches[index] = { ...batches[index], ...patch };
      const defaultWh = f.primaryWarehouse || (warehouses || []).find((w) => w.isDefault)?.id || warehouses?.[0]?.id || 'wh_main';
      const whMap = {};
      batches.forEach((b) => {
        const whId = b.warehouseId || defaultWh;
        whMap[whId] = (whMap[whId] || 0) + (Number(b.qty) || 0);
      });
      const stock = batches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);
      return { ...f, batches, warehouses: whMap, stock: Math.round(stock * 10000) / 10000 };
    });
  };

  const removeBatchRow = (index) => {
    setForm((f) => {
      const batches = (f.batches || []).filter((_, i) => i !== index);
      const defaultWh = f.primaryWarehouse || (warehouses || []).find((w) => w.isDefault)?.id || warehouses?.[0]?.id || 'wh_main';
      const whMap = {};
      batches.forEach((b) => {
        const whId = b.warehouseId || defaultWh;
        whMap[whId] = (whMap[whId] || 0) + (Number(b.qty) || 0);
      });
      const stock = batches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);
      return { ...f, batches, warehouses: whMap, stock: Math.round(stock * 10000) / 10000 };
    });
  };

  const submitWriteOff = async (e) => {
    e?.preventDefault();
    if (!writeOffTarget) return;
    const qty = Number(writeOffForm.qty);
    if (!(qty > 0)) {
      showToast('Enter a quantity to write off.', 'error');
      return;
    }
    setWritingOff(true);
    try {
      await api.post('/inventory/batches/writeoff', {
        productId: writeOffTarget.product.id,
        batchId: writeOffTarget.batch.id,
        quantity: qty,
        reason: writeOffForm.reason
      });
      showToast(`Wrote off ${qty} ${writeOffTarget.product.unit} from batch ${writeOffTarget.batch.batchNo}.`);
      setWriteOffTarget(null);
      onSaved?.();
    } catch (err) {
      showToast(api.message(err, 'Failed to write off batch.'), 'error');
    } finally {
      setWritingOff(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setUploadingImage(true);
    try {
      const res = await api.post('/upload', formData);
      if (res.success) {
        setForm((prev) => ({ ...prev, imageUrl: res.url }));
        showToast('Image uploaded successfully.');
      } else {
        showToast(res.message || 'Upload failed.', 'error');
      }
    } catch (err) {
      showToast(api.message(err, 'Failed to upload image.'), 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const autoFindRealPhoto = async () => {
    if (!form.name && !form.barcodes && !form.barcode) {
      showToast('Enter product name or barcode first.', 'error');
      return;
    }
    setFindingPhoto(true);
    try {
      const barcode = String(form.barcodes || form.barcode || '').split(',')[0].trim();
      const photo = await fetchRealProductPhoto(form.name, barcode);
      if (photo) {
        setForm((prev) => ({ ...prev, imageUrl: photo }));
        showToast('Real product photo found & attached!', 'success');
      } else {
        showToast('No online photo found for this item name.', 'error');
      }
    } catch (err) {
      showToast('Could not fetch real photo.', 'error');
    } finally {
      setFindingPhoto(false);
    }
  };

  const save = async (e) => {
    e?.preventDefault();
    if (saving) return;
    if (!form.name || form.price === undefined || form.price === '') {
      showToast('Product name and selling price are required.', 'error');
      return;
    }

    if (!Array.isArray(form.categoryIds) || form.categoryIds.length === 0) {
      showToast('Select at least one category.', 'error');
      return;
    }

    if (form.trackBatches) {
      const seen = new Set();
      const dupe = (form.batches || []).find((b) => {
        const key = String(b.batchNo || '').trim().toLowerCase();
        if (!key) return false;
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      });
      if (dupe) {
        showToast(`Batch number "${dupe.batchNo}" is used more than once — batch numbers must be unique for this product.`, 'error');
        return;
      }
    }

    const isComposite = form.productType === 'composite';
    const isCombo = form.productType === 'combo';

    const validIngredients = (form.recipeItems || [])
      .filter((i) => i.productId && Number(i.qty) > 0)
      .map((i) => ({ productId: i.productId, qty: Number(i.qty) }));

    const validComboItems = (form.comboItems || [])
      .filter((i) => i.productId && Number(i.qty) > 0)
      .map((i) => ({ productId: i.productId, qty: Number(i.qty) }));

    if (isComposite && validIngredients.length === 0) {
      showToast('A composite product needs a recipe — add at least one raw material with a quantity.', 'error');
      return;
    }

    if (isCombo && validComboItems.length === 0) {
      showToast('A combo bundle needs at least one existing product with a quantity.', 'error');
      return;
    }

    const factorNum = Number(form.customSubUnitFactor);
    let altUnits = Array.isArray(form.altUnits) ? [...form.altUnits] : [];

    if (form.enableMinorUnit && form.customSubUnitName && factorNum > 0) {
      const minorUnit = form.customSubUnitName.trim().toLowerCase();
      const minorFactor = 1 / factorNum; // e.g. 1 g = 0.001 kg
      const minorPrice = form.customSubUnitPrice ? Number(form.customSubUnitPrice) : (Number(form.price) / factorNum);
      const minorMrp = form.customSubUnitMrp ? Number(form.customSubUnitMrp) : (Number(form.mrp) / factorNum);
      const minorBarcode = form.customSubUnitBarcode ? form.customSubUnitBarcode.trim() : '';

      altUnits = altUnits.filter((u) => u.unit !== minorUnit);
      altUnits.push({
        unit: minorUnit,
        factor: minorFactor,
        price: minorPrice,
        mrp: minorMrp,
        barcode: minorBarcode
      });
    }

    const cleanBarcodeList = (form.barcodeList || [])
      .map((b) => ({ ...b, code: String(b.code || '').trim() }))
      .filter((b) => b.code);
    const primaryRow = cleanBarcodeList.find((b) => b.type === 'primary') || cleanBarcodeList[0];
    const primaryBarcode = primaryRow ? primaryRow.code : (form.barcode ? String(form.barcode).trim() : '');
    const allBarcodes = [...new Set(cleanBarcodeList.map((b) => b.code))];
    if (primaryBarcode && !allBarcodes.includes(primaryBarcode)) allBarcodes.unshift(primaryBarcode);

    // --- Real-time Duplicate Monitor Checks ---
    if (cleanBarcodeList.length !== allBarcodes.length) {
      showToast('Duplicate barcode entered across multiple rows in this product. Each barcode row must be unique.', 'error');
      return;
    }

    if (form.sku) {
      const cleanSku = String(form.sku).replace(/\D/g, '');
      const skuConflict = (products || []).find((p) => p.id !== editing?.id && String(p.sku || '').trim() === cleanSku);
      if (skuConflict) {
        showToast(`Cannot save: SKU "${cleanSku}" is already in use by "${skuConflict.name}".`, 'error');
        return;
      }
    }

    for (const b of allBarcodes) {
      const barcodeConflict = (products || []).find((p) => {
        if (p.id === editing?.id) return false;
        const mainMatch = String(p.barcode || '').trim() === b;
        const altMatch = Array.isArray(p.barcodes) && p.barcodes.some((alt) => String(alt || '').trim() === b);
        return mainMatch || altMatch;
      });
      if (barcodeConflict) {
        showToast(`Cannot save: Barcode "${b}" is already assigned to "${barcodeConflict.name}".`, 'error');
        return;
      }
    }

    const payload = {
      ...form,
      sku: form.sku ? String(form.sku).replace(/\D/g, '') : '',
      printName: form.regionalName || form.printName,
      barcode: primaryBarcode,
      barcodes: allBarcodes,
      barcodeDetails: cleanBarcodeList,
      
      enableMinorUnit: Boolean(form.enableMinorUnit),
      customSubUnitName: form.enableMinorUnit ? form.customSubUnitName : '',
      customSubUnitFactor: form.enableMinorUnit ? form.customSubUnitFactor : '',
      customSubUnitPrice: form.enableMinorUnit ? form.customSubUnitPrice : '',
      customSubUnitMrp: form.enableMinorUnit ? form.customSubUnitMrp : '',
      customSubUnitBarcode: form.enableMinorUnit ? form.customSubUnitBarcode : '',
      altUnits,
      comboItems: isCombo ? validComboItems : [],
      recipeItems: isComposite ? validIngredients : [],
      recipeNotes: isComposite ? form.recipeNotes || '' : ''
    };

    if (isComposite && !form.useCustomPricing) {
      payload.purchasePrice = computeRecipeTotals(form.recipeItems, products).unitCost;
    }

    if (isCombo && !form.useCustomPricing) {
      const rows = validComboItems.map(ing => {
        const material = (products || []).find(p => p.id === ing.productId);
        const qty = Number(ing.qty) || 0;
        const cost = material ? Number(material.price) || 0 : 0;
        return { lineCost: qty * cost };
      });
      payload.price = rows.reduce((sum, r) => sum + r.lineCost, 0).toFixed(2);
    }

    setSaving(true);
    try {
      const res = editing
        ? await api.put(`/products/${editing.id}`, payload)
        : await api.post('/products', payload);

      showToast(res.message || 'Product saved.');
      onClose();
      onSaved?.(res.data);
    } catch (err) {
      showToast(api.message(err, 'Failed to save product.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
        <Modal open={open} title={editing ? 'Edit Product' : 'Create New Product'} icon={Package} onClose={onClose} size="70" allowFullscreen>
          <form onSubmit={save} className="space-y-4 pr-1">
            {/* Image Upload section */}
            <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 flex items-center justify-center bg-[color:var(--bg-surface)] overflow-hidden relative">
                {form.imageUrl ? (
                  <img src={form.imageUrl.startsWith('/') ? `${API_BASE.replace('/api/pos', '')}${form.imageUrl}` : form.imageUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-indigo-400" />
                )}
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-bold text-[color:var(--text-primary)] block">Product Image</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="prod-img-upload" />
                  <label htmlFor="prod-img-upload" className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xs">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingImage ? 'Uploading...' : 'Choose Image (Manual)'}
                  </label>

                  <button
                    type="button"
                    onClick={autoFindRealPhoto}
                    disabled={findingPhoto || (!form.name && !form.barcodes && !form.barcode)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[color:var(--bg-surface)] text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-all disabled:opacity-50 shadow-2xs"
                    title="Auto-fetch real product photo online based on product name or barcode"
                  >
                    <Search className="h-3.5 w-3.5" />
                    {findingPhoto ? 'Finding photo...' : '✨ Auto-Find Real Photo'}
                  </button>

                  {form.imageUrl && (
                    <button type="button" onClick={() => setForm((p) => ({ ...p, imageUrl: '' }))} className="text-xs text-red-500 hover:underline">
                      Remove
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-[color:var(--text-muted)]">
                  Manually uploaded images take priority. If no image is provided, a real photo is auto-generated.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Product Name *">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Organic Himachal Apples" required />
              </Field>

              <Field label="Regional Name (Tamil/Hindi)">
                <Input value={form.regionalName} onChange={(e) => setForm({ ...form, regionalName: e.target.value, printName: e.target.value })} placeholder="e.g. ஆப்பிள் / தமிழ் பெயர்" />
              </Field>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)]">
              <div>
                <div className="text-xs font-bold text-[color:var(--text-primary)]">Product Status</div>
                <div className="text-[10.5px] text-[color:var(--text-muted)]">
                  Inactive products are hidden from POS billing and search, but stay in your records.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, isActive: !(form.isActive !== false) })}
                className={cx(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  form.isActive !== false
                    ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-600 border border-red-500/30'
                )}
              >
                {form.isActive !== false ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {form.isActive !== false ? 'Active' : 'Inactive'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="label-eyebrow">Categories</span>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>New Category</span>
                  </button>
                </div>
                <MultiSelect
                  value={form.categoryIds}
                  onChange={(e) => setForm({ ...form, categoryIds: e.target.value, categoryId: e.target.value[0] || '' })}
                  placeholder="Select categories..."
                >
                  {localCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </MultiSelect>
              </div>

              <Field label="Product Type">
                <Select
                  value={canonicalProductType(form.productType || (Array.isArray(form.productTypes) && form.productTypes.length > 1 ? 'both' : form.productTypes?.[0]) || 'standard')}
                  onChange={(e) => {
                    const t = e.target.value;
                    const types = t === 'both' ? ['standard', 'raw'] : [t];
                    setForm({ ...form, productType: t, productTypes: types });
                  }}
                >
                  <option value="standard">Standard Item</option>
                  <option value="raw">Raw Material</option>
                  <option value="both">Both Raw Material & Standard Product</option>
                  <option value="service">Service (No stock level)</option>
                  <option value="combo">Combo Bundle</option>
                  <option value="composite">Composite (Recipe)</option>
                </Select>
              </Field>

              {form.productType !== 'service' && (
                <Field label="Main Unit of Measurement">
                  <Select
                    value={form.unit}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      const def = getDefaultSubUnit(newUnit, units);
                      const isStandardSub = !!def.name;

                      // Offer a default bigger pack unit too (e.g. bag for kg) —
                      // just a starting suggestion, removable from the Additional Units list.
                      const bigDef = getDefaultBigUnit(newUnit);
                      let altUnits = Array.isArray(form.altUnits) ? [...form.altUnits] : [];
                      if (bigDef && !altUnits.some((u) => String(u.unit).toLowerCase() === bigDef.unit)) {
                        altUnits = [...altUnits, { unit: bigDef.unit, factor: bigDef.factor, price: '', mrp: '', barcode: '', priceAuto: true, mrpAuto: true }];
                      }

                      setForm(recomputeAutoUnitPricing({
                        ...form,
                        unit: newUnit,
                        enableMinorUnit: isStandardSub ? true : form.enableMinorUnit,
                        customSubUnitName: isStandardSub ? def.name : form.customSubUnitName,
                        customSubUnitFactor: isStandardSub ? def.factor : form.customSubUnitFactor,
                        // Reset to auto-tracking so the values below always follow the current Price/MRP.
                        customSubUnitPrice: isStandardSub ? '' : form.customSubUnitPrice,
                        customSubUnitPriceAuto: isStandardSub ? true : form.customSubUnitPriceAuto,
                        customSubUnitMrp: isStandardSub ? '' : form.customSubUnitMrp,
                        customSubUnitMrpAuto: isStandardSub ? true : form.customSubUnitMrpAuto,
                        altUnits
                      }));
                    }}
                  >
                    {units.map((u) => {
                      const name = typeof u === 'object' ? u.name : u;
                      return (
                        <option key={name} value={name}>{name}</option>
                      );
                    })}
                  </Select>
                </Field>
              )}
            </div>

            {/* Other Units — smaller (sub-unit) and bigger (additional) units, on top of the base unit above */}
            {form.productType !== 'service' && (
              <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-3">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold text-[color:var(--text-primary)] uppercase tracking-wider">
                    Other Units
                  </h4>
                </div>
                <p className="text-[11px] text-[color:var(--text-muted)] -mt-2">
                  Configure smaller units (e.g. g for kg) and bigger pack units (e.g. bag, box, case) this product can also be billed and stocked in.
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[color:var(--text-secondary)]">Sub-Unit (smaller than the base unit)</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    <input
                      type="checkbox"
                      checked={form.enableMinorUnit}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        if (enabled && !form.customSubUnitName) {
                          const def = getDefaultSubUnit(form.unit, units);
                          setForm(recomputeAutoUnitPricing({
                            ...form,
                            enableMinorUnit: true,
                            customSubUnitName: def.name || 'pcs',
                            customSubUnitFactor: def.factor || 1,
                            customSubUnitPrice: '',
                            customSubUnitPriceAuto: true,
                            customSubUnitMrp: '',
                            customSubUnitMrpAuto: true
                          }));
                        } else {
                          setForm({ ...form, enableMinorUnit: enabled });
                        }
                      }}
                      className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    Enable Sub-Unit (e.g. g for kg, ml for ltr, pcs for dozen/box)
                  </label>
                </div>

                {form.enableMinorUnit && (
                  <div className="space-y-3 pt-2 border-t border-indigo-200/60 dark:border-indigo-800/60">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <Field label="Minor Unit *" hint="Pick a unit smaller than the base unit">
                        <Select
                          value={form.customSubUnitName || ''}
                          onChange={(e) => setForm({ ...form, customSubUnitName: e.target.value })}
                        >
                          <option value="">Select unit…</option>
                          {unitNameList
                            .filter((name) => name.toLowerCase() !== String(form.unit).toLowerCase())
                            .map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          {form.customSubUnitName &&
                            !unitNameList.some((name) => name.toLowerCase() === String(form.customSubUnitName).toLowerCase()) && (
                              <option value={form.customSubUnitName}>{form.customSubUnitName}</option>
                            )}
                        </Select>
                      </Field>

                      <Field label={`1 ${form.unit || 'unit'} contains (${form.customSubUnitName || 'sub-units'})`}>
                        <Input
                          type="number"
                          step="any"
                          value={form.customSubUnitFactor || ''}
                          onChange={(e) => setForm((f) => recomputeAutoUnitPricing({ ...f, customSubUnitFactor: e.target.value }))}
                          placeholder="e.g. 1000"
                        />
                      </Field>

                      <Field label={`Price per 1 ${form.customSubUnitName || 'sub-unit'} (₹)`} hint={form.customSubUnitPriceAuto !== false ? 'Auto-calculated from Price' : 'Manually set'}>
                        <Input
                          type="number"
                          step="any"
                          value={form.customSubUnitPrice || ''}
                          onChange={(e) => setForm((f) => recomputeAutoUnitPricing({
                            ...f,
                            customSubUnitPrice: e.target.value,
                            customSubUnitPriceAuto: e.target.value === ''
                          }))}
                          placeholder="Auto-calculated"
                        />
                      </Field>

                      <Field label={`MRP per 1 ${form.customSubUnitName || 'sub-unit'} (₹)`} hint={form.customSubUnitMrpAuto !== false ? 'Auto-calculated from MRP' : 'Manually set'}>
                        <Input
                          type="number"
                          step="any"
                          value={form.customSubUnitMrp || ''}
                          onChange={(e) => setForm((f) => recomputeAutoUnitPricing({
                            ...f,
                            customSubUnitMrp: e.target.value,
                            customSubUnitMrpAuto: e.target.value === ''
                          }))}
                          placeholder="Auto-calculated"
                        />
                      </Field>

                      <Field label="Minor Unit Barcode">
                        <div className="flex items-center gap-1">
                          <Input
                            value={form.customSubUnitBarcode || ''}
                            onChange={(e) => setForm({ ...form, customSubUnitBarcode: e.target.value })}
                            placeholder="Optional sub-unit barcode"
                          />
                          <button
                            type="button"
                            disabled={generatingBarcode}
                            onClick={generateMinorUnitBarcode}
                            className="shrink-0 p-2 rounded-lg border border-[color:var(--border-subtle)] text-[color:var(--text-muted)] hover:text-indigo-600 hover:bg-[color:var(--bg-subtle)] disabled:opacity-40"
                            title="Generate the next barcode"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </Field>
                    </div>

                    {form.customSubUnitName && Number(form.customSubUnitFactor) > 0 && (
                      <div className="p-2.5 rounded-lg bg-indigo-100/70 dark:bg-indigo-900/40 text-[11px] text-indigo-900 dark:text-indigo-200 flex flex-wrap items-center justify-between gap-2 font-medium">
                        <div>
                          <strong>1 {form.unit}</strong> = <strong>{form.customSubUnitFactor} {form.customSubUnitName}</strong>
                          {Number(form.price) > 0 && (
                            <span className="ml-2">
                              | Price: <strong>{money(form.price)} / {form.unit}</strong> (<strong>₹{Number(form.customSubUnitPrice || (Number(form.price) / Number(form.customSubUnitFactor))).toFixed(4)} / {form.customSubUnitName}</strong>)
                            </span>
                          )}
                          {Number(form.mrp) > 0 && (
                            <span className="ml-2">
                              | MRP: <strong>{money(form.mrp)} / {form.unit}</strong> (<strong>₹{Number(form.customSubUnitMrp || (Number(form.mrp) / Number(form.customSubUnitFactor))).toFixed(4)} / {form.customSubUnitName}</strong>)
                            </span>
                          )}
                        </div>
                        {Number(form.stock) > 0 && (
                          <div className="font-bold text-emerald-700 dark:text-emerald-400">
                            Total Stock: {form.stock} {form.unit} ({Number(form.stock) * Number(form.customSubUnitFactor)} {form.customSubUnitName})
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-800/60 space-y-1">
                  <span className="text-xs font-bold text-[color:var(--text-secondary)]">Additional Units (bigger packs, e.g. bag, box, case)</span>
                </div>

                {(form.altUnits || []).length > 0 && (
                  <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[10px] font-bold uppercase text-[color:var(--text-muted)]">
                    <div className="col-span-2">Unit Name</div>
                    <div className="col-span-3">1 unit = ? {form.unit || 'base unit'}</div>
                    <div className="col-span-2">Price (₹)</div>
                    <div className="col-span-2">MRP (₹)</div>
                    <div className="col-span-2">Barcode</div>
                  </div>
                )}

                <div className="space-y-2">
                  {(form.altUnits || []).map((row, idx) => {
                    const usedElsewhere = new Set(
                      [
                        form.unit,
                        form.enableMinorUnit ? form.customSubUnitName : '',
                        ...(form.altUnits || []).filter((_, i) => i !== idx).map((u) => u.unit)
                      ]
                        .filter(Boolean)
                        .map((s) => String(s).toLowerCase())
                    );
                    const rowUnitOptions = unitNameList.filter((name) => !usedElsewhere.has(name.toLowerCase()));
                    return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)]">
                      <div className="col-span-6 md:col-span-2">
                        <Select
                          value={row.unit || ''}
                          onChange={(e) => updateAltUnit(idx, { unit: e.target.value })}
                          className="text-xs"
                        >
                          <option value="">Select unit…</option>
                          {rowUnitOptions.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                          {row.unit && !unitNameList.some((name) => name.toLowerCase() === String(row.unit).toLowerCase()) && (
                            <option value={row.unit}>{row.unit}</option>
                          )}
                        </Select>
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={row.factor ?? ''}
                          onChange={(e) => updateAltUnit(idx, { factor: e.target.value })}
                          placeholder={`e.g. 25 ${form.unit || ''}`}
                          className="text-xs"
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Input
                          type="number"
                          step="any"
                          value={row.price ?? ''}
                          onChange={(e) => updateAltUnit(idx, { price: e.target.value, priceAuto: e.target.value === '' })}
                          placeholder="Auto"
                          title={row.priceAuto !== false ? 'Auto-calculated from Price' : 'Manually set'}
                          className="text-xs"
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Input
                          type="number"
                          step="any"
                          value={row.mrp ?? ''}
                          onChange={(e) => updateAltUnit(idx, { mrp: e.target.value, mrpAuto: e.target.value === '' })}
                          placeholder="Auto"
                          title={row.mrpAuto !== false ? 'Auto-calculated from MRP' : 'Manually set'}
                          className="text-xs"
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <div className="flex items-center gap-1">
                          <Input
                            value={row.barcode || ''}
                            onChange={(e) => updateAltUnit(idx, { barcode: e.target.value })}
                            placeholder="Optional"
                            className="text-xs"
                          />
                          <button
                            type="button"
                            disabled={generatingBarcode}
                            onClick={() => generateAltUnitBarcode(idx)}
                            className="shrink-0 p-1.5 rounded-lg border border-[color:var(--border-subtle)] text-[color:var(--text-muted)] hover:text-indigo-600 hover:bg-[color:var(--bg-subtle)] disabled:opacity-40"
                            title="Generate the next barcode"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeAltUnit(idx)}
                          className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    );
                  })}

                  <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addAltUnit}>
                    Add Unit
                  </Button>
                </div>
              </div>
            )}

            {/* Barcode — SKU and Product Barcodes */}
            <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] space-y-3">
              <h4 className="text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">Barcode</h4>

              {/* SKU — manual entry or Generate */}
              <Field
                label="SKU Code"
                hint={`Numeric only — ${targetSkuLength} digits configured in Settings > Barcode (e.g. ${'1'.padStart(targetSkuLength, '0')})`}
              >
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    maxLength={targetSkuLength}
                    value={form.sku || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, targetSkuLength);
                      setForm({ ...form, sku: val });
                      if (val.length === targetSkuLength) {
                        checkSkuDuplicate(val);
                      } else {
                        setSkuWarning(null);
                      }
                    }}
                    onBlur={handleSkuBlur}
                    placeholder={`e.g. ${'1'.padStart(targetSkuLength, '0')}`}
                    className="font-mono text-xs font-bold pl-8 pr-24"
                  />
                  <Tag className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {form.sku ? (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)]">
                        {form.sku.length}/{targetSkuLength}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      title="Generate the next sequential SKU"
                      onClick={generateSku}
                      disabled={generatingSku}
                      className="p-1.5 rounded-lg hover:bg-[color:var(--bg-subtle)] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${generatingSku ? 'animate-spin' : ''}`} />
                    </button>
                    {form.sku && (
                      <button
                        type="button"
                        title="Clear SKU"
                        onClick={() => {
                          setForm({ ...form, sku: '' });
                          setSkuWarning(null);
                        }}
                        className="p-1.5 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-rose-600"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {skuWarning && (
                  <div className="mt-1 text-[10.5px] font-bold text-amber-600 dark:text-amber-400">⚠ {skuWarning}</div>
                )}
              </Field>

              {/* Multiple barcodes for the same product */}
              <div className="space-y-3 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Barcode className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-bold text-[color:var(--text-primary)] uppercase tracking-wider">
                        Product Barcodes ({(form.barcodeList || []).length})
                      </h4>
                    </div>
                    <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
                      Add more than one scannable code for this product (e.g. Primary, Packaging, Outer Carton, Supplier). All of them scan into the POS.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button type="button" size="sm" variant="ghost" icon={RefreshCw} onClick={addGeneratedBarcodeRow} disabled={generatingBarcode} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                      Generate Barcode
                    </Button>
                    <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => addBarcodeRow('')}>
                      Add Barcode
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {(form.barcodeList || []).map((row, idx) => {
                    const isPrimary = row.type === 'primary' || idx === 0;
                    return (
                      <div
                        key={row._key || idx}
                        className={`grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl border transition-all ${
                          isPrimary
                            ? 'border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 shadow-xs'
                            : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)]'
                        }`}
                      >
                        <div className="col-span-12 md:col-span-5">
                          <div className="relative">
                            <Input
                              ref={isPrimary ? barcodeInputRef : undefined}
                              value={row.code || ''}
                              onChange={(e) => updateBarcodeRow(idx, { code: e.target.value })}
                              onFocus={() => isPrimary && setScanningBarcode(true)}
                              onBlur={() => {
                                if (isPrimary) setScanningBarcode(false);
                                checkBarcodeDuplicate(row.code);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                              }}
                              placeholder={isPrimary ? (scanningBarcode ? 'Ready to scan…' : 'Primary barcode (auto if blank)') : 'e.g. 89012345002'}
                              className={`font-mono text-xs font-bold pl-8 ${isPrimary && scanningBarcode ? 'ring-2 ring-indigo-400' : ''}`}
                            />
                            <Barcode className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <div className="col-span-6 md:col-span-3">
                          <Select value={row.type || (idx === 0 ? 'primary' : 'alternate')} onChange={(e) => updateBarcodeRow(idx, { type: e.target.value })} className="text-xs">
                            <option value="primary">Primary Barcode</option>
                            <option value="packaging">Packaging / Retail Pack</option>
                            <option value="carton">Carton / Outer Case</option>
                            <option value="inner_pack">Inner Box / Bundle</option>
                            <option value="supplier">Supplier / Vendor Code</option>
                            <option value="alternate">Alternate Barcode</option>
                          </Select>
                        </div>

                        <div className="col-span-6 md:col-span-2 flex items-center">
                          {isPrimary ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              <CheckCircle className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                              Primary
                            </span>
                          ) : (
                            <button type="button" onClick={() => makePrimaryBarcode(idx)} className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer">
                              Set as Primary
                            </button>
                          )}
                        </div>

                        <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-1">
                          {scannerConnected && isPrimary && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              title="Scan with your barcode scanner"
                              icon={ScanLine}
                              onClick={startScanningBarcode}
                              className={`h-8 px-2 ${scanningBarcode ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50' : 'text-[color:var(--text-muted)] hover:text-indigo-600'}`}
                            />
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            title="Generate the next sequential barcode"
                            icon={RefreshCw}
                            onClick={() => regenerateBarcodeRow(idx)}
                            disabled={generatingBarcode}
                            className="h-8 px-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            title="Remove this barcode"
                            icon={Trash2}
                            onClick={() => removeBarcodeRow(idx)}
                            disabled={(form.barcodeList || []).length <= 1}
                            className="h-8 px-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {barcodeWarning && (
                  <div className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400">⚠ {barcodeWarning}</div>
                )}
              </div>
            </div>

            {form.productType === 'service' ? (
              <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] space-y-3">
                <h4 className="text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">Service Pricing</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Price (₹) *">
                    <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                  </Field>
                </div>
              </div>
            ) : form.productType !== 'combo' && form.productType !== 'composite' ? (
              <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] space-y-3">
                <h4 className="text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">Pricing &amp; Margin</h4>
                {(() => {
                  const ppNum = form.productType === 'composite' && !form.useCustomPricing
                    ? computeRecipeTotals(form.recipeItems, products).unitCost
                    : Number(form.purchasePrice) || 0;
                  return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <Field label="Purchase Price (₹)" hint={form.productType === 'composite' ? 'Calculated from the recipe' : undefined}>
                    <Input
                      type="number"
                      step="0.01"
                      value={
                        form.productType === 'composite' && !form.useCustomPricing
                          ? computeRecipeTotals(form.recipeItems, products).unitCost.toFixed(2)
                          : form.purchasePrice
                      }
                      onChange={(e) => {
                        const pp = e.target.value;
                        const ppN = Number(pp) || 0;
                        const next = { ...form, purchasePrice: pp };
                        // Keep Selling Price and MRP in step with their own already-configured margins so a cost change doesn't leave them stale.
                        if (form.marginPercentSp !== '' && ppN > 0) {
                          next.price = (ppN * (1 + Number(form.marginPercentSp) / 100)).toFixed(2);
                        }
                        if (form.marginPercentMrp !== '' && ppN > 0) {
                          next.mrp = (ppN * (1 + Number(form.marginPercentMrp) / 100)).toFixed(2);
                        }
                        setForm(next);
                      }}
                      disabled={form.productType === 'composite' && !form.useCustomPricing}
                      className={form.productType === 'composite' && !form.useCustomPricing ? 'opacity-70 cursor-not-allowed' : ''}
                    />
                  </Field>
                  <Field label="Selling Price (₹) *">
                    <Input
                      type="number"
                      step="0.01"
                      value={
                        form.productType === 'combo' && !form.useCustomPricing
                          ? (() => {
                              const rows = (form.comboItems || []).map(ing => {
                                const material = (products || []).find(p => p.id === ing.productId);
                                const qty = Number(ing.qty) || 0;
                                const cost = material ? Number(material.price) || 0 : 0;
                                return { lineCost: qty * cost };
                              });
                              return rows.reduce((sum, r) => sum + r.lineCost, 0).toFixed(2);
                            })()
                          : form.price
                      }
                      onChange={(e) => {
                        const priceVal = e.target.value;
                        const pp = Number(form.purchasePrice) || 0;
                        const next = { ...form, price: priceVal };
                        // Editing Selling Price directly re-derives its own margin, rather than leaving a now-inaccurate figure in place.
                        next.marginPercentSp = pp > 0 && priceVal !== '' ? (((Number(priceVal) - pp) / pp) * 100).toFixed(1) : '';
                        setForm(next);
                      }}
                      required
                      disabled={form.productType === 'combo' && !form.useCustomPricing}
                      className={form.productType === 'combo' && !form.useCustomPricing ? 'opacity-70 cursor-not-allowed' : ''}
                    />
                  </Field>
                  <Field label="Margin % (SP)" hint="Type a margin to auto-fill Selling Price from Purchase Price">
                    <Input
                      type="number"
                      step="0.1"
                      value={form.marginPercentSp}
                      onChange={(e) => {
                        const marginVal = e.target.value;
                        const pp = Number(form.purchasePrice) || 0;
                        const next = { ...form, marginPercentSp: marginVal };
                        if (marginVal !== '' && pp > 0) {
                          next.price = (pp * (1 + Number(marginVal) / 100)).toFixed(2);
                        }
                        setForm(next);
                      }}
                    />
                  </Field>
                  <Field label="MRP (₹)">
                    <Input
                      type="number"
                      step="0.01"
                      value={form.mrp}
                      onChange={(e) => {
                        const mrpVal = e.target.value;
                        const pp = Number(form.purchasePrice) || 0;
                        const next = { ...form, mrp: mrpVal };
                        // Editing MRP directly re-derives its own margin, same as Selling Price does.
                        next.marginPercentMrp = pp > 0 && mrpVal !== '' ? (((Number(mrpVal) - pp) / pp) * 100).toFixed(1) : '';
                        setForm(next);
                      }}
                    />
                  </Field>
                  <Field label="Margin % (MRP)" hint="Type a margin to auto-fill MRP from Purchase Price">
                    <Input
                      type="number"
                      step="0.1"
                      value={form.marginPercentMrp}
                      onChange={(e) => {
                        const marginVal = e.target.value;
                        const pp = Number(form.purchasePrice) || 0;
                        const next = { ...form, marginPercentMrp: marginVal };
                        if (marginVal !== '' && pp > 0) {
                          next.mrp = (pp * (1 + Number(marginVal) / 100)).toFixed(2);
                        }
                        setForm(next);
                      }}
                    />
                  </Field>
                </div>
                  );
                })()}
                {(form.productType === 'composite' || form.productType === 'combo') && (
                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[color:var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={form.useCustomPricing}
                        onChange={(e) => setForm({ ...form, useCustomPricing: e.target.checked })}
                        className="rounded border-[color:var(--border-strong)] text-indigo-600 focus:ring-indigo-500"
                      />
                      Enable Custom Pricing Override (Override auto-calculated {form.productType === 'composite' ? 'Purchase Price' : 'Selling Price'})
                    </label>
                  </div>
                )}
              </div>
            ) : null}

            {form.productType !== 'service' && form.productType !== 'composite' && form.productType !== 'combo' && (
              <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] space-y-3">
                <h4 className="text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                  <span>Warehouse Distribution & Minimum Stock</span>
                  <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-0.5 rounded-full text-[9px]">Total: {form.stock || 0}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field
                    label="Select Warehouse"
                    hint={form.trackBatches ? 'Disabled — select warehouse per batch below' : undefined}
                  >
                    <Select
                      value={form.primaryWarehouse || warehouses[0]?.id || ''}
                      onChange={(e) => setForm({ ...form, primaryWarehouse: e.target.value })}
                      disabled={Boolean(form.trackBatches)}
                      className={form.trackBatches ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}
                    >
                      {(warehouses || []).map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Stock in Selected Warehouse"
                    hint={
                      form.trackBatches
                        ? 'Derived from batches below'
                        : form.trackSerials
                        ? 'Sets how many rows open in the Serial Number Sheet below'
                        : (isWholeNumberUnit(form.unit) ? `Whole numbers only for ${form.unit}` : undefined)
                    }
                  >
                    <Input
                      type="number"
                      step={isWholeNumberUnit(form.unit) ? '1' : 'any'}
                      value={form.trackBatches ? form.stock || 0 : (form.warehouses?.[form.primaryWarehouse || warehouses[0]?.id] ?? '')}
                      onChange={(e) => {
                        const whId = form.primaryWarehouse || warehouses[0]?.id;
                        if (!whId) return;
                        const raw = isWholeNumberUnit(form.unit) ? e.target.value.replace(/\./g, '') : e.target.value;
                        const newStock = Number(raw) || 0;
                        const newWarehouses = { ...form.warehouses, [whId]: newStock };
                        const totalStock = Object.values(newWarehouses).reduce((sum, val) => sum + (Number(val) || 0), 0);
                        setForm({ ...form, warehouses: newWarehouses, stock: totalStock });
                      }}
                      disabled={form.productType === 'combo' || Boolean(form.trackBatches)}
                      className={form.productType === 'combo' || form.trackBatches ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}
                    />
                    {(() => {
                        const validAltUnits = (form.altUnits || []).filter((u) => u.unit && Number(u.factor) > 0);
                        const breakdown = formatUnitBreakdown({ ...form, altUnits: validAltUnits }, Number(form.stock) || 0);
                        return breakdown
                          ? <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 ml-1 font-medium">Auto-converted: {breakdown} total</div>
                          : null;
                    })()}
                  </Field>
                  <Field label="Minimum Alert Level">
                    <Input
                      type="number"
                      step={isWholeNumberUnit(form.unit) ? '1' : 'any'}
                      value={form.minStock}
                      onChange={(e) => setForm({ ...form, minStock: isWholeNumberUnit(form.unit) ? e.target.value.replace(/\./g, '') : e.target.value })}
                    />
                  </Field>
                </div>

                <div className="pt-2 border-t border-[color:var(--border-subtle)]">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-indigo-600 dark:text-indigo-400">
                    <input
                      type="checkbox"
                      checked={Boolean(form.requiresWeight)}
                      onChange={(e) => setForm({ ...form, requiresWeight: e.target.checked })}
                      className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    Weight Scale Item
                  </label>
                  <p className="text-[10px] text-[color:var(--text-muted)] mt-1 pl-6">
                    Ticked: billing reads the weight from the scale. Unticked: it is billed in its unit as usual.
                  </p>
                </div>

                {(batchTrackingEnabled || form.trackBatches) ? (
                  <div className="pt-2 border-t border-[color:var(--border-subtle)]">
                    <label
                      className={`flex items-center gap-2 text-xs font-bold ${
                        lockTrackBatchesOff ? 'cursor-not-allowed text-[color:var(--text-muted)]' : 'cursor-pointer text-indigo-600 dark:text-indigo-400'
                      }`}
                      title={lockTrackBatchesOff ? `Sell, transfer, or write off all ${lockedBatchRemainingQty} remaining batched unit(s) before turning this off.` : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(form.trackBatches)}
                        disabled={lockTrackBatchesOff}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setForm({ ...form, trackBatches: on, trackSerials: on ? false : form.trackSerials });
                        }}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 disabled:opacity-50"
                      />
                      Enable Batch
                    </label>
                    {lockTrackBatchesOff && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 pl-6">
                        {lockedBatchRemainingQty} {form.unit || 'unit'}(s) still sitting in batches — sell, transfer, or write them off first, then batch tracking can be turned off.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-[color:var(--text-muted)] pt-2 border-t border-[color:var(--border-subtle)]">
                    Batch tracking is off for this store. Enable it under Settings → Billing & Tax → Inventory to use it here.
                  </div>
                )}

                {(serialTrackingEnabled || form.trackSerials) ? (
                  <div className="pt-2 border-t border-[color:var(--border-subtle)]">
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-indigo-600 dark:text-indigo-400">
                      <input
                        type="checkbox"
                        checked={Boolean(form.trackSerials)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          // Batch and serial track the same thing one way or the other, never both.
                          setForm({ ...form, trackSerials: on, trackBatches: on ? false : form.trackBatches });
                        }}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      Enable Serial
                    </label>
                  </div>
                ) : (
                  <div className="text-[10px] text-[color:var(--text-muted)] pt-2 border-t border-[color:var(--border-subtle)]">
                    Serial number tracking is off for this store. Enable it under Settings → Billing & Tax → Inventory to use it here.
                  </div>
                )}
              </div>
            )}

            {form.trackSerials && form.productType !== 'service' && form.productType !== 'composite' && form.productType !== 'combo' && (
              <SerialNumberSection form={form} setForm={setForm} />
            )}

            {form.productType !== 'composite' && form.productType !== 'combo' && (
              <div className="p-3.5 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-indigo-600 dark:text-indigo-400">
                  <input
                    type="checkbox"
                    checked={Boolean(form.hasWarranty)}
                    onChange={(e) => setForm({ ...form, hasWarranty: e.target.checked })}
                    className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  Warranty-Enabled Product
                </label>
                {form.hasWarranty && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <Field label="Warranty Period">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={form.warrantyDurationValue}
                        onChange={(e) => setForm({ ...form, warrantyDurationValue: e.target.value.replace(/\D/g, '') })}
                      />
                    </Field>
                    <Field label="Unit">
                      <Select
                        value={form.warrantyDurationUnit}
                        onChange={(e) => setForm({ ...form, warrantyDurationUnit: e.target.value })}
                      >
                        <option value="days">Day(s)</option>
                        <option value="months">Month(s)</option>
                        <option value="years">Year(s)</option>
                      </Select>
                    </Field>
                    <p className="col-span-2 text-[10px] text-[color:var(--text-muted)] -mt-1">
                      The warranty period starts counting from the day a unit is actually billed to a customer, not from today.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!hideBatches && form.trackBatches && form.productType !== 'service' && form.productType !== 'composite' && form.productType !== 'combo' && (
              <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-[color:var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                    <History className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Batches
                  </h4>
                  <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
                    New batches are normally added automatically when you receive a Purchase for this product. Add one here for opening stock or a manual correction.
                  </p>
                </div>

                <Field
                  label="Near-Expiry Alert Window (days)"
                  hint="Overrides the store default for this product only — e.g. eggs need a much shorter warning than rice. Leave blank to use the store default."
                >
                  <Input
                    type="number"
                    min="1"
                    value={form.nearExpiryDays}
                    onChange={(e) => setForm({ ...form, nearExpiryDays: e.target.value })}
                    placeholder="Store default"
                    className="max-w-[160px]"
                  />
                </Field>

                <div className="space-y-2">
                  {(form.batches || []).map((row, idx) => (
                    <div key={row.id || idx} className="flex flex-wrap items-end gap-2 p-2.5 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)]">
                      <Field label="Batch / Lot No." className="w-36">
                        <Input
                          value={row.batchNo || ''}
                          onChange={(e) => updateBatchRow(idx, { batchNo: e.target.value })}
                          placeholder="Auto if blank"
                          className="text-xs"
                        />
                      </Field>
                      <Field label="Mfg. Date" className="w-36">
                        <Input
                          type="date"
                          value={row.mfgDate ? String(row.mfgDate).slice(0, 10) : ''}
                          onChange={(e) => updateBatchRow(idx, { mfgDate: e.target.value })}
                          className="text-xs"
                        />
                      </Field>
                      <Field label="Expiry Date" className="w-36">
                        <Input
                          type="date"
                          value={row.expiryDate ? String(row.expiryDate).slice(0, 10) : ''}
                          onChange={(e) => updateBatchRow(idx, { expiryDate: e.target.value })}
                          className="text-xs"
                        />
                      </Field>
                      <Field label="Qty" className="w-20">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={row.qty ?? ''}
                          onChange={(e) => updateBatchRow(idx, { qty: e.target.value })}
                          placeholder="Qty"
                          className="text-xs"
                        />
                      </Field>
                      <Field label="Cost Price (₹)" className="w-24">
                        <Input
                          type="number"
                          step="any"
                          value={row.costPrice ?? ''}
                          onChange={(e) => updateBatchRow(idx, { costPrice: e.target.value })}
                          placeholder="Cost"
                          className="text-xs"
                        />
                      </Field>
                      <Field label="Selling Price (₹)" hint="Blank = product's price" className="w-32">
                        <Input
                          type="number"
                          step="any"
                          value={row.sellPrice ?? ''}
                          onChange={(e) => updateBatchRow(idx, { sellPrice: e.target.value })}
                          placeholder={form.price ? `Auto ₹${form.price}` : 'Sell ₹'}
                          className="text-xs"
                        />
                      </Field>
                      <Field label="MRP (₹)" hint="Blank = product's MRP" className="w-28">
                        <Input
                          type="number"
                          step="any"
                          value={row.mrp ?? ''}
                          onChange={(e) => updateBatchRow(idx, { mrp: e.target.value })}
                          placeholder={form.mrp ? `Auto ₹${form.mrp}` : 'MRP ₹'}
                          className="text-xs"
                        />
                      </Field>
                      {(warehouses || []).length > 0 && (
                        <Field label="Warehouse" className="w-32">
                          <Select
                            value={row.warehouseId || form.primaryWarehouse || warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id}
                            onChange={(e) => updateBatchRow(idx, { warehouseId: e.target.value })}
                            className="text-xs"
                          >
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </Select>
                        </Field>
                      )}
                      <div className="flex items-center gap-0.5 ml-auto self-center">
                        {editing && !String(row.id).startsWith('new_') && Number(row.qty) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setWriteOffForm({ qty: '', reason: 'Expired' });
                              setWriteOffTarget({ product: editing, batch: row });
                            }}
                            className="p-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[color:var(--text-muted)] hover:text-amber-600"
                            title="Write off (expired/damaged)"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeBatchRow(idx)}
                          className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-red-600"
                          title="Remove row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addBatchRow}>
                    Add Batch
                  </Button>
                </div>

                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  Total across batches: {form.stock || 0} {form.unit}
                </div>
              </div>
            )}

            {form.productType === 'composite' && (
              <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] text-[11px] text-[color:var(--text-muted)]">
                This is a composite item — it has no stock of its own. Its availability is computed live from the raw materials in its recipe below ("Can produce").
              </div>
            )}

            {form.productType === 'composite' && (
              <div className="p-3 rounded-xl border border-emerald-300/50 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="h-3.5 w-3.5" /> Recipe — Raw Materials
                  </h4>
                  <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
                    Selling one {form.unit || 'unit'} of this product consumes these raw materials from stock. At least one material with a quantity is required.
                  </p>
                </div>

                <div className="space-y-2">
                  {(form.recipeItems || []).length > 0 && (
                    <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[10px] font-bold uppercase text-[color:var(--text-muted)]">
                      <div className="col-span-5">Raw Material</div>
                      <div className="col-span-2">Qty</div>
                      <div className="col-span-1 text-center">Unit</div>
                      <div className="col-span-2 text-right">Cost</div>
                      <div className="col-span-1 text-right">Line Cost</div>
                    </div>
                  )}

                  {(form.recipeItems || []).map((row, idx) => (
                    <IngredientRow
                      key={row._key ?? idx}
                      row={row}
                      index={idx}
                      products={products}
                      excludeIds={[editing?.id, ...(form.recipeItems || []).map((i) => i.productId)].filter(Boolean)}
                      onChange={updateIngredient}
                      onRemove={removeIngredient}
                    />
                  ))}

                  <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addIngredient}>
                    Add Raw Material
                  </Button>
                </div>

                {(() => {
                  const totals = computeRecipeTotals(form.recipeItems, products);
                  const sellingPrice = Number(form.price) || 0;
                  const margin = sellingPrice - totals.unitCost;
                  const marginPct = sellingPrice ? (margin / sellingPrice) * 100 : 0;
                  return (
                    <div className="pt-2 border-t border-emerald-300/40 dark:border-emerald-800/40 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <StatBlock label="Material Cost" value={money(totals.unitCost)} />
                        <StatBlock label="Margin" value={money(margin)} tone={margin < 0 ? 'danger' : 'success'} />
                        <StatBlock label="Margin %" value={`${marginPct.toFixed(1)}%`} tone={margin < 0 ? 'danger' : 'success'} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <Field label="Final Selling Price (₹) *">
                          <Input
                            type="number"
                            step="1"
                            value={form.price}
                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                            required
                          />
                        </Field>
                      </div>
                      <div className="text-xs font-bold text-[color:var(--text-secondary)]">
                        Can produce:{' '}
                        <span className={totals.producible <= 0 ? 'text-red-600' : totals.producible <= 5 ? 'text-amber-600' : 'text-emerald-600'}>
                          {totals.producible} {form.unit || 'unit'}(s)
                        </span>{' '}
                        from current raw material stock.
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {form.productType === 'combo' && (
              <div className="p-3 rounded-xl border border-indigo-300/50 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="h-3.5 w-3.5" /> Combo Products
                  </h4>
                  <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
                    Select existing products to include in this combo bundle.
                  </p>
                </div>

                <div className="space-y-2">
                  {(form.comboItems || []).length > 0 && (
                    <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[10px] font-bold uppercase text-[color:var(--text-muted)]">
                      <div className="col-span-5">Product</div>
                      <div className="col-span-2">Qty</div>
                      <div className="col-span-1 text-center">Unit</div>
                      <div className="col-span-2 text-right">Value</div>
                      <div className="col-span-1 text-right">Line Value</div>
                    </div>
                  )}

                  {(form.comboItems || []).map((row, idx) => (
                    <IngredientRow
                      key={row._key ?? idx}
                      row={row}
                      index={idx}
                      products={products}
                      excludeIds={[editing?.id, ...(form.comboItems || []).map((i) => i.productId)].filter(Boolean)}
                      onChange={updateComboItem}
                      onRemove={removeComboItem}
                    />
                  ))}

                  <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addComboItem}>
                    Add Product to Combo
                  </Button>
                </div>

                {(() => {
                  const rows = (form.comboItems || []).map(ing => {
                    const material = (products || []).find(p => p.id === ing.productId);
                    const qty = Number(ing.qty) || 0;
                    const cost = material ? Number(material.price) || 0 : 0;
                    return { qty, cost, lineCost: qty * cost };
                  }).filter(r => r.qty > 0);
                  const totalComboPrice = rows.reduce((sum, r) => sum + r.lineCost, 0);
                  const sellingPrice = form.useCustomPricing ? (Number(form.price) || 0) : totalComboPrice;
                  const discount = totalComboPrice - sellingPrice;
                  const discountPct = totalComboPrice ? (discount / totalComboPrice) * 100 : 0;
                  const comboBuyable = (form.comboItems || []).length > 0
                    ? Math.max(0, Math.floor(Math.min(...(form.comboItems || []).map(item => {
                        const material = (products || []).find(p => p.id === item.productId);
                        return material && Number(item.qty) > 0 ? (material.stock || 0) / Number(item.qty) : 0;
                      }))))
                    : 0;

                  return (
                    <div className="pt-2 border-t border-indigo-300/40 dark:border-indigo-800/40 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <StatBlock label="Items Total Value" value={money(totalComboPrice)} />
                        <StatBlock label="Combo Selling Price" value={money(sellingPrice)} />
                        <StatBlock label="Customer Savings" value={money(discount)} tone={discount < 0 ? 'danger' : 'success'} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <Field label="Discount (%)">
                          <Input
                            type="number"
                            step="1"
                            value={form.useCustomPricing ? parseFloat(discountPct.toFixed(2)) : ''}
                            onChange={(e) => {
                              let newPct = Number(e.target.value) || 0;
                              if (newPct > 100) newPct = 100;
                              const newDiscount = (totalComboPrice * newPct) / 100;
                              setForm({ ...form, price: (totalComboPrice - newDiscount).toFixed(2), useCustomPricing: true });
                            }}
                            placeholder="0"
                          />
                        </Field>
                        <Field label="Discount Amount (₹)">
                          <Input
                            type="number"
                            step="1"
                            value={form.useCustomPricing ? parseFloat(discount.toFixed(2)) : ''}
                            onChange={(e) => {
                              const newDiscount = Number(e.target.value) || 0;
                              setForm({ ...form, price: (totalComboPrice - newDiscount).toFixed(2), useCustomPricing: true });
                            }}
                            placeholder="0.00"
                          />
                        </Field>
                        <Field label="Final Selling Price (₹) *">
                          <Input
                            type="number"
                            step="1"
                            value={sellingPrice}
                            onChange={(e) => setForm({ ...form, price: e.target.value, useCustomPricing: true })}
                            required
                          />
                        </Field>
                      </div>
                      <div className="text-xs font-bold text-[color:var(--text-secondary)]">
                        Available to sell:{' '}
                        <span className={comboBuyable <= 0 ? 'text-red-600' : comboBuyable <= 5 ? 'text-amber-600' : 'text-emerald-600'}>
                          {comboBuyable} {form.unit || 'combo'}(s)
                        </span>{' '}
                        from current component products stock.
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="HSN Code">
                <Input value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
              </Field>
              <Field label="GST Tax Rate (%)">
                <Select value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })}>
                  <option value={0}>0% (Exempt)</option>
                  <option value={5}>5% GST</option>
                  <option value={12}>12% GST</option>
                  <option value={18}>18% GST</option>
                  <option value={28}>28% GST</option>
                </Select>
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button icon={Save} type="submit" loading={saving} disabled={saving}>{editing ? 'Update Product' : 'Save Product'}</Button>
            </div>
          </form>
        </Modal>

        {/* Batch Write-Off Modal */}
        {writeOffTarget && (
          <Modal
            open={true}
            title={`Write Off Batch ${writeOffTarget.batch.batchNo}`}
            icon={AlertTriangle}
            onClose={() => setWriteOffTarget(null)}
          >
            <form onSubmit={submitWriteOff} className="space-y-4">
              <p className="text-xs text-[color:var(--text-muted)]">
                {writeOffTarget.product.name} — {writeOffTarget.batch.qty} {writeOffTarget.product.unit} available in this batch
                {writeOffTarget.batch.expiryDate ? ` (expires ${String(writeOffTarget.batch.expiryDate).slice(0, 10)})` : ''}.
              </p>
              <Field label={`Quantity to Write Off (max ${writeOffTarget.batch.qty})`}>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  max={writeOffTarget.batch.qty}
                  value={writeOffForm.qty}
                  onChange={(e) => setWriteOffForm({ ...writeOffForm, qty: e.target.value })}
                  autoFocus
                />
              </Field>
              <Field label="Reason">
                <Select value={writeOffForm.reason} onChange={(e) => setWriteOffForm({ ...writeOffForm, reason: e.target.value })}>
                  <option value="Expired">Expired</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Quality Issue">Quality Issue</option>
                  <option value="Other">Other</option>
                </Select>
              </Field>
              <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
                <Button type="button" variant="secondary" onClick={() => setWriteOffTarget(null)}>Cancel</Button>
                <Button icon={AlertTriangle} type="submit" loading={writingOff} disabled={writingOff}>Write Off</Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Category Quick-Create Modal */}
        {showCategoryModal && (
          <CategoryFormModal
            open={true}
            editing={null}
            categories={localCategories}
            showToast={showToast}
            onClose={() => setShowCategoryModal(false)}
            onSaved={handleCategorySaved}
          />
        )}
    </>
  );
}

function ProductsTab({ products, categories, units, warehouses, showToast, onRefresh, batchTrackingEnabled, serialTrackingEnabled, storeNearExpiryDays, tenant, defaultTaxRate, settings }) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [batchNoFilter, setBatchNoFilter] = useState('');

  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [labelProduct, setLabelProduct] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [labelBatch, setLabelBatch] = useState(null);
  const [priceHistoryProduct, setPriceHistoryProduct] = useState(null);

  const allBatchOptions = useMemo(() => {
    const opts = [];
    (products || []).forEach((p) => {
      if (!p.trackBatches || !Array.isArray(p.batches)) return;
      p.batches.forEach((b) => {
        opts.push({
          value: b.batchNo,
          label: `${b.batchNo} — ${p.name} (${b.qty} ${p.unit}${b.expiryDate ? `, exp ${String(b.expiryDate).slice(0, 10)}` : ''})`
        });
      });
    });
    return opts.sort((a, b) => a.value.localeCompare(b.value));
  }, [products]);

  const deferredQuery = useDeferredValue(query);

  const rows = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId !== 'all') {
        const belongs = Array.isArray(p.categoryIds) && p.categoryIds.length
          ? p.categoryIds.includes(categoryId)
          : p.categoryId === categoryId;
        if (!belongs) return false;
      }
      if (typeFilter !== 'all') {
        const primaryType = canonicalProductType(p.productType || (Array.isArray(p.productTypes) && p.productTypes.length > 1 ? 'both' : p.productTypes?.[0]));
        if (typeFilter === 'standard') {
          if (primaryType !== 'standard' && primaryType !== 'both' && !p.productTypes?.includes('standard')) return false;
        } else if (typeFilter === 'raw') {
          if (primaryType !== 'raw' && primaryType !== 'both' && !p.productTypes?.includes('raw')) return false;
        } else if (primaryType !== typeFilter) {
          return false;
        }
      }
      if (statusFilter === 'active' && p.isActive === false) return false;
      if (statusFilter === 'inactive' && p.isActive !== false) return false;

      let displayStock = p.stock;
      if (warehouseFilter !== 'all') {
        if (p.warehouses) {
          displayStock = p.warehouses[warehouseFilter] || 0;
        } else {
          const defaultWh = warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id;
          displayStock = (warehouseFilter === 'wh_shop' || warehouseFilter === defaultWh) ? (p.stock || 0) : 0;
        }
      }

      // If a specific warehouse is selected, optionally hide products that have never been in this warehouse (unless OUT is selected)
      if (warehouseFilter !== 'all' && stockFilter !== 'OUT' && displayStock <= 0) return false;

      const stockInfo = resolveProductStockInfo(p, products);
      if (stockFilter === 'LOW' && (stockInfo.isService || !stockInfo.isLow)) return false;
      if (stockFilter === 'OUT' && (stockInfo.isService || !stockInfo.isOut)) return false;

      if (batchFilter === 'tracked' && !p.trackBatches) return false;
      if (batchFilter === 'untracked' && p.trackBatches) return false;
      if (batchFilter === 'nearExpiry' || batchFilter === 'expired') {
        if (!p.trackBatches || !Array.isArray(p.batches)) return false;
        const today = new Date();
        const windowDays = resolveNearExpiryDays(p, storeNearExpiryDays);
        const hasMatch = p.batches.some((b) => {
          if (!b.expiryDate || !(Number(b.qty) > 0)) return false;
          const days = Math.ceil((new Date(b.expiryDate) - today) / 86400000);
          return batchFilter === 'expired' ? days < 0 : days >= 0 && days <= windowDays;
        });
        if (!hasMatch) return false;
      }

      if (batchNoFilter) {
        if (!p.trackBatches || !Array.isArray(p.batches)) return false;
        if (!p.batches.some((b) => b.batchNo === batchNoFilter)) return false;
      }

      if (!needle) return true;
      // Legacy `p.barcodes` alternates (pre-dating the single-barcode system) are long codes that
      // can coincidentally contain a short typed number anywhere inside them, surfacing a totally
      // unrelated product — only this product's own current `p.barcode` is checked here.
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.regionalName || '').toLowerCase().includes(needle) ||
        (p.printName || '').toLowerCase().includes(needle) ||
        (p.sku || '').toLowerCase().includes(needle) ||
        (p.barcode && String(p.barcode).includes(needle)) ||
        (p.trackSerials && Array.isArray(p.serials) && p.serials.some((s) =>
          String(s.serialNo || '').toLowerCase().includes(needle) || String(s.imei || '').toLowerCase().includes(needle)
        ))
      );
    });
  }, [products, deferredQuery, categoryId, typeFilter, stockFilter, statusFilter, warehouseFilter, batchFilter, batchNoFilter, storeNearExpiryDays, warehouses]);

  const productsById = useMemo(() => {
    const map = {};
    for (const p of products) {
      map[p.id] = p;
    }
    return map;
  }, [products]);

  // Form state and save logic live in the shared ProductFormModal; this tab only decides which product (if any) to open it for.
  const openAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setShowForm(true);
  };

  const removeProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await api.del(`/products/${id}`);
      showToast(res.message || 'Product removed.');
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to delete product.'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Action Bar */}
      <div className="flex items-center justify-between gap-2 bg-[color:var(--bg-surface)] p-2.5 rounded-2xl border border-[color:var(--border-subtle)] overflow-x-auto scrollbar-thin">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search name, SKU, barcode, serial no..."
            className="flex-1 min-w-[180px]"
          />

          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-36 shrink-0">
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-32 shrink-0">
            <option value="all">All Types</option>
            <option value="standard">Standard</option>
            <option value="raw">Raw Material</option>
            <option value="service">Service</option>
            <option value="combo">Combo</option>
            <option value="composite">Composite</option>
          </Select>

          <Select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className="w-36 shrink-0">
            <option value="all">All Warehouses</option>
            {(warehouses || []).map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>

          {batchTrackingEnabled && (
            <Select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className="w-32 shrink-0">
              <option value="all">All Batches</option>
              <option value="tracked">Tracked</option>
              <option value="untracked">Untracked</option>
              <option value="nearExpiry">Near Expiry</option>
              <option value="expired">Expired</option>
            </Select>
          )}

          {batchTrackingEnabled && allBatchOptions.length > 0 && (
            <Select value={batchNoFilter} onChange={(e) => setBatchNoFilter(e.target.value)} className="w-36 shrink-0">
              <option value="">Batch No…</option>
              {allBatchOptions.map((opt, idx) => (
                <option key={`${opt.value}_${idx}`} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          )}

          <Select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="w-28 shrink-0">
            <option value="ALL">All Stock</option>
            <option value="LOW">Low Stock</option>
            <option value="OUT">Out of Stock</option>
          </Select>

          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-28 shrink-0">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedIds.size > 0 && (
            <Button icon={Printer} variant="secondary" onClick={() => setLabelBatch([...selectedIds])} className="whitespace-nowrap">
              Print ({selectedIds.size})
            </Button>
          )}
          <Button icon={Plus} onClick={openAdd} className="whitespace-nowrap">Add Product</Button>
        </div>
      </div>

      {/* Products Table */}
      <Panel title={`Products (${rows.length}) ${rows.length > 200 ? '(Showing first 200)' : ''}`} icon={Package}>
        {rows.length === 0 ? (
          <EmptyState icon={Package} title="No products found" description="Try adjusting your filters or create a new product." />
        ) : (
          <div className="overflow-x-auto max-h-[80vh]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] font-bold uppercase border-b border-[color:var(--border-subtle)]">
                <tr>
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      className="rounded border-[color:var(--border-strong)] text-indigo-600 focus:ring-indigo-500"
                      checked={rows.slice(0, 200).length > 0 && rows.slice(0, 200).every((p) => selectedIds.has(p.id))}
                      onChange={(e) => {
                        const visibleIds = rows.slice(0, 200).map((p) => p.id);
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) visibleIds.forEach((id) => next.add(id));
                          else visibleIds.forEach((id) => next.delete(id));
                          return next;
                        });
                      }}
                    />
                  </th>
                  <th className="py-3 px-3">Product Info</th>
                  <th className="py-3 px-3">Category / Type</th>
                  <th className="py-3 px-3">SKU / Barcodes</th>
                  <th className="py-3 px-3 text-right">Purchase Price</th>
                  <th className="py-3 px-3 text-right">Selling Price</th>
                  <th className="py-3 px-3 text-center">Stock Level</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {rows.slice(0, 200).map((p) => {
                  const productCategoryNames = (Array.isArray(p.categoryIds) && p.categoryIds.length ? p.categoryIds : [p.categoryId])
                    .map((id) => categories.find((c) => c.id === id)?.name)
                    .filter(Boolean);
                  const isCompositeRow = p.productType === 'composite' || p.isComposite;
                  const isComboRow = p.productType === 'combo';

                  const compositeIngredients = (p.recipe?.ingredients?.length ? p.recipe.ingredients : p.recipeItems) || [];

                  const producible = isCompositeRow && compositeIngredients.length > 0
                    ? Math.max(0, Math.floor(Math.min(...compositeIngredients.map(item => {
                        const material = productsById[item.productId];
                        return material && Number(item.qty) > 0 ? (material.stock || 0) / Number(item.qty) : 0;
                      }))))
                    : (p.recipe?.producible ?? 0);

                  const comboBuyable = isComboRow && p.comboItems && p.comboItems.length > 0
                    ? Math.max(0, Math.floor(Math.min(...p.comboItems.map(item => {
                        const material = productsById[item.productId];
                        return material && Number(item.qty) > 0 ? (material.stock || 0) / Number(item.qty) : 0;
                      }))))
                    : 0;

                  let displayStock = p.stock;
                  if (warehouseFilter !== 'all') {
                    if (p.warehouses) {
                      displayStock = p.warehouses[warehouseFilter] || 0;
                    } else {
                      const defaultWh = warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id;
                      displayStock = (warehouseFilter === 'wh_shop' || warehouseFilter === defaultWh) ? (p.stock || 0) : 0;
                    }
                  }

                  const isLow = p.productType !== 'service' && (
                    isCompositeRow ? producible <= Number(p.minStock ?? 5) :
                    isComboRow ? comboBuyable <= Number(p.minStock ?? 5) :
                    Number(displayStock) <= Number(p.minStock ?? 5)
                  );

                  const isOut = p.productType !== 'service' && (
                    isCompositeRow ? producible <= 0 :
                    isComboRow ? comboBuyable <= 0 :
                    Number(displayStock) <= 0
                  );

                  const productTypesList = Array.isArray(p.productTypes) && p.productTypes.length ? p.productTypes : [p.productType || 'standard'];
                  const ingredientCount = isCompositeRow
                    ? (p.recipe?.ingredients?.length || p.recipeItems?.length || 0)
                    : isComboRow
                    ? (p.comboItems?.length || 0)
                    : 0;

                  return (
                    <tr key={p.id} className={cx('hover:bg-[color:var(--bg-subtle)]/50 transition-colors', p.isActive === false && 'opacity-50')}>
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          className="rounded border-[color:var(--border-strong)] text-indigo-600 focus:ring-indigo-500"
                          checked={selectedIds.has(p.id)}
                          onChange={(e) =>
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(p.id);
                              else next.delete(p.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const imgUrl = getProductImageUrl(p.imageUrl, p.name, p.barcode);
                            const visual = getProductAutoVisual(p.name);
                            return (
                              <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex items-center justify-center relative">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={p.name}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      if (e.currentTarget.nextSibling) {
                                        e.currentTarget.nextSibling.style.display = 'flex';
                                      }
                                    }}
                                  />
                                ) : null}
                                <div
                                  className={`h-full w-full bg-gradient-to-br ${visual.gradient} flex items-center justify-center text-white font-bold text-base shadow-xs select-none`}
                                  style={{ display: imgUrl ? 'none' : 'flex' }}
                                >
                                  <span>{visual.icon}</span>
                                </div>
                              </div>
                            );
                          })()}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-[color:var(--text-primary)]">{p.name}</span>
                              {p.isActive === false && <Badge tone="neutral">Inactive</Badge>}
                            </div>
                            {(p.regionalName || p.printName) && (
                              <div className="text-xs text-indigo-600 font-medium">{p.regionalName || p.printName}</div>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {p.sku && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  SKU: {p.sku}
                                </span>
                              )}
                              <span className="text-[11px] text-[color:var(--text-muted)] font-mono">HSN: {p.hsn || '—'}</span>
                            </div>
                            {p.trackBatches && Array.isArray(p.batches) && p.batches.some((b) => Number(b.qty) > 0) && (() => {
                              const activeBatches = p.batches.filter((b) => Number(b.qty) > 0);
                              const windowDays = resolveNearExpiryDays(p, storeNearExpiryDays);
                              const today = new Date();
                              let worst = null;
                              activeBatches.forEach((b) => {
                                if (!b.expiryDate) return;
                                const days = Math.ceil((new Date(b.expiryDate) - today) / 86400000);
                                if (days < 0) worst = 'expired';
                                else if (days <= windowDays && worst !== 'expired') worst = 'near';
                              });
                              const batchNoLabel = activeBatches.length === 1
                                ? activeBatches[0].batchNo
                                : `${activeBatches[0].batchNo} +${activeBatches.length - 1} more`;
                              return (
                                <div
                                  title={activeBatches.map((b) => b.batchNo).join(', ')}
                                  className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold normal-case ${
                                    worst === 'expired'
                                      ? 'bg-red-500/10 text-red-600'
                                      : worst === 'near'
                                      ? 'bg-amber-500/10 text-amber-600'
                                      : 'bg-indigo-500/10 text-indigo-600'
                                  }`}
                                >
                                  <History className="h-2.5 w-2.5 shrink-0" />
                                  <span className="font-mono">{batchNoLabel}</span>
                                  {worst === 'expired' ? ' · Expired' : worst === 'near' ? ' · Near Expiry' : ''}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {productCategoryNames.length ? (
                            productCategoryNames.map((name, i) => {
                              const catTheme = getCategoryTheme(name);
                              return (
                                <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-extrabold tracking-tight ${catTheme.badge}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${catTheme.dot}`} />
                                  {name}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[color:var(--text-muted)]">—</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {(() => {
                            const typeKey = canonicalProductType(p.productType || (Array.isArray(p.productTypes) && p.productTypes.length > 1 ? 'both' : p.productTypes?.[0]));
                            if (typeKey === 'both' || (Array.isArray(p.productTypes) && p.productTypes.includes('standard') && p.productTypes.includes('raw'))) {
                              return (
                                <>
                                  <Badge tone="neutral">Standard Product</Badge>
                                  <Badge tone="warning">Raw Material</Badge>
                                </>
                              );
                            }
                            const info = PRODUCT_TYPE_LABELS[typeKey] || PRODUCT_TYPE_LABELS.standard;
                            return (
                              <Badge tone={info.tone || 'neutral'}>{info.label || 'Standard Product'}</Badge>
                            );
                          })()}
                          {isCompositeRow && (
                            <Badge tone="success">{ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'}</Badge>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono">
                        {p.sku && (
                          <div className="font-bold text-[11px] text-indigo-600 dark:text-indigo-400 mb-0.5">
                            SKU: {p.sku}
                          </div>
                        )}
                        <div className="font-bold text-[color:var(--text-primary)]">{p.barcode || '—'}</div>
                        {Array.isArray(p.barcodes) && p.barcodes.length > 1 && (
                          <div className="text-[10px] text-[color:var(--text-muted)]">+{p.barcodes.length - 1} secondary barcode(s)</div>
                        )}
                      </td>

                      {p.productType === 'service' ? (
                        <td colSpan={2} className="py-3 px-3">
                          <div className="flex items-center justify-center gap-2 bg-[color:var(--bg-subtle)]/30 rounded-lg p-2 border border-[color:var(--border-subtle)]">
                            <span className="text-xs font-medium text-[color:var(--text-muted)]">Service Price:</span>
                            <span className="font-bold text-emerald-600 text-base">{money(p.price)}</span>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="py-3 px-3 text-right font-medium text-[color:var(--text-muted)]">
                            {money(p.purchasePrice)}
                          </td>

                          <td className="py-3 px-3 text-right font-bold text-[color:var(--text-primary)]">
                            <div>{money(p.price)} / {p.unit}</div>
                            {(() => {
                              const def = getDefaultSubUnit(p.unit, units);
                              const subName = p.customSubUnitName || def.name || '';
                              const subFactor = Number(p.customSubUnitFactor) || (def.factor ? Number(def.factor) : 0);
                              const subPrice = p.customSubUnitPrice || (subFactor && p.price ? Number(p.price) / subFactor : 0);
                              if (subName && subFactor > 0 && subPrice > 0) {
                                return (
                                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">
                                    ₹{Number(subPrice).toFixed(4)} / {subName}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </td>
                        </>
                      )}

                      <td className="py-3 px-3 text-center">
                        {p.productType === 'service' ? (
                          <Badge tone="info">N/A Service</Badge>
                        ) : isCompositeRow ? (
                          <span className={`inline-flex flex-col items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                            isOut ? 'bg-red-500/15 text-red-600 border border-red-500/20' :
                            isLow ? 'bg-amber-500/15 text-amber-600 border border-amber-500/20' :
                            'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                          }`}>
                            <span>{producible} {p.unit}</span>
                            <span className="text-[9px] uppercase">Can Produce</span>
                          </span>
                        ) : isComboRow ? (
                          <span className={`inline-flex flex-col items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                            isOut ? 'bg-red-500/15 text-red-600 border border-red-500/20' :
                            isLow ? 'bg-amber-500/15 text-amber-600 border border-amber-500/20' :
                            'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                          }`}>
                            <span>{comboBuyable} {p.unit}</span>
                            <span className="text-[9px] uppercase">Buyable</span>
                          </span>
                        ) : (
                          <span className={`inline-flex flex-col items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                            isOut ? 'bg-red-500/15 text-red-600 border border-red-500/20' :
                            isLow ? 'bg-amber-500/15 text-amber-600 border border-amber-500/20' :
                            'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                          }`}>
                            <span>{displayStock} {p.unit}</span>
                            {(() => {
                               const breakdown = formatUnitBreakdown(p, Number(displayStock) || 0);
                               return breakdown ? <span className="text-[10px] opacity-75 font-medium">{breakdown}</span> : null;
                            })()}
                            {isOut && <span className="text-[9px] text-red-500 uppercase mt-0.5">Out of Stock</span>}
                            {isLow && !isOut && <span className="text-[9px] text-amber-600 uppercase mt-0.5">Low Stock</span>}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {Array.isArray(p.pricingHistory) && p.pricingHistory.length > 0 && (
                            <button onClick={() => setPriceHistoryProduct(p)} title="Price History" className="p-1.5 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-indigo-600">
                              <History className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => setLabelProduct(p)} title="Print Barcode Label" className="p-1.5 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-indigo-600">
                            <Printer className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEdit(p)} title="Edit Product" className="p-1.5 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-indigo-600">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button onClick={() => removeProduct(p.id)} title="Delete Product" className="p-1.5 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Product Form Drawer/Modal */}
      <ProductFormModal
        open={showForm}
        editing={editing}
        categories={categories}
        units={units}
        warehouses={warehouses}
        products={products}
        defaultTaxRate={defaultTaxRate}
        batchTrackingEnabled={batchTrackingEnabled}
        serialTrackingEnabled={serialTrackingEnabled}
        storeNearExpiryDays={storeNearExpiryDays}
        showToast={showToast}
        settings={settings}
        onClose={() => setShowForm(false)}
        onSaved={() => {
          setShowForm(false);
          onRefresh();
        }}
        onCategoryCreated={() => onRefresh?.()}
      />

      {/* Barcode Print Modal */}
      {labelProduct && (
        <BarcodePrinterModal product={labelProduct} companyName={tenant?.name} onClose={() => setLabelProduct(null)} showToast={showToast} />
      )}

      {labelBatch && (
        <BarcodePrinterModal
          products={products.filter((p) => labelBatch.includes(p.id))}
          companyName={tenant?.name}
          onClose={() => setLabelBatch(null)}
          showToast={showToast}
        />
      )}

      {/* Price History Modal */}
      {priceHistoryProduct && (
        <Modal open={true} title={`Price History — ${priceHistoryProduct.name}`} icon={History} onClose={() => setPriceHistoryProduct(null)}>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {(priceHistoryProduct.pricingHistory || []).map((h, idx) => (
              <div key={idx} className="p-2.5 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[color:var(--text-primary)]">{fmtDateTime(h.date)}</span>
                  <span className="text-[color:var(--text-muted)]">{h.updatedBy || 'Owner'}</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 font-mono">
                  {h.oldPrice !== h.newPrice && (
                    <div>
                      Selling: {money(h.oldPrice)} <ArrowRight className="inline h-3 w-3 mx-0.5" /> <span className="font-bold">{money(h.newPrice)}</span>
                    </div>
                  )}
                  {h.oldPurchasePrice !== h.newPurchasePrice && (
                    <div>
                      Purchase: {money(h.oldPurchasePrice)} <ArrowRight className="inline h-3 w-3 mx-0.5" /> <span className="font-bold">{money(h.newPurchasePrice)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

    </div>
  );
}

/* ------------------------------- Recipe & Alternate Unit row widgets — used inside the Product form ------------------------------- */

function StatBlock({ label, value, tone = 'neutral' }) {
  const color = tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-emerald-600' : 'text-[color:var(--text-primary)]';
  return (
    <div className="p-2 rounded-lg bg-[color:var(--bg-surface)] border border-[color:var(--border-subtle)]">
      <div className="text-[9px] uppercase font-bold text-[color:var(--text-muted)]">{label}</div>
      <div className={`text-sm font-bold tabular ${color}`}>{value}</div>
    </div>
  );
}

/** Searchable raw-material picker + qty for one recipe ingredient row. */
function IngredientRow({ row, index, products, excludeIds, onChange, onRemove }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const material = (products || []).find((p) => p.id === row.productId);

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (products || [])
      .filter((p) => p.productType !== 'composite' && !p.isComposite)
      .filter((p) => p.id === row.productId || !excludeIds.includes(p.id))
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || String(p.barcode || '').includes(needle))
      .slice(0, 30);
  }, [products, query, excludeIds, row.productId]);

  const isKg = material?.unit?.toLowerCase() === 'kg';
  const isLtr = ['ltr', 'l', 'liter', 'liters', 'litre', 'litres'].includes(material?.unit?.toLowerCase());
  const hasCustom = !!material?.customSubUnitName && Number(material?.customSubUnitFactor) > 0;

  const hasSubUnit = isKg || isLtr || hasCustom;
  const subUnitName = isKg ? 'g' : isLtr ? 'ml' : hasCustom ? material.customSubUnitName : null;
  const subUnitFactor = isKg || isLtr ? 1000 : hasCustom ? Number(material.customSubUnitFactor) : 1;

  const [useSubUnit, setUseSubUnit] = useState(hasSubUnit);

  useEffect(() => {
    setUseSubUnit(hasSubUnit);
  }, [hasSubUnit]);

  const cost = material ? Number(material.purchasePrice) || 0 : 0;
  const qty = Number(row.qty) || 0;
  const displayQty = useSubUnit ? qty * subUnitFactor : qty;

  const [inputValue, setInputValue] = useState(displayQty === 0 ? '' : String(displayQty));

  useEffect(() => {
    // Only sync from above if the parsed input value differs from the true displayQty
    // This allows typing "0." or "0.0" without it getting wiped out.
    const parsed = Number(inputValue) || 0;
    if (parsed !== displayQty && inputValue !== '') {
      setInputValue(displayQty === 0 ? '' : String(displayQty));
    }
  }, [displayQty]);

  const handleQtyChange = (val) => {
    setInputValue(val);
    const num = Number(val) || 0;
    onChange(index, { qty: useSubUnit ? num / subUnitFactor : num });
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)]">
      <div className="col-span-12 md:col-span-5 relative">
        {material ? (
          <div className="field-input flex items-center justify-between gap-2 !py-1.5">
            <span className="truncate text-xs font-bold text-[color:var(--text-primary)]">{material.name}</span>
            <button
              type="button"
              onClick={() => { onChange(index, { productId: '' }); setQuery(''); }}
              className="shrink-0 text-[10px] font-bold text-indigo-600 hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Search raw material..."
              className="text-xs"
            />
            {open && (
              <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] shadow-lg">
                {candidates.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[color:var(--text-muted)]">No matching products.</div>
                ) : (
                  candidates.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onMouseDown={() => { onChange(index, { productId: p.id }); setQuery(''); setOpen(false); }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-[color:var(--bg-subtle)]"
                    >
                      <span className="font-medium text-[color:var(--text-primary)]">{p.name}</span>
                      <span className="text-[color:var(--text-muted)]">{money(p.purchasePrice)}/{p.unit}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div className="col-span-4 md:col-span-2">
        <Input
          type="number"
          step="any"
          min="0"
          value={inputValue}
          onChange={(e) => handleQtyChange(e.target.value)}
          placeholder="Qty"
          className="text-xs"
        />
      </div>
      <div className="col-span-2 md:col-span-1 text-xs text-center font-medium">
        {hasSubUnit ? (
           <select
             value={useSubUnit ? 'sub' : 'base'}
             onChange={(e) => {
               // When switching units, the displayed quantity will automatically update to reflect the same base amount
               setUseSubUnit(e.target.value === 'sub');
             }}
             className="w-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded px-1 py-0.5 text-xs font-bold focus:ring-indigo-500 cursor-pointer"
             title="Select unit for recipe"
           >
             <option value="sub">{subUnitName}</option>
             <option value="base">{material.unit}</option>
           </select>
        ) : (
           <span className="text-[color:var(--text-muted)]">{material?.unit || '—'}</span>
        )}
      </div>
      <div className="col-span-3 md:col-span-2 text-xs text-right text-[color:var(--text-secondary)]">
        {material ? money(cost) : '—'}
      </div>
      <div className="col-span-2 md:col-span-1 text-xs text-right font-bold text-[color:var(--text-primary)]">
        {material ? money(qty * cost) : '—'}
      </div>
      <div className="col-span-1 text-right">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Categories Tab (Story 1) ------------------------------- */

function CategoriesTab({ categories, products, showToast, onRefresh }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    if (!query) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  }, [categories, query]);

  // Was a full products.filter() per category on every render — O(categories
  // × products) each time instead of once per actual products change.
  const categoryProductCounts = useMemo(() => {
    const counts = new Map();
    (products || []).forEach((p) => {
      const ids = Array.isArray(p.categoryIds) && p.categoryIds.length ? p.categoryIds : [p.categoryId];
      ids.forEach((id) => {
        if (!id) return;
        counts.set(id, (counts.get(id) || 0) + 1);
      });
    });
    return counts;
  }, [products]);

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setShowModal(true);
  };

  const removeCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      const res = await api.del(`/categories/${id}`);
      showToast(res.message || 'Category removed.');
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Cannot delete category.'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
        <SearchInput value={query} onChange={setQuery} placeholder="Search categories..." className="w-64" />
        <Button icon={Plus} onClick={openAdd}>Add Category</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {filtered.map((cat) => {
          const catTheme = getCategoryTheme(cat);
          const assignedCount = categoryProductCounts.get(cat.id) || 0;
          return (
            <div key={cat.id} className={`p-4 rounded-xl border ${catTheme.border} ${catTheme.lightBg} flex items-center justify-between transition-all hover:shadow-sm`}>
              <div className="flex items-center gap-3">
                <div className="text-2xl p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-[color:var(--border-subtle)]">{cat.icon || '📦'}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${catTheme.dot}`} />
                    <div className="font-bold text-sm text-[color:var(--text-primary)]">{cat.name}</div>
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)] mt-0.5">{assignedCount} product(s) assigned</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-slate-800 text-[color:var(--text-muted)] hover:text-indigo-600" title="Edit Category">
                  <Edit3 className="h-4 w-4" />
                </button>
                <button onClick={() => removeCategory(cat.id)} className="p-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-slate-800 text-[color:var(--text-muted)] hover:text-red-600" title="Delete Category">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <CategoryFormModal
        open={showModal}
        editing={editing}
        categories={categories}
        showToast={showToast}
        onClose={() => setShowModal(false)}
        onSaved={() => onRefresh?.()}
      />
    </div>
  );
}

/* ------------------------------- Units Tab (Story 2) ------------------------------- */

const UNIT_NAME_RE = /^[a-zA-Z][a-zA-Z0-9\s-]{0,29}$/;

function UnitsTab({ units, showToast, onRefresh }) {
  const [unitList, setUnitList] = useState(units || []);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState({ name: '', subUnit: '', factor: '' });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setUnitList(units || []);
  }, [units]);

  const unitNames = useMemo(
    () => (unitList || []).map((u) => (typeof u === 'object' ? u.name : u)).filter(Boolean),
    [unitList]
  );

  const errors = useMemo(() => {
    const e = {};
    const name = form.name.trim();

    if (!name) {
      e.name = 'Unit name is required.';
    } else if (!UNIT_NAME_RE.test(name)) {
      e.name = 'Start with a letter — letters, numbers, spaces and hyphens only (max 30 characters).';
    } else if (
      unitNames.some(
        (n) => n.toLowerCase() === name.toLowerCase() && n.toLowerCase() !== String(editingUnit || '').toLowerCase()
      )
    ) {
      e.name = `A unit named "${name}" already exists.`;
    }

    if (form.subUnit) {
      if (form.subUnit.toLowerCase() === name.toLowerCase()) {
        e.subUnit = 'Sub-unit cannot be the same as the unit itself.';
      }
      if (!(Number(form.factor) > 0)) {
        e.factor = 'Enter how many sub-units make up 1 of this unit.';
      }
    } else if (form.factor) {
      e.subUnit = 'Pick a sub-unit to go with this quantity.';
    }

    return e;
  }, [form, unitNames, editingUnit]);

  const isValid = Object.keys(errors).length === 0 && !!form.name.trim();

  const openAdd = () => {
    setEditingUnit(null);
    setForm({ name: '', subUnit: '', factor: '' });
    setTouched(false);
    setShowModal(true);
  };

  const openEdit = (u) => {
    const unitObj = typeof u === 'object' ? u : { name: u, subUnit: '', factor: '' };
    setEditingUnit(unitObj.name);
    setForm({
      name: unitObj.name || '',
      subUnit: unitObj.subUnit || '',
      factor: unitObj.factor || ''
    });
    setTouched(false);
    setShowModal(true);
  };

  const saveUnit = async (e) => {
    e?.preventDefault();
    setTouched(true);
    if (!isValid) {
      showToast(Object.values(errors)[0] || 'Please fix the highlighted fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim().toLowerCase(),
        newName: form.name.trim().toLowerCase(),
        subUnit: form.subUnit ? form.subUnit.trim().toLowerCase() : null,
        factor: form.subUnit && form.factor ? Number(form.factor) : null
      };

      if (editingUnit) {
        await api.put(`/units/${encodeURIComponent(editingUnit)}`, payload);
        showToast('Unit updated successfully.');
      } else {
        await api.post('/units', payload);
        showToast('Unit created successfully.');
      }
      setShowModal(false);
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to save unit.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteUnit = async (name) => {
    if (!confirm(`Delete unit "${name}"?`)) return;
    try {
      await api.del(`/units/${encodeURIComponent(name)}`);
      showToast(`Unit "${name}" deleted.`);
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Cannot delete unit.'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-[color:var(--bg-surface)] p-3.5 rounded-2xl border border-[color:var(--border-subtle)]">
        <div>
          <h3 className="font-bold text-sm text-[color:var(--text-primary)]">Units of Measurement</h3>
          <p className="text-xs text-[color:var(--text-muted)]">Configure selling units and conversions (e.g. 1 kg = 1000 g, 1 box = 24 pcs, 1 dozen = 12 pcs)</p>
        </div>
        <Button icon={Plus} onClick={openAdd}>Add Unit</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {unitList.map((u) => {
          const unitObj = typeof u === 'object' ? u : { name: u, subUnit: null, factor: null };
          const name = unitObj.name;
          const hasConversion = unitObj.subUnit && unitObj.factor;

          return (
            <div
              key={name}
              className="p-3.5 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex flex-col justify-between gap-2.5 shadow-sm hover:border-indigo-400/50 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-sm text-[color:var(--text-primary)] capitalize">{name}</span>
                  {hasConversion ? (
                    <div className="mt-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50 inline-block">
                      1 {name} = {unitObj.factor} {unitObj.subUnit}
                    </div>
                  ) : unitObj.subUnit ? (
                    <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                      Sub-unit: {unitObj.subUnit}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">Base unit</div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(u)}
                    className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:text-indigo-600 hover:bg-[color:var(--bg-subtle)] transition-colors"
                    title="Edit Unit"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteUnit(name)}
                    className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                    title="Delete Unit"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <Modal open={true} title={editingUnit ? `Edit Unit (${editingUnit})` : 'Create Unit'} icon={Sliders} onClose={() => setShowModal(false)}>
          <form onSubmit={saveUnit} className="space-y-4" noValidate>
            <Field label="Unit Name *" hint="e.g. kg, box, dozen, litre, bag">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onBlur={() => setTouched(true)}
                placeholder="e.g. bag"
                autoFocus
              />
              {touched && errors.name && (
                <div className="mt-1 text-[11px] font-semibold text-rose-600">{errors.name}</div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
              <Field label="Sub-Unit" hint="Optional — a smaller unit this breaks down into">
                <Select
                  value={form.subUnit}
                  onChange={(e) => setForm({ ...form, subUnit: e.target.value, factor: e.target.value ? form.factor : '' })}
                >
                  <option value="">No sub-unit (base unit)</option>
                  {unitNames
                    .filter((n) => n.toLowerCase() !== form.name.trim().toLowerCase())
                    .map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  {form.subUnit && !unitNames.some((n) => n.toLowerCase() === form.subUnit.toLowerCase()) && (
                    <option value={form.subUnit}>{form.subUnit}</option>
                  )}
                </Select>
                {touched && errors.subUnit && (
                  <div className="mt-1 text-[11px] font-semibold text-rose-600">{errors.subUnit}</div>
                )}
              </Field>

              <Field label="Quantity" hint={`1 ${form.name.trim() || 'unit'} = ? ${form.subUnit || 'sub-units'}`}>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.factor}
                  onChange={(e) => setForm({ ...form, factor: e.target.value })}
                  onBlur={() => setTouched(true)}
                  placeholder="e.g. 25"
                  disabled={!form.subUnit}
                  className={!form.subUnit ? 'opacity-60 cursor-not-allowed' : ''}
                />
                {touched && errors.factor && (
                  <div className="mt-1 text-[11px] font-semibold text-rose-600">{errors.factor}</div>
                )}
              </Field>
            </div>

            {form.name.trim() && form.subUnit && Number(form.factor) > 0 && !errors.name && !errors.subUnit && (
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                Conversion: 1 {form.name.trim()} = {form.factor} {form.subUnit}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button icon={Save} type="submit" disabled={saving || (touched && !isValid)}>
                {saving ? 'Saving…' : 'Save Unit'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------- Warehouses & Stock Transfer Tab ------------------------------- */

function WarehousesTab({ warehouses, products, showToast, onRefresh }) {
  const [sourceWh, setSourceWh] = useState(warehouses[0]?.id || 'wh_main');
  const [targetWh, setTargetWh] = useState(warehouses[1]?.id || 'wh_shop');
  const [transferReason, setTransferReason] = useState('Shop counter restock');
  const [transferItems, setTransferItems] = useState([{ productId: '', quantity: '10' }]);
  const [loading, setLoading] = useState(false);

  const [editingWh, setEditingWh] = useState(null);
  const [showWhModal, setShowWhModal] = useState(false);
  const [whForm, setWhForm] = useState({ name: '', code: '', location: '' });

  const getWarehouseStock = (product, whId) => {
    if (!product || !whId) return 0;
    if (product.warehouses && product.warehouses[whId] !== undefined) {
      return Number(product.warehouses[whId]) || 0;
    }
    const defaultWh = warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id;
    if (whId === 'wh_shop' || whId === defaultWh) {
      return Number(product.stock) || 0;
    }
    return 0;
  };

  const addTransferItem = () => {
    setTransferItems((prev) => [...prev, { productId: '', quantity: '1' }]);
  };

  const updateTransferItem = (index, patch) => {
    setTransferItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeTransferItem = (index) => {
    setTransferItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTransfer = async (e) => {
    e?.preventDefault();
    if (!sourceWh || !targetWh) {
      showToast('Select source and target warehouses.', 'error');
      return;
    }
    if (sourceWh === targetWh) {
      showToast('Source and target warehouse must be different.', 'error');
      return;
    }

    const validItems = transferItems
      .filter((i) => i.productId && Number(i.quantity) > 0)
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }));

    if (validItems.length === 0) {
      showToast('Please add at least one product with a valid quantity to transfer.', 'error');
      return;
    }

    // Check available stock in source warehouse before submitting
    for (const item of validItems) {
      const p = (products || []).find((prod) => prod.id === item.productId);
      const available = getWarehouseStock(p, sourceWh);
      if (item.quantity > available) {
        showToast(`Cannot transfer ${item.quantity} of "${p?.name || 'Item'}". Only ${available} available in source warehouse.`, 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await api.post('/inventory/transfer', {
        sourceWarehouseId: sourceWh,
        targetWarehouseId: targetWh,
        productId: validItems[0]?.productId,
        quantity: validItems[0]?.quantity,
        items: validItems,
        reason: transferReason
      });

      showToast(res.message || 'Stock transferred successfully.');
      setTransferItems([{ productId: '', quantity: '1' }]);
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Stock transfer failed.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddWh = () => {
    setEditingWh(null);
    setWhForm({ name: '', code: '', location: '' });
    setShowWhModal(true);
  };

  const openEditWh = (w) => {
    setEditingWh(w);
    setWhForm({ name: w.name, code: w.code, location: w.location || '' });
    setShowWhModal(true);
  };

  const saveWh = async (e) => {
    e?.preventDefault();
    if (!whForm.name) return showToast('Warehouse name is required.', 'error');
    try {
      if (editingWh) {
        await api.put(`/warehouses/${editingWh.id}`, whForm);
        showToast('Warehouse updated successfully.');
      } else {
        await api.post('/warehouses', whForm);
        showToast('Warehouse created successfully.');
      }
      setShowWhModal(false);
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to save warehouse.'), 'error');
    }
  };

  const deleteWh = async (w) => {
    if (w.isDefault) return showToast('Cannot delete default warehouse.', 'error');
    if (!confirm(`Are you sure you want to delete ${w.name}?`)) return;
    try {
      await api.del(`/warehouses/${w.id}`);
      showToast('Warehouse deleted.');
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to delete warehouse.'), 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Warehouse Cards */}
      <div className="lg:col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[color:var(--text-primary)]">Registered Warehouses</h3>
          <Button icon={Plus} size="sm" onClick={openAddWh}>Add</Button>
        </div>
        {(warehouses || []).map((w) => (
          <div key={w.id} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)]">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-[color:var(--text-primary)]">{w.name}</div>
              <Badge tone={w.isDefault ? 'success' : 'neutral'}>{w.code}</Badge>
            </div>
            <div className="text-xs text-[color:var(--text-muted)] mt-1">{w.location}</div>
            <div className="mt-3 pt-2 border-t border-[color:var(--border-subtle)] flex justify-between items-center text-xs font-bold text-indigo-600">
              <div className="flex gap-2">
                <span>{w.itemCounts || 0} items</span>
                <span>•</span>
                <span>{w.totalStock || 0} units</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEditWh(w)} className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-indigo-600">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                {!w.isDefault && (
                  <button onClick={() => deleteWh(w)} className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Multi-Product Stock Transfer Panel */}
      <div className="lg:col-span-2 space-y-3">
        <Panel title="Multi-Product Warehouse Stock Transfer" icon={ArrowRightLeft}>
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Source Warehouse">
                <Select value={sourceWh} onChange={(e) => setSourceWh(e.target.value)}>
                  {(warehouses || []).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Destination Warehouse">
                <Select value={targetWh} onChange={(e) => setTargetWh(e.target.value)}>
                  {(warehouses || []).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Transfer Items Manifest */}
            <div className="space-y-3 p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">
                  Transfer Items Manifest ({transferItems.length})
                </h4>
                <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addTransferItem}>
                  Add Product
                </Button>
              </div>

              <div className="space-y-2">
                {transferItems.map((item, idx) => {
                  const prod = (products || []).find((p) => p.id === item.productId);
                  const sourceStock = getWarehouseStock(prod, sourceWh);
                  const targetStock = getWarehouseStock(prod, targetWh);

                  const selectedProductIds = transferItems.map((i, iIdx) => iIdx !== idx && i.productId).filter(Boolean);
                  const availableProducts = (products || []).filter((p) => {
                    if (p.productType === 'service') return false;
                    if (selectedProductIds.includes(p.id) && p.id !== item.productId) return false;
                    const stk = getWarehouseStock(p, sourceWh);
                    return stk > 0 || p.id === item.productId;
                  });

                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)]">
                      <div className="col-span-6 md:col-span-5">
                        <Select
                          value={item.productId}
                          onChange={(e) => {
                            const newProdId = e.target.value;
                            const newProd = (products || []).find((p) => p.id === newProdId);
                            const available = getWarehouseStock(newProd, sourceWh);
                            updateTransferItem(idx, {
                              productId: newProdId,
                              quantity: available > 0 ? (Number(item.quantity) > available ? String(available) : item.quantity || '1') : '1'
                            });
                          }}
                          required
                        >
                          <option value="">
                            {availableProducts.length === 0
                              ? '-- No items with available stock in source --'
                              : '-- Choose Product (Available stock only) --'}
                          </option>
                          {availableProducts.map((p) => {
                            const stk = getWarehouseStock(p, sourceWh);
                            return (
                              <option key={p.id} value={p.id} disabled={stk <= 0}>
                                {p.name} {stk > 0 ? `(Available: ${stk} ${p.unit || 'pcs'})` : `(0 Available in Source)`}
                              </option>
                            );
                          })}
                        </Select>
                      </div>

                      <div className="col-span-3 md:col-span-3 text-xs">
                        {prod ? (
                          <div className="flex flex-col">
                            <span className={`font-bold ${sourceStock > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              Src: {sourceStock} {prod.unit || 'pcs'}
                            </span>
                            <span className="text-[10px] text-[color:var(--text-muted)]">Dst: {targetStock} {prod.unit || 'pcs'}</span>
                          </div>
                        ) : (
                          <span className="text-[color:var(--text-muted)]">—</span>
                        )}
                      </div>

                      <div className="col-span-2 md:col-span-3">
                        <Input
                          type="number"
                          step="any"
                          min="0.001"
                          max={sourceStock > 0 ? sourceStock : undefined}
                          value={item.quantity}
                          onChange={(e) => updateTransferItem(idx, { quantity: e.target.value })}
                          placeholder="Qty"
                          required
                        />
                      </div>

                      <div className="col-span-1 text-right">
                        {transferItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTransferItem(idx)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Remove Item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Field label="Transfer Reason / Reference">
              <Input
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g. Counter restock / Morning shipment"
              />
            </Field>

            <Button icon={ArrowRightLeft} type="submit" disabled={loading} className="w-full">
              {loading ? 'Executing Stock Transfer...' : `Execute Multi-Product Transfer (${transferItems.filter(i => i.productId && Number(i.quantity) > 0).length} Product(s))`}
            </Button>
          </form>
        </Panel>
      </div>

      {showWhModal && (
        <Modal open={true} title={editingWh ? 'Edit Warehouse' : 'Create Warehouse'} icon={Building2} onClose={() => setShowWhModal(false)}>
          <form onSubmit={saveWh} className="space-y-4">
            <Field label="Warehouse Name *">
              <Input value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} required />
            </Field>
            <Field label="Warehouse Code">
              <Input value={whForm.code} onChange={(e) => setWhForm({ ...whForm, code: e.target.value })} placeholder="e.g. WH-SOUTH" />
            </Field>
            <Field label="Location / Description">
              <Input value={whForm.location} onChange={(e) => setWhForm({ ...whForm, location: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
              <Button variant="secondary" onClick={() => setShowWhModal(false)}>Cancel</Button>
              <Button icon={Save} type="submit">Save Warehouse</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------- Stock Adjustment Tab (Story 10) ------------------------------- */

function AdjustTab({ products, warehouses = [], showToast, onRefresh }) {
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [mode, setMode] = useState('ADD');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Stock Take Audit');
  const [password, setPassword] = useState('');
  const [batchId, setBatchId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [customBatch, setCustomBatch] = useState(false);
  const [serial, setSerial] = useState('');
  const [saving, setSaving] = useState(false);
  const [labelProduct, setLabelProduct] = useState(null);

  const adjustableProducts = useMemo(
    () => products.filter((p) => p.productType !== 'service'),
    [products]
  );

  const availableWarehouses = useMemo(() => {
    if (warehouses && warehouses.length > 0) return warehouses;
    return [{ id: 'wh_shop', name: 'Main Godown / Shop', isDefault: true }];
  }, [warehouses]);

  // Default warehouse selection
  useEffect(() => {
    if (!warehouseId && availableWarehouses.length > 0) {
      const def = availableWarehouses.find((w) => w.isDefault) || availableWarehouses[0];
      if (def) setWarehouseId(def.id);
    }
  }, [availableWarehouses, warehouseId]);

  const selectedProduct = adjustableProducts.find((p) => p.id === productId);
  const isBatchedProduct = Boolean(
    selectedProduct && (selectedProduct.trackBatches || (Array.isArray(selectedProduct.batches) && selectedProduct.batches.length > 0))
  );
  const isSerialProduct = Boolean(
    selectedProduct && (
      selectedProduct.trackSerial ||
      selectedProduct.trackSerials ||
      selectedProduct.isSerialized ||
      (Array.isArray(selectedProduct.serialNumbers) && selectedProduct.serialNumbers.length > 0)
    )
  );
  const wholeNumberOnly = isWholeNumberUnit(selectedProduct?.unit);
  const productBatches = useMemo(() => {
    return Array.isArray(selectedProduct?.batches) ? selectedProduct.batches : [];
  }, [selectedProduct]);

  // When product changes, reset batch & serial
  useEffect(() => {
    setBatchId('');
    setBatchNo('');
    setCustomBatch(false);
    setSerial('');
  }, [productId]);

  const selectedWarehouse = availableWarehouses.find((w) => w.id === warehouseId) || availableWarehouses[0];
  const currentWhStock = selectedProduct
    ? (selectedProduct.warehouses && typeof selectedProduct.warehouses === 'object' && selectedProduct.warehouses[warehouseId] !== undefined
        ? Number(selectedProduct.warehouses[warehouseId]) || 0
        : (selectedWarehouse?.isDefault ? Number(selectedProduct.stock) || 0 : 0))
    : 0;

  const currentBatch = isBatchedProduct ? productBatches.find((b) => b.id === batchId) : null;

  // Projected stock computation
  const numericQty = Number(quantity) || 0;
  const projectedWhStock = selectedProduct
    ? (mode === 'SET' ? numericQty : mode === 'REMOVE' ? Math.max(0, currentWhStock - numericQty) : currentWhStock + numericQty)
    : null;

  const handleBatchSelect = (val) => {
    if (val === 'CUSTOM') {
      setBatchId('');
      setCustomBatch(true);
      setBatchNo('');
    } else if (val === '') {
      setBatchId('');
      setCustomBatch(false);
      setBatchNo('');
    } else {
      setBatchId(val);
      setCustomBatch(false);
      const b = productBatches.find((x) => x.id === val);
      setBatchNo(b?.batchNo || '');
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (saving) return;
    if (!productId || !quantity) return showToast('Product and quantity required.', 'error');

    setSaving(true);
    try {
      const res = await api.post('/inventory/adjust', {
        productId,
        mode,
        quantity,
        reason,
        password,
        warehouseId: warehouseId || undefined,
        batchId: isBatchedProduct && batchId ? batchId : undefined,
        batchNo: isBatchedProduct && (batchNo || '').trim() ? batchNo.trim() : undefined,
        serial: isSerialProduct && (serial || '').trim() ? serial.trim() : undefined
      });
      showToast(res.message || 'Stock adjusted.');
      setQuantity('');
      setSerial('');
      if (customBatch) {
        setBatchNo('');
        setCustomBatch(false);
      }
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Stock adjustment failed.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Manual Stock Adjustment" icon={Boxes}>
      <form onSubmit={submit} className="space-y-4 max-w-xl">
        <Field label="Select Product">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="">-- Select Product --</option>
                {adjustableProducts.map((p) => {
                  const isBatched = Boolean(p.trackBatches || (Array.isArray(p.batches) && p.batches.length > 0));
                  const isSerialized = Boolean(p.trackSerial || p.trackSerials || p.isSerialized || (Array.isArray(p.serialNumbers) && p.serialNumbers.length > 0));
                  const tags = [];
                  if (isBatched) tags.push('Batched');
                  if (isSerialized) tags.push('Serialized');
                  const tagStr = tags.length ? ` [${tags.join(', ')}]` : '';
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} (Total Stock: {p.stock} {p.unit}){tagStr}
                    </option>
                  );
                })}
              </Select>
            </div>
            {selectedProduct && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Barcode}
                onClick={() => setLabelProduct(selectedProduct)}
                title="Print a barcode/SKU label for this product right from here"
              >
                Print Barcode
              </Button>
            )}
          </div>
        </Field>

        {labelProduct && (
          <BarcodePrinterModal product={labelProduct} onClose={() => setLabelProduct(null)} showToast={showToast} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Godown / Warehouse">
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              {availableWarehouses.map((w) => {
                const whStock = selectedProduct?.warehouses?.[w.id] !== undefined
                  ? selectedProduct.warehouses[w.id]
                  : (w.isDefault ? selectedProduct?.stock ?? 0 : 0);
                return (
                  <option key={w.id} value={w.id}>
                    {w.name} {selectedProduct ? `(${whStock} ${selectedProduct.unit})` : ''} {w.isDefault ? '★ Default' : ''}
                  </option>
                );
              })}
            </Select>
          </Field>

          <Field label="Adjustment Action">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="ADD">Increase Stock (+)</option>
              <option value="REMOVE">Decrease Stock (-)</option>
              <option value="SET">Set Exact Stock (=)</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Quantity" hint={wholeNumberOnly ? `Whole numbers only for ${selectedProduct?.unit || 'unit'}` : undefined}>
            <Input
              type="number"
              min="0"
              step={wholeNumberOnly ? '1' : 'any'}
              value={quantity}
              onChange={(e) => setQuantity(wholeNumberOnly ? e.target.value.replace(/\./g, '') : e.target.value)}
              placeholder="e.g. 10"
              required
            />
          </Field>

          <Field label="Adjustment Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="Stock Take Audit">Stock Take Audit</option>
              <option value="Damaged Goods">Damaged Goods</option>
              <option value="Expired Item">Expired Item</option>
              <option value="Theft / Loss">Theft / Loss</option>
              <option value="Supplier Return">Supplier Return</option>
              <option value="Initial Opening Stock">Initial Opening Stock</option>
            </Select>
          </Field>
        </div>

        {/* Batch Selection — ONLY displayed when a batched product is selected */}
        {isBatchedProduct && (
          <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/20 space-y-3">
            <div className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Batch Tracking ({selectedProduct?.name})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {productBatches.length > 0 ? (
                <Field label="Select Batch">
                  <Select
                    value={customBatch ? 'CUSTOM' : batchId}
                    onChange={(e) => handleBatchSelect(e.target.value)}
                  >
                    <option value="">-- Select Existing Batch --</option>
                    {productBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batchNo} (Qty: {b.qty} {selectedProduct?.unit || ''}{b.expiryDate ? ` · Exp: ${b.expiryDate}` : ''})
                      </option>
                    ))}
                    <option value="CUSTOM">+ Enter New / Custom Batch</option>
                  </Select>
                </Field>
              ) : (
                <Field label="Batch Number">
                  <Input
                    type="text"
                    placeholder="e.g. BATCH-001"
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                  />
                </Field>
              )}

              {productBatches.length > 0 && customBatch && (
                <Field label="New Batch Number">
                  <Input
                    type="text"
                    placeholder="Enter batch number"
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    autoFocus
                  />
                </Field>
              )}
            </div>
          </div>
        )}

        {/* Serial / IMEI input — ONLY displayed when a serialized product is selected */}
        {isSerialProduct && (
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 space-y-3">
            <div className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Barcode className="w-3.5 h-3.5" />
              <span>Serial / IMEI Tracking ({selectedProduct?.name})</span>
            </div>
            <Field label="Serial / IMEI Number(s)" hint="Single or comma-separated serials (e.g. SN1001, SN1002)">
              <Input
                type="text"
                placeholder="e.g. SN1001, SN1002"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
              />
            </Field>
            {Array.isArray(selectedProduct?.serialNumbers) && selectedProduct.serialNumbers.length > 0 && (
              <div className="text-[11px] text-[color:var(--text-muted)]">
                Existing Serials ({selectedProduct.serialNumbers.length}):{' '}
                <span className="font-mono text-[color:var(--text-primary)]">
                  {selectedProduct.serialNumbers.slice(0, 5).join(', ')}
                  {selectedProduct.serialNumbers.length > 5 ? ` +${selectedProduct.serialNumbers.length - 5} more` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Live Stock Preview Card */}
        {selectedProduct && (
          <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <span className="text-[color:var(--text-muted)] block">Selected Godown:</span>
              <span className="font-bold text-[color:var(--text-primary)]">
                {selectedWarehouse?.name || 'Main'} ({currentWhStock} {selectedProduct.unit})
              </span>
            </div>
            <div>
              <span className="text-[color:var(--text-muted)] block">Total Stock:</span>
              <span className="font-bold text-[color:var(--text-primary)]">
                {selectedProduct.stock} {selectedProduct.unit}
              </span>
            </div>
            {isBatchedProduct && currentBatch && (
              <div>
                <span className="text-[color:var(--text-muted)] block">Batch Stock:</span>
                <span className="font-bold text-purple-600">
                  {currentBatch.qty} {selectedProduct.unit}
                </span>
              </div>
            )}
            {isSerialProduct && Array.isArray(selectedProduct.serialNumbers) && selectedProduct.serialNumbers.length > 0 && (
              <div>
                <span className="text-[color:var(--text-muted)] block">Registered Serials:</span>
                <span className="font-bold text-amber-600">
                  {selectedProduct.serialNumbers.length} serial(s)
                </span>
              </div>
            )}
            {quantity && projectedWhStock !== null && (
              <div className="col-span-2 sm:col-span-3 pt-1.5 border-t border-[color:var(--border-subtle)] flex items-center justify-between text-[color:var(--text-secondary)]">
                <span>Godown stock after adjustment:</span>
                <span className="font-bold text-indigo-600 text-sm">
                  {projectedWhStock} {selectedProduct.unit}
                </span>
              </div>
            )}
          </div>
        )}

        <Field label="Authorization Password (only required if enabled in Settings)">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank if not required" />
        </Field>

        <Button icon={Save} type="submit" loading={saving} disabled={saving}>Save Stock Adjustment</Button>
      </form>
    </Panel>
  );
}

/* ------------------------------- History Tab (Story 11) ------------------------------- */

function HistoryTab({ products }) {
  const [movements, setMovements] = useState([]);
  const [type, setType] = useState('ALL');
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const productOptions = useMemo(
    () => [...(products || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  useEffect(() => {
    let ignore = false;
    api.get('/inventory/movements', { type, productId: productId || undefined, startDate: startDate || undefined, endDate: endDate || undefined })
      .then((res) => {
        if (ignore) return;
        setMovements(Array.isArray(res) ? res : res?.data || []);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [type, productId, startDate, endDate]);

  const filtered = useMemo(() => {
    if (!query) return movements;
    return movements.filter((m) => String(m.productName || '').toLowerCase().includes(query.toLowerCase()));
  }, [movements, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by product name..." className="w-56" />

        <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-56">
          <option value="">All Products</option>
          {productOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>

        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-40">
          <option value="ALL">All Types</option>
          <option value="SALE">Sale</option>
          <option value="PURCHASE">Purchase</option>
          <option value="ADJUSTMENT">Adjustment</option>
          <option value="TRANSFER">Transfer</option>
          <option value="OPENING">Opening</option>
        </Select>

        <Field label="From" className="!mb-0">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
        </Field>
        <Field label="To" className="!mb-0">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
        </Field>
        {(startDate || endDate || productId) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setProductId('');
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      <Panel title={`Stock Movement Log (${filtered.length})`} icon={History}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-muted)] uppercase border-b border-[color:var(--border-subtle)]">
              <tr>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Qty Change</th>
                <th className="py-2.5 px-3 text-right">Balance After</th>
                <th className="py-2.5 px-3">Reason / Details</th>
                <th className="py-2.5 px-3">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-subtle)] font-mono">
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5 px-3 font-sans text-[color:var(--text-secondary)]">{m.dateTime || fmtDateTime(m.timestamp || m.date)}</td>
                  <td className="py-2.5 px-3 font-sans font-bold text-[color:var(--text-primary)]">{m.productName}</td>
                  <td className="py-2.5 px-3 font-sans">
                    <Badge tone={MOVEMENT_TONE[m.type] || 'neutral'}>{m.type}</Badge>
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold ${m.qtyChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.qtyChange >= 0 ? `+${m.qtyChange}` : m.qtyChange} {m.unit}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[color:var(--text-primary)]">{m.resultingStock ?? m.balanceAfter ?? '—'}</td>
                  <td className="py-2.5 px-3 font-sans">
                    <div className="text-[color:var(--text-primary)]">{m.reason || '—'}</div>
                    {(m.warehouseName || m.batchNo || (Array.isArray(m.serials) && m.serials.length > 0)) && (
                      <div className="flex flex-wrap gap-1 mt-1 font-mono text-[10px]">
                        {m.warehouseName && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Godown: {m.warehouseName}
                          </span>
                        )}
                        {m.batchNo && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Batch: {m.batchNo}
                          </span>
                        )}
                        {Array.isArray(m.serials) && m.serials.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            SN: {m.serials.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-[color:var(--text-secondary)]">{m.user || 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* --------------------- Batch Tracking Tab: every batch across every batch-tracked product, with write-off --------------------- */

function BatchesTab({ products, showToast, onRefresh, storeNearExpiryDays }) {
  const [view, setView] = useState('stock'); // 'stock' | 'sales'
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState(''); // '' = all products, else a product id
  const [writeOffTarget, setWriteOffTarget] = useState(null); // { product, batch }
  const [writeOffForm, setWriteOffForm] = useState({ qty: '', reason: 'Expired' });
  const [writingOff, setWritingOff] = useState(false);
  const [returnTarget, setReturnTarget] = useState(null); // { product, batch }
  const [returnForm, setReturnForm] = useState({ qty: '', reason: '' });
  const [returning, setReturning] = useState(false);
  const [salesReport, setSalesReport] = useState([]);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    if (view !== 'sales') return;
    setLoadingReport(true);
    api.get('/inventory/batches/sales-report')
      .then((res) => setSalesReport(Array.isArray(res) ? res : res?.data || []))
      .catch(() => showToast('Failed to load batch sales report.', 'error'))
      .finally(() => setLoadingReport(false));
  }, [view]);

  // Only products that actually have batches get listed — picking one (e.g.
  // "Keyboard") narrows the table to just that product's own batches.
  const batchProducts = useMemo(() => {
    return (products || [])
      .filter((p) => p.trackBatches && Array.isArray(p.batches) && p.batches.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const rows = useMemo(() => {
    const today = new Date();
    const needle = query.trim().toLowerCase();
    const list = [];

    (products || []).forEach((p) => {
      if (!p.trackBatches || !Array.isArray(p.batches)) return;
      if (productFilter && p.id !== productFilter) return;
      const windowDays = resolveNearExpiryDays(p, storeNearExpiryDays);
      p.batches.forEach((b) => {
        let status = 'active';
        let days = null;
        if (b.expiryDate) {
          days = Math.ceil((new Date(b.expiryDate) - today) / 86400000);
          if (days < 0) status = 'expired';
          else if (days <= windowDays) status = 'near';
        }
        list.push({ product: p, batch: b, status, days });
      });
    });

    return list
      .filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (!needle) return true;
        return String(r.batch.batchNo || '').toLowerCase().includes(needle) || String(r.product.name || '').toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const rank = { expired: 0, near: 1, active: 2 };
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        if (a.batch.expiryDate && b.batch.expiryDate) return new Date(a.batch.expiryDate) - new Date(b.batch.expiryDate);
        if (a.batch.expiryDate) return -1;
        if (b.batch.expiryDate) return 1;
        return new Date(b.batch.createdAt || 0) - new Date(a.batch.createdAt || 0);
      });
  }, [products, query, statusFilter, storeNearExpiryDays, productFilter]);

  const valuation = useMemo(() => {
    return rows.reduce(
      (acc, { product: p, batch: b }) => {
        const qty = Number(b.qty) || 0;
        const sellRate = b.sellPrice != null ? Number(b.sellPrice) : Number(p.price) || 0;
        acc.costValue += qty * (Number(b.costPrice) || 0);
        acc.retailValue += qty * sellRate;
        return acc;
      },
      { costValue: 0, retailValue: 0 }
    );
  }, [rows]);

  const submitWriteOff = async (e) => {
    e?.preventDefault();
    if (!writeOffTarget) return;
    const qty = Number(writeOffForm.qty);
    if (!(qty > 0)) {
      showToast('Enter a quantity to write off.', 'error');
      return;
    }
    setWritingOff(true);
    try {
      await api.post('/inventory/batches/writeoff', {
        productId: writeOffTarget.product.id,
        batchId: writeOffTarget.batch.id,
        quantity: qty,
        reason: writeOffForm.reason
      });
      showToast(`Wrote off ${qty} ${writeOffTarget.product.unit} from batch ${writeOffTarget.batch.batchNo}.`);
      setWriteOffTarget(null);
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to write off batch.'), 'error');
    } finally {
      setWritingOff(false);
    }
  };

  const submitReturn = async (e) => {
    e?.preventDefault();
    if (!returnTarget) return;
    const qty = Number(returnForm.qty);
    if (!(qty > 0)) {
      showToast('Enter a quantity to return.', 'error');
      return;
    }
    setReturning(true);
    try {
      const res = await api.post('/inventory/batches/return', {
        productId: returnTarget.product.id,
        batchId: returnTarget.batch.id,
        quantity: qty,
        reason: returnForm.reason
      });
      showToast(res.message || `Returned ${qty} ${returnTarget.product.unit} from batch ${returnTarget.batch.batchNo}.`);
      setReturnTarget(null);
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to return batch to supplier.'), 'error');
    } finally {
      setReturning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)] w-fit">
        {[
          { id: 'stock', label: 'Current Stock' },
          { id: 'sales', label: 'Sales Report' }
        ].map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              view === v.id ? 'bg-indigo-600 text-white' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Batches Shown" value={rows.length} icon={AlertTriangle} />
        <StatTile label="Stock Value (Cost)" value={money(valuation.costValue, { decimals: false })} icon={IndianRupee} />
        <StatTile label="Stock Value (Retail)" value={money(valuation.retailValue, { decimals: false })} tone="accent" />
      </div>

      {view === 'stock' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
            <SearchInput value={query} onChange={setQuery} placeholder="Search batch no. or product..." className="w-64" />
            <div className="flex items-center gap-2">
              <Select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="w-52">
                <option value="">All Products</option>
                {batchProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({(p.batches || []).length})
                  </option>
                ))}
              </Select>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
                <option value="all">All Batches</option>
                <option value="active">Active</option>
                <option value="near">Near Expiry</option>
                <option value="expired">Expired</option>
              </Select>
            </div>
          </div>

          <Panel title={`Batches (${rows.length})`} icon={AlertTriangle}>
            {rows.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No batches yet"
                description="Batches appear here once you turn on batch tracking for a product and receive stock for it."
              />
            ) : (
              <div className="overflow-x-auto max-h-[75vh]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-muted)] uppercase border-b border-[color:var(--border-subtle)] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Batch No.</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Cost (₹)</th>
                      <th className="py-2.5 px-3 text-right">Sell Price (₹)</th>
                      <th className="py-2.5 px-3">Mfg Date</th>
                      <th className="py-2.5 px-3">Expiry Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {rows.map(({ product: p, batch: b, status, days }) => (
                      <tr key={b.id}>
                        <td className="py-2.5 px-3 font-bold text-[color:var(--text-primary)]">{p.name}</td>
                        <td className="py-2.5 px-3 font-mono">{b.batchNo}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{b.qty} {p.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[color:var(--text-secondary)]">{money(b.costPrice)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[color:var(--text-secondary)]">
                          {b.sellPrice != null ? money(b.sellPrice) : <span className="text-[color:var(--text-muted)]">Auto</span>}
                        </td>
                        <td className="py-2.5 px-3 text-[color:var(--text-muted)]">{b.mfgDate ? String(b.mfgDate).slice(0, 10) : '—'}</td>
                        <td className="py-2.5 px-3 text-[color:var(--text-muted)]">{b.expiryDate ? String(b.expiryDate).slice(0, 10) : '—'}</td>
                        <td className="py-2.5 px-3">
                          <Badge tone={status === 'expired' ? 'danger' : status === 'near' ? 'warning' : 'success'}>
                            {status === 'expired' ? `Expired ${Math.abs(days)}d ago` : status === 'near' ? `${days}d left` : 'Active'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(b.qty) > 0 && (
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setReturnForm({ qty: '', reason: '' });
                                  setReturnTarget({ product: p, batch: b });
                                }}
                                className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[color:var(--text-muted)] hover:text-indigo-600"
                                title="Return to supplier"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setWriteOffForm({ qty: '', reason: 'Expired' });
                                  setWriteOffTarget({ product: p, batch: b });
                                }}
                                className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[color:var(--text-muted)] hover:text-amber-600"
                                title="Write off (expired/damaged)"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {view === 'sales' && (
        <Panel title={`Batch Sales Report (${salesReport.length})`} icon={IndianRupee}>
          {loadingReport ? (
            <Spinner text="Loading batch sales..." />
          ) : salesReport.length === 0 ? (
            <EmptyState
              icon={IndianRupee}
              title="No batch sales yet"
              description="Once a sale draws from a batch-tracked product, it'll show up here with quantity sold and revenue attributed to that batch."
            />
          ) : (
            <div className="overflow-x-auto max-h-[75vh]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-muted)] uppercase border-b border-[color:var(--border-subtle)] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Batch No.</th>
                    <th className="py-2.5 px-3 text-right">Qty Sold</th>
                    <th className="py-2.5 px-3 text-right">Revenue (₹)</th>
                    <th className="py-2.5 px-3 text-right">Order Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {salesReport.map((r) => (
                    <tr key={r.batchId}>
                      <td className="py-2.5 px-3 font-bold text-[color:var(--text-primary)]">{r.productName}</td>
                      <td className="py-2.5 px-3 font-mono">{r.batchNo}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{r.qtySold} {r.unit}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{money(r.revenue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[color:var(--text-muted)]">{r.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {returnTarget && (
        <Modal
          open={true}
          title={`Return Batch ${returnTarget.batch.batchNo} to Supplier`}
          icon={RefreshCw}
          onClose={() => setReturnTarget(null)}
        >
          <form onSubmit={submitReturn} className="space-y-4">
            <p className="text-xs text-[color:var(--text-muted)]">
              {returnTarget.product.name} — {returnTarget.batch.qty} {returnTarget.product.unit} available in this batch. This only
              corrects stock; adjust the vendor's payable manually via Purchases/Payments if this return should reduce what's owed to them.
            </p>
            <Field label={`Quantity to Return (max ${returnTarget.batch.qty})`}>
              <Input
                type="number"
                step="any"
                min="0"
                max={returnTarget.batch.qty}
                value={returnForm.qty}
                onChange={(e) => setReturnForm({ ...returnForm, qty: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Reason (optional)">
              <Input
                value={returnForm.reason}
                onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                placeholder="e.g. Damaged on arrival"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
              <Button type="button" variant="secondary" onClick={() => setReturnTarget(null)}>Cancel</Button>
              <Button icon={RefreshCw} type="submit" loading={returning} disabled={returning}>Return to Supplier</Button>
            </div>
          </form>
        </Modal>
      )}

      {writeOffTarget && (
        <Modal
          open={true}
          title={`Write Off Batch ${writeOffTarget.batch.batchNo}`}
          icon={AlertTriangle}
          onClose={() => setWriteOffTarget(null)}
        >
          <form onSubmit={submitWriteOff} className="space-y-4">
            <p className="text-xs text-[color:var(--text-muted)]">
              {writeOffTarget.product.name} — {writeOffTarget.batch.qty} {writeOffTarget.product.unit} available in this batch
              {writeOffTarget.batch.expiryDate ? ` (expires ${String(writeOffTarget.batch.expiryDate).slice(0, 10)})` : ''}.
            </p>
            <Field label={`Quantity to Write Off (max ${writeOffTarget.batch.qty})`}>
              <Input
                type="number"
                step="any"
                min="0"
                max={writeOffTarget.batch.qty}
                value={writeOffForm.qty}
                onChange={(e) => setWriteOffForm({ ...writeOffForm, qty: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Reason">
              <Select value={writeOffForm.reason} onChange={(e) => setWriteOffForm({ ...writeOffForm, reason: e.target.value })}>
                <option value="Expired">Expired</option>
                <option value="Damaged">Damaged</option>
                <option value="Quality Issue">Quality Issue</option>
                <option value="Other">Other</option>
              </Select>
            </Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
              <Button type="button" variant="secondary" onClick={() => setWriteOffTarget(null)}>Cancel</Button>
              <Button icon={AlertTriangle} type="submit" loading={writingOff} disabled={writingOff}>Write Off</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* Serial Tracking Tab: product list drills into a per-unit table (same shape as any other product list), and "View" opens a unit's full record since one row can't show every custom field. */

function SerialsTab({ products }) {
  const [query, setQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [unitQuery, setUnitQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in_stock' | 'sold' | 'returned'
  const [detailTarget, setDetailTarget] = useState(null); // { product, serial }

  const serialProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (products || [])
      .filter((p) => p.trackSerials && Array.isArray(p.serials) && p.serials.length > 0)
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || String(p.sku || '').toLowerCase().includes(needle))
      .map((p) => ({
        product: p,
        total: p.serials.length,
        inStock: p.serials.filter((s) => s.status === 'IN_STOCK').length,
        sold: p.serials.filter((s) => s.status === 'SOLD').length,
        returned: p.serials.filter((s) => s.status === 'RETURNED').length
      }))
      .sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [products, query]);

  const selectedProduct = selectedProductId ? (products || []).find((p) => p.id === selectedProductId) : null;

  // Unit-level filters are scoped to whichever product is open — switching
  // products (or going back to the list) starts them fresh.
  useEffect(() => {
    setUnitQuery('');
    setStatusFilter('all');
  }, [selectedProductId]);

  const unitRows = useMemo(() => {
    if (!selectedProduct) return [];
    const needle = unitQuery.trim().toLowerCase();
    return (selectedProduct.serials || [])
      .filter((s) => {
        if (statusFilter === 'in_stock') return s.status === 'IN_STOCK';
        if (statusFilter === 'sold') return s.status === 'SOLD';
        if (statusFilter === 'returned') return s.status === 'RETURNED';
        return true;
      })
      .filter((s) => !needle || String(s.serialNo || '').toLowerCase().includes(needle) || String(s.imei || '').toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [selectedProduct, unitQuery, statusFilter]);

  // Product-level drill-down: all of the selected product's units and qty details.
  if (selectedProduct) {
    const p = selectedProduct;
    const totalUnits = (p.serials || []).length;
    const inStockUnits = (p.serials || []).filter((s) => s.status === 'IN_STOCK').length;
    const soldUnits = (p.serials || []).filter((s) => s.status === 'SOLD').length;
    const returnedUnits = (p.serials || []).filter((s) => s.status === 'RETURNED').length;

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedProductId(null)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Products
        </button>

        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-indigo-600" />
          <h3 className="text-base font-bold text-[color:var(--text-primary)]">{p.name}</h3>
          {p.sku && <span className="text-xs font-mono text-[color:var(--text-muted)]">SKU: {p.sku}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Total Units" value={totalUnits} icon={ScanLine} />
          <StatTile label="In Stock" value={inStockUnits} tone="success" />
          <StatTile label="Sold" value={soldUnits} tone="accent" />
          <StatTile label="Returned" value={returnedUnits} tone="danger" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
          <SearchInput value={unitQuery} onChange={setUnitQuery} placeholder="Search serial no. or IMEI..." className="w-64" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
            <option value="all">All Units</option>
            <option value="in_stock">In Stock</option>
            <option value="sold">Sold</option>
            <option value="returned">Returned</option>
          </Select>
        </div>

        <Panel title={`Units (${unitRows.length})`} icon={ScanLine}>
          {unitRows.length === 0 ? (
            <EmptyState icon={ScanLine} title="No units match" description="Try a different search or status filter." />
          ) : (
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-muted)] uppercase border-b border-[color:var(--border-subtle)] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Serial No.</th>
                    <th className="py-2.5 px-3">IMEI</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Warranty Till</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {unitRows.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-[color:var(--text-primary)]">{s.serialNo}</td>
                      <td className="py-2.5 px-3 font-mono text-[color:var(--text-secondary)]">{s.imei || '—'}</td>
                      <td className="py-2.5 px-3">
                        <Badge tone={s.status === 'SOLD' ? 'neutral' : s.status === 'RETURNED' ? 'danger' : 'success'}>
                          {s.status === 'SOLD' ? 'Sold' : s.status === 'RETURNED' ? 'Returned' : 'In Stock'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-[color:var(--text-muted)]">
                        {s.warrantyEndDate ? String(s.warrantyEndDate).slice(0, 10) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailTarget({ product: p, serial: s })}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[color:var(--text-muted)] hover:text-indigo-600"
                          title="View full details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {detailTarget && (() => {
        const { product: p, serial: s } = detailTarget;
        const labels = Array.isArray(p.serialCustomLabels) && p.serialCustomLabels.length === 4
          ? p.serialCustomLabels
          : DEFAULT_SERIAL_CUSTOM_LABELS;
        const filledCustomFields = labels
          .map((lbl, i) => ({ lbl, value: s.customFields?.[i] }))
          .filter((f) => f.value);

        const field = (label, value) => (
          <div>
            <div className="text-[10px] uppercase text-[color:var(--text-muted)] font-bold">{label}</div>
            <div className="text-[color:var(--text-primary)]">{value ?? '—'}</div>
          </div>
        );

        return (
          <Modal
            open={true}
            onClose={() => setDetailTarget(null)}
            title={`Serial Details — ${p.name}`}
            icon={ScanLine}
            size="md"
          >
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {field('Product', p.name)}
                {field('SKU', p.sku)}
                {field('Category', (p.categoryIds && p.categoryIds.length) ? p.categoryIds.join(', ') : p.categoryId)}
                {field('Unit Price', money(p.price))}
                {field('Serial No.', <span className="font-mono font-bold">{s.serialNo}</span>)}
                {field('IMEI', s.imei ? <span className="font-mono">{s.imei}</span> : '—')}
                {field('Status', <Badge tone={s.status === 'SOLD' ? 'neutral' : s.status === 'RETURNED' ? 'danger' : 'success'}>{s.status === 'SOLD' ? 'Sold' : s.status === 'RETURNED' ? 'Returned' : 'In Stock'}</Badge>)}
                {field('Received On', s.createdAt ? String(s.createdAt).slice(0, 10) : '—')}
                {s.status === 'SOLD' && field('Sold On Order', s.soldOrderId || '—')}
                {s.status === 'RETURNED' && field('Return Reason', s.returnReason || '—')}
                {s.status === 'RETURNED' && field('Returned On', s.returnedAt ? String(s.returnedAt).slice(0, 10) : '—')}
                {s.status === 'RETURNED' && field('Returned By', s.returnedBy || '—')}
                {p.hasWarranty && field('Warranty Till', s.warrantyEndDate ? String(s.warrantyEndDate).slice(0, 10) : 'Not sold yet')}
              </div>

              {filledCustomFields.length > 0 && (
                <div className="pt-3 border-t border-[color:var(--border-subtle)]">
                  <div className="text-[10px] uppercase text-[color:var(--text-muted)] font-bold mb-2">Custom Fields</div>
                  <div className="grid grid-cols-2 gap-3">
                    {filledCustomFields.map((f, i) => <React.Fragment key={i}>{field(f.lbl, f.value)}</React.Fragment>)}
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}
      </div>
    );
  }

  // Default view: a normal product list, one row per serial-tracked product
  // with its qty summary — selecting a product drills into its own units.
  const overallTotal = serialProducts.reduce((sum, r) => sum + r.total, 0);
  const overallInStock = serialProducts.reduce((sum, r) => sum + r.inStock, 0);
  const overallSold = serialProducts.reduce((sum, r) => sum + r.sold, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Total Units" value={overallTotal} icon={ScanLine} />
        <StatTile label="In Stock" value={overallInStock} tone="success" />
        <StatTile label="Sold" value={overallSold} tone="accent" />
      </div>

      <div className="bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
        <SearchInput value={query} onChange={setQuery} placeholder="Search product or SKU..." className="w-72" />
      </div>

      <Panel title={`Serial-Tracked Products (${serialProducts.length})`} icon={ScanLine}>
        {serialProducts.length === 0 ? (
          <EmptyState
            icon={ScanLine}
            title="No serial-tracked products yet"
            description="Products appear here once you turn on 'Track by Serial / IMEI Number' for them and fill in their Serial Number Sheet from Add Product."
          />
        ) : (
          <div className="overflow-x-auto max-h-[75vh]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-muted)] uppercase border-b border-[color:var(--border-subtle)] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Total Units</th>
                  <th className="py-2.5 px-3 text-right">In Stock</th>
                  <th className="py-2.5 px-3 text-right">Sold</th>
                  <th className="py-2.5 px-3 text-right">Returned</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {serialProducts.map(({ product: p, total, inStock, sold, returned }) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className="cursor-pointer hover:bg-[color:var(--bg-subtle)] transition-colors"
                  >
                    <td className="py-2.5 px-3 font-bold text-[color:var(--text-primary)]">{p.name}</td>
                    <td className="py-2.5 px-3 font-mono text-[color:var(--text-secondary)]">{p.sku || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{total}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{inStock}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[color:var(--text-muted)]">{sold}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400">{returned}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedProductId(p.id); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                      >
                        View Units <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------- Price Sheets Tab (Story 18 & Story 13) ------------------------------- */

/** Margin as a % of cost — the same basis the product form uses when it turns a margin into a price. */
const marginPct = (cost, price) => {
  const c = Number(cost) || 0;
  const p = Number(price);
  return c > 0 && Number.isFinite(p) ? Math.round(((p - c) / c) * 10000) / 100 : null;
};
// Typed values are strings; the sheet stores numbers, and a blank must not become a zero price.
const numericMap = (map) =>
  Object.fromEntries(Object.entries(map || {}).filter(([, v]) => v !== '' && v != null && Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]));
const priceFromMargin = (cost, pct) => Math.round((Number(cost) || 0) * (1 + (Number(pct) || 0) / 100) * 100) / 100;

/** The Global Price Matrix grid (purchase price, selling price, MRP, margin and per-product batches). The Global Sheet editor uses the same grid. */
const MATRIX_PAGE = 150;

function PriceMatrixTable({ rows, onUpdate, batchesById, showAllBatches }) {
  const [openBatchIds, setOpenBatchIds] = useState(() => new Set());
  // Thousands of products × several inputs each is what makes a big catalogue crawl, so rows are drawn a page at a time.
  const [limit, setLimit] = useState(MATRIX_PAGE);
  const visibleRows = rows.length > limit ? rows.slice(0, limit) : rows;
  // What's being typed in a Margin box, so a half-typed "12." isn't rewritten from the price it produced.
  const [marginDraft, setMarginDraft] = useState({});
  const toggleBatches = (id) =>
    setOpenBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-primary)] uppercase border-b border-[color:var(--border-subtle)]">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Purchase Price (₹)</th>
                      <th className="py-2.5 px-3 text-right">Selling Price (₹)</th>
                      <th className="py-2.5 px-3 text-right">MRP (₹)</th>
                      <th className="py-2.5 px-3 text-right">Margin (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {visibleRows.map((r) => {
                      const isService = String(r.productType).toLowerCase() === 'service';
                      const batches = batchesById.get(r.id) || [];
                      const batchesOpen = batches.length > 0 && (showAllBatches || openBatchIds.has(r.id));
                      return (
                        <React.Fragment key={r.id}>
                        <tr>
                          <td className="py-2 px-3">
                            <div className="font-bold text-[color:var(--text-primary)] flex items-center gap-1.5">
                              {r.name}
                              {batches.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleBatches(r.id)}
                                  className="inline-flex items-center gap-0.5 rounded-md border border-[color:var(--border-subtle)] px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                  title="Show or hide this product's batches"
                                >
                                  {batchesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  {batches.length} batch{batches.length === 1 ? '' : 'es'}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 font-normal text-[10.5px] text-[color:var(--text-muted)]">
                              {r.sku && <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">SKU: {r.sku}</span>}
                              {r.barcode && <span className="font-mono">· {r.barcode}</span>}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-medium text-[color:var(--text-primary)]">{r.category} {isService && <Badge tone="info" className="ml-1">Service</Badge>}</td>
                          {isService ? (
                            <td colSpan={4} className="py-2 px-3">
                              <div className="flex items-center justify-end gap-3 bg-[color:var(--bg-subtle)]/30 rounded-lg p-1.5 border border-[color:var(--border-subtle)] mr-2">
                                <span className="text-sm uppercase font-bold text-[color:var(--text-primary)] tracking-wider">Service Price:</span>
                                <Input type="number" step="0.01" value={r.price} onChange={(e) => onUpdate(r.id, 'price', e.target.value)} className="w-32 text-right font-bold bg-white dark:bg-black" />
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="py-2 px-3 text-right">
                                <Input type="number" step="0.01" value={r.purchasePrice} onChange={(e) => onUpdate(r.id, 'purchasePrice', e.target.value)} className="w-24 text-right ml-auto" />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <Input type="number" step="0.01" value={r.price} onChange={(e) => onUpdate(r.id, 'price', e.target.value)} className="w-24 text-right font-bold ml-auto" />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <Input type="number" step="0.01" value={r.mrp} onChange={(e) => onUpdate(r.id, 'mrp', e.target.value)} className="w-24 text-right ml-auto" />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  disabled={!(Number(r.purchasePrice) > 0)}
                                  title={Number(r.purchasePrice) > 0 ? 'Type a margin to set the selling price from the purchase price' : 'Set a purchase price first'}
                                  value={marginDraft[r.id] ?? marginPct(r.purchasePrice, r.price) ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setMarginDraft((prev) => ({ ...prev, [r.id]: v }));
                                    if (v !== '') onUpdate(r.id, 'price', priceFromMargin(r.purchasePrice, v));
                                  }}
                                  onBlur={() => setMarginDraft((prev) => { const n = { ...prev }; delete n[r.id]; return n; })}
                                  className="w-20 text-right ml-auto"
                                />
                              </td>
                            </>
                          )}
                        </tr>
                        {batchesOpen && (
                          <tr className="bg-[color:var(--bg-subtle)]/40">
                            <td colSpan={6} className="py-2 px-3">
                              <table className="w-full text-[11px] text-left">
                                <thead className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--text-secondary)]">
                                  <tr>
                                    <th className="py-1 pr-3">Batch No</th>
                                    <th className="py-1 pr-3 text-right">Qty</th>
                                    <th className="py-1 pr-3">Mfg</th>
                                    <th className="py-1 pr-3">Expiry</th>
                                    <th className="py-1 pr-3 text-right">Cost (₹)</th>
                                    <th className="py-1 pr-3 text-right">Selling (₹)</th>
                                    <th className="py-1 pr-3 text-right">MRP (₹)</th>
                                    <th className="py-1 text-right">Margin (%)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                                  {batches.map((b) => {
                                    const sell = b.sellPrice != null && b.sellPrice !== '' ? Number(b.sellPrice) : Number(r.price) || 0;
                                    const bm = marginPct(b.costPrice, sell);
                                    return (
                                      <tr key={b.id || b.batchNo}>
                                        <td className="py-1 pr-3 font-mono font-semibold">{b.batchNo || '—'}</td>
                                        <td className="py-1 pr-3 text-right font-mono">{b.qty} {r.unit}</td>
                                        <td className="py-1 pr-3">{b.mfgDate ? String(b.mfgDate).slice(0, 10) : '—'}</td>
                                        <td className="py-1 pr-3">{b.expiryDate ? String(b.expiryDate).slice(0, 10) : '—'}</td>
                                        <td className="py-1 pr-3 text-right font-mono">{money(b.costPrice || 0)}</td>
                                        <td className="py-1 pr-3 text-right font-mono font-bold">
                                          {b.sellPrice != null && b.sellPrice !== '' ? money(b.sellPrice) : <span className="text-[color:var(--text-muted)]">Auto · {money(sell)}</span>}
                                        </td>
                                        <td
                                          className={`py-1 pr-3 text-right font-mono ${b.mrp != null && b.mrp !== '' ? 'font-bold' : 'text-[color:var(--text-muted)]'}`}
                                          title={b.mrp != null && b.mrp !== '' ? 'MRP of this batch' : "No MRP on this batch — showing the product's MRP"}
                                        >
                                          {Number(b.mrp != null && b.mrp !== '' ? b.mrp : r.mrp) ? money(b.mrp != null && b.mrp !== '' ? b.mrp : r.mrp) : '—'}
                                        </td>
                                        <td className="py-1 text-right font-mono">{bm !== null ? `${bm}%` : '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length > visibleRows.length && (
                  <div className="flex items-center justify-center gap-3 border-t border-[color:var(--border-subtle)] p-3 text-xs">
                    <span className="text-[color:var(--text-secondary)] font-semibold">
                      Showing {visibleRows.length} of {rows.length} products
                    </span>
                    <Button size="xs" variant="outline" onClick={() => setLimit((n) => n + MATRIX_PAGE)}>
                      Show {Math.min(MATRIX_PAGE, rows.length - visibleRows.length)} more
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => setLimit(rows.length)}>Show all</Button>
                  </div>
                )}
              </div>
  );
}

function PricesheetTab({ products, categories = [], showToast, onRefresh }) {
  const [subTab, setSubTab] = useState('matrix');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  // Show every product's batches under it in the Global Price Matrix / Global Sheet.
  const [showAllBatches, setShowAllBatches] = useState(false);
  // What's being typed in a Margin box, so a half-typed "12." isn't rewritten from the price it produced.
  const [marginDraft, setMarginDraft] = useState({});
  const batchesById = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      if (Array.isArray(p.batches)) map.set(p.id, p.batches.filter((b) => Number(b.qty) > 0));
    });
    return map;
  }, [products]);
  // Search & Filter State
  const [matrixQuery, setMatrixQuery] = useState('');
  const [matrixCategory, setMatrixCategory] = useState('all');
  const [sheetQuery, setSheetQuery] = useState('');
  const [manageQuery, setManageQuery] = useState('');

  // Price Sheets State
  const [priceSheets, setPriceSheets] = useState([]);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [editingSheet, setEditingSheet] = useState(null);
  const [sheetForm, setSheetForm] = useState({ name: '', code: '', customerType: 'Retail', defaultDiscountPercent: 0, isActive: true });

  // Custom Pricing State
  const [manageSheet, setManageSheet] = useState(null);
  const [sheetDiscount, setSheetDiscount] = useState(0);
  const [pricingMap, setPricingMap] = useState({});
  const [discountMap, setDiscountMap] = useState({});
  // The Global Sheet also keeps its own cost and MRP per product.
  const [costMap, setCostMap] = useState({});
  const [mrpMap, setMrpMap] = useState({});
  // Margin and discount are separate entries: editing one never moves the other — only typing the price itself refreshes both.
  const [marginMap, setMarginMap] = useState({});

  const fetchPriceSheets = () => {
    api.get('/price-sheets').then((res) => setPriceSheets(Array.isArray(res) ? res : res?.data || [])).catch(() => {});
  };

  useEffect(() => {
    api.get('/products/pricesheet').then((res) => setRows(res?.rows || res?.data?.rows || [])).catch(() => {});
    fetchPriceSheets();
  }, [products]);

  // Global Matrix Methods
  const updatePrice = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const saveGlobalPrices = async () => {
    setLoading(true);
    try {
      const res = await api.put('/products/pricesheet', { rows });
      showToast(res.message || 'Prices updated.');
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to update prices.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered rows for Global Matrix
  const filteredMatrixRows = useMemo(() => {
    let list = rows;
    if (matrixCategory !== 'all') {
      const selectedCat = (categories || []).find((c) => String(c.id) === String(matrixCategory));
      list = list.filter((r) => {
        const catName = String(r.category || '').toLowerCase();
        if (selectedCat) {
          return catName.includes(selectedCat.name.toLowerCase());
        }
        return catName === String(matrixCategory).toLowerCase();
      });
    }
    if (!matrixQuery.trim()) return list;
    const q = matrixQuery.toLowerCase().trim();
    return list.filter((r) =>
      String(r.name || '').toLowerCase().includes(q) ||
      String(r.regionalName || '').toLowerCase().includes(q) ||
      String(r.printName || '').toLowerCase().includes(q) ||
      String(r.category || '').toLowerCase().includes(q) ||
      String(r.sku || '').toLowerCase().includes(q) ||
      String(r.barcode || '').toLowerCase().includes(q) ||
      String(r.hsn || '').toLowerCase().includes(q)
    );
  }, [rows, matrixQuery, matrixCategory, categories]);

  // Filtered price sheets
  const filteredPriceSheets = useMemo(() => {
    if (!sheetQuery.trim()) return priceSheets;
    const q = sheetQuery.toLowerCase().trim();
    return priceSheets.filter((s) =>
      String(s.name || '').toLowerCase().includes(q) ||
      String(s.code || '').toLowerCase().includes(q) ||
      String(s.customerType || '').toLowerCase().includes(q)
    );
  }, [priceSheets, sheetQuery]);

  // Filtered rows for Custom Pricing modal
  const filteredManageRows = useMemo(() => {
    if (!manageQuery.trim()) return rows;
    const q = manageQuery.toLowerCase().trim();
    return rows.filter((p) =>
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.regionalName || '').toLowerCase().includes(q) ||
      String(p.printName || '').toLowerCase().includes(q) ||
      String(p.category || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.barcode || '').toLowerCase().includes(q)
    );
  }, [rows, manageQuery]);

  // Global Sheet: the Global Matrix rows with this sheet's own cost / selling price / MRP laid over them.
  const localMatrixRows = useMemo(
    () =>
      manageSheet?.isLocal
        ? filteredManageRows.map((r) => ({
            ...r,
            purchasePrice: costMap[r.id] ?? r.purchasePrice,
            price: pricingMap[r.id] ?? r.price,
            mrp: mrpMap[r.id] ?? r.mrp
          }))
        : [],
    [manageSheet, filteredManageRows, costMap, pricingMap, mrpMap]
  );
  const updateLocalCell = (id, field, value) => {
    const setter = field === 'purchasePrice' ? setCostMap : field === 'mrp' ? setMrpMap : setPricingMap;
    setter((prev) => ({ ...prev, [id]: value }));
  };

  // Drag a sheet's grip to put it anywhere in the list. The saved order is what every price sheet list uses —
  // billing, the purchase screen and the customer forms. Off while searching, since a filtered list hides the real positions.
  const reorderSheets = async (from, to) => {
    const previous = priceSheets;
    const next = moveItem(priceSheets, from, to);
    setPriceSheets(next);
    try {
      await api.put('/price-sheets/order', { ids: next.map((s) => s.id) });
    } catch (err) {
      setPriceSheets(previous);
      showToast(api.message(err, 'Could not save the new order.'), 'error');
    }
  };
  const sheetDrag = useDragReorder(reorderSheets, { disabled: Boolean(sheetQuery.trim()) });

  // Price Sheet CRUD Methods
  const openAddSheet = () => {
    setEditingSheet(null);
    setSheetForm({ name: '', code: '', customerType: 'Retail', defaultDiscountPercent: 0, isActive: true });
    setShowSheetModal(true);
  };

  const openEditSheet = (s) => {
    setEditingSheet(s);
    setSheetForm({
      name: s.name,
      code: s.code,
      customerType: s.customerType || 'Retail',
      defaultDiscountPercent: s.defaultDiscountPercent || 0,
      isActive: s.isActive !== false
    });
    setShowSheetModal(true);
  };

  const saveSheet = async (e) => {
    e?.preventDefault();
    if (!sheetForm.name) return showToast('Sheet name required', 'error');
    try {
      const payload = {
        ...sheetForm,
        defaultDiscountPercent: Number(sheetForm.defaultDiscountPercent) || 0
      };
      if (editingSheet) {
        await api.put(`/price-sheets/${editingSheet.id}`, payload);
        showToast('Price sheet updated.');
      } else {
        await api.post('/price-sheets', payload);
        showToast('Price sheet created.');
      }
      setShowSheetModal(false);
      fetchPriceSheets();
    } catch (err) {
      showToast(api.message(err, 'Failed to save price sheet.'), 'error');
    }
  };

  const deleteSheet = async (id) => {
    if (!confirm('Are you sure you want to delete this price sheet?')) return;
    try {
      await api.del(`/price-sheets/${id}`);
      showToast('Price sheet deleted.');
      fetchPriceSheets();
    } catch (err) {
      showToast(api.message(err, 'Failed to delete price sheet.'), 'error');
    }
  };

  const toggleSheetActive = async (s) => {
    try {
      await api.put(`/price-sheets/${s.id}`, { isActive: !s.isActive });
      fetchPriceSheets();
    } catch (err) {
      showToast(api.message(err, 'Failed to toggle status.'), 'error');
    }
  };

  // Custom Pricing Methods
  const openManagePricing = (s) => {
    setManageSheet(s);
    setSheetDiscount(s.defaultDiscountPercent || 0);
    setPricingMap({ ...(s.pricingMap || {}) });
    setDiscountMap({ ...(s.discountMap || {}) });
    setCostMap({ ...(s.costMap || {}) });
    setMrpMap({ ...(s.mrpMap || {}) });
    setMarginMap({ ...(s.marginMap || {}) });
    setManageQuery('');
  };

  const saveCustomPricing = async () => {
    setLoading(true);
    try {
      await api.put(`/price-sheets/${manageSheet.id}`, {
        defaultDiscountPercent: Number(sheetDiscount) || 0,
        pricingMap: manageSheet.isLocal ? numericMap(pricingMap) : pricingMap,
        discountMap,
        marginMap: numericMap(marginMap),
        ...(manageSheet.isLocal ? { costMap: numericMap(costMap), mrpMap: numericMap(mrpMap) } : {})
      });
      showToast(manageSheet.isLocal ? 'Global sheet saved — product prices updated.' : 'Custom pricing & discounts updated.');
      setManageSheet(null);
      fetchPriceSheets();
      if (manageSheet.isLocal) onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to save pricing.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[color:var(--border-subtle)] pb-2">
        <button
          onClick={() => setSubTab('matrix')}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg ${subTab === 'matrix' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-[color:var(--text-primary)] hover:text-indigo-600'}`}
        >
          Global Price Matrix
        </button>
        <button
          onClick={() => setSubTab('sheets')}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg ${subTab === 'sheets' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-[color:var(--text-primary)] hover:text-indigo-600'}`}
        >
          Custom Price Sheets
        </button>
      </div>

      {subTab === 'matrix' && (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
            <div>
              <h3 className="font-bold text-sm text-[color:var(--text-primary)]">Global Pricing Grid</h3>
              <p className="text-xs text-[color:var(--text-secondary)] font-medium">Quickly update standard retail, purchase, MRP, and wholesale pricing across all items.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={matrixQuery}
                onChange={setMatrixQuery}
                placeholder="Search products, barcode, category..."
                className="w-56 sm:w-64"
              />
              {categories && categories.length > 0 && (
                <Select value={matrixCategory} onChange={(e) => setMatrixCategory(e.target.value)} className="w-40">
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              )}
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-indigo-600 dark:text-indigo-400">
                <input
                  type="checkbox"
                  checked={showAllBatches}
                  onChange={(e) => setShowAllBatches(e.target.checked)}
                  className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                Show batches
              </label>
              <Button icon={Save} onClick={saveGlobalPrices} disabled={loading}>{loading ? 'Saving...' : 'Save All Price Changes'}</Button>
            </div>
          </div>

          <Panel
            title={`Product Price Matrix (${filteredMatrixRows.length}${filteredMatrixRows.length !== rows.length ? ` of ${rows.length}` : ''})`}
            icon={IndianRupee}
          >
            {filteredMatrixRows.length === 0 ? (
              <div className="py-8">
                <EmptyState
                  icon={Search}
                  title={rows.length === 0 ? 'No Products in Catalog' : 'No Products Found'}
                  description={rows.length === 0 ? 'Add products in the catalog to configure pricing.' : `No items match "${matrixQuery}". Try searching by another name, barcode, or category.`}
                />
              </div>
            ) : (
              <PriceMatrixTable rows={filteredMatrixRows} onUpdate={updatePrice} batchesById={batchesById} showAllBatches={showAllBatches} />
            )}
          </Panel>
        </>
      )}

      {subTab === 'sheets' && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
            <div>
              <h3 className="font-bold text-sm text-[color:var(--text-primary)]">Custom Price Sheets</h3>
              <p className="text-xs text-[color:var(--text-secondary)] font-medium">Create tailored price lists with global and per-item discounts for customer groups.</p>
            </div>
            <div className="flex items-center gap-2">
              <SearchInput
                value={sheetQuery}
                onChange={setSheetQuery}
                placeholder="Search price sheets..."
                className="w-56"
              />
              <Button icon={Plus} onClick={openAddSheet}>Create Price Sheet</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPriceSheets.map((s, sheetIdx) => (
              <div
                key={s.id}
                {...sheetDrag.rowProps(sheetIdx)}
                className={`p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex flex-col gap-3 ${sheetDrag.rowClass(sheetIdx)}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-sm text-[color:var(--text-primary)] flex flex-wrap items-center gap-1.5">
                      <DragHandle disabled={Boolean(sheetQuery.trim())} {...sheetDrag.handleProps(sheetIdx)} />
                      {s.name}
                      <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                      {s.isLocal && <Badge tone="info">Full price list</Badge>}
                      {(s.defaultDiscountPercent || 0) > 0 && (
                        <Badge tone="accent">{s.defaultDiscountPercent}% Discount</Badge>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-[color:var(--text-primary)] mt-1">{s.code} • {s.customerType}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => toggleSheetActive(s)} className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)]">
                      {s.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </button>
                    {!s.isLocal && (
                      <>
                        <button onClick={() => openEditSheet(s)} className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)] hover:text-indigo-600">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteSheet(s.id)} className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)] hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-[color:var(--border-subtle)] flex justify-between items-center text-xs">
                  <span className="font-bold text-[color:var(--text-primary)]">
                    {s.isLocal
                      ? `${Object.keys(s.pricingMap || {}).length} products priced`
                      : `${Object.keys(s.pricingMap || {}).length + Object.keys(s.discountMap || {}).length} custom overrides`}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => openManagePricing(s)}>Manage Pricing</Button>
                </div>
              </div>
            ))}
            {filteredPriceSheets.length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  icon={FileSpreadsheet}
                  title={priceSheets.length === 0 ? 'No Price Sheets' : 'No Matching Price Sheets'}
                  description={priceSheets.length === 0 ? 'Create a price sheet to assign custom prices and discounts to your products.' : `No price sheets found matching "${sheetQuery}".`}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Create / Edit Sheet Modal */}
      {showSheetModal && (
        <Modal open={true} title={editingSheet ? 'Edit Price Sheet' : 'New Price Sheet'} icon={FileSpreadsheet} onClose={() => setShowSheetModal(false)}>
          <form onSubmit={saveSheet} className="space-y-4">
            <Field label="Sheet Name *">
              <Input value={sheetForm.name} onChange={(e) => setSheetForm({ ...sheetForm, name: e.target.value })} placeholder="e.g. Festival Offer 2024" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sheet Code (Optional)">
                <Input value={sheetForm.code} onChange={(e) => setSheetForm({ ...sheetForm, code: e.target.value })} placeholder="e.g. FEST24" />
              </Field>
              <Field label="Customer Type">
                <Select value={sheetForm.customerType} onChange={(e) => setSheetForm({ ...sheetForm, customerType: e.target.value })}>
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="VIP">VIP</option>
                  <option value="Distributor">Distributor</option>
                </Select>
              </Field>
            </div>
            <Field label="Default Sheet Discount (%)" hint="Applies to all products on this sheet unless customized per product.">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={sheetForm.defaultDiscountPercent}
                onChange={(e) => setSheetForm({ ...sheetForm, defaultDiscountPercent: e.target.value })}
                placeholder="e.g. 10"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
              <Button variant="secondary" onClick={() => setShowSheetModal(false)}>Cancel</Button>
              <Button icon={Save} type="submit">Save Price Sheet</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manage Custom Pricing Drawer / Modal */}
      {manageSheet && (
        <Modal
          open={true}
          title={`Manage Pricing: ${manageSheet.name}`}
          icon={Tag}
          size="fullscreen"
          className="max-w-[96vw] w-[96vw] max-h-[92vh] h-[92vh] flex flex-col justify-between !bg-[color:var(--surface-raised,#ffffff)]"
          onClose={() => setManageSheet(null)}
        >
          <div className="space-y-4 flex-1 flex flex-col min-h-0 w-full">
            {manageSheet.isLocal ? (
              <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs shrink-0">
                <div className="font-bold text-indigo-700 dark:text-indigo-400">Global Sheet — editable copy of the Global Price Matrix</div>
                <div className="text-[11px] text-indigo-900 dark:text-indigo-200 font-medium">Its own purchase price, selling price and MRP for every product. Changes here never touch the Global Matrix.</div>
              </div>
            ) : (
            <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shrink-0">
              <div>
                <div className="font-bold text-indigo-700 dark:text-indigo-400">Sheet-Level Discount (%)</div>
                <div className="text-[11px] text-indigo-900 dark:text-indigo-200 font-medium">This discount percentage automatically applies across all items in this sheet.</div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={sheetDiscount}
                  onChange={(e) => setSheetDiscount(e.target.value)}
                  className="w-24 text-right font-bold bg-white dark:bg-black"
                  placeholder="0"
                />
                <span className="font-bold text-indigo-600">%</span>
              </div>
            </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <SearchInput
                value={manageQuery}
                onChange={setManageQuery}
                placeholder="Search products by name, barcode, category..."
                className="w-full sm:w-80"
              />
              {manageSheet.isLocal && (
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-indigo-600 dark:text-indigo-400">
                  <input
                    type="checkbox"
                    checked={showAllBatches}
                    onChange={(e) => setShowAllBatches(e.target.checked)}
                    className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  Show batches
                </label>
              )}
              <span className="text-xs text-[color:var(--text-secondary)] font-semibold shrink-0">
                Showing {filteredManageRows.length} of {rows.length} products
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface,#ffffff)]">
              {manageSheet.isLocal && filteredManageRows.length > 0 ? (
                <PriceMatrixTable rows={localMatrixRows} onUpdate={updateLocalCell} batchesById={batchesById} showAllBatches={showAllBatches} />
              ) : filteredManageRows.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Search}
                    title="No Products Found"
                    description={`No items match "${manageQuery}". Try searching with another term.`}
                  />
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[color:var(--text-primary)] font-bold uppercase sticky top-0 z-10 border-b border-[color:var(--border-subtle)] shadow-sm">
                    <tr>
                      <th className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800">Product Name</th>
                      <th className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800">Cost (₹)</th>
                      <th className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800">Standard Price</th>
                      <th className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800">Custom Discount (%)</th>
                      <th className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800">Custom Price (₹)</th>
                      <th className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800">Margin (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)] bg-[color:var(--surface,#ffffff)]">
                    {filteredManageRows.map(p => {
                      const isService = String(p.productType).toLowerCase() === 'service';
                      const stdPrice = Number(p.price) || 0;
                      const sheetPct = Number(sheetDiscount) || 0;
                      const calcDefaultPrice = stdPrice > 0 ? (stdPrice * (1 - sheetPct / 100)) : 0;

                      const hasCustomDiscount = discountMap[p.id] !== undefined && discountMap[p.id] !== '';
                      const hasCustomPrice = pricingMap[p.id] !== undefined && pricingMap[p.id] !== '';
                      const isOverridden = hasCustomDiscount || hasCustomPrice;

                      return (
                        <tr key={p.id} className={isOverridden ? 'bg-indigo-50/40 dark:bg-indigo-950/30' : ''}>
                          <td className="py-2 px-3">
                            <div className="font-bold text-[color:var(--text-primary)]">
                              {p.name} {isService && <Badge tone="info" className="ml-1">Service</Badge>}
                            </div>
                            <div className="text-[10px] text-[color:var(--text-secondary)] font-semibold flex items-center gap-1.5 mt-0.5">
                              {p.sku && <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">SKU: {p.sku}</span>}
                              <span>{p.category}</span>
                              {isOverridden ? (
                                <Badge tone="success">Custom Override</Badge>
                              ) : sheetPct > 0 ? (
                                <Badge tone="accent">{sheetPct}% Sheet Discount Applied</Badge>
                              ) : (
                                <Badge tone="neutral">Standard Price</Badge>
                              )}
                            </div>
                          </td>

                          <td className="py-2 px-3 text-right text-[color:var(--text-secondary)] font-mono">
                            {isService ? '—' : money(Number(p.purchasePrice) || 0)}
                          </td>

                          <td className="py-2 px-3 text-right text-[color:var(--text-primary)] font-bold font-mono">
                            {money(stdPrice)}
                          </td>

                          <td className="py-2 px-3 text-right">
                            <Input
                              type="number"
                              step="0.1"
                              placeholder={sheetPct > 0 ? `${sheetPct}% (Default)` : '0%'}
                              value={discountMap[p.id] !== undefined ? discountMap[p.id] : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === null) {
                                  setDiscountMap(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                                  setPricingMap(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                                  setMarginMap(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                                } else {
                                  const pct = Number(val) || 0;
                                  const calcPrice = stdPrice > 0 ? Number((stdPrice * (1 - pct / 100)).toFixed(2)) : 0;
                                  // Hold the margin as it was before this edit, so it doesn't follow the new price.
                                  const shownMargin = marginMap[p.id] ?? marginPct(Number(p.purchasePrice) || 0, hasCustomPrice ? Number(pricingMap[p.id]) : calcDefaultPrice);
                                  if (shownMargin !== null && shownMargin !== undefined) setMarginMap(prev => (prev[p.id] !== undefined ? prev : { ...prev, [p.id]: shownMargin }));
                                  setDiscountMap(prev => ({ ...prev, [p.id]: val }));
                                  setPricingMap(prev => ({ ...prev, [p.id]: calcPrice }));
                                }
                              }}
                              className="w-24 text-right ml-auto"
                            />
                          </td>

                          <td className="py-2 px-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={calcDefaultPrice > 0 ? calcDefaultPrice.toFixed(2) : 'Standard'}
                              value={pricingMap[p.id] !== undefined ? pricingMap[p.id] : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Editing the price itself is the one edit that refreshes both discount and margin.
                                setMarginMap(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                                if (val === '' || val === null) {
                                  setPricingMap(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                                  setDiscountMap(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                                } else {
                                  const priceVal = Number(val) || 0;
                                  const calcPct = stdPrice > 0 ? Number((((stdPrice - priceVal) / stdPrice) * 100).toFixed(2)) : 0;
                                  setPricingMap(prev => ({ ...prev, [p.id]: val }));
                                  setDiscountMap(prev => ({ ...prev, [p.id]: calcPct }));
                                }
                              }}
                              className="w-28 text-right font-bold ml-auto"
                            />
                          </td>

                          <td className="py-2 px-3 text-right">
                            {(() => {
                              const cost = Number(p.purchasePrice) || 0;
                              const effective = hasCustomPrice ? Number(pricingMap[p.id]) : calcDefaultPrice;
                              return (
                                <Input
                                  type="number"
                                  step="0.01"
                                  disabled={isService || cost <= 0}
                                  title={cost > 0 ? 'Type a margin to set this sheet\'s price from the cost' : 'No purchase price to take a margin on'}
                                  value={marginDraft[`m_${p.id}`] ?? marginMap[p.id] ?? marginPct(cost, effective) ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setMarginDraft((prev) => ({ ...prev, [`m_${p.id}`]: val }));
                                    if (val === '') {
                                      setPricingMap((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
                                      setMarginMap((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
                                      return;
                                    }
                                    // The price follows the margin; the discount column is left exactly as it is.
                                    setMarginMap((prev) => ({ ...prev, [p.id]: Number(val) || 0 }));
                                    setPricingMap((prev) => ({ ...prev, [p.id]: priceFromMargin(cost, val) }));
                                  }}
                                  onBlur={() => setMarginDraft((prev) => { const n = { ...prev }; delete n[`m_${p.id}`]; return n; })}
                                  className="w-20 text-right ml-auto"
                                />
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)] shrink-0 mt-auto">
              <Button variant="secondary" onClick={() => setManageSheet(null)}>Cancel</Button>
              <Button icon={Save} onClick={saveCustomPricing} disabled={loading}>{loading ? 'Saving...' : 'Save Pricing & Discounts'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------- Import / Export Tab (Stories 8 & 16) ------------------------------- */

function parseCSVContent(text) {
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 1) return [];

  const parseLine = (line) => {
    const res = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === ',' && !inQ) {
        res.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    res.push(cur.trim());
    return res;
  };

  // Find real header row by matching common product table keywords
  const headerKeywords = ['name', 'product', 'item', 'type', 'barcode', 'price', 'selling', 'unit', 'code', 'stock', 'qty', 'hsn'];
  let headerIdx = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const parsedCols = parseLine(lines[i]).map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase());
    if (parsedCols.length > 1) {
      const matchCount = parsedCols.filter((col) =>
        headerKeywords.some((kw) => col.includes(kw))
      ).length;
      if (matchCount >= 2) {
        headerIdx = i;
        break;
      }
    }
  }

  const headers = parseLine(lines[headerIdx]).map((h) => h.replace(/^\uFEFF/, '').trim());
  const rows = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    // Skip row if completely empty or all values are blank
    if (values.length === 0 || values.every((v) => !v || v.trim() === '')) continue;
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(rowObj);
  }

  return rows;
}

/** Reads an uploaded .xlsx/.xls workbook's first sheet into the same {header: value} row shape parseCSVContent() produces, so both formats share one downstream pipeline. `xlsx` is loaded on demand here rather than a top-level import, so it's fetched only when someone actually uploads a spreadsheet, not just for opening Inventory. */
async function parseXlsxContent(arrayBuffer) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

/** Case/spacing-insensitive lookup across a row's own headers, e.g. "Selling Price" matches "price". Mirrors (a lightweight subset of) the backend's own alias matching, just for preview purposes. */
function getRowValue(row, ...keys) {
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const targetClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = rowKeys.find((rk) => rk.replace(/^﻿/, '').toLowerCase().replace(/[^a-z0-9]/g, '') === targetClean);
    if (match && row[match] !== undefined && String(row[match]).trim() !== '') {
      return String(row[match]).trim();
    }
  }
  return '';
}

/** Builds a per-row preview (new vs. update, and any obvious problems) before the file is actually sent to the import endpoint. */
function buildImportPreview(rows, existingProducts, unitNames) {
  const seenBarcodes = new Map();
  const knownUnits = new Set((unitNames || []).map((u) => u.toLowerCase()));

  return rows.map((row, idx) => {
    const name = getRowValue(row, 'name', 'productname', 'itemname', 'product', 'item', 'title');
    const priceRaw = getRowValue(row, 'price', 'sellingprice', 'saleprice', 'rate', 'retailprice');
    const unit = getRowValue(row, 'unit', 'uom', 'units', 'baseunit') || 'pcs';
    const barcode = getRowValue(row, 'barcode', 'code', 'upc', 'ean', 'barcodeno');
    const category = getRowValue(row, 'category', 'categoryname', 'group');

    const issues = [];
    if (!name) issues.push('Missing product name');
    const price = Number(String(priceRaw).replace(/[₹$,\s]/g, ''));
    if (priceRaw && !Number.isFinite(price)) issues.push('Selling price is not a valid number');
    if (unit && !knownUnits.has(unit.toLowerCase())) issues.push(`Unit "${unit}" is new — will be created`);

    let matchedExisting = null;
    if (barcode) {
      matchedExisting = existingProducts.find((p) => p.barcode === barcode || (p.barcodes || []).includes(barcode));
      if (seenBarcodes.has(barcode)) issues.push(`Duplicate barcode within this file (also row ${seenBarcodes.get(barcode)})`);
      else seenBarcodes.set(barcode, idx + 1);
    }
    if (!matchedExisting && name) {
      matchedExisting = existingProducts.find((p) => p.name.toLowerCase().trim() === name.toLowerCase().trim());
    }

    return {
      row: idx + 1,
      name: name || '(blank)',
      price: priceRaw || '—',
      unit,
      barcode: barcode || '—',
      category: category || '—',
      willUpdate: Boolean(matchedExisting),
      issues,
      blocked: !name
    };
  });
}

function ImportExportTab({ products, categories, units, showToast, onRefresh }) {
  const [importSummary, setImportSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pendingRows, setPendingRows] = useState(null); // parsed but not yet confirmed
  const [exportCategory, setExportCategory] = useState('all');
  const [exportStatus, setExportStatus] = useState('all');

  const unitNames = useMemo(() => (units || []).map((u) => (typeof u === 'object' ? u.name : u)).filter(Boolean), [units]);

  const preview = useMemo(
    () => (pendingRows ? buildImportPreview(pendingRows, products, unitNames) : null),
    [pendingRows, products, unitNames]
  );
  const blockedCount = preview ? preview.filter((r) => r.blocked).length : 0;

  const downloadSampleCSV = () => {
    const csvContent =
      "Product Name,Regional Name,Category,Product Type,SKU Code,Unit,Barcode,Purchase Price,Selling Price,MRP,Wholesale Price,Current Stock,Min Stock,HSN,Tax Rate\n" +
      "Organic Apples,ஆப்பிள்,Fruits,standard,100001,kg,89012345999,100,150,160,130,50,10,0808,5\n" +
      "Raw Sugar (RM),சர்க்கரை,Raw Materials,raw,100002,kg,89012345777,35,40,42,38,200,50,1701,5\n" +
      "Amul Milk 1L,பால்,Dairy,standard,100003,ltr,89012345888,50,60,62,55,100,20,0401,0\n" +
      "Hair Trim Service,ஹேர் கட்,Services,service,100004,pcs,SERV001,0,100,100,100,0,0,,0\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'selsolve_product_import_sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const rows = isXlsx ? await parseXlsxContent(evt.target.result) : parseCSVContent(evt.target.result);
        if (rows.length === 0) {
          showToast('File is empty or missing data rows.', 'error');
          return;
        }
        setImportSummary(null);
        setPendingRows(rows);
      } catch (err) {
        showToast(`Could not read file: ${err.message}`, 'error');
      }
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  const confirmImport = async () => {
    if (!pendingRows) return;
    setLoading(true);
    showToast(`Importing ${pendingRows.length} item(s)...`);
    try {
      const res = await api.post('/products/bulk-import', { products: pendingRows });
      const summary = res.summary || {
        importedCount: res.data?.length || 0,
        updatedCount: 0,
        failedCount: 0,
        errors: []
      };
      setImportSummary(summary);
      setPendingRows(null);
      showToast(res.message || 'Bulk import completed!');
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Bulk import failed.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredExportProducts = useMemo(() => {
    return products.filter((p) => {
      if (exportCategory !== 'all') {
        const belongs = Array.isArray(p.categoryIds) && p.categoryIds.length ? p.categoryIds.includes(exportCategory) : p.categoryId === exportCategory;
        if (!belongs) return false;
      }
      if (exportStatus === 'active' && p.isActive === false) return false;
      if (exportStatus === 'inactive' && p.isActive !== false) return false;
      return true;
    });
  }, [products, exportCategory, exportStatus]);

  const buildExportRows = () =>
    filteredExportProducts.map((p) => {
      const typeKey = canonicalProductType(p.productType || (Array.isArray(p.productTypes) && p.productTypes.length > 1 ? 'both' : p.productTypes?.[0]));
      const typeLabel = PRODUCT_TYPE_LABELS[typeKey]?.label || 'Standard Product';
      const cat = categories.find((c) => c.id === (Array.isArray(p.categoryIds) ? p.categoryIds[0] : p.categoryId));
      return {
        ...p,
        category: cat?.name || p.categoryId || '—',
        productType: typeLabel,
        status: p.isActive === false ? 'Inactive' : 'Active'
      };
    });

  const catalogCols = [
    { key: 'name', label: 'Product Name' },
    { key: 'regionalName', label: 'Regional Name' },
    { key: 'productType', label: 'Product Type' },
    { key: 'category', label: 'Category' },
    { key: 'sku', label: 'SKU Code' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'unit', label: 'Unit' },
    { key: 'purchasePrice', label: 'Purchase Price' },
    { key: 'price', label: 'Selling Price' },
    { key: 'stock', label: 'Current Stock' },
    { key: 'hsn', label: 'HSN Code' },
    { key: 'status', label: 'Status' }
  ];

  const handleExportCSV = () => {
    exportReport('csv', { title: 'Product Inventory Export', columns: catalogCols, rows: buildExportRows() });
    showToast(`Exported ${filteredExportProducts.length} product(s) to CSV.`);
  };

  const handleExportXlsx = () => {
    exportReport('xlsx', { title: 'Product Inventory Export', columns: catalogCols, rows: buildExportRows() });
    showToast(`Exported ${filteredExportProducts.length} product(s) to Excel.`);
  };

  const handleExportPDF = () => {
    const cols = [
      { key: 'name', label: 'Product Name' },
      { key: 'regionalName', label: 'Regional Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'unit', label: 'Unit' },
      { key: 'purchasePrice', label: 'Cost Price', align: 'right' },
      { key: 'price', label: 'Selling Price', align: 'right' },
      { key: 'stock', label: 'Stock', align: 'right' }
    ];

    exportReport('pdf', {
      title: 'INVENTORY CATALOG & STOCK REPORT',
      company: { name: 'Selsolve Smart POS' },
      columns: cols,
      rows: filteredExportProducts
    });
    showToast(`Exported ${filteredExportProducts.length} product(s) to PDF.`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Excel / CSV Import Section */}
      <Panel title="Bulk Product & Stock Import" icon={Upload}>
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)] text-xs space-y-2">
            <div className="font-bold text-[color:var(--text-primary)]">Preview Before Import:</div>
            <p className="text-[color:var(--text-secondary)] font-medium">Upload a CSV or Excel (.xlsx) file — you'll see a preview with row-level checks before anything is saved. Matching by barcode or name creates new items or updates existing ones.</p>
            <Button icon={Download} size="sm" variant="secondary" onClick={downloadSampleCSV}>
              Download Sample CSV Template
            </Button>
          </div>

          <Field label="Upload CSV or Excel File">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={loading}
              className="block w-full text-xs text-[color:var(--text-primary)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 disabled:opacity-50"
            />
          </Field>

          {loading && (
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300 animate-pulse">
              ⏳ Importing items, stock balances, and categories...
            </div>
          )}

          {importSummary && (
            <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] space-y-2 text-xs">
              <div className="font-bold text-emerald-600">Import Summary:</div>
              <div className="grid grid-cols-2 gap-2 text-[color:var(--text-primary)] font-medium">
                <div>✨ New Created: <span className="font-bold text-emerald-600">{importSummary.importedCount || 0}</span></div>
                <div>🔄 Updated: <span className="font-bold text-indigo-600">{importSummary.updatedCount || 0}</span></div>
              </div>
              {importSummary.failedCount > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-amber-600 dark:text-amber-400 font-bold">
                    ⚠️ Validation Warnings: {importSummary.failedCount} row(s) skipped
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 p-2 rounded bg-amber-50 dark:bg-amber-950/40 text-[11px] font-mono text-amber-800 dark:text-amber-200">
                    {importSummary.errors.map((err, idx) => (
                      <div key={idx}>
                        Row {err.row}: <strong>{err.name}</strong> — {err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* Inventory Export Section */}
      <Panel title="Export Inventory Reports" icon={FileSpreadsheet}>
        <div className="space-y-4">
          <p className="text-xs text-[color:var(--text-secondary)] font-medium">Export catalog data, valuation, and stock levels — optionally narrowed by category or status first.</p>

          <div className="flex flex-wrap gap-2">
            <Select value={exportCategory} onChange={(e) => setExportCategory(e.target.value)} className="w-44">
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select value={exportStatus} onChange={(e) => setExportStatus(e.target.value)} className="w-36">
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </Select>
            <span className="text-[11px] text-[color:var(--text-muted)] self-center font-medium">
              {filteredExportProducts.length} of {products.length} product(s) will be exported
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button onClick={handleExportCSV} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] hover:border-indigo-500 text-left transition-all">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600 mb-2" />
              <div className="font-bold text-sm text-[color:var(--text-primary)]">CSV</div>
              <div className="text-xs text-[color:var(--text-secondary)] font-medium">UTF-8, opens in any spreadsheet app</div>
            </button>

            <button onClick={handleExportXlsx} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] hover:border-indigo-500 text-left transition-all">
              <FileSpreadsheet className="h-6 w-6 text-emerald-700 mb-2" />
              <div className="font-bold text-sm text-[color:var(--text-primary)]">Excel (.xlsx)</div>
              <div className="text-xs text-[color:var(--text-secondary)] font-medium">Native Excel workbook</div>
            </button>

            <button onClick={handleExportPDF} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] hover:border-indigo-500 text-left transition-all">
              <Printer className="h-6 w-6 text-indigo-600 mb-2" />
              <div className="font-bold text-sm text-[color:var(--text-primary)]">PDF</div>
              <div className="text-xs text-[color:var(--text-secondary)] font-medium">Print-formatted report</div>
            </button>
          </div>
        </div>
      </Panel>

      {/* Import Preview Modal */}
      {preview && (
        <Modal open={true} title={`Import Preview — ${preview.length} row(s)`} icon={Eye} onClose={() => setPendingRows(null)} className="!max-w-4xl">
          <div className="space-y-3">
            {blockedCount > 0 && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
                {blockedCount} row(s) are missing a product name and will be skipped.
              </div>
            )}
            <div className="max-h-[55vh] overflow-y-auto border border-[color:var(--border-subtle)] rounded-xl">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-muted)] uppercase sticky top-0">
                  <tr>
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Name</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2">Unit</th>
                    <th className="py-2 px-2">Price</th>
                    <th className="py-2 px-2">Barcode</th>
                    <th className="py-2 px-2">Action</th>
                    <th className="py-2 px-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {preview.map((r) => (
                    <tr key={r.row} className={r.blocked ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                      <td className="py-1.5 px-2 text-[color:var(--text-muted)]">{r.row}</td>
                      <td className="py-1.5 px-2 font-bold text-[color:var(--text-primary)]">{r.name}</td>
                      <td className="py-1.5 px-2">{r.category}</td>
                      <td className="py-1.5 px-2">{r.unit}</td>
                      <td className="py-1.5 px-2 font-mono">{r.price}</td>
                      <td className="py-1.5 px-2 font-mono">{r.barcode}</td>
                      <td className="py-1.5 px-2">
                        <Badge tone={r.blocked ? 'danger' : r.willUpdate ? 'info' : 'success'}>
                          {r.blocked ? 'Skip' : r.willUpdate ? 'Update' : 'New'}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-2 text-amber-600 dark:text-amber-400">
                        {r.issues.join('; ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--border-subtle)]">
              <Button variant="secondary" onClick={() => setPendingRows(null)}>Cancel</Button>
              <Button icon={Upload} onClick={confirmImport} loading={loading}>
                Confirm Import ({preview.length - blockedCount} row{preview.length - blockedCount === 1 ? '' : 's'})
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
