import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  Eye,
  RefreshCw,
  TrendingUp,
  FileText,
  Building2,
  User,
  ArrowUpRight,
  QrCode,
  X,
  CreditCard,
  Plus,
  FileCheck,
  Send,
  Trash2,
  Edit3,
  Layers,
  Tag,
  Check,
  Percent,
  CheckSquare,
  Sparkles,
  PackageCheck,
  Store,
  Boxes
} from 'lucide-react';

import api, { money, fmtDate, fmtDateTime, todayISO, monthStartISO } from '../lib/api';
import { Panel, SectionHeader, StatTile, Badge, Button, Spinner, EmptyState, DataTable, Modal, Field, Input, Select } from '../lib/ui';
import { exportReport } from '../lib/exporters';

/** Converts number to Indian words (Rupees) */
function numberToWords(num) {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(val) {
    if (val < 20) return a[val];
    if (val < 100) return b[Math.floor(val / 10)] + (val % 10 ? ' ' + a[val % 10] : '');
    if (val < 1000) return a[Math.floor(val / 100)] + ' Hundred' + (val % 100 ? ' and ' + inWords(val % 100) : '');
    if (val < 100000) return inWords(Math.floor(val / 1000)) + ' Thousand' + (val % 1000 ? ' ' + inWords(val % 1000) : '');
    if (val < 10000000) return inWords(Math.floor(val / 100000)) + ' Lakh' + (val % 100000 ? ' ' + inWords(val % 100000) : '');
    return inWords(Math.floor(val / 10000000)) + ' Crore' + (val % 10000000 ? ' ' + inWords(val % 10000000) : '');
  }

  return `${inWords(n)} Rupees Only`;
}

/** Solid Product Picker Popup Modal */
function ProductPickerModal({ open, onClose, products = [], onSelectProduct }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [customName, setCustomName] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set();
    (products || []).forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (products || []).filter((p) => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(q)) ||
        (p.regionalName && p.regionalName.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });
  }, [products, search, categoryFilter]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select Product / Item"
      subtitle={`Choose from ${products.length} catalog products or enter a custom service.`}
      icon={Boxes}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => setIsCustomMode(!isCustomMode)}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {isCustomMode ? '← Back to Catalog Products' : '✍️ Switch to Custom Item / Service'}
          </button>
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isCustomMode ? (
          <div className="p-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/60 space-y-3">
            <div className="font-bold text-xs text-[color:var(--text-primary)]">Custom Non-Inventory Item / Service</div>
            <div className="text-[11px] text-[color:var(--text-muted)]">
              Add non-catalog labor, custom consulting, delivery charges, or unlisted items.
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter custom item or service description…"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
              />
              <Button
                variant="primary"
                disabled={!customName.trim()}
                onClick={() => {
                  onSelectProduct({
                    id: '',
                    name: customName.trim(),
                    price: 0,
                    taxRate: 0,
                    unit: 'pcs',
                    isCustom: true
                  });
                  onClose();
                }}
              >
                Add Custom Item
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search by product name, barcode, category…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="field-input text-xs pl-8 pr-8 w-full rounded-xl"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="field-input text-xs py-2 px-3 min-w-[140px] rounded-xl font-semibold cursor-pointer shrink-0"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Solid Product Grid / List */}
            <div className="max-h-80 overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)] divide-y divide-[color:var(--border-subtle)]">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="text-xs font-bold text-[color:var(--text-secondary)]">No products match your search</div>
                  <div className="text-[11px] text-[color:var(--text-muted)]">
                    Try another search keyword or add this as a custom item.
                  </div>
                  {search.trim() && (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => {
                        onSelectProduct({
                          id: '',
                          name: search.trim(),
                          price: 0,
                          taxRate: 0,
                          unit: 'pcs',
                          isCustom: true
                        });
                        onClose();
                      }}
                    >
                      ✍️ Use "{search.trim()}" as Custom Item
                    </Button>
                  )}
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const stk = p.stock !== undefined ? p.stock : (p.inventory !== undefined ? p.inventory : '—');
                  const inStock = stk === '—' || Number(stk) > 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectProduct(p);
                        onClose();
                      }}
                      className="p-3 hover:bg-[color:var(--bg-subtle)] cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="font-bold text-xs text-[color:var(--text-primary)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {p.name}
                        </div>
                        <div className="text-[10.5px] text-[color:var(--text-muted)] flex flex-wrap items-center gap-2 mt-1">
                          {p.barcode && (
                            <span className="font-mono bg-[color:var(--bg-subtle)] px-1.5 py-0.5 rounded border border-[color:var(--border-subtle)]">
                              {p.barcode}
                            </span>
                          )}
                          {p.category && (
                            <span className="text-[10px] font-semibold text-[color:var(--text-secondary)]">
                              {p.category}
                            </span>
                          )}
                          <span
                            className={`font-bold text-[10.5px] px-1.5 py-0.2 rounded-full ${
                              inStock
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            Stock: {stk} {p.unit || 'pcs'}
                          </span>
                          {p.taxRate ? <span>GST {p.taxRate}%</span> : null}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-extrabold text-sm text-[color:var(--text-primary)]">
                          {money(p.price)}
                        </div>
                        <div className="text-[10px] text-[color:var(--text-muted)]">
                          per {p.unit || 'pcs'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Product Cell Display & Trigger Component */
function ProductItemCell({ row, index, onOpenPicker, onUpdateName }) {
  if (row.isCustom) {
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
          onClick={() => onOpenPicker(index)}
          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1.5 rounded-xl shrink-0 hover:bg-indigo-100 transition-colors"
          title="Pick from catalog instead"
        >
          Catalog
        </button>
      </div>
    );
  }

  if (!row.name) {
    return (
      <button
        type="button"
        onClick={() => onOpenPicker(index)}
        className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-400/60 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between transition-all"
      >
        <span className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 opacity-80" /> Click to Select Product…
        </span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>
    );
  }

  return (
    <div
      onClick={() => onOpenPicker(index)}
      className="p-1.5 px-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/50 hover:bg-[color:var(--bg-subtle)] cursor-pointer flex items-center justify-between gap-2 group transition-colors"
      title="Click to change product"
    >
      <div className="min-w-0 pr-1">
        <div className="font-bold text-xs text-[color:var(--text-primary)] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
          {row.name}
        </div>
        {row.barcode && (
          <div className="text-[10px] text-[color:var(--text-muted)] font-mono">{row.barcode}</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 opacity-80 group-hover:opacity-100">
        <span>Change</span>
        <Edit3 className="w-3 h-3" />
      </div>
    </div>
  );
}

export default function InvoicesManager({ tenant, showToast, onNavigate }) {
  const [mainTab, setMainTab] = useState('INVOICES'); // 'INVOICES' | 'QUOTATIONS'
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Invoices filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PAID, DUE, VOID
  const [dateFilter, setDateFilter] = useState('ALL'); // TODAY, THIS_WEEK, THIS_MONTH, ALL
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [viewMode, setViewMode] = useState('TAX_INVOICE'); // TAX_INVOICE, THERMAL
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  // Quotations state & modals
  const [quotationSearch, setQuotationSearch] = useState('');
  const [quotationStatusFilter, setQuotationStatusFilter] = useState('ALL'); // ALL, PENDING, ACCEPTED, CONVERTED, EXPIRED, REJECTED
  const [quotationDateFilter, setQuotationDateFilter] = useState('ALL');
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [convertingId, setConvertingId] = useState(null);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [ordersRes, quotationsRes, productsRes, customersRes, settingsRes] = await Promise.all([
        api.get('/orders', { limit: 1000 }).catch(() => []),
        api.get('/quotations', { limit: 1000 }).catch(() => []),
        api.get('/products').catch(() => []),
        api.get('/customers').catch(() => []),
        api.get('/settings').catch(() => ({}))
      ]);
      setInvoices(ordersRes || []);
      setQuotations(quotationsRes || []);
      setProducts(productsRes || []);
      setCustomers(customersRes || []);
      setSettings(settingsRes || null);
    } catch (err) {
      showToast(api.message(err, 'Failed to fetch sales & quotation data.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filter calculations for Invoices
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const todayStr = todayISO();
    const monthStart = monthStartISO();

    return (invoices || []).filter((inv) => {
      const isVoid = inv.status === 'VOID';
      const isDue = (inv.outstanding || inv.dueAmount || 0) > 0;
      if (statusFilter === 'PAID' && (isVoid || isDue)) return false;
      if (statusFilter === 'DUE' && (!isDue || isVoid)) return false;
      if (statusFilter === 'VOID' && !isVoid) return false;

      if (inv.date) {
        const invDateStr = String(inv.date).slice(0, 10);
        if (dateFilter === 'TODAY' && invDateStr !== todayStr) return false;
        if (dateFilter === 'THIS_MONTH' && invDateStr < monthStart) return false;
        if (dateFilter === 'THIS_WEEK') {
          const pastWeek = new Date();
          pastWeek.setDate(now.getDate() - 7);
          if (invDateStr < pastWeek.toISOString().slice(0, 10)) return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchId = String(inv.orderId || '').toLowerCase().includes(q);
        const matchCust = String(inv.customerName || '').toLowerCase().includes(q);
        const matchPhone = String(inv.customerPhone || '').includes(q);
        const matchMode = String(inv.paymentMethod || '').toLowerCase().includes(q);
        if (!matchId && !matchCust && !matchPhone && !matchMode) return false;
      }

      return true;
    });
  }, [invoices, statusFilter, dateFilter, search]);

  // Filter calculations for Quotations
  const filteredQuotations = useMemo(() => {
    const now = new Date();
    const todayStr = todayISO();
    const monthStart = monthStartISO();

    return (quotations || []).filter((qt) => {
      if (quotationStatusFilter !== 'ALL' && qt.status !== quotationStatusFilter) return false;

      if (qt.date) {
        const qtDateStr = String(qt.date).slice(0, 10);
        if (quotationDateFilter === 'TODAY' && qtDateStr !== todayStr) return false;
        if (quotationDateFilter === 'THIS_MONTH' && qtDateStr < monthStart) return false;
        if (quotationDateFilter === 'THIS_WEEK') {
          const pastWeek = new Date();
          pastWeek.setDate(now.getDate() - 7);
          if (qtDateStr < pastWeek.toISOString().slice(0, 10)) return false;
        }
      }

      if (quotationSearch.trim()) {
        const q = quotationSearch.toLowerCase();
        const matchNo = String(qt.quotationNo || '').toLowerCase().includes(q);
        const matchCust = String(qt.customerName || '').toLowerCase().includes(q);
        const matchPhone = String(qt.customerPhone || '').includes(q);
        if (!matchNo && !matchCust && !matchPhone) return false;
      }

      return true;
    });
  }, [quotations, quotationStatusFilter, quotationDateFilter, quotationSearch]);

  // Invoices Stats
  const invoiceStats = useMemo(() => {
    let totalAmount = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let voidCount = 0;

    (invoices || []).forEach((inv) => {
      if (inv.status === 'VOID') {
        voidCount++;
        return;
      }
      const tot = Number(inv.total || inv.grossTotal || 0);
      const due = Number(inv.outstanding || inv.dueAmount || 0);
      const paid = Math.max(0, tot - due);

      totalAmount += tot;
      totalPaid += paid;
      totalDue += due;
    });

    return {
      count: (invoices || []).filter((i) => i.status !== 'VOID').length,
      totalAmount,
      totalPaid,
      totalDue,
      voidCount
    };
  }, [invoices]);

  // Quotation Stats
  const quotationStats = useMemo(() => {
    let totalVal = 0;
    let pendingVal = 0;
    let convertedVal = 0;
    let pendingCount = 0;
    let convertedCount = 0;

    (quotations || []).forEach((qt) => {
      const tot = Number(qt.total || 0);
      totalVal += tot;
      if (qt.status === 'PENDING') {
        pendingVal += tot;
        pendingCount++;
      } else if (qt.status === 'CONVERTED') {
        convertedVal += tot;
        convertedCount++;
      }
    });

    return {
      totalCount: (quotations || []).length,
      totalVal,
      pendingVal,
      pendingCount,
      convertedVal,
      convertedCount
    };
  }, [quotations]);

  const handleVoidInvoice = async (invoice) => {
    if (!window.confirm(`Are you sure you want to VOID invoice #${invoice.orderId}? This will reverse stock and accounting entries.`)) return;
    try {
      await api.post(`/orders/${invoice.orderId}/void`);
      showToast(`Invoice #${invoice.orderId} voided successfully.`, 'success');
      setSelectedInvoice(null);
      fetchAllData();
    } catch (err) {
      showToast(api.message(err, 'Failed to void invoice.'), 'error');
    }
  };

  const handleConvertQuotation = async (quotation) => {
    if (!window.confirm(`Convert Quotation ${quotation.quotationNo} to a Tax Invoice? This will deduct product stocks and record accounting vouchers.`)) return;
    setConvertingId(quotation.id);
    try {
      const res = await api.post(`/quotations/${quotation.id}/convert`);
      showToast(res.message || `Quotation ${quotation.quotationNo} successfully converted to Invoice!`, 'success');
      fetchAllData();
      if (selectedQuotation?.id === quotation.id) {
        setSelectedQuotation(null);
      }
      const orderData = res?.data?.order || res?.data || res?.order;
      if (orderData) {
        setSelectedInvoice(orderData);
        setViewMode('TAX_INVOICE');
      }
    } catch (err) {
      showToast(api.message(err, 'Failed to convert quotation.'), 'error');
    } finally {
      setConvertingId(null);
    }
  };

  const handleDeleteQuotation = async (quotation) => {
    if (!window.confirm(`Delete Quotation ${quotation.quotationNo}?`)) return;
    try {
      await api.delete(`/quotations/${quotation.id}`);
      showToast(`Quotation ${quotation.quotationNo} deleted.`, 'success');
      fetchAllData();
    } catch (err) {
      showToast(api.message(err, 'Failed to delete quotation.'), 'error');
    }
  };

  const exportInvoices = (format) => {
    const rows = filteredInvoices.map((inv) => ({
      'Invoice #': inv.orderId,
      Date: fmtDate(inv.date),
      'Customer Name': inv.customerName || 'Walk-in',
      Phone: inv.customerPhone || '—',
      'Payment Mode': inv.paymentMethod || 'Cash',
      Status: inv.status || 'COMPLETED',
      'Subtotal (₹)': inv.subtotal || inv.total,
      'Tax (₹)': inv.tax || 0,
      'Discount (₹)': inv.discount || 0,
      'Total (₹)': inv.total
    }));
    exportReport({
      title: 'Sales_Invoices_Register',
      filename: `Sales_Invoices_${todayISO()}`,
      format,
      columns: ['Invoice #', 'Date', 'Customer Name', 'Phone', 'Payment Mode', 'Status', 'Subtotal (₹)', 'Tax (₹)', 'Discount (₹)', 'Total (₹)'],
      data: rows
    });
    showToast(`Exported ${rows.length} invoices to ${format.toUpperCase()}.`, 'success');
  };

  const exportQuotations = (format) => {
    const rows = filteredQuotations.map((qt) => ({
      'Quotation #': qt.quotationNo,
      Date: fmtDate(qt.date),
      'Valid Until': fmtDate(qt.validUntil),
      'Customer Name': qt.customerName || 'Walk-in',
      Phone: qt.customerPhone || '—',
      Status: qt.status || 'PENDING',
      'Items Count': (qt.items || []).length,
      'Subtotal (₹)': qt.subtotal || qt.total,
      'Tax (₹)': qt.tax || 0,
      'Discount (₹)': qt.discount || 0,
      'Total (₹)': qt.total,
      'Converted Invoice': qt.convertedOrderId || '—'
    }));
    exportReport({
      title: 'Quotations_Register',
      filename: `Quotations_${todayISO()}`,
      format,
      columns: ['Quotation #', 'Date', 'Valid Until', 'Customer Name', 'Phone', 'Status', 'Items Count', 'Subtotal (₹)', 'Tax (₹)', 'Discount (₹)', 'Total (₹)', 'Converted Invoice'],
      data: rows
    });
    showToast(`Exported ${rows.length} quotations to ${format.toUpperCase()}.`, 'success');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <SectionHeader
        eyebrow="Sales & Commercials"
        title="Invoices & Quotations"
        icon={Receipt}
        subtitle="Manage complete sales tax invoices register, create custom tax invoices, proforma quotations, price estimates, and instant reprint/export."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={RefreshCw} onClick={fetchAllData} loading={loading}>
              Refresh
            </Button>
            <Button
              variant="outline"
              icon={Download}
              onClick={() => (mainTab === 'INVOICES' ? exportInvoices('csv') : exportQuotations('csv'))}
              disabled={mainTab === 'INVOICES' ? filteredInvoices.length === 0 : filteredQuotations.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              icon={FileCheck}
              onClick={() => {
                setEditingQuotation(null);
                setQuotationModalOpen(true);
              }}
            >
              New Quotation
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setInvoiceModalOpen(true)}
            >
              Create Invoice
            </Button>
            {onNavigate && (
              <Button variant="ghost" size="sm" icon={Store} onClick={() => onNavigate('pos')} title="Open POS Billing Terminal">
                POS Terminal
              </Button>
            )}
          </div>
        }
      />

      {/* Main Tab Selector (Invoices vs Quotations) */}
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] pb-2">
        <button
          type="button"
          onClick={() => setMainTab('INVOICES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mainTab === 'INVOICES'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Tax Invoices</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${mainTab === 'INVOICES' ? 'bg-white/20 text-white' : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)]'}`}>
            {(invoices || []).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('QUOTATIONS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mainTab === 'QUOTATIONS'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)]'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Quotations & Estimates</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${mainTab === 'QUOTATIONS' ? 'bg-white/20 text-white' : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-muted)]'}`}>
            {(quotations || []).length}
          </span>
        </button>
      </div>

      {mainTab === 'INVOICES' ? (
        <>
          {/* Invoices KPI Ribbon */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Invoiced</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-[color:var(--text-primary)]">
                {money(invoiceStats.totalAmount, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                {invoiceStats.count} {invoiceStats.count === 1 ? 'invoice' : 'invoices'}
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Received / Paid</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {money(invoiceStats.totalPaid, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-semibold">
                Fully collected
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Due / Outstanding</span>
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {money(invoiceStats.totalDue, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Customer receivables
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Voided Invoices</span>
                <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-rose-600 dark:text-rose-400">
                {invoiceStats.voidCount}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Reversed & cancelled
              </div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <Panel className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {[
                  { key: 'ALL', label: 'All Invoices' },
                  { key: 'PAID', label: 'Paid' },
                  { key: 'DUE', label: 'Due / Credit' },
                  { key: 'VOID', label: 'Void' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      statusFilter === tab.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search & Date Range */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search Invoice #, customer, phone…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="field-input text-xs"
                    style={{ paddingLeft: '2.1rem' }}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="field-input text-xs py-2 px-3 min-w-[130px] rounded-xl font-semibold cursor-pointer"
                >
                  <option value="TODAY">Today</option>
                  <option value="THIS_WEEK">This Week</option>
                  <option value="THIS_MONTH">This Month</option>
                  <option value="ALL">All Time</option>
                </select>
              </div>
            </div>

            {/* Invoices Table */}
            {loading ? (
              <Spinner label="Loading sales invoices…" />
            ) : filteredInvoices.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No Invoices Found"
                hint="Click 'Create Invoice' to generate a new tax invoice with auto-filled customer details and products."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => setInvoiceModalOpen(true)}>
                    Create First Invoice
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider text-[10.5px]">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4 text-center">Items</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {filteredInvoices.map((inv) => {
                      const isVoid = inv.status === 'VOID';
                      const isDue = (inv.outstanding || inv.dueAmount || 0) > 0;

                      return (
                        <tr
                          key={inv.orderId}
                          className="hover:bg-[color:var(--bg-subtle)]/70 transition-colors group cursor-pointer"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setViewMode('TAX_INVOICE');
                          }}
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-[color:var(--text-primary)]">{fmtDate(inv.date)}</div>
                            <div className="text-[10px] text-[color:var(--text-muted)]">{inv.date ? String(inv.date).slice(11, 16) : ''}</div>
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            #{inv.orderId}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-[color:var(--text-primary)] truncate max-w-[160px]">
                              {inv.customerName || 'Walk-in Customer'}
                            </div>
                            {inv.customerPhone && inv.customerPhone !== 'N/A' && (
                              <div className="text-[10.5px] text-[color:var(--text-muted)]">{inv.customerPhone}</div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--text-secondary)]">
                              <CreditCard className="w-3 h-3 opacity-60" />
                              {inv.paymentMethod || 'Cash'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-semibold text-[color:var(--text-secondary)]">
                            {(inv.items || []).length}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="font-extrabold font-mono text-[13px] text-[color:var(--text-primary)]">
                              {money(inv.total)}
                            </div>
                            {isDue && (
                              <div className="text-[10px] text-amber-600 font-bold">
                                Due: {money(inv.outstanding || inv.dueAmount)}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isVoid ? (
                              <Badge tone="danger">VOID</Badge>
                            ) : isDue ? (
                              <Badge tone="warning">CREDIT / DUE</Badge>
                            ) : (
                              <Badge tone="success">PAID</Badge>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="xs"
                                variant="outline"
                                icon={Eye}
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setViewMode('TAX_INVOICE');
                                }}
                              >
                                View / Print
                              </Button>
                              <Button
                                size="xs"
                                variant="secondary"
                                icon={Printer}
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setViewMode('THERMAL');
                                }}
                              >
                                Thermal
                              </Button>
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
        </>
      ) : (
        <>
          {/* Quotations KPI Ribbon */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Quotations</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <FileCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-[color:var(--text-primary)]">
                {money(quotationStats.totalVal, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                {quotationStats.totalCount} {quotationStats.totalCount === 1 ? 'quotation' : 'quotations'}
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Open / Pending</span>
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {money(quotationStats.pendingVal, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-400/80 font-semibold">
                {quotationStats.pendingCount} active estimates
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Converted to Sales</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {money(quotationStats.convertedVal, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-semibold">
                {quotationStats.convertedCount} billed invoices
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)] flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Quick Action</span>
                <div className="text-xs text-[color:var(--text-secondary)] mt-1">
                  Issue price quote before billing.
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingQuotation(null);
                  setQuotationModalOpen(true);
                }}
                className="mt-2 w-full justify-center"
              >
                Create Quotation
              </Button>
            </div>
          </div>

          {/* Quotations Table Panel */}
          <Panel className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {[
                  { key: 'ALL', label: 'All Quotations' },
                  { key: 'PENDING', label: 'Pending / Open' },
                  { key: 'CONVERTED', label: 'Converted to Invoice' },
                  { key: 'ACCEPTED', label: 'Accepted' },
                  { key: 'EXPIRED', label: 'Expired / Rejected' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setQuotationStatusFilter(tab.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      quotationStatusFilter === tab.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search & Date Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search Quote #, customer, phone…"
                    value={quotationSearch}
                    onChange={(e) => setQuotationSearch(e.target.value)}
                    className="field-input text-xs"
                    style={{ paddingLeft: '2.1rem' }}
                  />
                  {quotationSearch && (
                    <button
                      type="button"
                      onClick={() => setQuotationSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={quotationDateFilter}
                  onChange={(e) => setQuotationDateFilter(e.target.value)}
                  className="field-input text-xs py-2 px-3 min-w-[130px] rounded-xl font-semibold cursor-pointer"
                >
                  <option value="TODAY">Today</option>
                  <option value="THIS_WEEK">This Week</option>
                  <option value="THIS_MONTH">This Month</option>
                  <option value="ALL">All Time</option>
                </select>
              </div>
            </div>

            {/* Quotations Table */}
            {loading ? (
              <Spinner label="Loading quotations…" />
            ) : filteredQuotations.length === 0 ? (
              <EmptyState
                icon={FileCheck}
                title="No Quotations Found"
                hint="Create a new price quotation for your customer by clicking 'New Quotation'."
                action={
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => {
                      setEditingQuotation(null);
                      setQuotationModalOpen(true);
                    }}
                  >
                    Create First Quotation
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider text-[10.5px]">
                      <th className="py-3 px-4">Quote Date</th>
                      <th className="py-3 px-4">Quotation #</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Valid Until</th>
                      <th className="py-3 px-4 text-center">Items</th>
                      <th className="py-3 px-4 text-right">Quoted Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {filteredQuotations.map((qt) => {
                      const isConverted = qt.status === 'CONVERTED';
                      const isPending = qt.status === 'PENDING';
                      const isAccepted = qt.status === 'ACCEPTED';
                      const isConverting = convertingId === qt.id;

                      return (
                        <tr
                          key={qt.id}
                          className="hover:bg-[color:var(--bg-subtle)]/70 transition-colors group cursor-pointer"
                          onClick={() => setSelectedQuotation(qt)}
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-[color:var(--text-primary)]">{fmtDate(qt.date)}</div>
                            <div className="text-[10px] text-[color:var(--text-muted)]">{qt.date ? String(qt.date).slice(11, 16) : ''}</div>
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            {qt.quotationNo}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-[color:var(--text-primary)] truncate max-w-[160px]">
                              {qt.customerName || 'Walk-in Customer'}
                            </div>
                            {qt.customerPhone && qt.customerPhone !== 'N/A' && (
                              <div className="text-[10.5px] text-[color:var(--text-muted)]">{qt.customerPhone}</div>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--text-secondary)]">
                              <Calendar className="w-3 h-3 opacity-60" />
                              {fmtDate(qt.validUntil)}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-semibold text-[color:var(--text-secondary)]">
                            {(qt.items || []).length}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="font-extrabold font-mono text-[13px] text-[color:var(--text-primary)]">
                              {money(qt.total)}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isConverted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                Billed #{qt.convertedOrderId}
                              </span>
                            ) : isAccepted ? (
                              <Badge tone="info">ACCEPTED</Badge>
                            ) : isPending ? (
                              <Badge tone="warning">PENDING</Badge>
                            ) : (
                              <Badge tone="danger">{qt.status}</Badge>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="xs"
                                variant="outline"
                                icon={Eye}
                                onClick={() => setSelectedQuotation(qt)}
                              >
                                View / Print
                              </Button>

                              {!isConverted && (
                                <>
                                  <Button
                                    size="xs"
                                    variant="primary"
                                    icon={CheckSquare}
                                    loading={isConverting}
                                    onClick={() => handleConvertQuotation(qt)}
                                    title="Convert to Tax Invoice"
                                  >
                                    Convert
                                  </Button>

                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    icon={Edit3}
                                    onClick={() => {
                                      setEditingQuotation(qt);
                                      setQuotationModalOpen(true);
                                    }}
                                    title="Edit Quotation"
                                  />
                                </>
                              )}

                              <Button
                                size="xs"
                                variant="ghost"
                                icon={Trash2}
                                onClick={() => handleDeleteQuotation(qt)}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Delete Quotation"
                              />
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
        </>
      )}

      {/* Professional Tax Invoice View/Print Modal */}
      {selectedInvoice && (
        <TaxInvoiceModal
          invoice={selectedInvoice}
          settings={settings}
          tenant={tenant}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onClose={() => setSelectedInvoice(null)}
          onVoid={() => handleVoidInvoice(selectedInvoice)}
        />
      )}

      {/* Professional Quotation / Estimate Modal */}
      {selectedQuotation && (
        <QuotationDocumentModal
          quotation={selectedQuotation}
          settings={settings}
          tenant={tenant}
          onClose={() => setSelectedQuotation(null)}
          onConvert={() => handleConvertQuotation(selectedQuotation)}
          converting={convertingId === selectedQuotation.id}
        />
      )}

      {/* Dedicated New Tax Invoice Sheet / Creation Modal */}
      {invoiceModalOpen && (
        <NewInvoiceModal
          products={products}
          customers={customers}
          settings={settings}
          onClose={() => setInvoiceModalOpen(false)}
          onSaved={(createdOrder) => {
            setInvoiceModalOpen(false);
            fetchAllData();
            const invNum = createdOrder?.orderId || createdOrder?.data?.orderId || '';
            showToast(invNum ? `Invoice #${invNum} generated successfully!` : 'Tax Invoice generated successfully!', 'success');
            if (createdOrder) {
              setSelectedInvoice(createdOrder?.data || createdOrder);
              setViewMode('TAX_INVOICE');
            }
          }}
          showToast={showToast}
        />
      )}

      {/* Quotation Editor / Creation Modal */}
      {quotationModalOpen && (
        <QuotationEditorModal
          quotation={editingQuotation}
          products={products}
          customers={customers}
          settings={settings}
          onClose={() => {
            setQuotationModalOpen(false);
            setEditingQuotation(null);
          }}
          onSaved={() => {
            setQuotationModalOpen(false);
            setEditingQuotation(null);
            fetchAllData();
            showToast(editingQuotation ? 'Quotation updated successfully.' : 'Quotation created successfully.', 'success');
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/** Dedicated New Tax Invoice Creation Modal / Sheet */
function NewInvoiceModal({ products = [], customers = [], settings, onClose, onSaved, showToast }) {
  const [loading, setLoading] = useState(false);
  const [activePickerIndex, setActivePickerIndex] = useState(null);

  // Customer fields
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Invoice specifics
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [isRoundOff, setIsRoundOff] = useState(true);

  // Line items
  const [items, setItems] = useState([
    {
      productId: '',
      name: '',
      barcode: '',
      qty: 1,
      unit: 'pcs',
      price: '',
      taxRate: 0,
      discount: 0,
      total: 0,
      isCustom: false
    }
  ]);

  // Handle Customer Selection & Auto-fill
  const handleCustomerChange = (id) => {
    setSelectedCustomerId(id);
    if (!id) {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGstin('');
      setCustomerAddress('');
      return;
    }
    const cust = (customers || []).find((c) => c.id === id);
    if (cust) {
      setCustomerName(cust.name || '');
      setCustomerPhone(cust.phone || '');
      setCustomerGstin(cust.gstin || '');
      setCustomerAddress(cust.address || '');
    }
  };

  // When picking a product from the Solid Picker Modal
  const handleProductSelect = (index, prod) => {
    setItems((prev) => {
      const next = [...prev];
      const qty = Number(next[index]?.qty) || 1;
      const price = Number(prod.price) || 0;
      const taxRate = Number(prod.taxRate || prod.gstRate) || 0;
      const discount = Number(next[index]?.discount) || 0;
      const sub = qty * (Number(price) || 0);
      const taxAmt = (sub * taxRate) / 100;
      const total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);

      next[index] = {
        ...next[index],
        productId: prod.id || '',
        name: prod.name,
        barcode: prod.barcode || '',
        unit: prod.unit || next[index]?.unit || 'pcs',
        price: prod.price !== undefined ? prod.price : '',
        taxRate,
        discount,
        total,
        isCustom: !!prod.isCustom
      };
      return next;
    });
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      const qty = Number(updated.qty) || 0;
      const price = Number(updated.price) || 0;
      const taxRate = Number(updated.taxRate) || 0;
      const discount = Number(updated.discount) || 0;
      const sub = qty * price;
      const taxAmt = (sub * taxRate) / 100;
      updated.total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);

      next[index] = updated;
      return next;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: '',
        name: '',
        barcode: '',
        qty: 1,
        unit: 'pcs',
        price: '',
        taxRate: 0,
        discount: 0,
        total: 0,
        isCustom: false
      }
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Live Totals calculation
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const rate = Number(item.taxRate) || 0;
      const disc = Number(item.discount) || 0;
      const lineSub = qty * price;
      const lineTax = (lineSub * rate) / 100;

      subtotal += lineSub;
      taxTotal += lineTax;
      discountTotal += disc;
    });

    const netBeforeRound = Math.max(0, subtotal + taxTotal - discountTotal);
    const roundedGrand = isRoundOff ? Math.round(netBeforeRound) : netBeforeRound;
    const roundOff = isRoundOff ? Math.round((roundedGrand - netBeforeRound) * 100) / 100 : 0;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(taxTotal * 100) / 100,
      discount: Math.round(discountTotal * 100) / 100,
      roundOff,
      total: roundedGrand
    };
  }, [items, isRoundOff]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validItems = items.filter((i) => i.name && i.name.trim() && (Number(i.qty) > 0 || Number(i.price) > 0));
    if (validItems.length === 0) {
      showToast('Please select or enter at least one item for the invoice.', 'error');
      return;
    }

    if (paymentMethod === 'Credit (Udhar)' && !customerName.trim()) {
      showToast('Customer name is required for credit / udhar sale.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        customerId: selectedCustomerId || null,
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || 'N/A',
        customerGstin: customerGstin.trim() || '',
        customerAddress: customerAddress.trim() || '',
        paymentMethod,
        date: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        items: validItems.map((i) => ({
          id: i.productId || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: i.name,
          barcode: i.barcode || '',
          qty: Number(i.qty) || 1,
          unit: i.unit || 'pcs',
          price: Number(i.price) || 0,
          taxRate: Number(i.taxRate) || 0,
          discount: Number(i.discount) || 0,
          total: Number(i.total) || 0
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        roundOff: totals.roundOff,
        total: totals.total,
        notes
      };

      const res = await api.post('/orders', payload);
      const created = res?.data || res;
      onSaved(created);
    } catch (err) {
      showToast(api.message(err, 'Failed to create tax invoice.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Create Tax Invoice"
        subtitle="Directly generate a formal tax sales invoice with customer details, product items, GST taxes, and stock deduction."
        icon={Receipt}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Information & Auto-fill Card */}
          <div className="p-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Customer & Billing Info
              </span>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                Auto-fills customer details upon selection
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Select Registered Customer">
                <Select value={selectedCustomerId} onChange={(e) => handleCustomerChange(e.target.value)}>
                  <option value="">— Walk-in / Custom Customer —</option>
                  {(customers || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Customer Name *">
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Customer / Client Name"
                  required
                />
              </Field>

              <Field label="Phone Number">
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Mobile number"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Field label="GSTIN / Tax ID">
                <Input
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value)}
                  placeholder="Optional GSTIN"
                />
              </Field>

              <Field label="Invoice Date *">
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </Field>

              <Field label="Payment Method">
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Credit (Udhar)">Credit (Udhar)</option>
                  <option value="Net Banking">Net Banking</option>
                </Select>
              </Field>

              <Field label="Billing / Delivery Address">
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Customer location / city"
                />
              </Field>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Invoice Items ({items.length})
              </span>
              <Button type="button" size="xs" variant="secondary" icon={Plus} onClick={addItemRow}>
                Add Product Line
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] uppercase text-[10.5px]">
                    <th className="py-2.5 px-3 min-w-[260px]">Product / Item Description *</th>
                    <th className="py-2.5 px-2 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-2 w-16 text-center">Unit</th>
                    <th className="py-2.5 px-2 w-28 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-2 w-20 text-right">GST %</th>
                    <th className="py-2.5 px-2 w-24 text-right">Disc (₹)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {items.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[color:var(--bg-subtle)]/30 transition-colors">
                      {/* Solid Product Selection Item Cell */}
                      <td className="py-2.5 px-3">
                        <ProductItemCell
                          row={row}
                          index={idx}
                          onOpenPicker={(i) => setActivePickerIndex(i)}
                          onUpdateName={(i, name) => handleItemChange(i, 'name', name)}
                        />
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          className="field-input text-xs py-1.5 px-2 text-right w-full font-mono font-bold rounded-xl"
                          value={row.qty}
                          onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                          required
                        />
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="text"
                          className="field-input text-xs py-1.5 px-1 text-center w-full rounded-xl font-medium text-[color:var(--text-secondary)]"
                          value={row.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          placeholder="pcs"
                        />
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="field-input text-xs py-1.5 px-2 text-right w-full font-mono rounded-xl font-semibold"
                          value={row.price}
                          onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="field-input text-xs py-1.5 px-2 text-right w-full font-mono rounded-xl"
                          value={row.taxRate}
                          onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                          placeholder="0"
                        />
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="field-input text-xs py-1.5 px-2 text-right w-full font-mono text-emerald-600 rounded-xl"
                          value={row.discount}
                          onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                          placeholder="0"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-[13px] text-[color:var(--text-primary)]">
                        {money(row.total)}
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length === 1}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-20 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes & Financial Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-3">
              <Field label="Invoice Notes / Special Remarks">
                <textarea
                  className="field-input text-xs p-2.5 w-full rounded-xl resize-none"
                  rows="3"
                  placeholder="Optional invoice remarks, transport details, PO reference, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-[color:var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={isRoundOff}
                  onChange={(e) => setIsRoundOff(e.target.checked)}
                  className="rounded border-[color:var(--border)] text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer accent-indigo-600"
                />
                <span>Automatically round off Grand Total to whole ₹</span>
              </label>
            </div>

            <div className="p-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/70 flex flex-col justify-between space-y-2 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between py-1 border-b border-[color:var(--border)]">
                  <span className="text-[color:var(--text-secondary)] font-medium">Subtotal:</span>
                  <span className="font-mono font-bold text-[color:var(--text-primary)]">{money(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-emerald-600 font-semibold">
                    <span>Discount:</span>
                    <span className="font-mono">-{money(totals.discount)}</span>
                  </div>
                )}
                {totals.tax > 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-[color:var(--text-secondary)] font-medium">
                    <span>GST Taxes:</span>
                    <span className="font-mono font-bold text-[color:var(--text-primary)]">{money(totals.tax)}</span>
                  </div>
                )}
                {isRoundOff && totals.roundOff !== 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-[color:var(--text-muted)]">
                    <span>Round Off:</span>
                    <span className="font-mono">{money(totals.roundOff)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-t-2 border-[color:var(--border-strong)] mt-2">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Payable</div>
                  <div className="text-[13px] font-bold text-[color:var(--text-primary)]">Invoice Grand Total</div>
                </div>
                <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  {money(totals.total)}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[color:var(--border)]">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading} icon={Receipt}>
              Save & Generate Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* Solid Product Picker Modal for Invoice Sheet */}
      <ProductPickerModal
        open={activePickerIndex !== null}
        onClose={() => setActivePickerIndex(null)}
        products={products}
        onSelectProduct={(prod) => {
          if (activePickerIndex !== null) {
            handleProductSelect(activePickerIndex, prod);
          }
        }}
      />
    </>
  );
}

/** Quotation Creation & Editor Modal */
function QuotationEditorModal({ quotation, products = [], customers = [], settings, onClose, onSaved, showToast }) {
  const isEditing = !!quotation;
  const [loading, setLoading] = useState(false);
  const [activePickerIndex, setActivePickerIndex] = useState(null);

  // Customer fields
  const [selectedCustomerId, setSelectedCustomerId] = useState(quotation?.customerId || '');
  const [customerName, setCustomerName] = useState(quotation?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(quotation?.customerPhone || '');
  const [customerGstin, setCustomerGstin] = useState(quotation?.customerGstin || '');
  const [customerAddress, setCustomerAddress] = useState(quotation?.customerAddress || '');

  // Dates
  const [validUntil, setValidUntil] = useState(() => {
    if (quotation?.validUntil) return String(quotation.validUntil).slice(0, 10);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  const [notes, setNotes] = useState(quotation?.notes || '');
  const [terms, setTerms] = useState(quotation?.terms || settings?.billing?.termsText || 'Prices valid until specified validity date. Subject to stock availability.');

  // Clean Line Items structure
  const [items, setItems] = useState(() => {
    if (quotation?.items?.length) {
      return quotation.items.map((i) => ({
        productId: i.productId || i.id || '',
        name: i.name || '',
        barcode: i.barcode || '',
        qty: Number(i.qty) || 1,
        unit: i.unit || 'pcs',
        price: Number(i.price) || 0,
        taxRate: Number(i.taxRate) || 0,
        discount: Number(i.discount) || 0,
        total: Number(i.total) || Math.round((Number(i.qty) || 1) * (Number(i.price) || 0) * 100) / 100,
        isCustom: !i.productId || !(products || []).some((p) => p.id === i.productId)
      }));
    }
    return [
      {
        productId: '',
        name: '',
        barcode: '',
        qty: 1,
        unit: 'pcs',
        price: '',
        taxRate: 0,
        discount: 0,
        total: 0,
        isCustom: false
      }
    ];
  });

  // Handle Customer Selection & Auto-fill
  const handleCustomerChange = (id) => {
    setSelectedCustomerId(id);
    if (!id) {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGstin('');
      setCustomerAddress('');
      return;
    }
    const cust = (customers || []).find((c) => c.id === id);
    if (cust) {
      setCustomerName(cust.name || '');
      setCustomerPhone(cust.phone || '');
      setCustomerGstin(cust.gstin || '');
      setCustomerAddress(cust.address || '');
    }
  };

  // When picking a product
  const handleProductSelect = (index, prod) => {
    setItems((prev) => {
      const next = [...prev];
      const qty = Number(next[index]?.qty) || 1;
      const price = Number(prod.price) || 0;
      const taxRate = Number(prod.taxRate || prod.gstRate) || 0;
      const discount = Number(next[index]?.discount) || 0;
      const sub = qty * (Number(price) || 0);
      const taxAmt = (sub * taxRate) / 100;
      const total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);

      next[index] = {
        ...next[index],
        productId: prod.id || '',
        name: prod.name,
        barcode: prod.barcode || '',
        unit: prod.unit || next[index]?.unit || 'pcs',
        price: prod.price !== undefined ? prod.price : '',
        taxRate,
        discount,
        total,
        isCustom: !!prod.isCustom
      };
      return next;
    });
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      const qty = Number(updated.qty) || 0;
      const price = Number(updated.price) || 0;
      const taxRate = Number(updated.taxRate) || 0;
      const discount = Number(updated.discount) || 0;
      const sub = qty * price;
      const taxAmt = (sub * taxRate) / 100;
      updated.total = Math.max(0, Math.round((sub + taxAmt - discount) * 100) / 100);

      next[index] = updated;
      return next;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: '',
        name: '',
        barcode: '',
        qty: 1,
        unit: 'pcs',
        price: '',
        taxRate: 0,
        discount: 0,
        total: 0,
        isCustom: false
      }
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Live Totals calculation
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const rate = Number(item.taxRate) || 0;
      const disc = Number(item.discount) || 0;
      const lineSub = qty * price;
      const lineTax = (lineSub * rate) / 100;

      subtotal += lineSub;
      taxTotal += lineTax;
      discountTotal += disc;
    });

    const grandTotal = Math.max(0, Math.round((subtotal + taxTotal - discountTotal) * 100) / 100);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(taxTotal * 100) / 100,
      discount: Math.round(discountTotal * 100) / 100,
      total: grandTotal
    };
  }, [items]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validItems = items.filter((i) => i.name && i.name.trim() && (Number(i.qty) > 0 || Number(i.price) > 0));
    if (validItems.length === 0) {
      showToast('Please select or enter at least one item for the quotation.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        customerId: selectedCustomerId || null,
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || 'N/A',
        customerGstin: customerGstin.trim() || '',
        customerAddress: customerAddress.trim() || '',
        validUntil,
        items: validItems.map((i) => ({
          productId: i.productId || null,
          name: i.name,
          barcode: i.barcode || '',
          qty: Number(i.qty) || 1,
          unit: i.unit || 'pcs',
          price: Number(i.price) || 0,
          taxRate: Number(i.taxRate) || 0,
          discount: Number(i.discount) || 0,
          total: Number(i.total) || 0
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        notes,
        terms
      };

      if (isEditing) {
        await api.put(`/quotations/${quotation.id}`, payload);
      } else {
        await api.post('/quotations', payload);
      }

      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Failed to save quotation.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={isEditing ? `Edit Quotation ${quotation.quotationNo}` : 'New Price Quotation / Estimate'}
        subtitle="Prepare a formal, itemized price proposal before invoicing."
        icon={FileCheck}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Information Card */}
          <div className="p-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Customer & Validity
              </span>
              <span className="text-[11px] font-semibold text-[color:var(--text-muted)]">
                Valid for 30 days by default
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Choose Existing Customer">
                <Select value={selectedCustomerId} onChange={(e) => handleCustomerChange(e.target.value)}>
                  <option value="">— Walk-in / One-off Customer —</option>
                  {(customers || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Customer Name *">
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Doe / Acme Corp"
                  required
                />
              </Field>

              <Field label="Phone Number">
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Mobile or office phone"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="GSTIN / Tax ID">
                <Input
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value)}
                  placeholder="Optional GST Number"
                />
              </Field>

              <Field label="Quote Valid Until *">
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                />
              </Field>

              <Field label="Customer Address / Location">
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Billing / Delivery address"
                />
              </Field>
            </div>
          </div>

          {/* Quoted Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Quoted Items ({items.length})
              </span>
              <Button type="button" size="xs" variant="secondary" icon={Plus} onClick={addItemRow}>
                Add Line Item
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] uppercase text-[10.5px]">
                    <th className="py-2.5 px-3 min-w-[260px]">Product / Item Description *</th>
                    <th className="py-2.5 px-2 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-2 w-16 text-center">Unit</th>
                    <th className="py-2.5 px-2 w-28 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-2 w-20 text-right">GST %</th>
                    <th className="py-2.5 px-2 w-24 text-right">Disc (₹)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {items.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[color:var(--bg-subtle)]/30 transition-colors">
                      {/* Solid Product Selection Item Cell */}
                      <td className="py-2.5 px-3">
                        <ProductItemCell
                          row={row}
                          index={idx}
                          onOpenPicker={(i) => setActivePickerIndex(i)}
                          onUpdateName={(i, name) => handleItemChange(i, 'name', name)}
                        />
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          className="field-input text-xs py-1.5 px-2 text-right w-full font-mono font-bold rounded-xl"
                          value={row.qty}
                          onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                          required
                        />
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="text"
                          className="field-input text-xs py-1.5 px-1 text-center w-full rounded-xl font-medium text-[color:var(--text-secondary)]"
                          value={row.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          placeholder="pcs"
                        />
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="field-input text-xs py-1.5 px-2 text-right w-full font-mono rounded-xl font-semibold"
                          value={row.price}
                          onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="field-input text-xs py-1.5 px-2 text-right w-full font-mono rounded-xl"
                          value={row.taxRate}
                          onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                          placeholder="0"
                        />
                      </td>

                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="field-input text-xs py-1.5 px-2 text-right w-full font-mono text-emerald-600 rounded-xl"
                          value={row.discount}
                          onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                          placeholder="0"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-[13px] text-[color:var(--text-primary)]">
                        {money(row.total)}
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length === 1}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-20 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes, Terms & Live Financial Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-3">
              <Field label="Special Notes / Scope of Work">
                <textarea
                  className="field-input text-xs p-2.5 w-full rounded-xl resize-none"
                  rows="2"
                  placeholder="e.g. Free shipping & installation included. Payment terms: 50% advance."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>

              <Field label="Terms & Conditions">
                <textarea
                  className="field-input text-xs p-2.5 w-full rounded-xl resize-none"
                  rows="2"
                  placeholder="Validity clauses, returns, warranty terms…"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </Field>
            </div>

            <div className="p-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/70 flex flex-col justify-between space-y-2 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between py-1 border-b border-[color:var(--border)]">
                  <span className="text-[color:var(--text-secondary)] font-medium">Items Subtotal:</span>
                  <span className="font-mono font-bold text-[color:var(--text-primary)]">{money(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-emerald-600 font-semibold">
                    <span>Total Discount:</span>
                    <span className="font-mono">-{money(totals.discount)}</span>
                  </div>
                )}
                {totals.tax > 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-[color:var(--text-secondary)] font-medium">
                    <span>Estimated GST (Taxes):</span>
                    <span className="font-mono font-bold text-[color:var(--text-primary)]">{money(totals.tax)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-t-2 border-[color:var(--border-strong)] mt-2">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Grand Estimate</div>
                  <div className="text-[13px] font-bold text-[color:var(--text-primary)]">Total Quoted Amount</div>
                </div>
                <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  {money(totals.total)}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[color:var(--border)]">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading} icon={FileCheck}>
              {isEditing ? 'Save Changes' : 'Create Quotation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Solid Product Picker Modal for Quotation Sheet */}
      <ProductPickerModal
        open={activePickerIndex !== null}
        onClose={() => setActivePickerIndex(null)}
        products={products}
        onSelectProduct={(prod) => {
          if (activePickerIndex !== null) {
            handleProductSelect(activePickerIndex, prod);
          }
        }}
      />
    </>
  );
}

/** Standard Tax Invoice & Thermal Receipt Modal */
function TaxInvoiceModal({ invoice, settings, tenant, viewMode, setViewMode, onClose, onVoid }) {
  if (!invoice) return null;
  const company = invoice?.company || settings?.company || { name: tenant?.name || 'Selsolve Store' };
  const billing = invoice?.billing || settings?.billing || {};
  const isVoid = invoice?.status === 'VOID';

  // GST slabs
  const gstSlabs = {};
  (invoice?.items || []).forEach((item) => {
    const rate = Number(item?.taxRate) || 0;
    if (!rate) return;
    if (!gstSlabs[rate]) gstSlabs[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    const amt = Number(item?.total) || (Number(item?.qty || 1) * Number(item?.price || 0));
    gstSlabs[rate].taxable += amt;
    if (billing?.interState) {
      gstSlabs[rate].igst += (amt * rate) / 100;
    } else {
      gstSlabs[rate].cgst += (amt * (rate / 2)) / 100;
      gstSlabs[rate].sgst += (amt * (rate / 2)) / 100;
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Tax Invoice — ${invoice?.orderId || ''}`}
      subtitle={`Generated on ${fmtDateTime(invoice?.date)}`}
      icon={Receipt}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            {!isVoid && (
              <Button variant="danger" size="sm" onClick={onVoid}>
                Void Invoice
              </Button>
            )}
            <div className="flex items-center p-1 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border)] text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('TAX_INVOICE')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'TAX_INVOICE' ? 'bg-indigo-600 text-white shadow-xs' : 'text-[color:var(--text-secondary)]'
                }`}
              >
                Standard A4
              </button>
              <button
                type="button"
                onClick={() => setViewMode('THERMAL')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewMode === 'THERMAL' ? 'bg-indigo-600 text-white shadow-xs' : 'text-[color:var(--text-secondary)]'
                }`}
              >
                Thermal Slip (3")
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={onClose}>Close</Button>
            <Button variant="primary" icon={Printer} onClick={() => window.print()}>
              Print Invoice
            </Button>
          </div>
        </div>
      }
    >
      {viewMode === 'TAX_INVOICE' ? (
        /* Standard A4 Tax Invoice */
        <div id="printable-tax-invoice" className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 font-sans shadow-xs space-y-6">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900">
                {company.name}
              </div>
              {company.address && <div className="text-xs text-slate-600 mt-1 max-w-sm">{company.address}</div>}
              <div className="text-xs text-slate-600 mt-0.5">
                {company.city} {company.state ? `· ${company.state}` : ''} {company.pincode ? `- ${company.pincode}` : ''}
              </div>
              {company.gstin && (
                <div className="text-xs font-semibold text-slate-800 mt-1">
                  GSTIN: <span className="font-mono">{company.gstin}</span>
                </div>
              )}
              {company.phone && <div className="text-xs text-slate-600">Phone: {company.phone}</div>}
            </div>

            <div className="text-right sm:min-w-[200px]">
              <div className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold uppercase tracking-wider rounded-lg">
                TAX INVOICE
              </div>
              <div className="text-lg font-mono font-bold text-slate-900 mt-2">
                #{invoice?.orderId}
              </div>
              {isVoid && (
                <div className="text-xs font-extrabold text-rose-600 uppercase tracking-widest mt-1">
                  [ VOID / CANCELLED ]
                </div>
              )}
            </div>
          </div>

          {/* Meta & Bill To rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-b border-slate-200 pb-6">
            <div className="space-y-1">
              <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">Bill To:</span>
              <div className="text-sm font-bold text-slate-900">{invoice?.customerName || 'Walk-in Customer'}</div>
              {invoice?.customerPhone && invoice.customerPhone !== 'N/A' && (
                <div className="text-slate-600">Phone: {invoice.customerPhone}</div>
              )}
              {invoice?.customerGstin && (
                <div className="text-slate-700 font-semibold">GSTIN: {invoice.customerGstin}</div>
              )}
            </div>

            <div className="space-y-1.5 sm:text-right">
              <div className="flex sm:justify-end gap-3">
                <span className="text-slate-500">Invoice Date:</span>
                <span className="font-bold font-mono">{fmtDate(invoice?.date)}</span>
              </div>
              <div className="flex sm:justify-end gap-3">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-bold">{invoice?.paymentMethod || 'Cash'}</span>
              </div>
              {invoice?.cashier && (
                <div className="flex sm:justify-end gap-3">
                  <span className="text-slate-500">Cashier:</span>
                  <span className="font-semibold">{invoice.cashier}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-50">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item & Description</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                  <th className="py-2.5 px-3 text-right">Tax (%)</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(invoice?.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {item.barcode && <div className="text-[10px] text-slate-500 font-mono">Barcode: {item.barcode}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {item.qty} {item.unit || ''}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{Number(item.price || 0).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">{item.taxRate ? `${item.taxRate}%` : '0%'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {Number(item.total || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculations & Total */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Total in Words:</span>
                <div className="text-xs font-semibold text-slate-800 italic mt-0.5">
                  {numberToWords(invoice?.total || 0)}
                </div>
              </div>

              {/* GST Slab Breakdown */}
              {Object.keys(gstSlabs).length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-[11px] space-y-1.5">
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Tax Slabs Summary</div>
                  {Object.entries(gstSlabs).map(([rate, vals]) => (
                    <div key={rate} className="flex justify-between text-slate-600 font-mono">
                      <span>GST @ {rate}% on {money(vals.taxable)}:</span>
                      <span className="font-bold">
                        {money(vals.igst || (vals.cgst + vals.sgst))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {billing?.termsText && (
                <div className="text-[11px] text-slate-600">
                  <strong className="text-slate-700">Terms & Conditions:</strong> {billing.termsText}
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-mono font-semibold">{money(invoice?.subtotal || invoice?.total)}</span>
              </div>
              {invoice?.discount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-600 font-semibold">
                  <span>Discount:</span>
                  <span className="font-mono">-{money(invoice.discount)}</span>
                </div>
              )}
              {invoice?.tax > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">GST Total:</span>
                  <span className="font-mono font-semibold">{money(invoice.tax)}</span>
                </div>
              )}
              {invoice?.roundOff !== 0 && invoice?.roundOff && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-500">
                  <span>Round Off:</span>
                  <span className="font-mono">{money(invoice.roundOff)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-extrabold text-slate-900">
                <span>Grand Total:</span>
                <span className="text-base text-indigo-600 font-mono">{money(invoice?.total)}</span>
              </div>
            </div>
          </div>

          {/* Footer & Signature */}
          <div className="flex flex-col sm:flex-row items-end justify-between gap-6 pt-6 border-t border-slate-200 text-xs">
            <div className="text-slate-500 text-[11px]">
              {billing?.footerText || 'Thank you for your business!'}
            </div>
            <div className="text-center sm:text-right space-y-1">
              <div className="h-10"></div>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-800 text-[11px]">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Thermal 3-inch slip */
        <div id="printable-thermal-receipt" className="bg-white text-black p-4 rounded-xl border border-slate-300 font-mono text-[11.5px] max-w-sm mx-auto shadow-sm">
          <div className="border-b border-dashed border-black pb-2 text-center">
            <div className="text-[13px] font-bold uppercase">{company.name}</div>
            {company.address && <div className="text-[10px]">{company.address}</div>}
            {company.gstin && <div className="text-[10px]">GSTIN: {company.gstin}</div>}
          </div>
          <div className="flex justify-between border-b border-dashed border-black py-1.5 text-[10px]">
            <div>
              <div>Bill: {invoice?.orderId}</div>
              <div>{fmtDateTime(invoice?.date)}</div>
            </div>
            <div className="text-right">
              <div>{invoice?.customerName || 'Walk-in'}</div>
              <div>Cashier: {invoice?.cashier || 'Admin'}</div>
            </div>
          </div>
          <table className="w-full py-1 text-[10.5px]">
            <thead>
              <tr className="border-b border-dashed border-black uppercase text-[9.5px]">
                <th className="py-1 text-left">Item</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Rate</th>
                <th className="py-1 text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {(invoice?.items || []).map((it, i) => (
                <tr key={i}>
                  <td className="py-0.5">{it.name}</td>
                  <td className="py-0.5 text-right">{it.qty}</td>
                  <td className="py-0.5 text-right">{Number(it.price || 0).toFixed(2)}</td>
                  <td className="py-0.5 text-right">{Number(it.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-dashed border-black pt-1.5 space-y-0.5 text-right">
            <div>Subtotal: {money(invoice?.subtotal || invoice?.total)}</div>
            {invoice?.discount > 0 && <div>Discount: -{money(invoice.discount)}</div>}
            {invoice?.tax > 0 && <div>GST: {money(invoice.tax)}</div>}
            <div className="text-[13px] font-bold border-t border-dashed border-black pt-1">
              TOTAL: {money(invoice?.total)}
            </div>
          </div>
          <div className="text-center text-[10px] mt-3 border-t border-dashed border-black pt-2">
            {billing?.footerText || 'Thank you, visit again!'}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Professional Printable Quotation / Estimate Modal */
function QuotationDocumentModal({ quotation, settings, tenant, onClose, onConvert, converting }) {
  if (!quotation) return null;
  const company = quotation?.company || settings?.company || { name: tenant?.name || 'Selsolve Store' };
  const billing = quotation?.billing || settings?.billing || {};
  const isConverted = quotation?.status === 'CONVERTED';

  // GST slabs
  const gstSlabs = {};
  (quotation?.items || []).forEach((item) => {
    const rate = Number(item?.taxRate) || 0;
    if (!rate) return;
    if (!gstSlabs[rate]) gstSlabs[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    const amt = Number(item?.total) || (Number(item?.qty || 1) * Number(item?.price || 0));
    gstSlabs[rate].taxable += amt;
    if (billing?.interState) {
      gstSlabs[rate].igst += (amt * rate) / 100;
    } else {
      gstSlabs[rate].cgst += (amt * (rate / 2)) / 100;
      gstSlabs[rate].sgst += (amt * (rate / 2)) / 100;
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Price Quotation — ${quotation?.quotationNo || ''}`}
      subtitle={`Created on ${fmtDateTime(quotation?.date)} · Valid Until ${fmtDate(quotation?.validUntil)}`}
      icon={FileCheck}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            {!isConverted && (
              <Button variant="primary" icon={CheckSquare} loading={converting} onClick={onConvert}>
                Convert to Tax Invoice
              </Button>
            )}
            {isConverted && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Billed as Tax Invoice #{quotation?.convertedOrderId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={onClose}>Close</Button>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Print Quotation
            </Button>
          </div>
        </div>
      }
    >
      <div id="printable-quotation" className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 font-sans shadow-xs space-y-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="text-2xl font-black tracking-tight text-slate-900">
              {company.name}
            </div>
            {company.address && <div className="text-xs text-slate-600 mt-1 max-w-sm">{company.address}</div>}
            <div className="text-xs text-slate-600 mt-0.5">
              {company.city} {company.state ? `· ${company.state}` : ''} {company.pincode ? `- ${company.pincode}` : ''}
            </div>
            {company.gstin && (
              <div className="text-xs font-semibold text-slate-800 mt-1">
                GSTIN: <span className="font-mono">{company.gstin}</span>
              </div>
            )}
            {company.phone && <div className="text-xs text-slate-600">Phone: {company.phone}</div>}
          </div>

          <div className="text-right sm:min-w-[200px]">
            <div className="inline-block px-3 py-1 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-extrabold uppercase tracking-wider rounded-lg">
              PRICE ESTIMATE / QUOTATION
            </div>
            <div className="text-lg font-mono font-bold text-slate-900 mt-2">
              {quotation?.quotationNo}
            </div>
            {isConverted && (
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wide mt-1">
                [ CONVERTED TO INVOICE #{quotation?.convertedOrderId} ]
              </div>
            )}
          </div>
        </div>

        {/* Meta & Bill To rows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs border-b border-slate-200 pb-6">
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">Quotation For:</span>
            <div className="text-sm font-bold text-slate-900">{quotation?.customerName || 'Walk-in Customer'}</div>
            {quotation?.customerPhone && quotation.customerPhone !== 'N/A' && (
              <div className="text-slate-600">Phone: {quotation.customerPhone}</div>
            )}
            {quotation?.customerGstin && (
              <div className="text-slate-700 font-semibold">GSTIN: {quotation.customerGstin}</div>
            )}
            {quotation?.customerAddress && (
              <div className="text-slate-600 mt-0.5">{quotation.customerAddress}</div>
            )}
          </div>

          <div className="space-y-1.5 sm:text-right">
            <div className="flex sm:justify-end gap-3">
              <span className="text-slate-500">Quotation Date:</span>
              <span className="font-bold font-mono">{fmtDate(quotation?.date)}</span>
            </div>
            <div className="flex sm:justify-end gap-3">
              <span className="text-slate-500">Valid Until:</span>
              <span className="font-bold font-mono text-amber-700">{fmtDate(quotation?.validUntil)}</span>
            </div>
            {quotation?.createdBy && (
              <div className="flex sm:justify-end gap-3">
                <span className="text-slate-500">Prepared By:</span>
                <span className="font-semibold">{quotation.createdBy}</span>
              </div>
            )}
          </div>
        </div>

        {/* Line items table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-50">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Item & Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 text-right">Tax (%)</th>
                <th className="py-2.5 px-3 text-right">Quoted Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(quotation?.items || []).map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{item.name}</div>
                    {item.barcode && <div className="text-[10px] text-slate-500 font-mono">Barcode: {item.barcode}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    {item.qty} {item.unit || ''}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{Number(item.price || 0).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">{item.taxRate ? `${item.taxRate}%` : '0%'}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {Number(item.total || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculations & Total */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <div className="space-y-3">
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Total in Words:</span>
              <div className="text-xs font-semibold text-slate-800 italic mt-0.5">
                {numberToWords(quotation?.total || 0)}
              </div>
            </div>

            {/* GST Slab Breakdown */}
            {Object.keys(gstSlabs).length > 0 && (
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-[11px] space-y-1.5">
                <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Estimated Tax Breakdown</div>
                {Object.entries(gstSlabs).map(([rate, vals]) => (
                  <div key={rate} className="flex justify-between text-slate-600 font-mono">
                    <span>GST @ {rate}% on {money(vals.taxable)}:</span>
                    <span className="font-bold">
                      {money(vals.igst || (vals.cgst + vals.sgst))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[11px] text-slate-600 space-y-1">
              {quotation?.notes && (
                <div>
                  <strong className="text-slate-700">Notes:</strong> {quotation.notes}
                </div>
              )}
              <div>
                <strong className="text-slate-700">Terms & Conditions:</strong>{' '}
                {quotation?.terms || 'Prices valid until specified validity date. Subject to stock availability.'}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-mono font-semibold">{money(quotation?.subtotal || quotation?.total)}</span>
            </div>
            {quotation?.discount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-600 font-semibold">
                <span>Estimated Discount:</span>
                <span className="font-mono">-{money(quotation.discount)}</span>
              </div>
            )}
            {quotation?.tax > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">GST Total:</span>
                <span className="font-mono font-semibold">{money(quotation.tax)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-extrabold text-slate-900">
              <span>Estimated Total:</span>
              <span className="text-base text-indigo-600 font-mono">{money(quotation?.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer & Signature */}
        <div className="flex flex-col sm:flex-row items-end justify-between gap-6 pt-6 border-t border-slate-200 text-xs">
          <div className="text-slate-500 text-[11px]">
            {billing?.footerText || 'This is a quotation / estimate only and not a tax invoice until confirmed.'}
          </div>
          <div className="text-center sm:text-right space-y-1">
            <div className="h-10"></div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-800 text-[11px]">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
