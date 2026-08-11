import React, { useEffect, useMemo, useState } from 'react';
import {
  Package, Plus, Edit3, Trash2, Upload, AlertTriangle, Barcode, Tag,
  Boxes, History, IndianRupee, Save, Printer, Layers, ScanLine, Building2,
  FileSpreadsheet, Download, RefreshCw, Eye, CheckCircle, ArrowRightLeft,
  XCircle, Image as ImageIcon, Sliders, Scissors, FileText, Check, Search
} from 'lucide-react';

import api, { money, API_BASE, fmtDateTime } from '../lib/api';
import {
  Panel, SectionHeader, StatTile, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, SearchInput, SegmentedControl, DataTable
} from '../lib/ui';
import { exportReport } from '../lib/exporters';
import BarcodePrinterModal from './BarcodePrinterModal';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Package },
  { id: 'products', label: 'Products', icon: Tag },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'units', label: 'Units', icon: Sliders },
  { id: 'warehouses', label: 'Warehouses & Transfers', icon: Building2 },
  { id: 'adjust', label: 'Stock Adjustment', icon: Boxes },
  { id: 'history', label: 'Stock History', icon: History },
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

const PRODUCT_TYPE_LABELS = {
  standard: { label: 'Standard Item', tone: 'neutral' },
  raw: { label: 'Raw Material', tone: 'warning' },
  service: { label: 'Service', tone: 'info' },
  combo: { label: 'Combo Bundle', tone: 'accent' },
  composite: { label: 'Composite (Recipe)', tone: 'success' }
};

export default function InventoryManager({ products, categories, onRefresh, showToast }) {
  const [tab, setTab] = useState('products');
  const [units, setUnits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [summary, setSummary] = useState(null);

  const fetchAuxData = () => {
    api.get('/units').then((res) => setUnits(Array.isArray(res) ? res : res?.data || [])).catch(() => {});
    api.get('/warehouses').then((res) => setWarehouses(Array.isArray(res) ? res : res?.data || [])).catch(() => {});
    api.get('/inventory/summary').then((res) => setSummary(res?.data || res)).catch(() => {});
  };

  useEffect(() => {
    fetchAuxData();
  }, [products]);

  const refreshAll = () => {
    onRefresh();
    fetchAuxData();
  };

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
            </button>
          );
        })}
      </div>

      {tab === 'dashboard' && (
        <DashboardTab summary={summary} products={products} setTab={setTab} />
      )}

      {tab === 'products' && (
        <ProductsTab
          products={products}
          categories={categories}
          units={units}
          warehouses={warehouses}
          showToast={showToast}
          onRefresh={refreshAll}
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
        <AdjustTab products={products} showToast={showToast} onRefresh={refreshAll} />
      )}

      {tab === 'history' && <HistoryTab products={products} />}

      {tab === 'pricesheet' && (
        <PricesheetTab products={products} showToast={showToast} onRefresh={refreshAll} />
      )}

      {tab === 'importexport' && (
        <ImportExportTab products={products} categories={categories} showToast={showToast} onRefresh={refreshAll} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Dashboard Tab
 * ------------------------------------------------------------------ */

function DashboardTab({ summary, products, setTab }) {
  if (!summary) return <Spinner text="Loading inventory insights..." />;

  const lowStock = (products || []).filter((p) => p.productType !== 'service' && Number(p.stock || 0) <= Number(p.minStock ?? 5));
  const outOfStock = (products || []).filter((p) => p.productType !== 'service' && Number(p.stock || 0) <= 0);

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
              {lowStock.slice(0, 10).map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[color:var(--text-primary)]">{p.name}</div>
                    {p.regionalName && <div className="text-xs text-indigo-600 font-medium">{p.regionalName}</div>}
                    <div className="text-xs text-[color:var(--text-muted)]">Barcode: {p.barcode}</div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${p.stock <= 0 ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      {p.stock} / {p.minStock ?? 5} {p.unit}
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
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Products Tab
 * ------------------------------------------------------------------ */

const blankProduct = (categories) => ({
  name: '',
  regionalName: '',
  printName: '',
  description: '',
  categoryId: categories[0]?.id || '',
  productType: 'standard',
  barcode: '',
  barcodes: '',
  hsn: '',
  unit: 'pcs',
  price: '',
  mrp: '',
  purchasePrice: '',
  wholesalePrice: '',
  specialPrice: '',
  stock: '',
  minStock: '5',
  imageUrl: '',
  warehouses: { wh_main: 0, wh_shop: 0 },
  requiresWeight: false,
  taxRate: 5,
  altUnits: [],
  recipe: { yieldQty: 1, ingredients: [], notes: '' }
});

/**
 * Live cost/yield math for the recipe builder — mirrors the server's
 * `decorateRecipe` in modules/recipes.js so the numbers shown while editing
 * never surprise the user once the request round-trips.
 */
function computeRecipeTotals(ingredients, yieldQty, products) {
  const rows = (ingredients || [])
    .map((ing) => {
      const material = (products || []).find((p) => p.id === ing.productId);
      const qty = Number(ing.qty) || 0;
      const cost = material ? Number(material.purchasePrice) || 0 : 0;
      return { productId: ing.productId, material, qty, cost, lineCost: qty * cost };
    })
    .filter((r) => r.productId && r.qty > 0);

  const batchCost = rows.reduce((sum, r) => sum + r.lineCost, 0);
  const y = Number(yieldQty) > 0 ? Number(yieldQty) : 1;
  const unitCost = batchCost / y;

  const producible = rows.length
    ? Math.floor(
        Math.min(...rows.map((r) => (r.qty > 0 ? ((r.material?.stock || 0) / r.qty) * y : 0)))
      )
    : 0;

  return { rows, batchCost, unitCost, producible: Math.max(0, Number.isFinite(producible) ? producible : 0) };
}

function ProductsTab({ products, categories, units, warehouses, showToast, onRefresh }) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');

  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [labelProduct, setLabelProduct] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [form, setForm] = useState(blankProduct(categories));

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId !== 'all' && p.categoryId !== categoryId) return false;
      if (typeFilter !== 'all' && p.productType !== typeFilter) return false;
      if (statusFilter === 'active' && p.isActive === false) return false;
      if (statusFilter === 'inactive' && p.isActive !== false) return false;

      const displayStock = warehouseFilter === 'all' ? p.stock : (p.warehouses?.[warehouseFilter] || 0);

      // If a specific warehouse is selected, optionally hide products that have never been in this warehouse (unless OUT is selected)
      if (warehouseFilter !== 'all' && stockFilter !== 'OUT' && displayStock <= 0) return false;

      if (stockFilter === 'LOW' && (p.productType === 'service' || Number(displayStock) > Number(p.minStock ?? 5))) return false;
      if (stockFilter === 'OUT' && (p.productType === 'service' || Number(displayStock) > 0)) return false;

      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.regionalName || '').toLowerCase().includes(needle) ||
        (p.printName || '').toLowerCase().includes(needle) ||
        (p.barcodes || [p.barcode]).some((b) => String(b).includes(needle))
      );
    });
  }, [products, query, categoryId, typeFilter, stockFilter, statusFilter, warehouseFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(blankProduct(categories));
    setShowForm(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      ...blankProduct(categories),
      ...product,
      regionalName: product.regionalName || product.printName || '',
      barcodes: Array.isArray(product.barcodes) ? product.barcodes.join(', ') : product.barcode || '',
      warehouses: product.warehouses || { wh_main: Math.max(0, product.stock - 10), wh_shop: Math.min(product.stock, 10) },
      altUnits: Array.isArray(product.altUnits) ? product.altUnits.map((u) => ({ ...u })) : [],
      recipe: product.recipe
        ? {
            yieldQty: product.recipe.yieldQty || 1,
            notes: product.recipe.notes || '',
            ingredients: (product.recipe.ingredients || []).map((i) => ({ productId: i.productId, qty: i.qty }))
          }
        : { yieldQty: 1, ingredients: [], notes: '' }
    });
    setShowForm(true);
  };

  const addIngredient = () => {
    setForm((f) => ({
      ...f,
      recipe: { ...f.recipe, ingredients: [...(f.recipe?.ingredients || []), { productId: '', qty: '' }] }
    }));
  };

  const updateIngredient = (index, patch) => {
    setForm((f) => {
      const ingredients = [...(f.recipe?.ingredients || [])];
      ingredients[index] = { ...ingredients[index], ...patch };
      return { ...f, recipe: { ...f.recipe, ingredients } };
    });
  };

  const removeIngredient = (index) => {
    setForm((f) => ({
      ...f,
      recipe: { ...f.recipe, ingredients: (f.recipe?.ingredients || []).filter((_, i) => i !== index) }
    }));
  };

  const addAltUnit = () => {
    setForm((f) => ({
      ...f,
      altUnits: [...(f.altUnits || []), { unit: '', factor: '', price: '', barcode: '', isDefaultSaleUnit: false }]
    }));
  };

  const updateAltUnit = (index, patch) => {
    setForm((f) => {
      const altUnits = [...(f.altUnits || [])];
      altUnits[index] = { ...altUnits[index], ...patch };
      return { ...f, altUnits };
    });
  };

  const removeAltUnit = (index) => {
    setForm((f) => ({ ...f, altUnits: (f.altUnits || []).filter((_, i) => i !== index) }));
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

  const save = async (e) => {
    e?.preventDefault();
    if (!form.name || form.price === undefined || form.price === '') {
      showToast('Product name and selling price are required.', 'error');
      return;
    }

    const isComposite = form.productType === 'composite';
    const validIngredients = (form.recipe?.ingredients || [])
      .filter((i) => i.productId && Number(i.qty) > 0)
      .map((i) => ({ productId: i.productId, qty: Number(i.qty) }));

    if (isComposite && validIngredients.length === 0) {
      showToast('A composite product needs a recipe — add at least one raw material with a quantity.', 'error');
      return;
    }

    const cleanAltUnits = (form.altUnits || [])
      .filter((u) => u.unit && Number(u.factor) > 0)
      .map((u) => ({
        unit: u.unit,
        factor: Number(u.factor),
        price: u.price === '' || u.price === undefined ? null : Number(u.price),
        barcode: u.barcode || '',
        isDefaultSaleUnit: Boolean(u.isDefaultSaleUnit)
      }));

    const payload = {
      ...form,
      printName: form.regionalName || form.printName,
      barcodes: String(form.barcodes || '')
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean),
      altUnits: cleanAltUnits
    };

    if (isComposite) {
      payload.recipe = {
        yieldQty: Number(form.recipe?.yieldQty) > 0 ? Number(form.recipe.yieldQty) : 1,
        ingredients: validIngredients,
        notes: form.recipe?.notes || ''
      };
      payload.purchasePrice = computeRecipeTotals(form.recipe?.ingredients, form.recipe?.yieldQty, products).unitCost;
    } else {
      delete payload.recipe;
    }

    try {
      const res = editing
        ? await api.put(`/products/${editing.id}`, payload)
        : await api.post('/products', payload);

      showToast(res.message || 'Product saved.');
      setShowForm(false);
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to save product.'), 'error');
    }
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
        <div className="flex flex-1 flex-wrap gap-2 items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search by name, regional name, barcode..." className="w-64" />
          
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-44">
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-36">
            <option value="all">All Types</option>
            <option value="standard">Standard</option>
            <option value="raw">Raw Material</option>
            <option value="service">Service</option>
            <option value="combo">Combo</option>
            <option value="composite">Composite</option>
          </Select>

          <Select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className="w-44">
            <option value="all">All Warehouses</option>
            {(warehouses || []).map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>

          <SegmentedControl
            options={[
              { value: 'ALL', label: 'All Stock' },
              { value: 'LOW', label: 'Low Stock' },
              { value: 'OUT', label: 'Out of Stock' }
            ]}
            value={stockFilter}
            onChange={setStockFilter}
          />
        </div>

        <Button icon={Plus} onClick={openAdd}>Add Product</Button>
      </div>

      {/* Products Table */}
      <Panel title={`Products (${rows.length})`} icon={Package}>
        {rows.length === 0 ? (
          <EmptyState icon={Package} title="No products found" description="Try adjusting your filters or create a new product." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] font-bold uppercase border-b border-[color:var(--border-subtle)]">
                <tr>
                  <th className="py-3 px-3">Product Info</th>
                  <th className="py-3 px-3">Category / Type</th>
                  <th className="py-3 px-3">Barcodes</th>
                  <th className="py-3 px-3 text-right">Purchase Price</th>
                  <th className="py-3 px-3 text-right">Selling Price</th>
                  <th className="py-3 px-3 text-right">Wholesale / Special</th>
                  <th className="py-3 px-3 text-center">Stock Level</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {rows.map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  const isCompositeRow = p.productType === 'composite' || p.isComposite;
                  const producible = p.recipe?.producible ?? 0;
                  const displayStock = warehouseFilter === 'all' ? p.stock : (p.warehouses?.[warehouseFilter] || 0);
                  const isLow = p.productType !== 'service' && (isCompositeRow ? producible <= 5 : Number(displayStock) <= Number(p.minStock ?? 5));
                  const isOut = p.productType !== 'service' && (isCompositeRow ? producible <= 0 : Number(displayStock) <= 0);
                  const typeInfo = PRODUCT_TYPE_LABELS[p.productType || 'standard'];
                  const ingredientCount = p.recipe?.ingredients?.length ?? p.recipeItems?.length ?? 0;

                  return (
                    <tr key={p.id} className="hover:bg-[color:var(--bg-subtle)]/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img src={p.imageUrl.startsWith('/') ? `${API_BASE.replace('/api/pos', '')}${p.imageUrl}` : p.imageUrl} alt={p.name} className="h-10 w-10 rounded-lg object-cover border border-[color:var(--border-subtle)]" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 font-bold text-sm">
                              {p.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-sm text-[color:var(--text-primary)]">{p.name}</div>
                            {(p.regionalName || p.printName) && (
                              <div className="text-xs text-indigo-600 font-medium">{p.regionalName || p.printName}</div>
                            )}
                            <div className="text-[11px] text-[color:var(--text-muted)] font-mono">HSN: {p.hsn || '—'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-[color:var(--text-primary)]">{cat?.name || '—'}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <Badge tone={typeInfo?.tone || 'neutral'}>{typeInfo?.label || 'Standard'}</Badge>
                          {isCompositeRow && (
                            <Badge tone="success">{ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'}</Badge>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono">
                        <div className="font-bold text-[color:var(--text-primary)]">{p.barcode}</div>
                        {Array.isArray(p.barcodes) && p.barcodes.length > 1 && (
                          <div className="text-[10px] text-[color:var(--text-muted)]">+{p.barcodes.length - 1} secondary barcode(s)</div>
                        )}
                      </td>

                      {p.productType === 'service' ? (
                        <td colSpan={3} className="py-3 px-3">
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
                            {money(p.price)}
                          </td>

                          <td className="py-3 px-3 text-right text-xs">
                            <div className="text-[color:var(--text-secondary)]">WS: {money(p.wholesalePrice)}</div>
                            {p.specialPrice && <div className="text-emerald-600 font-medium">VIP: {money(p.specialPrice)}</div>}
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
                        ) : (
                          <span className={`inline-flex flex-col items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                            isOut ? 'bg-red-500/15 text-red-600 border border-red-500/20' :
                            isLow ? 'bg-amber-500/15 text-amber-600 border border-amber-500/20' :
                            'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                          }`}>
                            <span>{displayStock} {p.unit}</span>
                            {isOut && <span className="text-[9px] text-red-500 uppercase">Out of Stock</span>}
                            {isLow && !isOut && <span className="text-[9px] text-amber-600 uppercase">Low Stock</span>}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
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
      {showForm && (
        <Modal open={true} title={editing ? 'Edit Product' : 'Create New Product'} icon={Package} onClose={() => setShowForm(false)} className="!max-w-[728px]">
          <form onSubmit={save} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            {/* Image Upload section */}
            <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 flex items-center justify-center bg-[color:var(--bg-surface)] overflow-hidden relative">
                {form.imageUrl ? (
                  <img src={form.imageUrl.startsWith('/') ? `${API_BASE.replace('/api/pos', '')}${form.imageUrl}` : form.imageUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-indigo-400" />
                )}
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-bold text-[color:var(--text-primary)] block">Product Image (Multer Storage)</label>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="prod-img-upload" />
                  <label htmlFor="prod-img-upload" className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingImage ? 'Uploading...' : 'Choose Image'}
                  </label>
                  {form.imageUrl && (
                    <button type="button" onClick={() => setForm((p) => ({ ...p, imageUrl: '' }))} className="text-xs text-red-500 hover:underline">
                      Remove
                    </button>
                  )}
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

            <div className="grid grid-cols-3 gap-3">
              <Field label="Category">
                <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Product Type">
                <Select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}>
                  <option value="standard">Standard Physical Item</option>
                  <option value="raw">Raw Material</option>
                  <option value="service">Service (No stock level)</option>
                  <option value="combo">Combo Bundle</option>
                  <option value="composite">Composite / Recipe</option>
                </Select>
              </Field>

              {form.productType !== 'service' && (
                <Field label="Unit of Measurement">
                  <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary Barcode">
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Leave blank to auto-generate" />
              </Field>

              <Field label="Multiple Barcodes (Comma Separated)">
                <Input value={form.barcodes} onChange={(e) => setForm({ ...form, barcodes: e.target.value })} placeholder="e.g. 89012345001, 89012345002" />
              </Field>
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
            ) : (
              <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] space-y-3">
                <h4 className="text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">Multiple Selling Prices</h4>
                <div className="grid grid-cols-4 gap-3">
                  <Field label="Purchase Price (₹)" hint={form.productType === 'composite' ? 'Calculated from the recipe' : undefined}>
                    <Input
                      type="number"
                      step="0.01"
                      value={
                        form.productType === 'composite'
                          ? computeRecipeTotals(form.recipe?.ingredients, form.recipe?.yieldQty, products).unitCost.toFixed(2)
                          : form.purchasePrice
                      }
                      onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                      disabled={form.productType === 'composite'}
                      className={form.productType === 'composite' ? 'opacity-70 cursor-not-allowed' : ''}
                    />
                  </Field>
                  <Field label="Selling Price (₹) *">
                    <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                  </Field>
                  <Field label="MRP (₹)">
                    <Input type="number" step="0.01" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
                  </Field>
                  <Field label="Wholesale Price (₹)">
                    <Input type="number" step="0.01" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}

            {form.productType !== 'service' && form.productType !== 'composite' && (
              <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] space-y-3">
                <h4 className="text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">Warehouse Distribution & Minimum Stock</h4>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Main Warehouse Stock">
                    <Input type="number" value={form.warehouses?.wh_main ?? 0} onChange={(e) => setForm({
                      ...form,
                      warehouses: { ...form.warehouses, wh_main: Number(e.target.value) },
                      stock: Number(e.target.value) + Number(form.warehouses?.wh_shop || 0)
                    })} />
                  </Field>
                  <Field label="Shop Counter Stock">
                    <Input type="number" value={form.warehouses?.wh_shop ?? 0} onChange={(e) => setForm({
                      ...form,
                      warehouses: { ...form.warehouses, wh_shop: Number(e.target.value) },
                      stock: Number(form.warehouses?.wh_main || 0) + Number(e.target.value)
                    })} />
                  </Field>
                  <Field label="Minimum Alert Level">
                    <Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                  </Field>
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

                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <Field label="Batch Yields" hint={`Units of ${form.unit || 'unit'} produced per batch`}>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={form.recipe?.yieldQty ?? 1}
                      onChange={(e) => setForm({ ...form, recipe: { ...form.recipe, yieldQty: e.target.value } })}
                    />
                  </Field>
                </div>

                <div className="space-y-2">
                  {(form.recipe?.ingredients || []).length > 0 && (
                    <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[10px] font-bold uppercase text-[color:var(--text-muted)]">
                      <div className="col-span-5">Raw Material</div>
                      <div className="col-span-2">Qty</div>
                      <div className="col-span-1 text-center">Unit</div>
                      <div className="col-span-2 text-right">Cost</div>
                      <div className="col-span-1 text-right">Line Cost</div>
                    </div>
                  )}

                  {(form.recipe?.ingredients || []).map((row, idx) => (
                    <IngredientRow
                      key={idx}
                      row={row}
                      index={idx}
                      products={products}
                      excludeIds={[editing?.id, ...(form.recipe?.ingredients || []).map((i) => i.productId)].filter(Boolean)}
                      onChange={updateIngredient}
                      onRemove={removeIngredient}
                    />
                  ))}

                  <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addIngredient}>
                    Add Raw Material
                  </Button>
                </div>

                {(() => {
                  const totals = computeRecipeTotals(form.recipe?.ingredients, form.recipe?.yieldQty, products);
                  const sellingPrice = Number(form.price) || 0;
                  const margin = sellingPrice - totals.unitCost;
                  const marginPct = sellingPrice ? (margin / sellingPrice) * 100 : 0;
                  return (
                    <div className="pt-2 border-t border-emerald-300/40 dark:border-emerald-800/40 space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <StatBlock label="Batch Cost" value={money(totals.batchCost)} />
                        <StatBlock label="Cost / Unit" value={money(totals.unitCost)} />
                        <StatBlock label="Selling Price" value={money(sellingPrice)} />
                        <StatBlock label="Margin" value={money(margin)} tone={margin < 0 ? 'danger' : 'success'} />
                        <StatBlock label="Margin %" value={`${marginPct.toFixed(1)}%`} tone={margin < 0 ? 'danger' : 'success'} />
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

            <details className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)]" open={(form.altUnits || []).length > 0}>
              <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-bold text-[color:var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-2 normal-case">
                  <Sliders className="h-3.5 w-3.5" /> Alternate Units
                  {(form.altUnits || []).length > 0 && <Badge tone="accent">{form.altUnits.length}</Badge>}
                </span>
                <span className="text-[10px] normal-case font-medium text-[color:var(--text-muted)]">e.g. 1 Box = 12 pcs</span>
              </summary>
              <div className="px-3 pb-3 space-y-2">
                {(form.altUnits || []).map((row, idx) => (
                  <AltUnitRow
                    key={idx}
                    row={row}
                    index={idx}
                    units={units}
                    baseUnit={form.unit}
                    usedUnits={(form.altUnits || []).map((u) => u.unit).filter(Boolean)}
                    basePrice={Number(form.price) || 0}
                    onChange={updateAltUnit}
                    onRemove={removeAltUnit}
                  />
                ))}
                <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addAltUnit}>
                  Add alternate unit
                </Button>
              </div>
            </details>

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
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button icon={Save} type="submit">{editing ? 'Update Product' : 'Save Product'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Barcode Print Modal */}
      {labelProduct && (
        <BarcodePrinterModal product={labelProduct} onClose={() => setLabelProduct(null)} showToast={showToast} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Recipe & Alternate Unit row widgets — used inside the Product form
 * ------------------------------------------------------------------ */

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

  const cost = material ? Number(material.purchasePrice) || 0 : 0;
  const qty = Number(row.qty) || 0;

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
          step="0.01"
          min="0"
          value={row.qty}
          onChange={(e) => onChange(index, { qty: e.target.value })}
          placeholder="Qty"
          className="text-xs"
        />
      </div>
      <div className="col-span-2 md:col-span-1 text-xs text-center text-[color:var(--text-muted)] font-medium">
        {material?.unit || '—'}
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

/** One alternate-unit row (unit, factor, optional price/barcode override). */
function AltUnitRow({ row, index, units, baseUnit, usedUnits, basePrice, onChange, onRemove }) {
  const availableUnits = (units || []).filter((u) => u !== baseUnit && (u === row.unit || !usedUnits.includes(u)));
  const factor = Number(row.factor) || 0;
  const derivedPrice = basePrice * factor;

  return (
    <div className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)]">
      <div className="col-span-6 md:col-span-3">
        <Select value={row.unit} onChange={(e) => onChange(index, { unit: e.target.value })}>
          <option value="">Select unit</option>
          {availableUnits.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </Select>
      </div>
      <div className="col-span-6 md:col-span-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={row.factor}
          onChange={(e) => onChange(index, { factor: e.target.value })}
          placeholder={`1 ${row.unit || 'unit'} = ? ${baseUnit || 'base'}`}
          className="text-xs"
        />
      </div>
      <div className="col-span-6 md:col-span-3">
        <Input
          type="number"
          step="0.01"
          value={row.price}
          onChange={(e) => onChange(index, { price: e.target.value })}
          placeholder={`Auto: ${money(derivedPrice)}`}
          className="text-xs"
        />
      </div>
      <div className="col-span-5 md:col-span-3">
        <Input
          value={row.barcode}
          onChange={(e) => onChange(index, { barcode: e.target.value })}
          placeholder="Barcode (optional)"
          className="text-xs"
        />
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

/* ------------------------------------------------------------------ *
 * Categories Tab (Story 1)
 * ------------------------------------------------------------------ */

function CategoriesTab({ categories, products, showToast, onRefresh }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', icon: '📦', description: '', kotPrinter: '' });

  const filtered = useMemo(() => {
    if (!query) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  }, [categories, query]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', icon: '📦', description: '', kotPrinter: '' });
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({ name: cat.name, icon: cat.icon || '📦', description: cat.description || '', kotPrinter: cat.kotPrinter || '' });
    setShowModal(true);
  };

  const save = async (e) => {
    e?.preventDefault();
    if (!form.name) return showToast('Category name is required.', 'error');
    try {
      const res = editing
        ? await api.put(`/categories/${editing.id}`, form)
        : await api.post('/categories', form);

      showToast(res.message || 'Category saved.');
      setShowModal(false);
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to save category.'), 'error');
    }
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
        {filtered.map((cat) => (
          <div key={cat.id} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl p-2 bg-[color:var(--bg-subtle)] rounded-xl">{cat.icon || '📦'}</div>
              <div>
                <div className="font-bold text-sm text-[color:var(--text-primary)]">{cat.name}</div>
                <div className="text-xs text-[color:var(--text-muted)]">{(products || []).filter(p => p.categoryId === cat.id).length} product(s) assigned</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-indigo-600">
                <Edit3 className="h-4 w-4" />
              </button>
              <button onClick={() => removeCategory(cat.id)} className="p-1.5 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal open={true} title={editing ? 'Edit Category' : 'Create Category'} icon={Layers} onClose={() => setShowModal(false)}>
          <form onSubmit={save} className="space-y-4">
            <Field label="Category Name *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Emoji Icon">
              <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="🍎" />
            </Field>
            <Field label="Description">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button icon={Save} type="submit">Save Category</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Units Tab (Story 2)
 * ------------------------------------------------------------------ */

function UnitsTab({ units, showToast, onRefresh }) {
  const [unitList, setUnitList] = useState(units || []);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitName, setUnitName] = useState('');

  useEffect(() => {
    setUnitList(units || []);
  }, [units]);

  const saveUnit = async (e) => {
    e?.preventDefault();
    if (!unitName.trim()) return showToast('Unit name is required.', 'error');
    try {
      if (editingUnit) {
        await api.put(`/units/${editingUnit}`, { newName: unitName });
        showToast('Unit updated successfully.');
      } else {
        await api.post('/units', { name: unitName });
        showToast('Unit created successfully.');
      }
      setShowModal(false);
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Failed to save unit.'), 'error');
    }
  };

  const deleteUnit = async (name) => {
    if (!confirm(`Delete unit "${name}"?`)) return;
    try {
      await api.del(`/units/${name}`);
      showToast(`Unit "${name}" deleted.`);
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Cannot delete unit.'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
        <div>
          <h3 className="font-bold text-sm text-[color:var(--text-primary)]">Units of Measurement</h3>
          <p className="text-xs text-[color:var(--text-muted)]">Configure selling & inventory units (pcs, kg, litre, box, etc.)</p>
        </div>
        <Button icon={Plus} onClick={() => { setEditingUnit(null); setUnitName(''); setShowModal(true); }}>Add Unit</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {unitList.map((u) => (
          <div key={u} className="p-3.5 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex items-center justify-between">
            <span className="font-bold text-sm text-[color:var(--text-primary)] capitalize">{u}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => { setEditingUnit(u); setUnitName(u); setShowModal(true); }} className="p-1 text-[color:var(--text-muted)] hover:text-indigo-600">
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => deleteUnit(u)} className="p-1 text-[color:var(--text-muted)] hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal open={true} title={editingUnit ? 'Edit Unit' : 'Create Unit'} icon={Sliders} onClose={() => setShowModal(false)}>
          <form onSubmit={saveUnit} className="space-y-4">
            <Field label="Unit Name (e.g. Kg, Box, Litre, Bundle)">
              <Input value={unitName} onChange={(e) => setUnitName(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button icon={Save} type="submit">Save Unit</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Warehouses & Stock Transfer Tab
 * ------------------------------------------------------------------ */

function WarehousesTab({ warehouses, products, showToast, onRefresh }) {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [sourceWh, setSourceWh] = useState(warehouses[0]?.id || 'wh_main');
  const [targetWh, setTargetWh] = useState(warehouses[1]?.id || 'wh_shop');
  const [transferQty, setTransferQty] = useState('10');
  const [transferReason, setTransferReason] = useState('Shop counter restock');
  const [loading, setLoading] = useState(false);

  const [editingWh, setEditingWh] = useState(null);
  const [showWhModal, setShowWhModal] = useState(false);
  const [whForm, setWhForm] = useState({ name: '', code: '', location: '' });

  const productObj = (products || []).find((p) => p.id === selectedProduct);
  const sourceStock = productObj?.warehouses?.[sourceWh] ?? 0;
  const targetStock = productObj?.warehouses?.[targetWh] ?? 0;

  const handleTransfer = async (e) => {
    e?.preventDefault();
    if (!selectedProduct || !sourceWh || !targetWh) {
      showToast('Select product, source, and target warehouse.', 'error');
      return;
    }
    if (sourceWh === targetWh) {
      showToast('Source and target warehouse must be different.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/inventory/transfer', {
        productId: selectedProduct,
        sourceWarehouseId: sourceWh,
        targetWarehouseId: targetWh,
        quantity: transferQty,
        reason: transferReason
      });

      showToast(res.message || 'Stock transferred successfully.');
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

      {/* Stock Transfer Calculator */}
      <div className="lg:col-span-2 space-y-3">
        <Panel title="Warehouse to Shop Stock Transfer" icon={ArrowRightLeft}>
          <form onSubmit={handleTransfer} className="space-y-4">
            <Field label="Select Product to Transfer">
              <Select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} required>
                <option value="">-- Choose Product --</option>
                {products
                  .filter((p) => p.productType !== 'service' && (p.warehouses?.[sourceWh] || 0) > 0)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.warehouses?.[sourceWh] || 0} {p.unit})
                    </option>
                  ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Source Location">
                <Select value={sourceWh} onChange={(e) => setSourceWh(e.target.value)}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Destination Location">
                <Select value={targetWh} onChange={(e) => setTargetWh(e.target.value)}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
              </Field>
            </div>

            {productObj && (
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-around text-xs">
                <div>
                  <div className="text-[color:var(--text-muted)] font-medium">Source Stock ({warehouses.find((w) => w.id === sourceWh)?.name})</div>
                  <div className="text-lg font-bold text-indigo-600">{sourceStock} {productObj.unit}</div>
                </div>
                <ArrowRightLeft className="h-5 w-5 text-indigo-500" />
                <div>
                  <div className="text-[color:var(--text-muted)] font-medium">Destination Stock ({warehouses.find((w) => w.id === targetWh)?.name})</div>
                  <div className="text-lg font-bold text-indigo-600">{targetStock} {productObj.unit}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Transfer Quantity">
                <Input type="number" min="1" max={sourceStock || 9999} value={transferQty} onChange={(e) => setTransferQty(e.target.value)} required />
              </Field>

              <Field label="Transfer Reason / Ref">
                <Input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="e.g. Morning counter refill" />
              </Field>
            </div>

            <Button icon={ArrowRightLeft} type="submit" disabled={loading || !selectedProduct} className="w-full">
              {loading ? 'Processing Transfer...' : 'Execute Stock Transfer'}
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

/* ------------------------------------------------------------------ *
 * Stock Adjustment Tab (Story 10)
 * ------------------------------------------------------------------ */

function AdjustTab({ products, showToast, onRefresh }) {
  const [productId, setProductId] = useState('');
  const [mode, setMode] = useState('ADD');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Stock Take Audit');
  const [password, setPassword] = useState('');

  const submit = async (e) => {
    e?.preventDefault();
    if (!productId || !quantity) return showToast('Product and quantity required.', 'error');

    try {
      const res = await api.post('/inventory/adjust', { productId, mode, quantity, reason, password });
      showToast(res.message || 'Stock adjusted.');
      setQuantity('');
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Stock adjustment failed.'), 'error');
    }
  };

  return (
    <Panel title="Manual Stock Adjustment" icon={Boxes}>
      <form onSubmit={submit} className="space-y-4 max-w-xl">
        <Field label="Select Product">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">-- Select Product --</option>
            {products.filter((p) => p.productType !== 'service').map((p) => (
              <option key={p.id} value={p.id}>{p.name} (Current Stock: {p.stock} {p.unit})</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Adjustment Action">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="ADD">Increase Stock (+)</option>
              <option value="REMOVE">Decrease Stock (-)</option>
              <option value="SET">Set Exact Stock (=)</option>
            </Select>
          </Field>

          <Field label="Quantity">
            <Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </Field>
        </div>

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

        <Field label="Authorization Password (default: 1234)">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="1234" />
        </Field>

        <Button icon={Save} type="submit">Save Stock Adjustment</Button>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * History Tab (Story 11)
 * ------------------------------------------------------------------ */

function HistoryTab({ products }) {
  const [movements, setMovements] = useState([]);
  const [type, setType] = useState('ALL');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/inventory/movements', { type }).then((res) => setMovements(Array.isArray(res) ? res : res?.data || [])).catch(() => {});
  }, [type]);

  const filtered = useMemo(() => {
    if (!query) return movements;
    return movements.filter((m) => m.productName.toLowerCase().includes(query.toLowerCase()));
  }, [movements, query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by product name..." className="w-64" />
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-44">
          <option value="ALL">All Types</option>
          <option value="SALE">Sale</option>
          <option value="PURCHASE">Purchase</option>
          <option value="ADJUSTMENT">Adjustment</option>
          <option value="TRANSFER">Transfer</option>
          <option value="OPENING">Opening</option>
        </Select>
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
                  <td className="py-2.5 px-3 font-sans text-[color:var(--text-secondary)]">{fmtDateTime(m.date)}</td>
                  <td className="py-2.5 px-3 font-sans font-bold text-[color:var(--text-primary)]">{m.productName}</td>
                  <td className="py-2.5 px-3 font-sans">
                    <Badge tone={MOVEMENT_TONE[m.type] || 'neutral'}>{m.type}</Badge>
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold ${m.qtyChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.qtyChange >= 0 ? `+${m.qtyChange}` : m.qtyChange} {m.unit}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[color:var(--text-primary)]">{m.balanceAfter}</td>
                  <td className="py-2.5 px-3 font-sans text-[color:var(--text-muted)]">{m.reason || '—'}</td>
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

/* ------------------------------------------------------------------ *
 * Price Sheets Tab (Story 18 & Story 13)
 * ------------------------------------------------------------------ */

function PricesheetTab({ products, showToast, onRefresh }) {
  const [subTab, setSubTab] = useState('matrix');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Price Sheets State
  const [priceSheets, setPriceSheets] = useState([]);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [editingSheet, setEditingSheet] = useState(null);
  const [sheetForm, setSheetForm] = useState({ name: '', code: '', customerType: 'Retail', isActive: true });
  
  // Custom Pricing State
  const [manageSheet, setManageSheet] = useState(null);
  const [pricingMap, setPricingMap] = useState({});

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

  // Price Sheet CRUD Methods
  const openAddSheet = () => {
    setEditingSheet(null);
    setSheetForm({ name: '', code: '', customerType: 'Retail', isActive: true });
    setShowSheetModal(true);
  };

  const openEditSheet = (s) => {
    setEditingSheet(s);
    setSheetForm({ name: s.name, code: s.code, customerType: s.customerType, isActive: s.isActive });
    setShowSheetModal(true);
  };

  const saveSheet = async (e) => {
    e?.preventDefault();
    if (!sheetForm.name) return showToast('Sheet name required', 'error');
    try {
      if (editingSheet) {
        await api.put(`/price-sheets/${editingSheet.id}`, sheetForm);
        showToast('Price sheet updated.');
      } else {
        await api.post('/price-sheets', sheetForm);
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
    setPricingMap({ ...s.pricingMap });
  };

  const saveCustomPricing = async () => {
    setLoading(true);
    try {
      await api.put(`/price-sheets/${manageSheet.id}`, { pricingMap });
      showToast('Custom pricing updated.');
      setManageSheet(null);
      fetchPriceSheets();
    } catch (err) {
      showToast(api.message(err, 'Failed to save custom pricing.'), 'error');
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
          className={`px-4 py-2 text-sm font-bold rounded-t-lg ${subTab === 'matrix' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'}`}
        >
          Global Price Matrix
        </button>
        <button
          onClick={() => setSubTab('sheets')}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg ${subTab === 'sheets' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'}`}
        >
          Custom Price Sheets
        </button>
      </div>

      {subTab === 'matrix' && (
        <>
          <div className="flex items-center justify-between bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
            <div>
              <h3 className="font-bold text-sm text-[color:var(--text-primary)]">Global Pricing Grid</h3>
              <p className="text-xs text-[color:var(--text-muted)]">Quickly update standard retail, purchase, MRP, and wholesale pricing across all items.</p>
            </div>
            <Button icon={Save} onClick={saveGlobalPrices} disabled={loading}>{loading ? 'Saving...' : 'Save All Price Changes'}</Button>
          </div>

          <Panel title="Product Price Matrix" icon={IndianRupee}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-muted)] uppercase border-b border-[color:var(--border-subtle)]">
                  <tr>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Purchase Price (₹)</th>
                    <th className="py-2.5 px-3 text-right">Selling Price (₹)</th>
                    <th className="py-2.5 px-3 text-right">MRP (₹)</th>
                    <th className="py-2.5 px-3 text-right">Wholesale (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {rows.map((r) => {
                    const isService = String(r.productType).toLowerCase() === 'service';
                    return (
                      <tr key={r.id}>
                        <td className="py-2 px-3 font-bold text-[color:var(--text-primary)]">{r.name}</td>
                        <td className="py-2 px-3 text-[color:var(--text-muted)]">{r.category} {isService && <Badge tone="info" className="ml-1">Service</Badge>}</td>
                        {isService ? (
                          <td colSpan={4} className="py-2 px-3">
                            <div className="flex items-center justify-end gap-3 bg-[color:var(--bg-subtle)]/30 rounded-lg p-1.5 border border-[color:var(--border-subtle)] mr-2">
                              <span className="text-sm uppercase font-bold text-[color:var(--text-muted)] tracking-wider">Service Price:</span>
                              <Input type="number" step="0.01" value={r.price} onChange={(e) => updatePrice(r.id, 'price', e.target.value)} className="w-32 text-right font-bold bg-white dark:bg-black" />
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="py-2 px-3 text-right">
                              <Input type="number" step="0.01" value={r.purchasePrice} onChange={(e) => updatePrice(r.id, 'purchasePrice', e.target.value)} className="w-24 text-right ml-auto" />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <Input type="number" step="0.01" value={r.price} onChange={(e) => updatePrice(r.id, 'price', e.target.value)} className="w-24 text-right font-bold ml-auto" />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <Input type="number" step="0.01" value={r.mrp} onChange={(e) => updatePrice(r.id, 'mrp', e.target.value)} className="w-24 text-right ml-auto" />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <Input type="number" step="0.01" value={r.wholesalePrice} onChange={(e) => updatePrice(r.id, 'wholesalePrice', e.target.value)} className="w-24 text-right ml-auto" />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {subTab === 'sheets' && (
        <>
          <div className="flex items-center justify-between bg-[color:var(--bg-surface)] p-3 rounded-2xl border border-[color:var(--border-subtle)]">
            <div>
              <h3 className="font-bold text-sm text-[color:var(--text-primary)]">Custom Price Sheets</h3>
              <p className="text-xs text-[color:var(--text-muted)]">Create tailored price lists for VIPs, specific regions, or customer groups.</p>
            </div>
            <Button icon={Plus} onClick={openAddSheet}>Create Price Sheet</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {priceSheets.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-sm text-[color:var(--text-primary)] flex items-center gap-2">
                      {s.name}
                      <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="text-xs text-[color:var(--text-muted)] mt-1">{s.code} • {s.customerType}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => toggleSheetActive(s)} className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)]">
                      {s.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEditSheet(s)} className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-indigo-600">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteSheet(s.id)} className="p-1 rounded-lg hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-[color:var(--border-subtle)] flex justify-between items-center">
                  <span className="text-xs font-medium text-[color:var(--text-secondary)]">{Object.keys(s.pricingMap || {}).length} custom prices</span>
                  <Button size="sm" variant="secondary" onClick={() => openManagePricing(s)}>Manage Pricing</Button>
                </div>
              </div>
            ))}
            {priceSheets.length === 0 && (
              <div className="col-span-full">
                <EmptyState icon={FileSpreadsheet} title="No Price Sheets" description="Create a price sheet to assign custom prices to your products." />
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
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
              <Button variant="secondary" onClick={() => setShowSheetModal(false)}>Cancel</Button>
              <Button icon={Save} type="submit">Save Price Sheet</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manage Custom Pricing Drawer / Modal */}
      {manageSheet && (
        <Modal open={true} title={`Manage Pricing: ${manageSheet.name}`} icon={Tag} onClose={() => setManageSheet(null)}>
          <div className="space-y-4">
            <p className="text-xs text-[color:var(--text-muted)]">Set custom prices for this sheet. Leave blank to use the standard global price.</p>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <table className="w-full text-xs text-left">
                <thead className="bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)] font-bold uppercase sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3 text-right">Standard Price</th>
                    <th className="py-2 px-3 text-right">Custom Price (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {rows.map(p => {
                    const isService = String(p.productType).toLowerCase() === 'service';
                    return (
                      <tr key={p.id} className={pricingMap[p.id] ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}>
                        <td className="py-2 px-3 font-medium text-[color:var(--text-primary)]">
                          {p.name} {isService && <Badge tone="info" className="ml-2">Service</Badge>}
                        </td>
                        <td className="py-2 px-3 text-right text-[color:var(--text-muted)]">
                          {isService ? <span className="text-sm uppercase font-bold tracking-wider mr-1">Service Price:</span> : ''}
                          {money(p.price)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Standard"
                            value={pricingMap[p.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPricingMap(prev => {
                                const next = { ...prev };
                                if (!val) delete next[p.id];
                                else next[p.id] = Number(val);
                                return next;
                              });
                            }}
                            className="w-24 text-right ml-auto"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-subtle)]">
              <Button variant="secondary" onClick={() => setManageSheet(null)}>Cancel</Button>
              <Button icon={Save} onClick={saveCustomPricing} disabled={loading}>{loading ? 'Saving...' : 'Save Pricing'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Import / Export Tab (Stories 8 & 16)
 * ------------------------------------------------------------------ */

function ImportExportTab({ products, categories, showToast, onRefresh }) {
  const [fileText, setFileText] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const downloadSampleCSV = () => {
    const csvContent = "name,regionalName,categoryId,productType,unit,barcode,purchasePrice,price,mrp,wholesalePrice,stock,minStock,hsn,taxRate\n" +
      "Organic Apples,ஆப்பிள்,cat_1,standard,kg,89012345999,100,150,160,130,50,10,0808,5\n" +
      "Hair Trim Service,ஹேர் கட்,,service,pcs,SERV001,0,100,100,100,0,0,,0\n";

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
    const reader = new FileReader();
    reader.onload = (evt) => setFileText(evt.target.result);
    reader.readAsText(file);
  };

  const processImport = async () => {
    if (!fileText.trim()) return showToast('Please select a valid CSV file first.', 'error');

    const lines = fileText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return showToast('CSV file is empty or missing data rows.', 'error');

    const headers = lines[0].split(',').map((h) => h.trim());
    const parsedProducts = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      if (cols.length < 2) continue;

      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx] || '';
      });

      parsedProducts.push(rowObj);
    }

    setLoading(true);
    try {
      const res = await api.post('/products/bulk-import', { products: parsedProducts });
      setImportSummary(res.summary || { importedCount: res.count, failedCount: 0, errors: [] });
      showToast(res.message || 'Import processed.');
      onRefresh();
    } catch (err) {
      showToast(api.message(err, 'Bulk import failed.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const cols = [
      { key: 'name', label: 'Product Name' },
      { key: 'regionalName', label: 'Regional Name' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'unit', label: 'Unit' },
      { key: 'purchasePrice', label: 'Purchase Price' },
      { key: 'price', label: 'Selling Price' },
      { key: 'stock', label: 'Current Stock' },
      { key: 'hsn', label: 'HSN Code' }
    ];

    exportReport('csv', { title: 'Product Inventory Export', columns: cols, rows: products });
    showToast('Exported CSV file.');
  };

  const handleExportPDF = () => {
    const cols = [
      { key: 'name', label: 'Product Name' },
      { key: 'regionalName', label: 'Regional Name' },
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
      rows: products
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Excel / CSV Import Section */}
      <Panel title="Bulk Excel / CSV Product Import" icon={Upload}>
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)] text-xs space-y-2">
            <div className="font-bold text-[color:var(--text-primary)]">Import Instructions:</div>
            <p className="text-[color:var(--text-muted)]">Upload a CSV file containing columns for name, regionalName, price, barcode, purchasePrice, stock, etc.</p>
            <Button icon={Download} size="sm" variant="secondary" onClick={downloadSampleCSV}>
              Download Sample CSV Template
            </Button>
          </div>

          <Field label="Choose CSV File">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-xs text-[color:var(--text-primary)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700" />
          </Field>

          <Button icon={Upload} onClick={processImport} disabled={loading || !fileText}>
            {loading ? 'Processing Import...' : 'Import Products'}
          </Button>

          {importSummary && (
            <div className="p-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] space-y-2 text-xs">
              <div className="font-bold text-emerald-600">Import Summary:</div>
              <div>Successfully imported: {importSummary.importedCount} product(s)</div>
              {importSummary.failedCount > 0 && (
                <div className="text-red-500 font-medium">Validation errors: {importSummary.failedCount} row(s) skipped</div>
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* Inventory Export Section */}
      <Panel title="Export Inventory Reports" icon={FileSpreadsheet}>
        <div className="space-y-4">
          <p className="text-xs text-[color:var(--text-muted)]">Export catalog data, valuation, and stock levels to Excel CSV or print-ready PDF format.</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExportCSV} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] hover:border-indigo-500 text-left transition-all">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600 mb-2" />
              <div className="font-bold text-sm text-[color:var(--text-primary)]">Export to Excel (CSV)</div>
              <div className="text-xs text-[color:var(--text-muted)]">UTF-8 encoded CSV with regional text support</div>
            </button>

            <button onClick={handleExportPDF} className="p-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] hover:border-indigo-500 text-left transition-all">
              <Printer className="h-6 w-6 text-indigo-600 mb-2" />
              <div className="font-bold text-sm text-[color:var(--text-primary)]">Export to PDF</div>
              <div className="text-xs text-[color:var(--text-muted)]">Print-formatted PDF inventory report</div>
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
