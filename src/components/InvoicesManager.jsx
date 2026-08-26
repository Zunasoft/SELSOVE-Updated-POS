import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
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
  Boxes,
  Truck,
  Package
} from 'lucide-react';

import api, { money, fmtDate, fmtDateTime, todayISO, monthStartISO } from '../lib/api';
import { Panel, SectionHeader, StatTile, Badge, Button, Spinner, EmptyState, DataTable, Modal, Field, Input, Select, Textarea } from '../lib/ui';
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
  const [mainTab, setMainTab] = useState('INVOICES'); // 'INVOICES' | 'DRAFTS' | 'QUOTATIONS'
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
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);
  const [issueModalInvoice, setIssueModalInvoice] = useState(null);

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

  // Quotation create/edit/delete never touch stock, accounts, or orders — refetching
  // all five resources after each of those (as fetchAllData does) was pure waste.
  const refreshQuotations = async () => {
    try {
      const quotationsRes = await api.get('/quotations', { limit: 1000 });
      setQuotations(quotationsRes || []);
    } catch (err) {
      showToast(api.message(err, 'Failed to refresh quotations.'), 'error');
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Separate regular Tax Invoices from Draft Invoices
  const taxInvoices = useMemo(() => (invoices || []).filter((i) => i.status !== 'DRAFT'), [invoices]);
  const draftInvoicesList = useMemo(() => (invoices || []).filter((i) => i.status === 'DRAFT'), [invoices]);

  // Filter calculations for Tax Invoices
  const filteredInvoices = useMemo(() => {
    const now = new Date();
                  const todayStr = todayISO();
                  const monthStart = monthStartISO();

                  return taxInvoices.filter((inv) => {
                    const isVoid = inv.status === 'VOID';
                    const tot = Number(inv.total || inv.grossTotal || 0);
                    const paid = Number(inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'PAID' || inv.paymentStatus === 'PAID' ? tot : 0));
                    const due = Number(inv.balanceDue !== undefined ? inv.balanceDue : (isVoid ? 0 : Math.max(0, tot - paid)));
                    const isPartiallyPaid = !isVoid && (inv.status === 'PARTIALLY_PAID' || inv.paymentStatus === 'PARTIALLY_PAID' || (paid > 0 && due > 0));
                    const isFullyUnpaid = !isVoid && !isPartiallyPaid && (inv.status === 'UNPAID' || inv.paymentStatus === 'UNPAID' || due >= tot);
                    const isPaid = !isVoid && !isPartiallyPaid && !isFullyUnpaid;

                    if (statusFilter === 'PAID' && !isPaid) return false;
                    if (statusFilter === 'PARTIAL' && !isPartiallyPaid) return false;
                    if (statusFilter === 'DUE' && !(isFullyUnpaid || isPartiallyPaid)) return false;
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
                }, [taxInvoices, statusFilter, dateFilter, search]);

  // Filter calculations for Drafts
  const filteredDrafts = useMemo(() => {
    return draftInvoicesList.filter((inv) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchId = String(inv.orderId || '').toLowerCase().includes(q);
        const matchCust = String(inv.customerName || '').toLowerCase().includes(q);
        const matchPhone = String(inv.customerPhone || '').includes(q);
        if (!matchId && !matchCust && !matchPhone) return false;
      }
      return true;
    });
  }, [draftInvoicesList, search]);

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

    taxInvoices.forEach((inv) => {
      if (inv.status === 'VOID') {
        voidCount++;
        return;
      }
      const tot = Number(inv.total || inv.grossTotal || 0);
      const paid = Number(inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'PAID' || inv.paymentStatus === 'PAID' ? tot : 0));
      const due = Number(inv.balanceDue !== undefined ? inv.balanceDue : Math.max(0, tot - paid));

      totalAmount += tot;
      totalPaid += paid;
      totalDue += due;
    });

    return {
      count: taxInvoices.filter((i) => i.status !== 'VOID').length,
      totalAmount,
      totalPaid,
      totalDue,
      voidCount
    };
  }, [taxInvoices]);

  // Draft Stats
  const draftStats = useMemo(() => {
    const totalVal = draftInvoicesList.reduce((s, d) => s + Number(d.total || 0), 0);
    return {
      count: draftInvoicesList.length,
      totalVal
    };
  }, [draftInvoicesList]);

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

  const handleDeleteDraft = async (draft) => {
    if (!window.confirm(`Delete Draft Invoice #${draft.orderId}?`)) return;
    try {
      await api.del(`/orders/${draft.orderId}`);
      showToast(`Draft Invoice #${draft.orderId} deleted.`, 'success');
      fetchAllData();
    } catch (err) {
      showToast(api.message(err, 'Failed to delete draft invoice.'), 'error');
    }
  };

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

  const handleDeleteInvoice = async (invoice) => {
    const isUnpaid = invoice.status === 'UNPAID' || invoice.paymentStatus === 'UNPAID' || invoice.status === 'DRAFT' || invoice.status === 'VOID';
    const confirmMsg = isUnpaid
      ? `Are you sure you want to DELETE Invoice #${invoice.orderId}? This will permanently remove the invoice and restore product inventory stock.`
      : `Are you sure you want to DELETE Invoice #${invoice.orderId}? This will restore inventory stock and reverse accounting entries.`;

    if (!window.confirm(confirmMsg)) return;
    try {
      await api.del(`/orders/${invoice.orderId}`);
      showToast(`Invoice #${invoice.orderId} deleted successfully.`, 'success');
      setSelectedInvoice(null);
      fetchAllData();
    } catch (err) {
      showToast(api.message(err, 'Failed to delete invoice.'), 'error');
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
      await api.del(`/quotations/${quotation.id}`);
      showToast(`Quotation ${quotation.quotationNo} deleted.`, 'success');
      refreshQuotations();
    } catch (err) {
      showToast(api.message(err, 'Failed to delete quotation.'), 'error');
    }
  };

  const exportInvoices = (format) => {
    const rows = filteredInvoices.map((inv) => {
      const tot = Number(inv.total || inv.grossTotal || 0);
      const paid = Number(inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'PAID' ? tot : 0));
      const due = Number(inv.balanceDue !== undefined ? inv.balanceDue : Math.max(0, tot - paid));
      return {
        'Invoice #': inv.orderId,
        Date: fmtDate(inv.date),
        'Customer Name': inv.customerName || 'Walk-in',
        Phone: inv.customerPhone || '—',
        'Payment Mode': inv.paymentMethod || 'Cash',
        Status: inv.status || 'COMPLETED',
        'Subtotal (₹)': inv.subtotal || inv.total,
        'Tax (₹)': inv.tax || 0,
        'Discount (₹)': inv.discount || 0,
        'Total (₹)': inv.total,
        'Paid Amount (₹)': paid,
        'Balance Due (₹)': due
      };
    });
    exportReport({
      title: 'Sales_Invoices_Register',
      filename: `Sales_Invoices_${todayISO()}`,
      format,
      columns: ['Invoice #', 'Date', 'Customer Name', 'Phone', 'Payment Mode', 'Status', 'Subtotal (₹)', 'Tax (₹)', 'Discount (₹)', 'Total (₹)', 'Paid Amount (₹)', 'Balance Due (₹)'],
      data: rows
    });
    showToast(`Exported ${rows.length} invoices to ${format.toUpperCase()}.`, 'success');
  };

  const exportQuotations = (format) => {
    const rows = filteredQuotations.map((qt) => ({
      'Quotation #': qt.quotationNo,
      Date: fmtDate(qt.date),
      'Valid Until': qt.validUntil ? fmtDate(qt.validUntil) : '—',
      'Customer Name': qt.customerName || 'Walk-in',
      Phone: qt.customerPhone || '—',
      Status: qt.status,
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

      {/* Main Tab Bar */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-[color:var(--bg-subtle)] border border-[color:var(--border)] w-fit">
        <button
          type="button"
          onClick={() => setMainTab('INVOICES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mainTab === 'INVOICES'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Tax Invoices</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            mainTab === 'INVOICES' ? 'bg-white/20 text-white' : 'bg-[color:var(--border)] text-[color:var(--text-secondary)]'
          }`}>
            {taxInvoices.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('DRAFTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mainTab === 'DRAFTS'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Draft Invoices</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            mainTab === 'DRAFTS' ? 'bg-white/20 text-white' : 'bg-[color:var(--border)] text-[color:var(--text-secondary)]'
          }`}>
            {draftInvoicesList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('QUOTATIONS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mainTab === 'QUOTATIONS'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Quotations &amp; Estimates</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            mainTab === 'QUOTATIONS' ? 'bg-white/20 text-white' : 'bg-[color:var(--border)] text-[color:var(--text-secondary)]'
          }`}>
            {(quotations || []).length}
          </span>
        </button>
      </div>

      {/* Main Tab Content */}
      {mainTab === 'INVOICES' && (
        <>
          {/* Invoices KPI Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Issued Invoices</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-[color:var(--text-primary)]">
                {invoiceStats.count}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Total Billed: <span className="font-semibold font-mono text-[color:var(--text-secondary)]">{money(invoiceStats.totalAmount, { decimals: false })}</span>
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Collected (Paid)</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {money(invoiceStats.totalPaid, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Fully / partially realized
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Balance Due</span>
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {money(invoiceStats.totalDue, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Pending collection
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
                  { key: 'PAID', label: 'Fully Paid' },
                  { key: 'PARTIAL', label: 'Partially Paid' },
                  { key: 'DUE', label: 'Unpaid / Due' },
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
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => {
                      setEditingInvoice(null);
                      setInvoiceModalOpen(true);
                    }}
                  >
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
                      <th className="py-3 px-4">Payment Mode</th>
                      <th className="py-3 px-4 text-center">Items</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                      <th className="py-3 px-4 text-center">Payment Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {filteredInvoices.map((inv) => {
                      const isVoid = inv.status === 'VOID';
                      const tot = Number(inv.total || inv.grossTotal || 0);
                      const paid = Number(inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'PAID' || inv.paymentStatus === 'PAID' ? tot : 0));
                      const due = Number(inv.balanceDue !== undefined ? inv.balanceDue : (isVoid ? 0 : Math.max(0, tot - paid)));
                      const isPartiallyPaid = !isVoid && (inv.status === 'PARTIALLY_PAID' || inv.paymentStatus === 'PARTIALLY_PAID' || (paid > 0 && due > 0));
                      const isFullyUnpaid = !isVoid && !isPartiallyPaid && (inv.status === 'UNPAID' || inv.paymentStatus === 'UNPAID' || due >= tot);

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
                            {inv.paymentRef && (
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono truncate max-w-[120px]" title={inv.paymentRef}>
                                Ref: {inv.paymentRef}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-semibold text-[color:var(--text-secondary)]">
                            {(inv.items || []).length}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="font-extrabold font-mono text-[13px] text-[color:var(--text-primary)]">
                              {money(tot)}
                            </div>
                            {isPartiallyPaid && (
                              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                Paid: {money(paid)} · Due: {money(due)}
                              </div>
                            )}
                            {isFullyUnpaid && (
                              <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                Due: {money(due)}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isVoid ? (
                              <Badge tone="danger">VOID</Badge>
                            ) : isPartiallyPaid ? (
                              <Badge tone="warning" className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300">
                                PARTIAL
                              </Badge>
                            ) : isFullyUnpaid ? (
                              <Badge tone="warning">UNPAID</Badge>
                            ) : (
                              <Badge tone="success">PAID</Badge>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {(isFullyUnpaid || isPartiallyPaid) && !isVoid && (
                                <Button
                                  size="xs"
                                  variant="primary"
                                  icon={CheckCircle2}
                                  onClick={() => setPaymentModalInvoice(inv)}
                                  title={isPartiallyPaid ? 'Record partial or full balance payment' : 'Record payment for invoice'}
                                >
                                  {isPartiallyPaid ? 'Add Payment' : 'Mark Paid'}
                                </Button>
                              )}
                              <Button
                                size="xs"
                                variant="outline"
                                icon={Eye}
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setViewMode('TAX_INVOICE');
                                }}
                              >
                                View
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
                                Print
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                icon={Trash2}
                                onClick={() => handleDeleteInvoice(inv)}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title={isFullyUnpaid ? 'Delete unpaid invoice & restore stock' : 'Delete invoice'}
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

      {mainTab === 'DRAFTS' && (
        <>
          {/* Drafts KPI Ribbon */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Draft Invoices</span>
                <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-[color:var(--text-primary)]">
                {draftStats.count} {draftStats.count === 1 ? 'draft' : 'drafts'}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Unissued commercial bills
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Draft Estimated Value</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {money(draftStats.totalVal, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Pending confirmation / stock hold
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)] flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Draft Invoicing</span>
                <div className="text-xs text-[color:var(--text-secondary)] mt-1">
                  Prepare invoices in advance before issuing.
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingInvoice(null);
                  setInvoiceModalOpen(true);
                }}
                className="mt-2 w-full justify-center"
              >
                Create New Draft
              </Button>
            </div>
          </div>

          {/* Drafts Table Panel */}
          <Panel className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <span className="text-xs font-bold text-[color:var(--text-secondary)]">
                Draft Invoices List ({filteredDrafts.length})
              </span>

              <div className="relative min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search Draft #, customer, phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="field-input text-xs"
                  style={{ paddingLeft: '2.1rem' }}
                />
              </div>
            </div>

            {loading ? (
              <Spinner label="Loading draft invoices…" />
            ) : filteredDrafts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Draft Invoices"
                hint="You don't have any saved draft invoices. Create a draft to prepare billing before finalizing."
                action={
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => {
                      setEditingInvoice(null);
                      setInvoiceModalOpen(true);
                    }}
                  >
                    Create Draft Invoice
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider text-[10.5px]">
                      <th className="py-3 px-4">Draft Date</th>
                      <th className="py-3 px-4">Draft #</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Payment Mode</th>
                      <th className="py-3 px-4 text-center">Items</th>
                      <th className="py-3 px-4 text-right">Draft Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-subtle)]">
                    {filteredDrafts.map((draft) => (
                      <tr key={draft.orderId} className="hover:bg-[color:var(--bg-subtle)]/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-[color:var(--text-primary)]">{fmtDate(draft.date)}</div>
                          <div className="text-[10px] text-[color:var(--text-muted)]">{draft.date ? String(draft.date).slice(11, 16) : ''}</div>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                          #{draft.orderId}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-[color:var(--text-primary)] truncate max-w-[160px]">
                            {draft.customerName || 'Walk-in Customer'}
                          </div>
                          {draft.customerPhone && draft.customerPhone !== 'N/A' && (
                            <div className="text-[10.5px] text-[color:var(--text-muted)]">{draft.customerPhone}</div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--text-secondary)]">
                            <CreditCard className="w-3 h-3 opacity-60" />
                            {draft.paymentMethod || 'Cash'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-semibold text-[color:var(--text-secondary)]">
                          {(draft.items || []).length}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="font-extrabold font-mono text-[13px] text-[color:var(--text-primary)]">
                            {money(draft.total)}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                            DRAFT
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="xs"
                              variant="primary"
                              icon={Receipt}
                              onClick={() => setIssueModalInvoice(draft)}
                              title="Issue this draft as an official tax invoice"
                            >
                              Issue Invoice
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              icon={Edit3}
                              onClick={() => {
                                setEditingInvoice(draft);
                                setInvoiceModalOpen(true);
                              }}
                              title="Edit draft invoice details"
                            >
                              Edit
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              icon={Trash2}
                              onClick={() => handleDeleteDraft(draft)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Delete draft invoice"
                            />
                          </div>
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

      {mainTab === 'QUOTATIONS' && (
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

      {/* Dedicated Tax Invoice & Thermal Receipt Modal */}
      {selectedInvoice && (
        <TaxInvoiceModal
          invoice={selectedInvoice}
          settings={settings}
          tenant={tenant}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onClose={() => setSelectedInvoice(null)}
          onVoid={() => handleVoidInvoice(selectedInvoice)}
          onDelete={() => handleDeleteInvoice(selectedInvoice)}
          onMarkPaid={(inv) => setPaymentModalInvoice(inv)}
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

      {/* Dedicated Tax Invoice Sheet / Creation & Draft Editing Modal */}
      {invoiceModalOpen && (
        <NewInvoiceModal
          invoice={editingInvoice}
          products={products}
          customers={customers}
          settings={settings}
          onClose={() => {
            setInvoiceModalOpen(false);
            setEditingInvoice(null);
          }}
          onSaved={(createdOrder, targetStatus) => {
            setInvoiceModalOpen(false);
            setEditingInvoice(null);
            fetchAllData();
            const invNum = createdOrder?.orderId || createdOrder?.data?.orderId || '';
            const msg = targetStatus === 'DRAFT'
              ? `Draft invoice ${invNum ? `#${invNum}` : ''} saved!`
              : targetStatus === 'UNPAID'
              ? `Invoice ${invNum ? `#${invNum}` : ''} issued (Unpaid)!`
              : `Invoice ${invNum ? `#${invNum}` : ''} issued & marked as Paid!`;
            showToast(msg, 'success');
            if (targetStatus === 'DRAFT') {
              setMainTab('DRAFTS');
            } else if (createdOrder) {
              setSelectedInvoice(createdOrder?.data || createdOrder);
              setViewMode('TAX_INVOICE');
            }
          }}
          showToast={showToast}
        />
      )}

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
        <PaymentConfirmModal
          invoice={paymentModalInvoice}
          onClose={() => setPaymentModalInvoice(null)}
          onPaid={(updatedOrder) => {
            setPaymentModalInvoice(null);
            fetchAllData();
            if (selectedInvoice?.orderId === updatedOrder?.orderId) {
              setSelectedInvoice(updatedOrder);
            }
          }}
          showToast={showToast}
        />
      )}

      {/* Issue Draft Modal */}
      {issueModalInvoice && (
        <IssueDraftModal
          draft={issueModalInvoice}
          onClose={() => setIssueModalInvoice(null)}
          onIssued={(issuedOrder) => {
            setIssueModalInvoice(null);
            fetchAllData();
            if (issuedOrder) {
              setSelectedInvoice(issuedOrder?.data || issuedOrder);
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
            refreshQuotations();
            showToast(editingQuotation ? 'Quotation updated successfully.' : 'Quotation created successfully.', 'success');
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/** Dedicated New Tax Invoice Creation & Draft Editing Modal / Sheet */
function NewInvoiceModal({ invoice = null, products = [], customers = [], settings, onClose, onSaved, showToast }) {
  const [loading, setLoading] = useState(false);
  const [activePickerIndex, setActivePickerIndex] = useState(null);

  // Customer fields
  const [selectedCustomerId, setSelectedCustomerId] = useState(invoice?.customerId || '');
  const [customerName, setCustomerName] = useState(invoice?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(invoice?.customerPhone && invoice?.customerPhone !== 'N/A' ? invoice.customerPhone : '');
  const [customerGstin, setCustomerGstin] = useState(invoice?.customerGstin || '');
  const [customerPan, setCustomerPan] = useState(invoice?.customerPan || '');
  const [customerAddress, setCustomerAddress] = useState(invoice?.customerAddress || '');
  const [customerState, setCustomerState] = useState(invoice?.customerState || '');
  const [customerStateCode, setCustomerStateCode] = useState(invoice?.customerStateCode || '');

  // Invoice specifics
  const [invoiceDate, setInvoiceDate] = useState(() => (invoice?.date ? String(invoice.date).slice(0, 10) : todayISO()));
  const [dueDate, setDueDate] = useState(() => (invoice?.dueDate ? String(invoice.dueDate).slice(0, 10) : ''));
  const [paymentType, setPaymentType] = useState(() => (
    invoice?.status === 'PARTIALLY_PAID' || (invoice?.paidAmount > 0 && invoice?.paidAmount < invoice?.total)
      ? 'PARTIAL'
      : invoice?.status === 'UNPAID' || invoice?.paymentStatus === 'UNPAID'
      ? 'UNPAID'
      : 'FULL'
  ));
  const [initialPaidAmount, setInitialPaidAmount] = useState(() => (invoice?.paidAmount !== undefined && invoice.paidAmount > 0 ? String(invoice.paidAmount) : ''));
  const [paymentMethod, setPaymentMethod] = useState(invoice?.paymentMethod || 'Cash');
  const [paymentRef, setPaymentRef] = useState(invoice?.paymentRef || '');
  const [notes, setNotes] = useState(invoice?.notes || '');
  const [isRoundOff, setIsRoundOff] = useState(() => {
    // Whether rounding was applied isn't stored as its own flag — infer it
    // from the saved total. If the un-rounded net (recomputed from the saved
    // items) still carries the exact same fractional total that was saved,
    // rounding must have been off; Math.round() would otherwise have landed
    // on a whole-rupee figure. Ambiguous cases (already whole, or no items)
    // fall back to the original default of on.
    if (!invoice?.items?.length) return true;
    const netBeforeRound = invoice.items.reduce((sum, i) => {
      const qty = Number(i.qty) || 0;
      const price = Number(i.price) || 0;
      const taxRate = Number(i.taxRate) || 0;
      const disc = Number(i.discount) || 0;
      return sum + qty * price + (qty * price * taxRate) / 100 - disc;
    }, 0);
    const net = Math.max(0, netBeforeRound);
    const savedTotal = Number(invoice.total) || 0;
    const matchesUnrounded = Math.abs(savedTotal - net) < 0.005;
    const matchesRounded = Math.abs(savedTotal - Math.round(net)) < 0.005;
    if (matchesUnrounded && !matchesRounded) return false;
    return true;
  });

  // Dispatch, place of supply & shipping
  const [placeOfSupply, setPlaceOfSupply] = useState(invoice?.placeOfSupply || '');
  const [vendorCode, setVendorCode] = useState(invoice?.vendorCode || '');
  const [dispatchFrom, setDispatchFrom] = useState(invoice?.dispatchFrom || '');
  const [dispatchDate, setDispatchDate] = useState(() => (invoice?.dispatchDate ? String(invoice.dispatchDate).slice(0, 10) : ''));
  const [shipToName, setShipToName] = useState(invoice?.shipToName || '');
  const [shipToAddress, setShipToAddress] = useState(invoice?.shipToAddress || '');
  const [vehicleNo, setVehicleNo] = useState(invoice?.vehicleNo || '');
  const [shipBy, setShipBy] = useState(invoice?.shipBy || '');
  const [transporterName, setTransporterName] = useState(invoice?.transporterName || '');

  // Buyer references & terms
  const [buyerRef, setBuyerRef] = useState(invoice?.buyerRef || '');
  const [buyerRefDate, setBuyerRefDate] = useState(() => (invoice?.buyerRefDate ? String(invoice.buyerRefDate).slice(0, 10) : ''));
  const [buyerOrderNo, setBuyerOrderNo] = useState(invoice?.buyerOrderNo || '');
  const [buyerOrderDate, setBuyerOrderDate] = useState(() => (invoice?.buyerOrderDate ? String(invoice.buyerOrderDate).slice(0, 10) : ''));
  const [dispatchDocNo, setDispatchDocNo] = useState(invoice?.dispatchDocNo || '');
  const [termsOfDelivery, setTermsOfDelivery] = useState(invoice?.termsOfDelivery || '');
  const [paymentTerms, setPaymentTerms] = useState(invoice?.paymentTerms || '');

  // Line items
  const [items, setItems] = useState(() => {
    if (invoice?.items?.length) {
      return invoice.items.map((i) => ({
        productId: i.productId || i.id || '',
        name: i.name || '',
        barcode: i.barcode || '',
        hsn: i.hsn || '',
        qty: Number(i.qty) || 1,
        unit: i.unit || 'pcs',
        price: i.price !== undefined ? i.price : '',
        taxRate: Number(i.taxRate) || 0,
        discount: Number(i.discount) || 0,
        total: Number(i.total) || 0,
        isCustom: !i.productId
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

  const isSoftMoney = ['UPI', 'Card', 'Net Banking', 'Bank Transfer', 'Cheque'].includes(paymentMethod);

  // Handle Customer Selection & Auto-fill
  const handleCustomerChange = (id) => {
    setSelectedCustomerId(id);
    if (!id) {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGstin('');
      setCustomerPan('');
      setCustomerAddress('');
      setCustomerState('');
      setCustomerStateCode('');
      return;
    }
    const cust = (customers || []).find((c) => c.id === id);
    if (cust) {
      setCustomerName(cust.name || '');
      setCustomerPhone(cust.phone || '');
      setCustomerGstin(cust.gstin || '');
      setCustomerPan(cust.pan || '');
      setCustomerAddress(cust.address || '');
      setCustomerState(cust.state || '');
      setCustomerStateCode(cust.stateCode || '');
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
        hsn: prod.hsn || '',
        unit: prod.unit || next[index]?.unit || 'pcs',
        price: prod.price !== undefined ? prod.price : '',
        taxRate,
        discount,
        total,
        isCustom: !!prod.isCustom
      };

      // Auto-create next product select option if this is the last line or no blank row exists below
      const hasEmptyRowBelow = next.some((r, i) => i > index && (!r.name || !r.name.trim()));
      if (!hasEmptyRowBelow) {
        next.push({
          productId: '',
          name: '',
          barcode: '',
          hsn: '',
          qty: 1,
          unit: 'pcs',
          price: '',
          taxRate: 0,
          discount: 0,
          total: 0,
          isCustom: false
        });
      }

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
        isCustom: true
      }
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Grand financial summary
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    items.forEach((item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const disc = Number(item.discount) || 0;

      const lineSub = qty * price;
      const lineTax = (lineSub * taxRate) / 100;

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

  const handleSaveWithStatus = async (targetStatus, customPaidAmount) => {
    const validItems = items.filter((i) => {
      if (!i.name || !i.name.trim()) return false;
      const qtyNum = Number(i.qty) || 0;
      const priceNum = Number(i.price) || 0;
      return qtyNum >= 0 && priceNum >= 0 && (qtyNum > 0 || priceNum > 0);
    });
    if (validItems.length === 0) {
      showToast('Please select or enter at least one item for the invoice.', 'error');
      return;
    }

    if (paymentMethod === 'Credit (Udhar)' && !customerName.trim()) {
      showToast('Customer name is required for credit / udhar sale.', 'error');
      return;
    }

    let finalPaid = 0;
    if (targetStatus === 'DRAFT' || targetStatus === 'UNPAID') {
      finalPaid = 0;
    } else if (targetStatus === 'PARTIALLY_PAID') {
      finalPaid = Math.min(totals.total, Math.max(0, Number(customPaidAmount !== undefined ? customPaidAmount : initialPaidAmount) || 0));
      if (finalPaid <= 0) {
        showToast('Please enter an initial payment amount greater than zero for partial payment.', 'error');
        return;
      }
    } else if (targetStatus === 'PAID') {
      finalPaid = totals.total;
    }

    // Soft money verification prompt
    if (finalPaid > 0 && isSoftMoney && !paymentRef.trim()) {
      const ok = window.confirm(`You are issuing this invoice via ${paymentMethod} without entering a Transaction Reference/UTR. Confirm that payment of ${money(finalPaid)} has been verified and received?`);
      if (!ok) return;
    }

    setLoading(true);
    try {
      const payload = {
        customerId: selectedCustomerId || null,
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || 'N/A',
        customerGstin: customerGstin.trim() || '',
        customerPan: customerPan.trim() || '',
        customerAddress: customerAddress.trim() || '',
        customerState: customerState.trim() || '',
        customerStateCode: customerStateCode.trim() || '',
        paymentMethod,
        paymentRef: paymentRef.trim() || '',
        status: targetStatus,
        paidAmount: finalPaid,
        date: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        placeOfSupply: placeOfSupply.trim() || '',
        vendorCode: vendorCode.trim() || '',
        dispatchFrom: dispatchFrom.trim() || '',
        dispatchDate: dispatchDate ? new Date(dispatchDate).toISOString() : null,
        shipToName: shipToName.trim() || '',
        shipToAddress: shipToAddress.trim() || '',
        vehicleNo: vehicleNo.trim() || '',
        shipBy: shipBy.trim() || '',
        transporterName: transporterName.trim() || '',
        buyerRef: buyerRef.trim() || '',
        buyerRefDate: buyerRefDate ? new Date(buyerRefDate).toISOString() : null,
        buyerOrderNo: buyerOrderNo.trim() || '',
        buyerOrderDate: buyerOrderDate ? new Date(buyerOrderDate).toISOString() : null,
        dispatchDocNo: dispatchDocNo.trim() || '',
        termsOfDelivery: termsOfDelivery.trim() || '',
        paymentTerms: paymentTerms.trim() || '',
        items: validItems.map((i) => ({
          id: i.productId || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          productId: i.productId || i.id,
          name: i.name,
          barcode: i.barcode || '',
          hsn: i.hsn || '',
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

      let res;
      if (invoice?.orderId && invoice?.status === 'DRAFT') {
        if (targetStatus === 'DRAFT') {
          res = await api.put(`/orders/${invoice.orderId}`, payload);
        } else {
          await api.put(`/orders/${invoice.orderId}`, payload);
          res = await api.post(`/orders/${invoice.orderId}/issue`, {
            status: targetStatus,
            paidAmount: finalPaid,
            paymentMethod,
            paymentRef: paymentRef.trim() || ''
          });
        }
      } else {
        res = await api.post('/orders', payload);
      }

      const created = res?.data || res;
      onSaved(created, targetStatus);
    } catch (err) {
      showToast(api.message(err, 'Failed to process invoice.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={invoice?.status === 'DRAFT' ? `Edit Draft Invoice #${invoice.orderId}` : 'Create Tax Invoice'}
        subtitle={invoice?.status === 'DRAFT' ? 'Update draft items and details, or issue as a finalized tax invoice.' : 'Generate a formal tax sales invoice with customer details, product items, GST taxes, and stock deduction.'}
        icon={Receipt}
        size="xl"
      >
        {/* No field in this form is a submit trigger — every save action (Draft /
            Issue Unpaid / Partial / Paid) is an explicit type="button" below, so
            an Enter keypress while typing in any input must not silently pick
            one of them (it used to always fire the "mark PAID" action). */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
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

              <Field label="PAN">
                <Input
                  value={customerPan}
                  onChange={(e) => setCustomerPan(e.target.value.toUpperCase())}
                  placeholder="Optional PAN"
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

              <Field label="Due Date">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </div>

            {/* Payment Method and Payment Status / Terms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Payment Method">
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="Cash">Cash (In Hand)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Net Banking">Net Banking / Bank Transfer</option>
                  <option value="Credit (Udhar)">Credit (Udhar)</option>
                  <option value="Cheque">Bank Cheque</option>
                </Select>
              </Field>

              <Field label="Payment Status / Terms">
                <Select
                  value={paymentType}
                  onChange={(e) => {
                    setPaymentType(e.target.value);
                    if (e.target.value === 'PARTIAL' && !initialPaidAmount) {
                      setInitialPaidAmount(String(Math.round(totals.total / 2)));
                    }
                  }}
                >
                  <option value="FULL">Full Payment (Paid in Full)</option>
                  <option value="PARTIAL">Partial Payment (Advance + Balance Due)</option>
                  <option value="UNPAID">Unpaid / Pay Later (Full Balance Due)</option>
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

            {/* Partial Payment Configuration Card */}
            {paymentType === 'PARTIAL' && (
              <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Partial / Advance Payment Setup
                  </span>
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    Grand Total: {money(totals.total)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <Field label="Amount Paid Now (₹) *">
                    <Input
                      type="number"
                      min="0.01"
                      max={totals.total}
                      step="0.01"
                      value={initialPaidAmount}
                      onChange={(e) => setInitialPaidAmount(e.target.value)}
                      placeholder="Enter advance/partial amount"
                      className="font-bold font-mono text-sm bg-white dark:bg-slate-900"
                    />
                  </Field>

                  <div className="rounded-xl p-3 bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                    <div className="flex justify-between text-[11px] text-[color:var(--text-secondary)]">
                      <span>Advance Paid Now:</span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{money(Number(initialPaidAmount) || 0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-amber-800 dark:text-amber-300 border-t border-amber-100 dark:border-amber-900/60 pt-1">
                      <span>Remaining Balance Due:</span>
                      <span className="font-mono">{money(Math.max(0, totals.total - (Number(initialPaidAmount) || 0)))}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isSoftMoney && (
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div>
                    <div className="font-bold text-xs text-indigo-900 dark:text-indigo-300">
                      Soft Money Mode: {paymentMethod}
                    </div>
                    <div className="text-[10.5px] text-indigo-700/80 dark:text-indigo-300/80">
                      Enter transaction reference / UTR code for digital verification before confirming payment.
                    </div>
                  </div>
                </div>
                <div className="min-w-[220px]">
                  <Input
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g. UTR / Ref / Auth #"
                    className="bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Customer State Name" hint="For GST place-of-supply on the invoice">
                <Input value={customerState} onChange={(e) => setCustomerState(e.target.value)} placeholder="e.g. Delhi" />
              </Field>
              <Field label="Customer State Code (2-digit GST code)" hint="e.g. 07 for Delhi, 27 for Maharashtra, 33 for Tamil Nadu">
                <Input value={customerStateCode} onChange={(e) => setCustomerStateCode(e.target.value)} placeholder="e.g. 07" maxLength={2} />
              </Field>
            </div>
          </div>

          {/* Optional Shipping, Dispatch & Transport Section */}
          <details className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/40 p-4 group">
            <summary className="text-xs font-bold text-[color:var(--text-secondary)] cursor-pointer select-none flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Transport, Dispatch & E-Way Bill Fields (Optional)</span>
              </span>
              <span className="text-[10.5px] font-normal text-[color:var(--text-muted)] group-open:hidden">Click to expand</span>
            </summary>
            <div className="mt-3 space-y-3 pt-3 border-t border-[color:var(--border)] text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Place of Supply">
                  <Input value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} placeholder="e.g. Maharashtra (27)" />
                </Field>
                <Field label="Dispatch From Address / Hub">
                  <Input value={dispatchFrom} onChange={(e) => setDispatchFrom(e.target.value)} placeholder="Warehouse / Branch location" />
                </Field>
                <Field label="Dispatch Date">
                  <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Ship-To Consignee Name" hint="If different from buyer">
                  <Input value={shipToName} onChange={(e) => setShipToName(e.target.value)} placeholder="Consignee / Site receiver" />
                </Field>
                <Field label="Ship-To Delivery Address" className="md:col-span-2">
                  <Input value={shipToAddress} onChange={(e) => setShipToAddress(e.target.value)} placeholder="Delivery destination address" />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Vehicle No.">
                  <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} placeholder="e.g. MH12AB1234" />
                </Field>
                <Field label="Ship By / Mode">
                  <Input value={shipBy} onChange={(e) => setShipBy(e.target.value)} placeholder="Road / Air / Courier" />
                </Field>
                <Field label="Transporter Name">
                  <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} placeholder="Logistics Partner" />
                </Field>
                <Field label="Dispatch Doc / LR No.">
                  <Input value={dispatchDocNo} onChange={(e) => setDispatchDocNo(e.target.value)} placeholder="e.g. LR-99882" />
                </Field>
              </div>
            </div>
          </details>

          {/* Optional Buyer References Section */}
          <details className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)]/40 p-4 group">
            <summary className="text-xs font-bold text-[color:var(--text-secondary)] cursor-pointer select-none flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Buyer References, PO Numbers & Terms (Optional)</span>
              </span>
              <span className="text-[10.5px] font-normal text-[color:var(--text-muted)] group-open:hidden">Click to expand</span>
            </summary>
            <div className="mt-3 space-y-3 pt-3 border-t border-[color:var(--border)] text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Buyer Order / PO No.">
                  <Input value={buyerOrderNo} onChange={(e) => setBuyerOrderNo(e.target.value)} placeholder="e.g. PO-2026-009" />
                </Field>
                <Field label="Buyer Order Date">
                  <Input type="date" value={buyerOrderDate} onChange={(e) => setBuyerOrderDate(e.target.value)} />
                </Field>
                <Field label="Buyer Reference / Enquiry No.">
                  <Input value={buyerRef} onChange={(e) => setBuyerRef(e.target.value)} placeholder="e.g. ENQ-445" />
                </Field>
                <Field label="Buyer Reference Date">
                  <Input type="date" value={buyerRefDate} onChange={(e) => setBuyerRefDate(e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Vendor Code (assigned by buyer)">
                  <Input value={vendorCode} onChange={(e) => setVendorCode(e.target.value)} placeholder="e.g. VEN-8812" />
                </Field>
                <Field label="Terms of Delivery">
                  <Input value={termsOfDelivery} onChange={(e) => setTermsOfDelivery(e.target.value)} placeholder="e.g. Door Delivery / FOB" />
                </Field>
                <Field label="Terms of Payment">
                  <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 30 Days Net" />
                </Field>
              </div>
            </div>
          </details>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--text-secondary)]">
                Line Items &amp; Products ({items.length})
              </span>
              <Button size="xs" variant="outline" icon={Plus} onClick={addItemRow}>
                Add Blank Row
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] text-[10.5px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Product / Service Description</th>
                    <th className="py-2.5 px-3 w-24">HSN/SAC</th>
                    <th className="py-2.5 px-3 w-24 text-right">Qty</th>
                    <th className="py-2.5 px-3 w-20">Unit</th>
                    <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 w-20 text-right">GST %</th>
                    <th className="py-2.5 px-3 w-24 text-right">Disc (₹)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-subtle)]">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[color:var(--bg-subtle)]/50">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>

                      <td className="py-2.5 px-3 min-w-[240px]">
                        <ProductItemCell
                          row={item}
                          index={idx}
                          onOpenPicker={(i) => setActivePickerIndex(i)}
                          onUpdateName={(i, name) => handleItemChange(i, 'name', name)}
                        />
                      </td>

                      <td className="py-2 px-3">
                        <Input
                          value={item.hsn}
                          onChange={(e) => handleItemChange(idx, 'hsn', e.target.value)}
                          placeholder="HSN"
                          className="text-xs font-mono"
                        />
                      </td>

                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="any"
                          value={item.qty}
                          onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                          className="text-right text-xs font-mono font-bold"
                        />
                      </td>

                      <td className="py-2 px-3">
                        <Input
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="text-xs"
                        />
                      </td>

                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="any"
                          value={item.price}
                          onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                          placeholder="0.00"
                          className="text-right text-xs font-mono font-bold"
                        />
                      </td>

                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="any"
                          value={item.taxRate}
                          onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                          className="text-right text-xs font-mono"
                        />
                      </td>

                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="any"
                          value={item.discount}
                          onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                          className="text-right text-xs font-mono"
                        />
                      </td>

                      <td className="py-2 px-3 text-right font-mono font-bold text-xs text-[color:var(--text-primary)]">
                        {money(item.total)}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length === 1}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors disabled:opacity-30"
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

          {/* Bottom Summary & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <Field label="Invoice Notes / Remarks">
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Remarks, terms, or bank payment reference notes shown on invoice…"
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

            <div className="p-4 rounded-2xl bg-[color:var(--bg-subtle)] border border-[color:var(--border)] space-y-2">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-[color:var(--text-secondary)]">
                  <span>Subtotal (Taxable):</span>
                  <span className="font-mono font-semibold text-[color:var(--text-primary)]">{money(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between py-1 border-b border-[color:var(--border)] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Total Discount:</span>
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
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[color:var(--border)]">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                loading={loading}
                icon={FileText}
                onClick={() => handleSaveWithStatus('DRAFT')}
              >
                {invoice?.status === 'DRAFT' ? 'Update Draft' : 'Save as Draft'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={loading}
                icon={Clock}
                onClick={() => handleSaveWithStatus('UNPAID')}
              >
                Issue as Unpaid
              </Button>
              {paymentType === 'PARTIAL' ? (
                <Button
                  type="button"
                  variant="primary"
                  loading={loading}
                  icon={CheckCircle2}
                  onClick={() => handleSaveWithStatus('PARTIALLY_PAID', Number(initialPaidAmount) || 0)}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Issue with Partial (₹{Number(initialPaidAmount) || 0})
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  loading={loading}
                  icon={CheckCircle2}
                  onClick={() => handleSaveWithStatus('PAID')}
                >
                  Issue &amp; Mark Paid
                </Button>
              )}
            </div>
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
        hsn: prod.hsn || '',
        unit: prod.unit || next[index]?.unit || 'pcs',
        price: prod.price !== undefined ? prod.price : '',
        taxRate,
        discount,
        total,
        isCustom: !!prod.isCustom
      };

      // Auto-create next product select option if this is the last line or no blank row exists below
      const hasEmptyRowBelow = next.some((r, i) => i > index && (!r.name || !r.name.trim()));
      if (!hasEmptyRowBelow) {
        next.push({
          productId: '',
          name: '',
          barcode: '',
          hsn: '',
          qty: 1,
          unit: 'pcs',
          price: '',
          taxRate: 0,
          discount: 0,
          total: 0,
          isCustom: false
        });
      }

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

    // A row needs at least one of qty/price to be positive (the other can be
    // left blank — qty defaults to 1, price to 0, below), but neither may be
    // negative: `Number(i.qty) > 0 || Number(i.price) > 0` alone let a negative
    // qty through whenever price was positive, and that negative value then
    // went straight into the payload instead of being rejected.
    const validItems = items.filter((i) => {
      if (!i.name || !i.name.trim()) return false;
      const qtyNum = Number(i.qty) || 0;
      const priceNum = Number(i.price) || 0;
      return qtyNum >= 0 && priceNum >= 0 && (qtyNum > 0 || priceNum > 0);
    });
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
          hsn: i.hsn || '',
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
                          required={Boolean(row.name?.trim())}
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
                          required={Boolean(row.name?.trim())}
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

/** Record Payment Modal for Unpaid / Partially Paid Invoices */
function PaymentConfirmModal({ invoice, onClose, onPaid, showToast }) {
  const [loading, setLoading] = useState(false);
  const total = Number(invoice?.total || 0);
  const currentPaid = Number(invoice?.paidAmount !== undefined ? invoice.paidAmount : (invoice?.status === 'PAID' ? total : 0));
  const currentDue = Number(invoice?.balanceDue !== undefined ? invoice.balanceDue : Math.max(0, total - currentPaid));

  const [paymentAmount, setPaymentAmount] = useState(String(currentDue > 0 ? currentDue : total));
  const [paymentMethod, setPaymentMethod] = useState(invoice?.paymentMethod && invoice.paymentMethod !== 'Credit (Udhar)' ? invoice.paymentMethod : 'Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');

  const numPay = Math.max(0, Math.min(currentDue, Number(paymentAmount) || 0));
  const remainingDueAfter = Math.max(0, Math.round((currentDue - numPay) * 100) / 100);
  const isSettleFull = remainingDueAfter === 0;

  const isSoftMoney = ['UPI', 'Card', 'Net Banking', 'Bank Transfer', 'Cheque'].includes(paymentMethod);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (numPay <= 0) {
      showToast('Please enter a payment amount greater than zero.', 'error');
      return;
    }
    if (isSoftMoney && !paymentRef.trim()) {
      const ok = window.confirm(`You have not entered a Transaction Reference/UTR for ${paymentMethod}. Confirm that the payment of ${money(numPay)} has been verified?`);
      if (!ok) return;
    }

    setLoading(true);
    try {
      const res = await api.post(`/orders/${invoice.orderId}/pay`, {
        amount: numPay,
        paymentMethod,
        paymentRef: paymentRef.trim(),
        notes: notes.trim()
      });
      showToast(res.message || `Payment of ${money(numPay)} recorded for Invoice #${invoice.orderId}!`, 'success');
      onPaid(res?.data || res);
    } catch (err) {
      showToast(api.message(err, 'Failed to record payment.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Record Payment — Invoice #${invoice?.orderId}`}
      subtitle={`Collect full or partial payment and update drawer & customer balance for ${invoice?.customerName || 'Customer'}.`}
      icon={CreditCard}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2">
          <div className="flex justify-between items-center text-amber-900 dark:text-amber-200">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold block text-amber-800 dark:text-amber-400">Total Invoice</span>
              <span className="text-xs font-semibold">{money(total)}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider font-bold block text-amber-800 dark:text-amber-400">Current Balance Due</span>
              <span className="text-xl font-mono font-extrabold text-amber-700 dark:text-amber-300">{money(currentDue)}</span>
            </div>
          </div>
          {currentPaid > 0 && (
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold border-t border-amber-200/60 dark:border-amber-800/60 pt-1.5 flex justify-between">
              <span>Previously Paid:</span>
              <span className="font-mono">{money(currentPaid)}</span>
            </div>
          )}
          <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
            Customer: <span className="font-semibold">{invoice?.customerName || 'Walk-in Customer'}</span> {invoice?.customerPhone && invoice.customerPhone !== 'N/A' ? `(${invoice.customerPhone})` : ''}
          </div>
        </div>

        <div className="space-y-1.5">
          <Field label="Payment Amount to Collect Now (₹) *">
            <Input
              type="number"
              min="0.01"
              max={currentDue}
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="text-base font-bold font-mono py-2 bg-white dark:bg-slate-900"
              required
              autoFocus
            />
          </Field>

          {/* Quick preset amount buttons */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setPaymentAmount(String(currentDue))}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[11px] font-bold hover:bg-indigo-100 transition-colors"
            >
              Full Due: {money(currentDue)}
            </button>
            {currentDue > 10 && (
              <button
                type="button"
                onClick={() => setPaymentAmount(String(Math.round(currentDue / 2)))}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-200 transition-colors"
              >
                50%: {money(Math.round(currentDue / 2))}
              </button>
            )}
            {[500, 1000, 2000].filter(amt => amt < currentDue).map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => setPaymentAmount(String(amt))}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-200 transition-colors"
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </div>

        {/* Live Status Preview */}
        <div className={`p-3 rounded-xl border text-xs space-y-1 ${
          isSettleFull
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
        }`}>
          <div className="flex justify-between font-semibold">
            <span>Resulting Invoice Status:</span>
            <span className="font-bold uppercase tracking-wider">
              {isSettleFull ? '✅ FULLY PAID' : '⚠️ PARTIALLY PAID'}
            </span>
          </div>
          {!isSettleFull && (
            <div className="flex justify-between text-[11px] border-t border-amber-200/60 dark:border-amber-800/60 pt-1">
              <span>Remaining Balance Due:</span>
              <span className="font-bold font-mono">{money(remainingDueAfter)}</span>
            </div>
          )}
        </div>

        <Field label="Payment Mode *">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
            <option value="Cash">Cash (In Hand / Session Drawer)</option>
            <option value="UPI">UPI / QR Payment</option>
            <option value="Card">Credit / Debit Card</option>
            <option value="Net Banking">Net Banking / Direct Transfer</option>
            <option value="Cheque">Bank Cheque</option>
          </Select>
        </Field>

        {isSoftMoney && (
          <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5">
            <div className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Soft Money Verification
            </div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
              Enter the bank/UPI reference or UTR number received for digital record keeping:
            </p>
            <Input
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. UPI Ref / UTR / Auth Code"
              className="bg-white dark:bg-slate-900"
            />
          </div>
        )}

        <Field label="Payment Remarks / Notes">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Installment / Advance payment received"
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[color:var(--border)]">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading} icon={CheckCircle2}>
            {isSettleFull ? `Confirm Full Payment (${money(numPay)})` : `Record Partial Payment (${money(numPay)})`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Issue Draft Modal */
function IssueDraftModal({ draft, onClose, onIssued, showToast }) {
  const [loading, setLoading] = useState(false);
  const [targetStatus, setTargetStatus] = useState('PAID');
  const [paymentMethod, setPaymentMethod] = useState(draft?.paymentMethod || 'Cash');
  const [paymentRef, setPaymentRef] = useState(draft?.paymentRef || '');

  const isSoftMoney = ['UPI', 'Card', 'Net Banking', 'Bank Transfer', 'Cheque'].includes(paymentMethod);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (targetStatus === 'PAID' && isSoftMoney && !paymentRef.trim()) {
      const ok = window.confirm(`You are marking this issued invoice as PAID via ${paymentMethod} without entering a Transaction Reference/UTR. Confirm that payment of ${money(draft.total)} is received?`);
      if (!ok) return;
    }

    setLoading(true);
    try {
      const res = await api.post(`/orders/${draft.orderId}/issue`, {
        status: targetStatus,
        paymentMethod,
        paymentRef: paymentRef.trim()
      });
      showToast(`Draft Invoice #${draft.orderId} issued successfully as ${targetStatus}!`, 'success');
      onIssued(res?.data || res);
    } catch (err) {
      showToast(api.message(err, 'Failed to issue draft invoice.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Issue Draft Invoice #${draft?.orderId}`}
      subtitle="Finalize this draft invoice, deduct product inventory stock, and post sales records."
      icon={Send}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 space-y-1.5">
          <div className="flex justify-between items-center text-sky-900 dark:text-sky-200">
            <span className="font-bold">Total Invoice Amount</span>
            <span className="text-lg font-mono font-extrabold text-sky-700 dark:text-sky-300">{money(draft?.total)}</span>
          </div>
          <div className="text-[11px] text-sky-700/80 dark:text-sky-300/80">
            Customer: <span className="font-semibold">{draft?.customerName || 'Walk-in Customer'}</span> · Items: <span className="font-semibold">{draft?.items?.length || 0}</span>
          </div>
        </div>

        <Field label="Issuance Status *">
          <Select value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)} required>
            <option value="PAID">Issue & Mark as PAID (Payment Received)</option>
            <option value="UNPAID">Issue as UNPAID (Payment Pending / Collect Later)</option>
          </Select>
        </Field>

        <Field label="Payment Mode">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Net Banking">Net Banking</option>
            <option value="Credit (Udhar)">Credit (Udhar)</option>
            <option value="Cheque">Cheque</option>
          </Select>
        </Field>

        {targetStatus === 'PAID' && isSoftMoney && (
          <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5">
            <div className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Soft Money Verification ({paymentMethod})
            </div>
            <Input
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. UTR / Ref Number"
              className="bg-white dark:bg-slate-900"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[color:var(--border)]">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading} icon={Send}>
            {targetStatus === 'PAID' ? 'Issue & Mark Paid' : 'Issue as Unpaid'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Standard Tax Invoice & Thermal Receipt Modal */
function TaxInvoiceModal({ invoice, settings, tenant, viewMode, setViewMode, onClose, onVoid, onMarkPaid, onDelete }) {
  const company = invoice?.company || settings?.company || { name: tenant?.name || 'Selsolve Store' };
  const billing = invoice?.billing || settings?.billing || {};
  const isVoid = invoice?.status === 'VOID';
  const isDraft = invoice?.status === 'DRAFT';
  const totalAmt = Number(invoice?.total || 0);
  const paidAmt = Number(invoice?.paidAmount !== undefined ? invoice.paidAmount : (invoice?.status === 'PAID' ? totalAmt : 0));
  const dueAmt = Number(invoice?.balanceDue !== undefined ? invoice.balanceDue : (isVoid ? 0 : Math.max(0, totalAmt - paidAmt)));
  const isPartiallyPaid = !isVoid && (invoice?.status === 'PARTIALLY_PAID' || invoice?.paymentStatus === 'PARTIALLY_PAID' || (paidAmt > 0 && dueAmt > 0));
  const isFullyUnpaid = !isVoid && !isPartiallyPaid && (invoice?.status === 'UNPAID' || invoice?.paymentStatus === 'UNPAID' || dueAmt >= totalAmt);

  // Client-side UPI payment QR — nothing is sent anywhere, it's just encoded locally.
  const [qrDataUrl, setQrDataUrl] = useState('');
  useEffect(() => {
    if (!billing?.upiId || !invoice) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    const amountToQr = dueAmt > 0 ? dueAmt : totalAmt;
    const upiString = `upi://pay?pa=${encodeURIComponent(billing.upiId)}&pn=${encodeURIComponent(company?.name || 'Merchant')}&am=${Number(amountToQr).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${invoice?.orderId || ''}`)}`;
    QRCode.toDataURL(upiString, { margin: 1, width: 160 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
  }, [billing?.upiId, company?.name, dueAmt, totalAmt, invoice?.orderId, invoice]);

  if (!invoice) return null;

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

  // HSN/SAC-wise tax summary — GST-invoice-standard breakdown, one row per HSN code
  const hsnSummary = {};
  (invoice?.items || []).forEach((item) => {
    const hsn = item.hsn || item.hsnCode || '—';
    const rate = Number(item?.taxRate) || 0;
    const amt = Number(item?.total) || (Number(item?.qty || 1) * Number(item?.price || 0));
    if (!hsnSummary[hsn]) hsnSummary[hsn] = { taxable: 0, rate, cgst: 0, sgst: 0, igst: 0 };
    hsnSummary[hsn].taxable += amt;
    if (billing?.interState) {
      hsnSummary[hsn].igst += (amt * rate) / 100;
    } else {
      hsnSummary[hsn].cgst += (amt * (rate / 2)) / 100;
      hsnSummary[hsn].sgst += (amt * (rate / 2)) / 100;
    }
  });
  const hsnRows = Object.entries(hsnSummary);
  const hsnTotals = hsnRows.reduce(
    (acc, [, v]) => ({
      taxable: acc.taxable + v.taxable,
      cgst: acc.cgst + v.cgst,
      sgst: acc.sgst + v.sgst,
      igst: acc.igst + v.igst
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
  );

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
            {onDelete && (
              <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>
                Delete Invoice
              </Button>
            )}
            {!isVoid && (
              <Button variant="outline" size="sm" onClick={onVoid}>
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
                Bill
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isVoid && (isFullyUnpaid || isPartiallyPaid) && onMarkPaid && (
              <Button
                variant="primary"
                size="sm"
                icon={CheckCircle2}
                onClick={() => {
                  onClose();
                  onMarkPaid(invoice);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPartiallyPaid ? 'Record Payment / Installment' : 'Record Payment'}
              </Button>
            )}
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
        <div id="printable-tax-invoice" className="bg-white text-slate-900 rounded-2xl border border-slate-200 font-sans shadow-xs overflow-hidden">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-6 sm:p-8 pb-6">
            <div className="flex items-start gap-3">
              {company.logoUrl && (
                <img src={company.logoUrl} alt={company.name} className="h-12 w-12 shrink-0 rounded-lg object-contain border border-slate-100" />
              )}
              <div>
                <div className="text-xl font-black tracking-tight text-slate-900">
                  {company.name}
                </div>
                {company.address && <div className="text-xs text-slate-600 mt-1 max-w-sm">{company.address}</div>}
                <div className="text-xs text-slate-600 mt-0.5">
                  {company.city} {company.state ? `· ${company.state}` : ''} {company.pincode ? `- ${company.pincode}` : ''}
                </div>
                {(company.state || company.stateCode) && (
                  <div className="text-xs text-slate-600">
                    State Name: {company.state || '—'}{company.stateCode ? `, Code: ${company.stateCode}` : ''}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-slate-800">
                  {company.gstin && <span className="font-semibold">GSTIN: <span className="font-mono">{company.gstin}</span></span>}
                  {company.pan && <span className="font-semibold">PAN: <span className="font-mono">{company.pan}</span></span>}
                  {company.cin && <span className="font-semibold">CIN No.: <span className="font-mono">{company.cin}</span></span>}
                  {company.lutBondNo && <span className="font-semibold">LUT Bond No.: <span className="font-mono">{company.lutBondNo}</span></span>}
                  {company.cstNo && <span className="font-semibold">CST: <span className="font-mono">{company.cstNo}</span></span>}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-slate-800">
                  {company.fssaiNo && <span className="font-semibold">FSSAI No.: <span className="font-mono">{company.fssaiNo}</span></span>}
                  {company.tan && <span className="font-semibold">TAN: <span className="font-mono">{company.tan}</span></span>}
                  {company.dlNo && <span className="font-semibold">D.L. No.: <span className="font-mono">{company.dlNo}</span></span>}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {[company.website, company.contactName && `Contact: ${company.contactName}`].filter(Boolean).join(' · ')}
                </div>
                <div className="text-[11px] text-slate-500">
                  {[company.phone, company.email].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>

            <div className="text-right sm:min-w-[200px] shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Original for Recipient</div>
              <div className="text-2xl font-black tracking-tight text-blue-900 mt-1">
                {billing.invoiceTitle || 'TAX INVOICE'}
              </div>
              <div className="text-sm font-mono font-bold text-blue-700 mt-1">
                #{invoice?.orderId}
              </div>
              {isVoid ? (
                <div className="text-xs font-extrabold text-rose-600 uppercase tracking-widest mt-1">
                  [ VOID / CANCELLED ]
                </div>
              ) : isDraft ? (
                <div className="text-xs font-extrabold text-sky-600 uppercase tracking-widest mt-1">
                  [ DRAFT INVOICE ]
                </div>
              ) : isPartiallyPaid ? (
                <div className="text-xs font-extrabold text-amber-600 uppercase tracking-widest mt-1">
                  [ PARTIALLY PAID ]
                </div>
              ) : isFullyUnpaid ? (
                <div className="text-xs font-extrabold text-rose-600 uppercase tracking-widest mt-1">
                  [ PAYMENT PENDING / UNPAID ]
                </div>
              ) : (
                <div className="text-xs font-extrabold text-emerald-600 uppercase tracking-widest mt-1">
                  [ PAID ]
                </div>
              )}
            </div>
          </div>

          {/* Amount banner + Bill To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-slate-200 text-xs">
            <div className="p-6 sm:p-8 sm:border-r border-slate-200 space-y-1">
              <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">Bill To</span>
              <div className="text-sm font-bold text-slate-900">{invoice?.customerName || 'Walk-in Customer'}</div>
              {invoice?.customerAddress && <div className="text-slate-600 max-w-xs">{invoice.customerAddress}</div>}
              {invoice?.customerPhone && invoice.customerPhone !== 'N/A' && (
                <div className="text-slate-600">Phone: {invoice.customerPhone}</div>
              )}
              {invoice?.customerGstin && (
                <div className="text-slate-700 font-semibold">GSTIN: {invoice.customerGstin}</div>
              )}
              {invoice?.customerPan && (
                <div className="text-slate-700 font-semibold">PAN: {invoice.customerPan}</div>
              )}
              {(invoice?.customerState || invoice?.customerStateCode) && (
                <div className="text-slate-600">
                  State Name: {invoice.customerState || '—'}{invoice.customerStateCode ? `, Code: ${invoice.customerStateCode}` : ''}
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <div className={`px-6 sm:px-8 py-3 flex items-center justify-between text-white ${
                isVoid ? 'bg-slate-400' : isDraft ? 'bg-sky-700' : isPartiallyPaid ? 'bg-amber-600' : isFullyUnpaid ? 'bg-rose-700' : 'bg-blue-900'
              }`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block">
                    {isDraft ? 'Draft Total' : isPartiallyPaid ? 'Partially Paid' : isFullyUnpaid ? 'Amount Due (Unpaid)' : 'Amount Paid'}
                  </span>
                  {isPartiallyPaid && (
                    <span className="text-[10px] opacity-90 block">
                      Paid: {money(paidAmt)} · Due: {money(dueAmt)}
                    </span>
                  )}
                </div>
                <span className="text-lg font-black font-mono">{money(invoice?.total)}</span>
              </div>
              <div className="p-6 sm:p-8 space-y-1.5">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Issue Date:</span>
                  <span className="font-bold font-mono">{fmtDate(invoice?.date)}</span>
                </div>
                {invoice?.dueDate && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Due Date:</span>
                    <span className="font-bold font-mono">{fmtDate(invoice.dueDate)}</span>
                  </div>
                )}
                {invoice?.paymentTerms && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Terms of Payment:</span>
                    <span className="font-bold">{invoice.paymentTerms}</span>
                  </div>
                )}
                {invoice?.buyerRef && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Buyer's Ref.:</span>
                    <span className="font-bold">
                      {invoice.buyerRef}{invoice.buyerRefDate ? ` dt. ${fmtDate(invoice.buyerRefDate)}` : ''}
                    </span>
                  </div>
                )}
                {invoice?.buyerOrderNo && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Buyer's Order No.:</span>
                    <span className="font-bold">
                      {invoice.buyerOrderNo}{invoice.buyerOrderDate ? ` dt. ${fmtDate(invoice.buyerOrderDate)}` : ''}
                    </span>
                  </div>
                )}
                {invoice?.dispatchDocNo && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Despatch Document No.:</span>
                    <span className="font-bold">{invoice.dispatchDocNo}</span>
                  </div>
                )}
                {invoice?.termsOfDelivery && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Terms of Delivery:</span>
                    <span className="font-bold">{invoice.termsOfDelivery}</span>
                  </div>
                )}
                {invoice?.dispatchFrom && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Dispatch From:</span>
                    <span className="font-bold">{invoice.dispatchFrom}</span>
                  </div>
                )}
                {invoice?.dispatchDate && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Dispatch Date:</span>
                    <span className="font-bold font-mono">{fmtDate(invoice.dispatchDate)}</span>
                  </div>
                )}
                {invoice?.placeOfSupply && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Place of Supply:</span>
                    <span className="font-bold">{invoice.placeOfSupply}</span>
                  </div>
                )}
                {invoice?.vendorCode && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Vendor Code:</span>
                    <span className="font-bold font-mono">{invoice.vendorCode}</span>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span className="font-bold">{invoice?.paymentMethod || 'Cash'}</span>
                </div>
                {billing?.showCashier !== false && invoice?.cashier && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Cashier:</span>
                    <span className="font-semibold">{invoice.cashier}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {(invoice?.shipToName || invoice?.shipToAddress || invoice?.vehicleNo || invoice?.shipBy || invoice?.transporterName) && (
            <div className="px-6 sm:px-8 py-4 border-t border-slate-200 text-xs space-y-1.5">
              <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">Ship To</span>
              {(invoice?.shipToName || invoice?.customerName) && (
                <div className="text-sm font-bold text-slate-900">{invoice.shipToName || invoice.customerName}</div>
              )}
              {invoice?.shipToAddress && <div className="text-slate-600 max-w-md">{invoice.shipToAddress}</div>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-blue-800 font-semibold">
                {invoice?.vehicleNo && <span>Vehicle No.: {invoice.vehicleNo}</span>}
                {invoice?.shipBy && <span>Ship by: {invoice.shipBy}</span>}
                {invoice?.transporterName && <span>Transporter: {invoice.transporterName}</span>}
              </div>
            </div>
          )}

          <div className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-6 border-t border-slate-200 pt-6">
            {/* Line items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-50">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3">HSN/SAC</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Price (₹)</th>
                    <th className="py-2.5 px-3 text-right">Taxable Value (₹)</th>
                    <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(invoice?.items || []).map((item, idx) => {
                    const qty = Number(item.qty) || 1;
                    const price = Number(item.price) || 0;
                    const taxRate = Number(item.taxRate) || 0;
                    const taxable = Math.round(qty * price * 100) / 100;
                    const tax = Math.round(((taxable * taxRate) / 100) * 100) / 100;
                    const total = Number(item.total) || Math.round((taxable + tax) * 100) / 100;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">{item.hsn || item.hsnCode || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{qty} {item.unit || 'pcs'}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{price.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{taxable.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {tax.toFixed(2)} {taxRate ? `(${taxRate}%)` : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {billing?.showGstBreakup !== false && Object.keys(gstSlabs).length > 0 && (
                  <tfoot>
                    {Object.entries(gstSlabs).map(([rate, vals]) => {
                      const taxAmt = vals.igst || (vals.cgst + vals.sgst);
                      return (
                        <tr key={rate} className="border-t border-slate-200 bg-slate-50/50 font-bold text-slate-700">
                          <td colSpan={5} className="py-2 px-3 text-right text-[11px] uppercase tracking-wider">Total @ {rate}%</td>
                          <td className="py-2 px-3 text-right font-mono">{Number(vals.taxable).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono">{Number(taxAmt).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono">{Number(vals.taxable + taxAmt).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tfoot>
                )}
              </table>
            </div>

            {/* Payment details & Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                {(billing?.bankAccountHolder || billing?.bankName || billing?.bankAccountNumber) && (
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-[11px] space-y-1">
                    <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Payment Details</div>
                    {billing.bankAccountHolder && (
                      <div><span className="text-slate-500">Account Holder Name:</span> <span className="font-semibold">{billing.bankAccountHolder}</span></div>
                    )}
                    {billing.bankName && (
                      <div><span className="text-slate-500">Bank Name:</span> <span className="font-semibold">{billing.bankName}</span></div>
                    )}
                    {billing.bankAccountNumber && (
                      <div><span className="text-slate-500">Account Number:</span> <span className="font-mono font-semibold">{billing.bankAccountNumber}</span></div>
                    )}
                    {billing.bankBranch && (
                      <div><span className="text-slate-500">Branch Name:</span> <span className="font-semibold">{billing.bankBranch}</span></div>
                    )}
                    {billing.bankIfsc && (
                      <div><span className="text-slate-500">IFSC Code:</span> <span className="font-mono font-semibold">{billing.bankIfsc}</span></div>
                    )}
                  </div>
                )}

                {billing?.upiId && (
                  <div className="flex items-center gap-3">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="Payment QR" className="h-24 w-24 rounded-lg border border-slate-200" />
                    ) : (
                      <div className="h-24 w-24 rounded-lg border border-slate-200 flex items-center justify-center text-slate-300">
                        <QrCode className="h-8 w-8" />
                      </div>
                    )}
                    <div className="text-[11px]">
                      <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Payment QR Code</div>
                      <div className="text-slate-600 mt-0.5">UPI ID: <span className="font-mono font-semibold">{billing.upiId}</span></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Total Taxable Value:</span>
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
                    <span className="text-slate-600">Total Tax Amount:</span>
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
                  <span>Total Invoice Value:</span>
                  <span className="text-base text-blue-800 font-mono">{money(invoice?.total)}</span>
                </div>
                {(paidAmt > 0 || dueAmt > 0) && !isDraft && (
                  <div className="space-y-1 pt-1 border-t border-slate-100 font-mono text-xs">
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Total Amount Paid:</span>
                      <span>{money(paidAmt)}</span>
                    </div>
                    {dueAmt > 0 && (
                      <div className="flex justify-between text-rose-700 font-bold">
                        <span>Balance Due:</span>
                        <span>{money(dueAmt)}</span>
                      </div>
                    )}
                  </div>
                )}
                {billing?.showWordsTotal !== false && (
                  <div className="pt-1.5 border-t border-slate-100">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount Chargeable (in words):</span>
                      <span className="text-[10px] italic text-slate-400 shrink-0">E. &amp; O.E</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-800 italic mt-0.5">
                      {numberToWords(invoice?.total || 0)}
                    </div>
                    {invoice?.tax > 0 && (
                      <>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1.5 block">Tax Amount (in words):</span>
                        <div className="text-[11px] font-semibold text-slate-800 italic mt-0.5">
                          {numberToWords(invoice.tax)}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Receipts / Installments History */}
            {invoice?.payments && invoice.payments.length > 0 && (
              <div className="space-y-1.5 pt-4 border-t border-slate-200">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Payment Receipts &amp; Installments History</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Total Paid: <strong className="font-mono text-slate-800">{money(paidAmt)}</strong>
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 text-[10px] uppercase">
                        <th className="py-1.5 px-3">Date &amp; Time</th>
                        <th className="py-1.5 px-3">Payment Mode</th>
                        <th className="py-1.5 px-3">Reference / UTR</th>
                        <th className="py-1.5 px-3">Remarks / Cashier</th>
                        <th className="py-1.5 px-3 text-right">Amount Paid (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoice.payments.map((p, idx) => (
                        <tr key={p.id || idx}>
                          <td className="py-1.5 px-3 whitespace-nowrap text-slate-600">{fmtDateTime(p.paidAt)}</td>
                          <td className="py-1.5 px-3 font-semibold text-slate-800">{p.paymentMethod || 'Cash'}</td>
                          <td className="py-1.5 px-3 font-mono text-slate-600">{p.paymentRef || '—'}</td>
                          <td className="py-1.5 px-3 text-slate-500">{p.notes || p.receivedBy || '—'}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-700">{money(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* HSN/SAC-wise Tax Summary — GST-invoice-standard breakdown table */}
            {billing?.showGstBreakup !== false && hsnRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-slate-200">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-50">
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200 align-bottom">HSN/SAC</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-slate-200 text-right align-bottom">Taxable Value (₹)</th>
                      {billing?.interState ? (
                        <th colSpan={2} className="py-2 px-3 border-r border-slate-200 text-center">Integrated Tax</th>
                      ) : (
                        <>
                          <th colSpan={2} className="py-2 px-3 border-r border-slate-200 text-center">Central Tax</th>
                          <th colSpan={2} className="py-2 px-3 border-r border-slate-200 text-center">State Tax</th>
                        </>
                      )}
                      <th rowSpan={2} className="py-2 px-3 text-right align-bottom">Total Tax Amount (₹)</th>
                    </tr>
                    <tr className="border-b-2 border-slate-300 text-[10px] font-bold text-slate-600 uppercase bg-slate-50">
                      {billing?.interState ? (
                        <>
                          <th className="py-1.5 px-3 border-r border-slate-200 text-right">Rate</th>
                          <th className="py-1.5 px-3 border-r border-slate-200 text-right">Amount (₹)</th>
                        </>
                      ) : (
                        <>
                          <th className="py-1.5 px-3 border-r border-slate-200 text-right">Rate</th>
                          <th className="py-1.5 px-3 border-r border-slate-200 text-right">Amount (₹)</th>
                          <th className="py-1.5 px-3 border-r border-slate-200 text-right">Rate</th>
                          <th className="py-1.5 px-3 border-r border-slate-200 text-right">Amount (₹)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {hsnRows.map(([hsn, v]) => (
                      <tr key={hsn}>
                        <td className="py-2 px-3 border-r border-slate-100 font-mono">{hsn}</td>
                        <td className="py-2 px-3 border-r border-slate-100 text-right font-mono">{v.taxable.toFixed(2)}</td>
                        {billing?.interState ? (
                          <>
                            <td className="py-2 px-3 border-r border-slate-100 text-right font-mono">{v.rate}%</td>
                            <td className="py-2 px-3 border-r border-slate-100 text-right font-mono">{v.igst.toFixed(2)}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 px-3 border-r border-slate-100 text-right font-mono">{(v.rate / 2)}%</td>
                            <td className="py-2 px-3 border-r border-slate-100 text-right font-mono">{v.cgst.toFixed(2)}</td>
                            <td className="py-2 px-3 border-r border-slate-100 text-right font-mono">{(v.rate / 2)}%</td>
                            <td className="py-2 px-3 border-r border-slate-100 text-right font-mono">{v.sgst.toFixed(2)}</td>
                          </>
                        )}
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {(v.igst || v.cgst + v.sgst).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-bold text-slate-900 bg-slate-50">
                      <td className="py-2 px-3 border-r border-slate-200">Total</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-mono">{hsnTotals.taxable.toFixed(2)}</td>
                      {billing?.interState ? (
                        <td colSpan={2} className="py-2 px-3 border-r border-slate-200 text-right font-mono">{hsnTotals.igst.toFixed(2)}</td>
                      ) : (
                        <>
                          <td colSpan={2} className="py-2 px-3 border-r border-slate-200 text-right font-mono">{hsnTotals.cgst.toFixed(2)}</td>
                          <td colSpan={2} className="py-2 px-3 border-r border-slate-200 text-right font-mono">{hsnTotals.sgst.toFixed(2)}</td>
                        </>
                      )}
                      <td className="py-2 px-3 text-right font-mono">
                        {(hsnTotals.igst || hsnTotals.cgst + hsnTotals.sgst).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Footer & Signature */}
            <div className="flex flex-col sm:flex-row items-end justify-between gap-6 pt-6 border-t border-slate-200">
              <div className="text-slate-600 text-[11px] max-w-md space-y-1.5">
                <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Terms & Conditions</div>
                {billing?.termsText ? (
                  <div className="whitespace-pre-line">{billing.termsText}</div>
                ) : (
                  <div className="text-slate-400">—</div>
                )}
                {billing?.footerText && <div className="mt-2 italic text-slate-500">{billing.footerText}</div>}
              </div>
              {billing?.showSignature !== false && (
                <div className="text-center sm:text-right space-y-1 shrink-0">
                  {company.name && (
                    <div className="text-[11px] font-semibold text-slate-700">for {company.name}</div>
                  )}
                  <div className="h-10"></div>
                  <div className="border-t border-slate-400 pt-1 font-bold text-slate-800 text-[11px]">
                    Authorised Signatory
                  </div>
                </div>
              )}
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-4">
              This is a Computer Generated Document
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
            {paidAmt > 0 && (
              <div className="text-[11px] text-black">PAID: {money(paidAmt)}</div>
            )}
            {dueAmt > 0 && (
              <div className="text-[11.5px] font-bold text-black border-t border-dashed border-black pt-0.5">
                BALANCE DUE: {money(dueAmt)}
              </div>
            )}
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
  const isConverted = quotation?.status === 'CONVERTED' || !!quotation?.convertedOrderId;

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
