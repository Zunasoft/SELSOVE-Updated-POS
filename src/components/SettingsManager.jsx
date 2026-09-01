import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Settings, Plus, Trash2, ShieldCheck, RotateCcw, Check, X as XIcon,
  Star, Award, Gift, Sparkles, Calculator, TrendingUp, HelpCircle,
  Printer, Receipt, LayoutTemplate, Palette, Sliders, CheckCircle2, Eye, Edit3,
  Copy, RefreshCw, FileText, CheckCircle, ChevronRight, ChevronLeft, Layers, Maximize2, Minimize2, Type
} from 'lucide-react';

import api from '../lib/api';
import {
  Panel, SectionHeader, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, StatTile, DataTable, cx
} from '../lib/ui';
import {
  ThermalReceiptView, THERMAL_THEMES, SAMPLE_RECEIPT_DATA, BILLING_THERMAL_THEME_IDS
} from './ThermalReceiptTemplates';
import {
  InvoiceDocumentView, INVOICE_THEMES, ACCENT_COLORS, SAMPLE_INVOICE_DATA
} from './InvoiceDocumentTemplates';
import { VisualTemplateBuilderModal } from './VisualTemplateBuilderModal';

const TABS = [
  { key: 'company', label: 'Company' },
  { key: 'billing', label: 'Billing & Tax' },
  { key: 'hardware', label: 'Hardware' },
  { key: 'users', label: 'Users & Roles' },
  { key: 'tables', label: 'Tables' }
];

/**
 * Store configuration in one place — company profile, billing/tax defaults,
 * connected hardware, staff access and dine-in tables. Each tab owns its own
 * data so switching tabs never re-fetches everything else.
 */
export default function SettingsManager({ tenant, token, showToast, onSettingsChange }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('company');

  const load = async () => {
    setLoading(true);
    try {
      setSettings(await api.get('/settings'));
    } catch (err) {
      showToast(api.message(err, 'Could not load settings.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Every section save goes through here so the parent app shell can refresh
  // (e.g. the header reads company name, checkout reads tax defaults).
  const saveSection = async (section, patch) => {
    const res = await api.put(`/settings/${section}`, patch);
    setSettings((s) => ({ ...s, [section]: res.data }));
    onSettingsChange?.();
    return res;
  };

  if (loading || !settings) return <Spinner label="Loading settings…" />;

  return (
    <div className="space-y-4">
      <SectionHeader eyebrow="Configuration" title="Settings" icon={Settings} subtitle="Company profile, billing, tax, hardware, staff access and tables." />

      <div
        className="inline-flex flex-wrap items-center gap-0.5 rounded-xl p-0.5"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              'rounded-[10px] px-3.5 py-1.5 text-[11px] font-bold transition-all',
              tab === t.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && <CompanyTab company={settings.company} saveSection={saveSection} showToast={showToast} />}
      {tab === 'billing' && (
        <BillingTaxTab
          company={settings.company}
          billing={settings.billing}
          tax={settings.tax}
          pos={settings.pos}
          loyalty={settings.loyalty}
          saveSection={saveSection}
          showToast={showToast}
        />
      )}
      {tab === 'hardware' && <HardwareTab showToast={showToast} />}
      {tab === 'users' && <UsersTab showToast={showToast} />}
      {tab === 'tables' && <TablesTab enableTables={settings.pos?.enableTables} showToast={showToast} />}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

function Toggle({ label, hint, checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 py-1.5 cursor-pointer select-none"
    >
      <span>
        <span className="block text-[12px] font-semibold text-[color:var(--text-primary)]">{label}</span>
        {hint && <span className="block text-[11px] text-[color:var(--text-muted)]">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        className={cx(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
          checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
        )}
      >
        <span
          className={cx(
            'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Company
 * ------------------------------------------------------------------ */

function CompanyTab({ company, saveSection, showToast }) {
  const [form, setForm] = useState(company || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(company || {});
  }, [company]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    setSaving(true);
    try {
      const res = await saveSection('company', form);
      showToast(res.message || 'Company details saved.');
    } catch (err) {
      showToast(api.message(err, 'Could not save company details.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company name">
          <Input value={form.name || ''} onChange={set('name')} />
        </Field>
        <Field label="Legal name">
          <Input value={form.legalName || ''} onChange={set('legalName')} />
        </Field>
        {/* GSTIN is always entered upper-case to match the format on the certificate. */}
        <Field label="GSTIN">
          <Input value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="State code">
          <Input value={form.stateCode || ''} onChange={set('stateCode')} />
        </Field>
        <Field label="PAN">
          <Input value={form.pan || ''} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea rows={2} value={form.address || ''} onChange={set('address')} />
        </Field>
        <Field label="City">
          <Input value={form.city || ''} onChange={set('city')} />
        </Field>
        <Field label="State">
          <Input value={form.state || ''} onChange={set('state')} />
        </Field>
        <Field label="Pincode">
          <Input value={form.pincode || ''} onChange={set('pincode')} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email || ''} onChange={set('email')} />
        </Field>
        <Field label="Website">
          <Input value={form.website || ''} onChange={set('website')} />
        </Field>
        <Field label="Logo URL">
          <Input value={form.logoUrl || ''} onChange={set('logoUrl')} />
        </Field>
        <Field label="Contact Name" hint="Person named on the invoice as point of contact">
          <Input value={form.contactName || ''} onChange={set('contactName')} />
        </Field>
      </div>

      <div className="border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="label-eyebrow mb-3">Statutory Registration Numbers (Optional)</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="CIN No.">
            <Input value={form.cin || ''} onChange={(e) => setForm({ ...form, cin: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="LUT Bond No.">
            <Input value={form.lutBondNo || ''} onChange={set('lutBondNo')} />
          </Field>
          <Field label="CST No.">
            <Input value={form.cstNo || ''} onChange={(e) => setForm({ ...form, cstNo: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="TAN">
            <Input value={form.tan || ''} onChange={(e) => setForm({ ...form, tan: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="FSSAI No.">
            <Input value={form.fssaiNo || ''} onChange={set('fssaiNo')} />
          </Field>
          <Field label="D.L. No." hint="Drug License Number">
            <Input value={form.dlNo || ''} onChange={set('dlNo')} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={save} loading={saving}>
          Save Company Details
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Billing & Tax
 * ------------------------------------------------------------------ */

function BillingTaxTab({ company, billing, tax, pos, loyalty, saveSection, showToast }) {
  const [bForm, setBForm] = useState(billing || {});
  const [tForm, setTForm] = useState(tax || {});
  const [iForm, setIForm] = useState({
    enableBatchTracking: Boolean(pos?.enableBatchTracking),
    nearExpiryDays: pos?.nearExpiryDays ?? 30
  });
  const [savingInventory, setSavingInventory] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editorThemeId, setEditorThemeId] = useState(billing?.activeThermalTemplate || 'detailed_gst');
  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);
  const [editorInvoiceThemeId, setEditorInvoiceThemeId] = useState(billing?.activeInvoiceTemplate || 'corporate_blue');
  const [showVisualBuilder, setShowVisualBuilder] = useState(false);
  const [visualBuilderTarget, setVisualBuilderTarget] = useState('thermal');
  const [savingBilling, setSavingBilling] = useState(false);
  const [savingTax, setSavingTax] = useState(false);

  const thermalScrollRef = useRef(null);
  const invoiceScrollRef = useRef(null);

  const scrollContainer = (ref, offset) => {
    if (ref.current) {
      ref.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    setBForm(billing || {});
  }, [billing]);
  useEffect(() => {
    setTForm(tax || {});
  }, [tax]);
  useEffect(() => {
    setIForm({
      enableBatchTracking: Boolean(pos?.enableBatchTracking),
      nearExpiryDays: pos?.nearExpiryDays ?? 30
    });
  }, [pos]);

  const saveBilling = async (customPatch = null) => {
    setSavingBilling(true);
    try {
      const payload = customPatch ? { ...bForm, ...customPatch } : bForm;
      const res = await saveSection('billing', payload);
      if (customPatch) setBForm(payload);
      showToast(res.message || 'Billing settings saved.');
      return true;
    } catch (err) {
      showToast(api.message(err, 'Could not save billing settings.'), 'error');
      return false;
    } finally {
      setSavingBilling(false);
    }
  };

  const saveTax = async () => {
    setSavingTax(true);
    try {
      const res = await saveSection('tax', tForm);
      showToast(res.message || 'Tax settings saved.');
    } catch (err) {
      showToast(api.message(err, 'Could not save tax settings.'), 'error');
    } finally {
      setSavingTax(false);
    }
  };

  const saveInventory = async () => {
    setSavingInventory(true);
    try {
      const res = await saveSection('pos', iForm);
      showToast(res.message || 'Inventory settings saved.');
    } catch (err) {
      showToast(api.message(err, 'Could not save inventory settings.'), 'error');
    } finally {
      setSavingInventory(false);
    }
  };

  const handleSetActiveTemplate = async (themeId) => {
    const theme = THERMAL_THEMES.find((t) => t.id === themeId);
    const custom = (bForm.customTemplates || []).find((t) => t.id === themeId);
    if (!theme && !custom) return;
    // Only the pointer changes here — a theme's own visual config
    // (showGstin, dividerStyle, sections, ...) must never be flattened onto
    // the shared billing settings, or picking this theme active would leak
    // its look into every other theme's rendering too.
    // Wait for the save to actually succeed before announcing it — showing
    // this toast unconditionally meant a failed save still told the user
    // their new default had been applied.
    const ok = await saveBilling({ activeThermalTemplate: themeId, customHtml: '' });
    if (ok) showToast(`Active bill template set to: ${theme ? theme.name : custom.name}`);
  };

  const openEditorWithTheme = (themeId) => {
    setEditorThemeId(themeId);
    setShowTemplateEditor(true);
  };

  const handleSetActiveInvoiceTemplate = async (themeId) => {
    const theme = INVOICE_THEMES.find((t) => t.id === themeId);
    const custom = (bForm.customTemplates || []).find((t) => t.id === themeId);
    if (!theme && !custom) return;
    const ok = await saveBilling({ activeInvoiceTemplate: themeId, customHtml: '' });
    if (ok) showToast(`Active invoice bill theme set to: ${theme ? theme.name : custom.name}`);
  };

  const openInvoiceEditorWithTheme = (themeId) => {
    setEditorInvoiceThemeId(themeId);
    setShowInvoiceEditor(true);
  };

  const [visualBuilderThemeId, setVisualBuilderThemeId] = useState(null);

  const openVisualBuilder = (target = 'thermal', themeId = null) => {
    setVisualBuilderTarget(target);
    setVisualBuilderThemeId(themeId);
    setShowVisualBuilder(true);
  };

  const loyaltyConfig = loyalty || pos || {};
  const isLoyaltyOn = loyaltyConfig.enableLoyalty !== false;
  const ptsPerSpend = loyaltyConfig.loyaltyPointsPerSpend ?? loyaltyConfig.loyaltyPointsPerHundred ?? 1;
  const spendAmount = loyaltyConfig.loyaltySpendAmount ?? 100;
  const pointPrice = Number(loyaltyConfig.loyaltyRedeemValue ?? 0.5);
  const activeTemplateId = BILLING_THERMAL_THEME_IDS.includes(bForm.activeThermalTemplate) ? bForm.activeThermalTemplate : 'detailed_gst';
  const activeInvoiceTemplateId = bForm.activeInvoiceTemplate || 'corporate_blue';

  const customThermalTemplates = (bForm.customTemplates || []).filter((t) => t.type === 'thermal');
  const customInvoiceTemplates = (bForm.customTemplates || []).filter((t) => t.type === 'invoice');

  // Billing only ever offers the 2 fixed thermal slots (detailed_gst /
  // normal_thermal) — see BILLING_THERMAL_THEME_IDS. Both stay editable in
  // place: a saved edit lands as a customTemplates[] entry with the same id
  // as the built-in, so it's merged onto that same card here rather than
  // appearing as a separate, deletable "custom" entry.
  const allThermalThemes = THERMAL_THEMES
    .filter((th) => BILLING_THERMAL_THEME_IDS.includes(th.id))
    .map((th) => {
      const custom = customThermalTemplates.find((ct) => ct.id === th.id);
      return custom ? { ...th, defaults: custom.config } : th;
    });

  const allInvoiceThemes = [
    ...INVOICE_THEMES.map((th) => {
      const custom = customInvoiceTemplates.find((ct) => ct.id === th.id);
      return custom ? { ...th, defaults: custom.config } : th;
    }),
    ...customInvoiceTemplates
      .filter((ct) => !INVOICE_THEMES.some((th) => th.id === ct.id))
      .map((ct) => ({
        id: ct.id,
        name: ct.name,
        badge: 'Custom Template',
        isCustom: true,
        tagline: `Custom Tax Invoice format based on ${ct.baseTheme || 'corporate_blue'}.`,
        description: `Created ${new Date(ct.createdAt || Date.now()).toLocaleDateString('en-IN')}. Custom column headers and statutory sections.`,
        defaults: ct.config
      }))
  ];

  const handleDeleteCustomTemplateFromGallery = async (id) => {
    const updated = (bForm.customTemplates || []).filter((t) => t.id !== id);
    const patch = { customTemplates: updated };
    if (bForm.activeThermalTemplate === id) {
      patch.activeThermalTemplate = 'detailed_gst';
    }
    if (bForm.activeInvoiceTemplate === id) {
      patch.activeInvoiceTemplate = 'corporate_blue';
    }
    const ok = await saveBilling(patch);
    if (ok) showToast('Custom template deleted.');
  };

  return (
    <div className="space-y-4">
      {/* 1. Billing Defaults Panel */}
      <Panel className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
          <div className="label-eyebrow">Billing & Currency</div>
          <span className="text-[11px] text-[color:var(--text-muted)]">General POS cash counter rules</span>
        </div>
        
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Currency symbol">
            <Input value={bForm.currency || ''} onChange={(e) => setBForm({ ...bForm, currency: e.target.value })} placeholder="₹" />
          </Field>
          <Field label="Max bill discount (%)">
            <Input type="number" min="0" max="100" value={bForm.maxDiscountPercent ?? ''} onChange={(e) => setBForm({ ...bForm, maxDiscountPercent: e.target.value })} placeholder="100" />
          </Field>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label="Round off grand total"
            hint="Automatically rounds decimal totals to the nearest integer rupee"
            checked={Boolean(bForm.roundOff)}
            onChange={(v) => setBForm({ ...bForm, roundOff: v })}
          />
          <Toggle
            label="Print receipt after checkout"
            hint="Triggers automatic print dialog when checkout is completed"
            checked={Boolean(bForm.printAfterCheckout)}
            onChange={(v) => setBForm({ ...bForm, printAfterCheckout: v })}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={() => saveBilling()} loading={savingBilling}>
            Save Billing Rules
          </Button>
        </div>
      </Panel>

      {/* 1b. Inventory / Batch Tracking Panel */}
      <Panel className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
          <div className="label-eyebrow">Inventory</div>
          <span className="text-[11px] text-[color:var(--text-muted)]">Batch/lot tracking for perishables & traceable stock</span>
        </div>

        <Toggle
          label="Enable Batch Tracking"
          hint="Lets individual products track stock by lot number, expiry date, and batch-wise cost. Turn this on first, then enable it per product from the product form."
          checked={Boolean(iForm.enableBatchTracking)}
          onChange={(v) => setIForm({ ...iForm, enableBatchTracking: v })}
        />

        {iForm.enableBatchTracking && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Near-Expiry Alert Window (days)" hint="Batches expiring within this many days show up on the Inventory dashboard">
              <Input
                type="number"
                min="1"
                value={iForm.nearExpiryDays ?? 30}
                onChange={(e) => setIForm({ ...iForm, nearExpiryDays: e.target.value })}
              />
            </Field>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={saveInventory} loading={savingInventory}>
            Save Inventory Settings
          </Button>
        </div>
      </Panel>

      {/* 2. POS Bill Templates Gallery Panel */}
      <Panel className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                POS Bill Templates ({allThermalThemes.length})
              </h3>
              <p className="text-[11px] text-[color:var(--text-muted)]">
                Scroll horizontally to browse formats · Select default or edit in visual builder
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allThermalThemes.length > 2 && (
              <div className="hidden sm:flex items-center gap-1 mr-1">
                <button
                  type="button"
                  onClick={() => scrollContainer(thermalScrollRef, -320)}
                  className="p-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] hover:bg-[color:var(--bg-surface)] text-[color:var(--text-secondary)] transition-all hover:scale-105"
                  title="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollContainer(thermalScrollRef, 320)}
                  className="p-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] hover:bg-[color:var(--bg-surface)] text-[color:var(--text-secondary)] transition-all hover:scale-105"
                  title="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <Button
              variant="secondary"
              icon={Type}
              onClick={() => openEditorWithTheme(activeTemplateId)}
              title="Quickly edit titles, column headers, terms, and custom banner text for bills"
            >
              Quick Text Edit
            </Button>
            <Button
              variant="primary"
              icon={Sliders}
              onClick={() => openVisualBuilder('thermal', activeTemplateId)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              title="Open modular visual layout builder with Word/PDF template support"
            >
              Visual Template Builder
            </Button>
          </div>
        </div>

        {/* Horizontal Marquee-like Scrollable Track */}
        <div
          ref={thermalScrollRef}
          className="flex gap-3 overflow-x-auto pb-2 pt-1 scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: 'thin' }}
        >
          {allThermalThemes.map((theme) => {
            const isActive = activeTemplateId === theme.id;
            return (
              <div
                key={theme.id}
                className={cx(
                  'min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-2xl border p-3.5 flex flex-col justify-between transition-all',
                  isActive
                    ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 ring-1 ring-indigo-600 shadow-sm'
                    : 'border-[color:var(--border)] bg-[color:var(--bg-subtle)] hover:border-slate-400'
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-black text-[color:var(--text-primary)] truncate">
                      {theme.name}
                    </span>
                    <span
                      className={cx(
                        'text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 ml-1.5',
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : (theme.isCustom ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300')
                      )}
                    >
                      {isActive ? 'Active Default' : theme.badge}
                    </span>
                  </div>

                  <p className="text-[11px] font-medium text-[color:var(--text-secondary)] leading-snug mb-1 line-clamp-2">
                    {theme.tagline}
                  </p>
                  <p className="text-[10px] text-[color:var(--text-muted)] leading-normal line-clamp-2">
                    {theme.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-[color:var(--border-subtle)] gap-2">
                  {isActive ? (
                    <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active Default
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetActiveTemplate(theme.id)}
                    >
                      Set as Default
                    </Button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={isActive ? 'primary' : 'ghost'}
                      icon={Edit3}
                      onClick={() => openVisualBuilder('thermal', theme.id)}
                    >
                      Edit
                    </Button>
                    {theme.isCustom && (
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => handleDeleteCustomTemplateFromGallery(theme.id)}
                        title="Delete custom template"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* 3. A4 / A5 Tax Invoice Bill Themes Gallery Panel */}
      <Panel className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                Tax Invoice Templates (A4 / A5) ({allInvoiceThemes.length})
              </h3>
              <p className="text-[11px] text-[color:var(--text-muted)]">
                Scroll horizontally to browse full-sheet statutory invoice formats and custom designs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allInvoiceThemes.length > 2 && (
              <div className="hidden sm:flex items-center gap-1 mr-1">
                <button
                  type="button"
                  onClick={() => scrollContainer(invoiceScrollRef, -320)}
                  className="p-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] hover:bg-[color:var(--bg-surface)] text-[color:var(--text-secondary)] transition-all hover:scale-105"
                  title="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollContainer(invoiceScrollRef, 320)}
                  className="p-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] hover:bg-[color:var(--bg-surface)] text-[color:var(--text-secondary)] transition-all hover:scale-105"
                  title="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <Button
              variant="secondary"
              icon={Type}
              onClick={() => openInvoiceEditorWithTheme(activeInvoiceTemplateId)}
              title="Quickly edit statutory invoice titles, column headers, terms, and words label"
            >
              Quick Text Edit
            </Button>
            <Button
              variant="primary"
              icon={Sliders}
              onClick={() => openVisualBuilder('invoice', activeInvoiceTemplateId)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              title="Open modular visual layout builder with Word/PDF template support"
            >
              Visual Template Builder
            </Button>
          </div>
        </div>

        {/* Horizontal Marquee-like Scrollable Track */}
        <div
          ref={invoiceScrollRef}
          className="flex gap-3 overflow-x-auto pb-2 pt-1 scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: 'thin' }}
        >
          {allInvoiceThemes.map((theme) => {
            const isActive = activeInvoiceTemplateId === theme.id;
            return (
              <div
                key={theme.id}
                className={cx(
                  'min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-2xl border p-3.5 flex flex-col justify-between transition-all',
                  isActive
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-600 shadow-sm'
                    : 'border-[color:var(--border)] bg-[color:var(--bg-subtle)] hover:border-slate-400'
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-black text-[color:var(--text-primary)] truncate">
                      {theme.name}
                    </span>
                    <span
                      className={cx(
                        'text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 ml-1.5',
                        isActive
                          ? 'bg-blue-600 text-white'
                          : (theme.isCustom ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300')
                      )}
                    >
                      {isActive ? 'Active Default' : theme.badge}
                    </span>
                  </div>

                  <p className="text-[11px] font-medium text-[color:var(--text-secondary)] leading-snug mb-1 line-clamp-2">
                    {theme.tagline}
                  </p>
                  <p className="text-[10px] text-[color:var(--text-muted)] leading-normal line-clamp-2">
                    {theme.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-[color:var(--border-subtle)] gap-2">
                  {isActive ? (
                    <span className="text-[10.5px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active Default
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetActiveInvoiceTemplate(theme.id)}
                    >
                      Set as Default
                    </Button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={isActive ? 'primary' : 'ghost'}
                      icon={Edit3}
                      onClick={() => openVisualBuilder('invoice', theme.id)}
                    >
                      Edit
                    </Button>
                    {theme.isCustom && (
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => handleDeleteCustomTemplateFromGallery(theme.id)}
                        title="Delete custom template"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* 4. Customer Loyalty & Rewards Program Panel Card with Modal Trigger */}
      <Panel className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <div className="label-eyebrow">Customer Loyalty & Rewards Program</div>
          </div>
          <Badge tone={isLoyaltyOn ? 'success' : 'neutral'}>
            {isLoyaltyOn ? 'Active' : 'Disabled'}
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <div className="text-[12.5px] font-bold text-[color:var(--text-primary)]">
              {isLoyaltyOn ? 'Loyalty Points System is Enabled' : 'Loyalty Points System is Disabled'}
            </div>
            <div className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
              {isLoyaltyOn ? (
                <>
                  Earn <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">+{ptsPerSpend} pts per ₹{spendAmount}</strong> spend · Redeem at <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">₹{pointPrice.toFixed(2)} / pt</strong>
                </>
              ) : (
                'Configure custom points earning formulas and redemption price rules in popup.'
              )}
            </div>
          </div>

          <Button
            variant="primary"
            icon={Star}
            onClick={() => setShowLoyaltyModal(true)}
          >
            Configure Loyalty Points
          </Button>
        </div>
      </Panel>

      {/* 4. Invoice Section (in rows) */}
      <Panel className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
          <div className="label-eyebrow">Invoice Section</div>
          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">Format & Sequence</span>
        </div>

        {/* Row 1: Numbering & Series */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Invoice prefix" hint="e.g. INV- or BILL-">
            <Input value={bForm.invoicePrefix || ''} onChange={(e) => setBForm({ ...bForm, invoicePrefix: e.target.value })} placeholder="INV-" />
          </Field>
          <Field label="Next invoice no." hint="Auto-incremented on bill generation">
            <Input type="number" value={bForm.nextInvoiceNo ?? ''} onChange={(e) => setBForm({ ...bForm, nextInvoiceNo: e.target.value })} placeholder="1" />
          </Field>
          <Field label="Invoice headline title" hint="Printed on top of tax invoice">
            <Input value={bForm.invoiceTitle || ''} onChange={(e) => setBForm({ ...bForm, invoiceTitle: e.target.value })} placeholder="TAX INVOICE" />
          </Field>
        </div>

        {/* Row 2: Terms & Notes */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Terms & Conditions (Footer note)" hint="Printed at bottom of invoices">
            <Textarea rows={3} value={bForm.termsText || ''} onChange={(e) => setBForm({ ...bForm, termsText: e.target.value })} placeholder="1. Goods once sold will not be taken back. 2. Subject to local jurisdiction." />
          </Field>
          <Field label="Customer Greeting / Receipt Footer" hint="Thank you note for customer">
            <Textarea rows={3} value={bForm.footerText || ''} onChange={(e) => setBForm({ ...bForm, footerText: e.target.value })} placeholder="Thank you for your business! Visit again." />
          </Field>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={() => saveBilling()} loading={savingBilling}>
            Save Invoice & Billing Settings
          </Button>
        </div>
      </Panel>

      {/* 5. Bank & Payment Details Panel */}
      <Panel className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
          <div className="label-eyebrow">Bank & Payment Details</div>
          <span className="text-[11px] text-[color:var(--text-muted)]">Printed on tax invoices for customer payment</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Account Holder Name">
            <Input value={bForm.bankAccountHolder || ''} onChange={(e) => setBForm({ ...bForm, bankAccountHolder: e.target.value })} />
          </Field>
          <Field label="Bank Name">
            <Input value={bForm.bankName || ''} onChange={(e) => setBForm({ ...bForm, bankName: e.target.value })} />
          </Field>
          <Field label="Account Number">
            <Input value={bForm.bankAccountNumber || ''} onChange={(e) => setBForm({ ...bForm, bankAccountNumber: e.target.value })} />
          </Field>
          <Field label="IFSC Code">
            <Input value={bForm.bankIfsc || ''} onChange={(e) => setBForm({ ...bForm, bankIfsc: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Branch Name">
            <Input value={bForm.bankBranch || ''} onChange={(e) => setBForm({ ...bForm, bankBranch: e.target.value })} />
          </Field>
          <Field label="UPI ID" hint="Used to generate the payment QR code on invoices">
            <Input value={bForm.upiId || ''} onChange={(e) => setBForm({ ...bForm, upiId: e.target.value })} placeholder="e.g. yourstore@okbank" />
          </Field>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={() => saveBilling()} loading={savingBilling}>
            Save Bank & Payment Details
          </Button>
        </div>
      </Panel>

      {/* 6. Tax Settings Panel */}
      <Panel className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
          <div className="label-eyebrow">Tax & GST Configuration</div>
          <span className="text-[11px] text-[color:var(--text-muted)]">GST slabs and calculation rules</span>
        </div>

        <Toggle label="Enable GST" checked={Boolean(tForm.enableGst)} onChange={(v) => setTForm({ ...tForm, enableGst: v })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tax mode">
            <Select value={tForm.taxMode || 'EXCLUSIVE'} onChange={(e) => setTForm({ ...tForm, taxMode: e.target.value })}>
              <option value="EXCLUSIVE">Exclusive (Tax added on top of price)</option>
              <option value="INCLUSIVE">Inclusive (Price includes tax)</option>
            </Select>
          </Field>
          <Field label="Default tax rate (%)">
            <Input type="number" value={tForm.defaultTaxRate ?? ''} onChange={(e) => setTForm({ ...tForm, defaultTaxRate: e.target.value })} placeholder="18" />
          </Field>
          <Field label="GST scheme">
            <Select value={tForm.gstScheme || 'REGULAR'} onChange={(e) => setTForm({ ...tForm, gstScheme: e.target.value })}>
              <option value="REGULAR">Regular GST</option>
              <option value="COMPOSITION">Composition Scheme</option>
            </Select>
          </Field>
        </div>
        <Toggle
          label="Inter-state billing"
          hint="Switches new invoices from CGST + SGST to IGST"
          checked={Boolean(tForm.interState)}
          onChange={(v) => setTForm({ ...tForm, interState: v })}
        />
        <div className="flex justify-end">
          <Button variant="primary" onClick={saveTax} loading={savingTax}>
            Save Tax Settings
          </Button>
        </div>
      </Panel>

      {/* Loyalty Points Configuration Modal */}
      <LoyaltyModal
        open={showLoyaltyModal}
        onClose={() => setShowLoyaltyModal(false)}
        pos={pos}
        loyalty={loyalty}
        saveSection={saveSection}
        showToast={showToast}
      />

      {/* Thermal Bill & POS Slip Template Visual Editor Modal */}
      <BillTemplateEditorModal
        open={showTemplateEditor}
        onClose={() => setShowTemplateEditor(false)}
        billing={bForm}
        company={company}
        saveSection={saveSection}
        showToast={showToast}
        initialThemeId={editorThemeId}
      />

      {/* A4 / A5 Tax Invoice Bill Template Visual Editor Modal */}
      <InvoiceTemplateEditorModal
        open={showInvoiceEditor}
        onClose={() => setShowInvoiceEditor(false)}
        billing={bForm}
        company={company}
        saveSection={saveSection}
        showToast={showToast}
        initialThemeId={editorInvoiceThemeId}
      />

      {/* Visual Template Builder & Editor Modal */}
      <VisualTemplateBuilderModal
        open={showVisualBuilder}
        onClose={() => setShowVisualBuilder(false)}
        billing={bForm}
        company={company}
        saveSection={saveSection}
        showToast={showToast}
        initialTarget={visualBuilderTarget}
        initialThemeId={visualBuilderThemeId}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bill Template Quick Editor Modal
 * ------------------------------------------------------------------ */

function BillTemplateEditorModal({
  open,
  onClose,
  billing,
  company,
  saveSection,
  showToast,
  initialThemeId
}) {
  // A theme's editable config comes ONLY from that theme's own defaults plus
  // its own saved override (customTemplates[] entry keyed by the theme's own
  // id) — never from the raw `billing` object, which is shared across every
  // theme and would otherwise leak one theme's edits into every other's
  // rendering the moment this editor is opened or saved.
  const buildThermalConfig = (billingObj, themeId) => {
    const customList = billingObj?.customTemplates || [];
    const custom = customList.find((t) => t.id === themeId && t.type === 'thermal');
    const baseId = custom ? (custom.baseTheme || themeId) : themeId;
    const themeMeta = THERMAL_THEMES.find((t) => t.id === baseId) || THERMAL_THEMES[0];
    const override = custom?.config || {};
    return {
      ...themeMeta.defaults,
      ...override,
      customLabels: { ...themeMeta.defaults.customLabels, ...(override.customLabels || {}) }
    };
  };

  const [selectedTheme, setSelectedTheme] = useState(
    initialThemeId || billing?.activeThermalTemplate || 'detailed_gst'
  );
  const [form, setForm] = useState(() => buildThermalConfig(billing, selectedTheme));
  const [activeSubTab, setActiveSubTab] = useState('toggles');
  const [previewZoom, setPreviewZoom] = useState(100);
  const [saving, setSaving] = useState(false);
  const [showFullscreenView, setShowFullscreenView] = useState(false);

  useEffect(() => {
    if (!open) return;
    const active = initialThemeId || billing?.activeThermalTemplate || 'detailed_gst';
    setSelectedTheme(active);
    setForm(buildThermalConfig(billing, active));
  }, [open, billing, initialThemeId]);

  const handleSelectTheme = (themeId) => {
    setSelectedTheme(themeId);
    const theme = THERMAL_THEMES.find((t) => t.id === themeId);
    const custom = (billing?.customTemplates || []).find((t) => t.id === themeId);
    if (theme) {
      setForm((prev) => ({
        ...prev,
        ...theme.defaults,
        activeThermalTemplate: themeId,
        customLabels: { ...theme.defaults.customLabels, ...(prev.customLabels || {}) }
      }));
    } else if (custom) {
      setForm((prev) => ({
        ...prev,
        ...(custom.config || {}),
        activeThermalTemplate: themeId,
        customLabels: { ...(custom.config?.customLabels || {}), ...(prev.customLabels || {}) }
      }));
    }
  };

  const handleResetDefaults = () => {
    const theme = THERMAL_THEMES.find((t) => t.id === selectedTheme);
    const custom = (billing?.customTemplates || []).find((t) => t.id === selectedTheme);
    if (theme) {
      setForm((prev) => ({
        ...prev,
        ...theme.defaults,
        activeThermalTemplate: selectedTheme,
        customLabels: { ...theme.defaults.customLabels }
      }));
      showToast(`Reset to ${theme.name} default layout`);
    } else if (custom) {
      setForm((prev) => ({
        ...prev,
        ...(custom.config || {}),
        activeThermalTemplate: selectedTheme,
        customLabels: { ...(custom.config?.customLabels || {}) }
      }));
      showToast(`Reset to ${custom.name} default layout`);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const themeMeta = THERMAL_THEMES.find((t) => t.id === selectedTheme);
      const existing = (billing?.customTemplates || []).find((t) => t.id === selectedTheme && t.type === 'thermal');
      const upserted = {
        id: selectedTheme,
        name: existing?.name || themeMeta?.name || selectedTheme,
        type: 'thermal',
        baseTheme: selectedTheme,
        config: form,
        createdAt: existing?.createdAt || new Date().toISOString()
      };
      const updated = [
        ...(billing?.customTemplates || []).filter((t) => !(t.id === selectedTheme && t.type === 'thermal')),
        upserted
      ];
      const payload = { activeThermalTemplate: selectedTheme, customTemplates: updated };
      const res = await saveSection('billing', payload);
      showToast(res.message || 'Bill template saved successfully!');
      onClose();
    } catch (err) {
      showToast(api.message(err, 'Could not save bill template.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const currentTheme = THERMAL_THEMES.find((t) => t.id === selectedTheme) || THERMAL_THEMES[0];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="POS Bill Template Editor"
        subtitle="Customize header details, column headers, terms, greetings, font sizes & test in real-time"
        icon={Printer}
        size="fullscreen"
        allowFullscreen={true}
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" icon={RefreshCw} onClick={handleResetDefaults}>
              Reset Theme Defaults
            </Button>
            <div className="flex items-center gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" icon={Check} onClick={save} loading={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Save &amp; Apply Template
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Top Control Bar: Theme Switcher Pills & Sub-Tabs */}
          <div className="rounded-2xl border border-[color:var(--border)] p-3 bg-[color:var(--bg-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">
                Select Base Theme
              </div>
              <div className="flex flex-wrap gap-1.5">
                {THERMAL_THEMES.filter((theme) => BILLING_THERMAL_THEME_IDS.includes(theme.id)).map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleSelectTheme(theme.id)}
                    className={cx(
                      'px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-all flex items-center gap-1.5',
                      selectedTheme === theme.id
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30'
                        : 'bg-[color:var(--bg-surface)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] border border-[color:var(--border)]'
                    )}
                  >
                    <span>{theme.name}</span>
                    <span className="text-[9px] opacity-80 px-1 py-0.2 rounded bg-black/10">
                      {theme.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Tabs Selector */}
            <div className="flex items-center p-1 rounded-xl bg-[color:var(--bg-surface)] border border-[color:var(--border)] font-bold text-xs shrink-0">
              <button
                type="button"
                onClick={() => setActiveSubTab('toggles')}
                className={cx(
                  'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                  activeSubTab === 'toggles'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>1. Layout Toggles</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('text')}
                className={cx(
                  'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                  activeSubTab === 'text'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                )}
              >
                <Type className="w-3.5 h-3.5" />
                <span>2. Edit All Text &amp; Labels</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('styling')}
                className={cx(
                  'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                  activeSubTab === 'styling'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                )}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>3. Paper &amp; Font</span>
              </button>
            </div>
          </div>

          {/* 2-Column Split: Left Controls, Right Live Preview */}
          <div className="grid gap-4 lg:grid-cols-12 items-start">
            {/* Left Column: Controls (6 Cols) */}
            <div className="lg:col-span-6 space-y-3.5 max-h-[calc(98vh-230px)] overflow-y-auto pr-1">
              {/* TAB 1: LAYOUT TOGGLES */}
              {activeSubTab === 'toggles' && (
                <div className="space-y-3">
                  {/* 1. Header & Store Info */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2.5 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>1. Store &amp; Header Details</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Branding</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show GSTIN prominently"
                        hint="Prints store GSTIN in bold on receipt header"
                        checked={Boolean(form.showGstin !== false)}
                        onChange={(v) => setForm({ ...form, showGstin: v })}
                      />
                      <Toggle
                        label="Show FSSAI License Number"
                        hint="Displays Food Safety License number"
                        checked={Boolean(form.showFssai !== false)}
                        onChange={(v) => setForm({ ...form, showFssai: v })}
                      />
                      <Toggle
                        label="Show Store Address"
                        hint="Prints street address, city, state, and pincode"
                        checked={Boolean(form.showStoreAddress !== false)}
                        onChange={(v) => setForm({ ...form, showStoreAddress: v })}
                      />
                      <Toggle
                        label="Show Phone / Tel"
                        hint="Prints telephone / mobile numbers"
                        checked={Boolean(form.showStorePhone !== false)}
                        onChange={(v) => setForm({ ...form, showStorePhone: v })}
                      />
                      <Toggle
                        label="Show Email Address"
                        hint="Prints billing/support email"
                        checked={Boolean(form.showStoreEmail)}
                        onChange={(v) => setForm({ ...form, showStoreEmail: v })}
                      />
                      <Toggle
                        label="Show Store Logo"
                        hint="Prints store image logo (if configured)"
                        checked={Boolean(form.showLogo)}
                        onChange={(v) => setForm({ ...form, showLogo: v })}
                      />
                    </div>
                  </div>

                  {/* 2. Customer & Cashier Info */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2.5 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>2. Customer &amp; Cashier Meta</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Operator &amp; Tax</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show Customer Name &amp; Phone"
                        hint="Includes buyer name and mobile number on receipt"
                        checked={Boolean(form.showCustomerDetails !== false)}
                        onChange={(v) => setForm({ ...form, showCustomerDetails: v })}
                      />
                      <Toggle
                        label="Show Customer GSTIN"
                        hint="Crucial for B2B tax invoice credit claims"
                        checked={Boolean(form.showCustomerGstin !== false)}
                        onChange={(v) => setForm({ ...form, showCustomerGstin: v })}
                      />
                      <Toggle
                        label="Show Customer Address"
                        hint="Prints customer billing address if recorded"
                        checked={Boolean(form.showCustomerAddress)}
                        onChange={(v) => setForm({ ...form, showCustomerAddress: v })}
                      />
                    </div>
                  </div>

                  {/* 3. Items & Table Columns */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2.5 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>3. Item Columns &amp; Details</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Table Columns</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show HSN / SAC Code column"
                        hint="Displays statutory HSN codes in the item table"
                        checked={Boolean(form.showHsn !== false)}
                        onChange={(v) => setForm({ ...form, showHsn: v })}
                      />
                      <Toggle
                        label="Show Item Tax Rate (%) column"
                        hint="Displays GST rate (e.g. 5%, 12%, 18%) per line item"
                        checked={Boolean(form.showItemTaxRate !== false)}
                        onChange={(v) => setForm({ ...form, showItemTaxRate: v })}
                      />
                      <Toggle
                        label="Show Item Discounts"
                        hint="Prints item-level discount amounts under product name"
                        checked={Boolean(form.showItemDiscount !== false)}
                        onChange={(v) => setForm({ ...form, showItemDiscount: v })}
                      />
                    </div>
                  </div>

                  {/* 4. GST Breakdown, Savings & Payment */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2.5 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>4. Taxes, Savings &amp; Payments</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Breakup &amp; Badges</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show Full GST Breakdown Table"
                        hint="Prints Taxable, CGST, SGST, IGST summary slab table"
                        checked={Boolean(form.showGstBreakup !== false)}
                        onChange={(v) => setForm({ ...form, showGstBreakup: v })}
                      />
                      <Toggle
                        label="Show Savings Highlight Banner"
                        hint="Displays '🎉 YOU SAVED ₹XX ON THIS BILL!' banner"
                        checked={Boolean(form.showSavings !== false)}
                        onChange={(v) => setForm({ ...form, showSavings: v })}
                      />
                      <Toggle
                        label="Show Total Amount in Words"
                        hint="Prints amount in words (e.g. One Thousand Rupees Only)"
                        checked={Boolean(form.showWordsTotal)}
                        onChange={(v) => setForm({ ...form, showWordsTotal: v })}
                      />
                      <Toggle
                        label="Show Payment Mode Breakdown"
                        hint="Displays payment method (Cash, Card, UPI, Advance, Split)"
                        checked={Boolean(form.showPaymentBreakup !== false)}
                        onChange={(v) => setForm({ ...form, showPaymentBreakup: v })}
                      />
                    </div>
                  </div>

                  {/* 5. Loyalty & Accounts */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2.5 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>5. Loyalty &amp; Store Credit</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Customer Rewards</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show Loyalty Points Summary"
                        hint="Prints points earned on sale and updated balance"
                        checked={Boolean(form.showLoyaltySummary !== false)}
                        onChange={(v) => setForm({ ...form, showLoyaltySummary: v })}
                      />
                      <Toggle
                        label="Show Advance / Store Credit Balance"
                        hint="Displays remaining customer advance balance"
                        checked={Boolean(form.showAdvanceSummary !== false)}
                        onChange={(v) => setForm({ ...form, showAdvanceSummary: v })}
                      />
                    </div>
                  </div>

                  {/* 6. QR Code, Barcode & Footers */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2.5 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>6. QR Code, Barcode &amp; Footers</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Digital &amp; Legal</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show QR Code"
                        hint="Prints scannable QR code on bottom of receipt"
                        checked={Boolean(form.showQrCode !== false)}
                        onChange={(v) => setForm({ ...form, showQrCode: v })}
                      />
                      {form.showQrCode !== false && (
                        <Field label="QR Code Payload">
                          <Select
                            value={form.qrCodeType || 'upi'}
                            onChange={(e) => setForm({ ...form, qrCodeType: e.target.value })}
                          >
                            <option value="upi">UPI Payment Intent (Scan to Pay)</option>
                            <option value="invoice">Invoice Verification</option>
                          </Select>
                        </Field>
                      )}
                      <Toggle
                        label="Show Invoice Barcode"
                        hint="Prints barcode of order ID for scanning"
                        checked={Boolean(form.showBarcode !== false)}
                        onChange={(v) => setForm({ ...form, showBarcode: v })}
                      />
                      <Toggle
                        label="Show Terms &amp; Conditions"
                        hint="Prints return policy / terms text"
                        checked={Boolean(form.showTerms !== false)}
                        onChange={(v) => setForm({ ...form, showTerms: v })}
                      />
                      <Toggle
                        label="Show Customer Greeting Note"
                        hint="Prints 'Thank you, visit again!' footer"
                        checked={Boolean(form.showFooterNote !== false)}
                        onChange={(v) => setForm({ ...form, showFooterNote: v })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EDIT ALL CONTENT & TEXT */}
              {activeSubTab === 'text' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-indigo-500/30 p-3.5 space-y-3 bg-indigo-50/20 dark:bg-indigo-950/20">
                    <div className="text-[11.5px] font-bold text-indigo-900 dark:text-indigo-300 border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>Bill Title &amp; Banner</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Headlines</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Bill Main Title">
                        <Input
                          value={form.customLabels?.receiptTitle || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), receiptTitle: e.target.value }
                          })}
                          placeholder="TAX INVOICE / POS BILL"
                        />
                      </Field>
                      <Field label="Festive / Announcement Banner">
                        <Input
                          value={form.customBannerText || ''}
                          onChange={(e) => setForm({ ...form, customBannerText: e.target.value })}
                          placeholder="e.g. ⭐ FESTIVE SALE: 10% OFF ON NEXT VISIT ⭐"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>Table Column Headings</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Receipt Table</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Field label="Item Column">
                        <Input
                          value={form.customLabels?.itemHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), itemHeader: e.target.value }
                          })}
                          placeholder="Item"
                        />
                      </Field>
                      <Field label="HSN Column">
                        <Input
                          value={form.customLabels?.hsnHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), hsnHeader: e.target.value }
                          })}
                          placeholder="HSN"
                        />
                      </Field>
                      <Field label="Qty Column">
                        <Input
                          value={form.customLabels?.qtyHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), qtyHeader: e.target.value }
                          })}
                          placeholder="Qty"
                        />
                      </Field>
                      <Field label="Rate Column">
                        <Input
                          value={form.customLabels?.rateHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), rateHeader: e.target.value }
                          })}
                          placeholder="Rate"
                        />
                      </Field>
                      <Field label="Tax % Column">
                        <Input
                          value={form.customLabels?.taxHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), taxHeader: e.target.value }
                          })}
                          placeholder="GST%"
                        />
                      </Field>
                      <Field label="Total Amount Column">
                        <Input
                          value={form.customLabels?.totalHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), totalHeader: e.target.value }
                          })}
                          placeholder="Amount"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>Totals &amp; Summary Labels</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Calculations</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Subtotal Label">
                        <Input
                          value={form.customLabels?.subtotalLabel || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), subtotalLabel: e.target.value }
                          })}
                          placeholder="Subtotal:"
                        />
                      </Field>
                      <Field label="Total GST Label">
                        <Input
                          value={form.customLabels?.taxLabel || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), taxLabel: e.target.value }
                          })}
                          placeholder="Total GST:"
                        />
                      </Field>
                      <Field label="Savings Label">
                        <Input
                          value={form.customLabels?.savingsLabel || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), savingsLabel: e.target.value }
                          })}
                          placeholder="Total Savings:"
                        />
                      </Field>
                      <Field label="Grand Total Label">
                        <Input
                          value={form.customLabels?.totalLabel || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), totalLabel: e.target.value }
                          })}
                          placeholder="GRAND TOTAL:"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>Terms, Greetings &amp; Footer</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Customer Notes</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Terms Title">
                        <Input
                          value={form.customLabels?.termsTitle || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), termsTitle: e.target.value }
                          })}
                          placeholder="Terms & Conditions"
                        />
                      </Field>
                      <Field label="Customer Greeting Text">
                        <Input
                          value={form.customLabels?.greetingText || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), greetingText: e.target.value }
                          })}
                          placeholder="Thank you for shopping with us!"
                        />
                      </Field>
                    </div>
                    <Field label="Terms &amp; Conditions Text">
                      <Textarea
                        rows={2}
                        value={form.termsText || ''}
                        onChange={(e) => setForm({ ...form, termsText: e.target.value })}
                        placeholder="1. Goods once sold will not be taken back. 2. Subject to local jurisdiction."
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* TAB 3: STYLING & PAPER */}
              {activeSubTab === 'styling' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>Paper Dimensions &amp; Typography</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Roll Settings</span>
                    </div>

                    <div className="space-y-3">
                      <Field label="Paper Roll Width">
                        <Select
                          value={form.paperWidth || '80mm'}
                          onChange={(e) => setForm({ ...form, paperWidth: e.target.value })}
                        >
                          <option value="80mm">80mm (3-inch standard roll)</option>
                          <option value="58mm">58mm (2-inch compact roll)</option>
                        </Select>
                      </Field>

                      <Field label="Receipt Font Size">
                        <Select
                          value={form.fontSize || 'md'}
                          onChange={(e) => setForm({ ...form, fontSize: e.target.value })}
                        >
                          <option value="sm">Small (9.5px - High Density)</option>
                          <option value="md">Medium (11px - Standard)</option>
                          <option value="lg">Large (12.5px - High Legibility)</option>
                        </Select>
                      </Field>

                      <Field label="Section Divider Line Style">
                        <Select
                          value={form.dividerStyle || 'dashed'}
                          onChange={(e) => setForm({ ...form, dividerStyle: e.target.value })}
                        >
                          <option value="dashed">Dashed Line ( - - - - - )</option>
                          <option value="dotted">Dotted Line ( . . . . . )</option>
                          <option value="solid">Solid Line ( ————— )</option>
                          <option value="double">Double Line ( ===== )</option>
                        </Select>
                      </Field>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live Simulator (6 Cols) */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-[11.5px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Live Bill Preview
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold">
                    {form.paperWidth || '80mm'} · {form.fontSize || 'md'}
                  </span>
                  <Button size="sm" variant="secondary" icon={Maximize2} onClick={() => setShowFullscreenView(true)}>
                    Full Screen
                  </Button>
                </div>
              </div>

              {/* Receipt Mockup Frame */}
              <div className="w-full max-h-[calc(98vh-220px)] overflow-y-auto p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex justify-center shadow-inner">
                <ThermalReceiptView
                  receipt={SAMPLE_RECEIPT_DATA}
                  settings={{ company, billing: form }}
                  customConfig={form}
                  activeTheme={selectedTheme}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Full Screen Immersive Bill Preview Modal */}
      {showFullscreenView && (
        <Modal
          open={showFullscreenView}
          onClose={() => setShowFullscreenView(false)}
          title="POS Bill — Full Screen View"
          subtitle={`${form.paperWidth || '80mm'} Bill High-Resolution Preview`}
          size="fullscreen"
          allowFullscreen={true}
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-[color:var(--text-muted)] font-mono">
                Bill Theme: {selectedTheme} · Width: {form.paperWidth || '80mm'}
              </span>
              <div className="flex items-center gap-2">
                <Button onClick={() => setShowFullscreenView(false)}>Close View</Button>
                <Button variant="primary" icon={Printer} onClick={() => window.print()}>
                  Print Document
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex-1 flex justify-center items-start p-4 sm:p-8 bg-slate-900/90 rounded-2xl overflow-y-auto min-h-full">
            <ThermalReceiptView
              receipt={SAMPLE_RECEIPT_DATA}
              settings={{ company, billing: form }}
              customConfig={form}
              activeTheme={selectedTheme}
            />
          </div>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * A4 / A5 Tax Invoice Bill Template Visual Editor Modal
 * ------------------------------------------------------------------ */

function InvoiceTemplateEditorModal({
  open,
  onClose,
  billing,
  company,
  saveSection,
  showToast,
  initialThemeId
}) {
  // See the matching comment in BillTemplateEditorModal — a theme's config
  // must come only from its own defaults plus its own saved override, never
  // the shared `billing` object.
  const buildInvoiceConfig = (billingObj, themeId) => {
    const customList = billingObj?.customTemplates || [];
    const custom = customList.find((t) => t.id === themeId && t.type === 'invoice');
    const baseId = custom ? (custom.baseTheme || themeId) : themeId;
    const themeMeta = INVOICE_THEMES.find((t) => t.id === baseId) || INVOICE_THEMES[0];
    const override = custom?.config || {};
    return {
      ...themeMeta.defaults,
      ...override,
      customLabels: { ...themeMeta.defaults.customLabels, ...(override.customLabels || {}) }
    };
  };

  const [selectedTheme, setSelectedTheme] = useState(
    initialThemeId || billing?.activeInvoiceTemplate || 'corporate_blue'
  );
  const [form, setForm] = useState(() => buildInvoiceConfig(billing, selectedTheme));
  const [activeSubTab, setActiveSubTab] = useState('toggles');
  const [previewZoom, setPreviewZoom] = useState(85);
  const [saving, setSaving] = useState(false);
  const [showFullscreenView, setShowFullscreenView] = useState(false);

  useEffect(() => {
    if (!open) return;
    const active = initialThemeId || billing?.activeInvoiceTemplate || 'corporate_blue';
    setSelectedTheme(active);
    setForm(buildInvoiceConfig(billing, active));
  }, [open, billing, initialThemeId]);

  const handleSelectTheme = (themeId) => {
    setSelectedTheme(themeId);
    const theme = INVOICE_THEMES.find((t) => t.id === themeId);
    const custom = (billing?.customTemplates || []).find((t) => t.id === themeId);
    if (theme) {
      setForm((prev) => ({
        ...prev,
        ...theme.defaults,
        activeInvoiceTemplate: themeId,
        customLabels: { ...theme.defaults.customLabels, ...(prev.customLabels || {}) }
      }));
    } else if (custom) {
      setForm((prev) => ({
        ...prev,
        ...(custom.config || {}),
        activeInvoiceTemplate: themeId,
        customLabels: { ...(custom.config?.customLabels || {}), ...(prev.customLabels || {}) }
      }));
    }
  };

  const handleResetDefaults = () => {
    const theme = INVOICE_THEMES.find((t) => t.id === selectedTheme);
    const custom = (billing?.customTemplates || []).find((t) => t.id === selectedTheme);
    if (theme) {
      setForm((prev) => ({
        ...prev,
        ...theme.defaults,
        activeInvoiceTemplate: selectedTheme,
        customLabels: { ...theme.defaults.customLabels }
      }));
      showToast(`Reset to ${theme.name} default layout`);
    } else if (custom) {
      setForm((prev) => ({
        ...prev,
        ...(custom.config || {}),
        activeInvoiceTemplate: selectedTheme,
        customLabels: { ...(custom.config?.customLabels || {}) }
      }));
      showToast(`Reset to ${custom.name} default layout`);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const themeMeta = INVOICE_THEMES.find((t) => t.id === selectedTheme);
      const existing = (billing?.customTemplates || []).find((t) => t.id === selectedTheme && t.type === 'invoice');
      const upserted = {
        id: selectedTheme,
        name: existing?.name || themeMeta?.name || selectedTheme,
        type: 'invoice',
        baseTheme: selectedTheme,
        config: form,
        createdAt: existing?.createdAt || new Date().toISOString()
      };
      const updated = [
        ...(billing?.customTemplates || []).filter((t) => !(t.id === selectedTheme && t.type === 'invoice')),
        upserted
      ];
      const payload = { activeInvoiceTemplate: selectedTheme, customTemplates: updated };
      const res = await saveSection('billing', payload);
      showToast(res.message || 'A4 / A5 Tax invoice bill template saved successfully!');
      onClose();
    } catch (err) {
      showToast(api.message(err, 'Could not save invoice template.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const currentTheme = INVOICE_THEMES.find((t) => t.id === selectedTheme) || INVOICE_THEMES[0];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="A4 / A5 Tax Invoice Template Editor"
        subtitle="Customize full-sheet layout, edit all text & column headings, accent colors, bank details & preview live"
        icon={Palette}
        size="fullscreen"
        allowFullscreen={true}
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" icon={RefreshCw} onClick={handleResetDefaults}>
              Reset Theme Defaults
            </Button>
            <div className="flex items-center gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                icon={Check}
                onClick={save}
                loading={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save &amp; Apply Invoice Template
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Top Control Bar: Base Theme, Sub-Tabs */}
          <div className="rounded-2xl border border-[color:var(--border)] p-3 bg-[color:var(--bg-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">
                Select Base Theme
              </div>
              <div className="flex flex-wrap gap-1.5">
                {INVOICE_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleSelectTheme(theme.id)}
                    className={cx(
                      'px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-all flex items-center gap-1.5',
                      selectedTheme === theme.id
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30'
                        : 'bg-[color:var(--bg-surface)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] border border-[color:var(--border)]'
                    )}
                  >
                    <span>{theme.name}</span>
                    <span className="text-[9px] opacity-80 px-1 py-0.2 rounded bg-black/10">
                      {theme.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Tabs Selector */}
            <div className="flex items-center p-1 rounded-xl bg-[color:var(--bg-surface)] border border-[color:var(--border)] font-bold text-xs shrink-0">
              <button
                type="button"
                onClick={() => setActiveSubTab('toggles')}
                className={cx(
                  'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                  activeSubTab === 'toggles'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>1. Layout Toggles</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('text')}
                className={cx(
                  'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                  activeSubTab === 'text'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                )}
              >
                <Type className="w-3.5 h-3.5" />
                <span>2. Edit All Text &amp; Labels</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('styling')}
                className={cx(
                  'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                  activeSubTab === 'styling'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                )}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>3. Colors &amp; Paper</span>
              </button>
            </div>
          </div>

          {/* 2-Column Split: Left Controls, Right Live Preview */}
          <div className="grid gap-4 lg:grid-cols-12 items-start">
            {/* Left Column: Controls (6 Cols) */}
            <div className="lg:col-span-6 space-y-3.5 max-h-[calc(98vh-230px)] overflow-y-auto pr-1">
              {/* TAB 1: LAYOUT TOGGLES */}
              {activeSubTab === 'toggles' && (
                <div className="space-y-3">
                  {/* 1. Header & Company Identifiers */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>1. Store Logo &amp; Tax Identifiers</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Header Section</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show Company Logo"
                        hint="Displays store logo in the invoice header"
                        checked={Boolean(form.showInvoiceLogo !== false)}
                        onChange={(v) => setForm({ ...form, showInvoiceLogo: v })}
                      />
                      <Toggle
                        label="Show Company Tax IDs"
                        hint="Prints PAN, CIN, FSSAI, LUT/Bond No. under store address"
                        checked={Boolean(form.showCompanyTaxMeta !== false)}
                        onChange={(v) => setForm({ ...form, showCompanyTaxMeta: v })}
                      />
                    </div>
                  </div>

                  {/* 2. Customer & Consignee (Bill-To / Ship-To) */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>2. Buyer &amp; Consignee Addresses</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Bill-To &amp; Ship-To</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show Ship-To (Consignee)"
                        hint="Displays delivery address &amp; Consignee GSTIN if different from buyer"
                        checked={Boolean(form.showConsigneeShipTo !== false)}
                        onChange={(v) => setForm({ ...form, showConsigneeShipTo: v })}
                      />
                    </div>
                  </div>

                  {/* 3. Transport, Logistics & PO Details */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>3. Transport, PO &amp; Logistics Meta</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">E-Way &amp; Delivery</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show Transport &amp; Dispatch Details"
                        hint="Includes E-Way Bill No., Vehicle No., Despatch Doc No., Place of Supply"
                        checked={Boolean(form.showTransportMeta !== false)}
                        onChange={(v) => setForm({ ...form, showTransportMeta: v })}
                      />
                    </div>
                  </div>

                  {/* 4. Item Table Columns */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>4. Item Table Columns</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Line Items</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show HSN / SAC column"
                        hint="Displays statutory HSN/SAC code per line item"
                        checked={Boolean(form.showItemHsn !== false)}
                        onChange={(v) => setForm({ ...form, showItemHsn: v })}
                      />
                      <Toggle
                        label="Show Unit / UOM column"
                        hint="Displays packaging unit (e.g. pcs, box, kg, ltr)"
                        checked={Boolean(form.showItemUnit !== false)}
                        onChange={(v) => setForm({ ...form, showItemUnit: v })}
                      />
                      <Toggle
                        label="Show Tax Rate (%) column"
                        hint="Displays applicable GST slab percentage per item"
                        checked={Boolean(form.showItemTaxBreakup !== false)}
                        onChange={(v) => setForm({ ...form, showItemTaxBreakup: v })}
                      />
                    </div>
                  </div>

                  {/* 5. Tax Summary, Bank Details & QR Code */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>5. Tax Breakdown, Bank &amp; QR Code</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Slabs &amp; Payment</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show HSN Summary Slab Table"
                        hint="Prints statutory HSN-wise Taxable, CGST, SGST, IGST matrix"
                        checked={Boolean(form.showHsnSummaryTable !== false)}
                        onChange={(v) => setForm({ ...form, showHsnSummaryTable: v })}
                      />
                      <Toggle
                        label="Show Bank Account &amp; IFSC"
                        hint="Prints bank transfer details for NEFT/RTGS payments"
                        checked={Boolean(form.showBankDetails !== false)}
                        onChange={(v) => setForm({ ...form, showBankDetails: v })}
                      />
                      <Toggle
                        label="Show Instant UPI Payment QR"
                        hint="Prints dynamic UPI payment QR code on the invoice"
                        checked={Boolean(form.showPaymentQr !== false)}
                        onChange={(v) => setForm({ ...form, showPaymentQr: v })}
                      />
                    </div>
                  </div>

                  {/* 6. Legal, Words & Signature */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>6. Legal, Words &amp; Signature</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Signatory &amp; Terms</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Show Total Amount in Words"
                        hint="Prints Indian Rupee words (e.g. Twenty Thousand Seven Hundred...)"
                        checked={Boolean(form.showInvoiceWordsTotal !== false)}
                        onChange={(v) => setForm({ ...form, showInvoiceWordsTotal: v })}
                      />
                      <Toggle
                        label="Show Terms &amp; Conditions"
                        hint="Prints invoice terms text at bottom"
                        checked={Boolean(form.showInvoiceTerms !== false)}
                        onChange={(v) => setForm({ ...form, showInvoiceTerms: v })}
                      />
                      <Toggle
                        label="Show Authorized Signatory Box"
                        hint="Displays signature box on bottom right"
                        checked={Boolean(form.showInvoiceSignature !== false)}
                        onChange={(v) => setForm({ ...form, showInvoiceSignature: v })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EDIT ALL CONTENT & TEXT */}
              {activeSubTab === 'text' && (
                <div className="space-y-3">
                  {/* 1. Document Headlines & Titles */}
                  <div className="rounded-2xl border border-blue-500/30 p-3.5 space-y-3 bg-blue-50/20 dark:bg-blue-950/20">
                    <div className="text-[11.5px] font-bold text-blue-900 dark:text-blue-300 border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>Invoice Titles &amp; Address Headings</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Document Headers</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Invoice Main Title">
                        <Input
                          value={form.customLabels?.invoiceTitle || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), invoiceTitle: e.target.value }
                          })}
                          placeholder="TAX INVOICE"
                        />
                      </Field>
                      <Field label="Recipient Copy Subtitle">
                        <Input
                          value={form.customLabels?.recipientCopy || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), recipientCopy: e.target.value }
                          })}
                          placeholder="Original for Recipient"
                        />
                      </Field>
                      <Field label="Buyer (Bill-To) Box Title">
                        <Input
                          value={form.customLabels?.billToTitle || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), billToTitle: e.target.value }
                          })}
                          placeholder="Bill To (Buyer / Customer)"
                        />
                      </Field>
                      <Field label="Ship-To (Consignee) Box Title">
                        <Input
                          value={form.customLabels?.shipToTitle || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), shipToTitle: e.target.value }
                          })}
                          placeholder="Ship To (Consignee)"
                        />
                      </Field>
                    </div>
                    <Field label="Custom Notice / Announcement Banner (Optional)">
                      <Input
                        value={form.customBannerText || ''}
                        onChange={(e) => setForm({ ...form, customBannerText: e.target.value })}
                        placeholder="e.g. ⭐ ANNUAL GST COMPLIANT TAX INVOICE ⭐"
                      />
                    </Field>
                  </div>

                  {/* 2. Item Table Column Headers */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>Item Table Column Headers</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Table Columns</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <Field label="Item Column">
                        <Input
                          value={form.customLabels?.itemColHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), itemColHeader: e.target.value }
                          })}
                          placeholder="Item Description"
                        />
                      </Field>
                      <Field label="HSN/SAC Column">
                        <Input
                          value={form.customLabels?.hsnColHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), hsnColHeader: e.target.value }
                          })}
                          placeholder="HSN/SAC"
                        />
                      </Field>
                      <Field label="Qty Column">
                        <Input
                          value={form.customLabels?.qtyColHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), qtyColHeader: e.target.value }
                          })}
                          placeholder="Qty"
                        />
                      </Field>
                      <Field label="Unit Column">
                        <Input
                          value={form.customLabels?.unitColHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), unitColHeader: e.target.value }
                          })}
                          placeholder="Unit"
                        />
                      </Field>
                      <Field label="Rate Column">
                        <Input
                          value={form.customLabels?.rateColHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), rateColHeader: e.target.value }
                          })}
                          placeholder="Rate (₹)"
                        />
                      </Field>
                      <Field label="Taxable Column">
                        <Input
                          value={form.customLabels?.taxableColHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), taxableColHeader: e.target.value }
                          })}
                          placeholder="Taxable (₹)"
                        />
                      </Field>
                      <Field label="GST Rate Column">
                        <Input
                          value={form.customLabels?.taxRateColHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), taxRateColHeader: e.target.value }
                          })}
                          placeholder="Tax %"
                        />
                      </Field>
                      <Field label="Amount Column">
                        <Input
                          value={form.customLabels?.amountColHeader || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), amountColHeader: e.target.value }
                          })}
                          placeholder="Amount (₹)"
                        />
                      </Field>
                    </div>
                  </div>

                  {/* 3. Totals & Consignment Labels */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>Totals &amp; Consignment Labels</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Financial Summary</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Taxable Subtotal Label">
                        <Input
                          value={form.customLabels?.subtotalLabel || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), subtotalLabel: e.target.value }
                          })}
                          placeholder="Total Taxable Amount:"
                        />
                      </Field>
                      <Field label="Special Discount Label">
                        <Input
                          value={form.customLabels?.discountLabel || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), discountLabel: e.target.value }
                          })}
                          placeholder="Special Discount:"
                        />
                      </Field>
                      <Field label="Total GST Label">
                        <Input
                          value={form.customLabels?.taxLabel || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), taxLabel: e.target.value }
                          })}
                          placeholder="Total GST:"
                        />
                      </Field>
                      <Field label="Total Consignment Value Label">
                        <Input
                          value={form.customLabels?.totalLabel || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), totalLabel: e.target.value }
                          })}
                          placeholder="TOTAL INVOICE VALUE:"
                        />
                      </Field>
                    </div>
                    <Field label="Amount in Words Label">
                      <Input
                        value={form.customLabels?.wordsLabel || ''}
                        onChange={(e) => setForm({
                          ...form,
                          customLabels: { ...(form.customLabels || {}), wordsLabel: e.target.value }
                        })}
                        placeholder="Amount in Words (Rupees):"
                      />
                    </Field>
                  </div>

                  {/* 4. Terms, Signatory & Notes */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>Terms, Signatory &amp; Footers</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Legal &amp; Signatures</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Terms Title">
                        <Input
                          value={form.customLabels?.termsTitle || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), termsTitle: e.target.value }
                          })}
                          placeholder="Terms & Conditions"
                        />
                      </Field>
                      <Field label="Authorised Signatory Title">
                        <Input
                          value={form.customLabels?.signatoryTitle || ''}
                          onChange={(e) => setForm({
                            ...form,
                            customLabels: { ...(form.customLabels || {}), signatoryTitle: e.target.value }
                          })}
                          placeholder="Authorised Signatory"
                        />
                      </Field>
                    </div>
                    <Field label="Terms &amp; Conditions Text">
                      <Textarea
                        rows={2}
                        value={form.termsText || ''}
                        onChange={(e) => setForm({ ...form, termsText: e.target.value })}
                        placeholder="1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. will be charged for delayed payments."
                      />
                    </Field>
                    <Field label="Computer Generated Note">
                      <Input
                        value={form.customLabels?.computerGeneratedNote || ''}
                        onChange={(e) => setForm({
                          ...form,
                          customLabels: { ...(form.customLabels || {}), computerGeneratedNote: e.target.value }
                        })}
                        placeholder="This is a Computer Generated Tax Invoice"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* TAB 3: COLORS & PAPER */}
              {activeSubTab === 'styling' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span>Accent Colors &amp; Page Size</span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">Theme Appearance</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="text-[10.5px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider mb-2">
                          Accent Color Palette
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {ACCENT_COLORS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setForm({ ...form, invoiceAccentColor: c.id, accentColor: c.id })}
                              className={cx(
                                'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2',
                                (form.invoiceAccentColor || form.accentColor || 'blue') === c.id
                                  ? 'border-slate-900 bg-white shadow-sm ring-2 ring-blue-500/40 text-slate-900'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                              )}
                            >
                              <span className="w-3.5 h-3.5 rounded-full shadow-xs" style={{ backgroundColor: c.hex }} />
                              <span>{c.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <Field label="Invoice Paper Size">
                        <Select
                          value={form.invoicePaperSize || form.paperSize || 'A4'}
                          onChange={(e) => setForm({ ...form, invoicePaperSize: e.target.value, paperSize: e.target.value })}
                        >
                          <option value="A4">A4 Full Page (Standard 210 × 297 mm)</option>
                          <option value="A5">A5 Half Page (Compact 148 × 210 mm)</option>
                        </Select>
                      </Field>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live A4/A5 Preview Simulator (6 Cols) */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-[11.5px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Live Tax Invoice Preview
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Zoom Controls */}
                  <div className="flex items-center rounded-lg bg-slate-200 dark:bg-slate-800 p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(70)}
                      className={cx('px-2 py-0.5 rounded transition-all', previewZoom === 70 ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400')}
                    >
                      70%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(85)}
                      className={cx('px-2 py-0.5 rounded transition-all', previewZoom === 85 ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400')}
                    >
                      85%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(100)}
                      className={cx('px-2 py-0.5 rounded transition-all', previewZoom === 100 ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400')}
                    >
                      100%
                    </button>
                  </div>

                  <Button size="sm" variant="secondary" icon={Maximize2} onClick={() => setShowFullscreenView(true)}>
                    Full Screen
                  </Button>
                </div>
              </div>

              {/* Invoice Mockup Frame with Zoom scaling */}
              <div className="w-full max-h-[calc(98vh-220px)] overflow-y-auto overflow-x-auto p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex justify-center shadow-inner">
                <div
                  style={{
                    transform: previewZoom !== 100 ? `scale(${previewZoom / 100})` : 'none',
                    transformOrigin: 'top center',
                    width: previewZoom !== 100 ? `${100 / (previewZoom / 100)}%` : '100%',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <InvoiceDocumentView
                    invoice={SAMPLE_INVOICE_DATA}
                    settings={{ company, billing: form }}
                    customConfig={form}
                    activeTheme={selectedTheme}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Full Screen Immersive Invoice Preview Modal */}
      {showFullscreenView && (
        <Modal
          open={showFullscreenView}
          onClose={() => setShowFullscreenView(false)}
          title="A4 / A5 Tax Invoice — Full Screen View"
          subtitle={`${form.invoicePaperSize || 'A4'} Document High-Resolution Preview`}
          size="fullscreen"
          allowFullscreen={true}
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-[color:var(--text-muted)] font-mono">
                Theme: {selectedTheme} · Size: {form.invoicePaperSize || 'A4'} · Color: {form.invoiceAccentColor || 'blue'}
              </span>
              <div className="flex items-center gap-2">
                <Button onClick={() => setShowFullscreenView(false)}>Close View</Button>
                <Button variant="primary" icon={Printer} onClick={() => window.print()}>
                  Print Document
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex-1 flex justify-center items-start p-4 sm:p-8 bg-slate-900/90 rounded-2xl overflow-y-auto min-h-full">
            <InvoiceDocumentView
              invoice={SAMPLE_INVOICE_DATA}
              settings={{ company, billing: form }}
              customConfig={form}
              activeTheme={selectedTheme}
            />
          </div>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Loyalty Points & Rewards Modal Popup
 * ------------------------------------------------------------------ */

function LoyaltyModal({ open, onClose, pos, loyalty, saveSection, showToast }) {
  const initial = {
    enableLoyalty: loyalty?.enableLoyalty ?? pos?.enableLoyalty ?? true,
    loyaltySpendAmount: Number(loyalty?.loyaltySpendAmount ?? pos?.loyaltySpendAmount) || 100,
    loyaltyPointsPerSpend: Number(loyalty?.loyaltyPointsPerSpend ?? loyalty?.loyaltyPointsPerHundred ?? pos?.loyaltyPointsPerSpend ?? pos?.loyaltyPointsPerHundred) || 1,
    loyaltyMinSpendToEarn: Number(loyalty?.loyaltyMinSpendToEarn ?? pos?.loyaltyMinSpendToEarn) || 0,
    loyaltyRedeemValue: Number(loyalty?.loyaltyRedeemValue ?? pos?.loyaltyRedeemValue) || 0.5,
    loyaltyMinRedeemPoints: Number(loyalty?.loyaltyMinRedeemPoints ?? pos?.loyaltyMinRedeemPoints) || 50,
    loyaltyMaxRedeemPercent: Number(loyalty?.loyaltyMaxRedeemPercent ?? pos?.loyaltyMaxRedeemPercent) || 100
  };

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  // Live simulation test states
  const [simBill, setSimBill] = useState(1000);
  const [simPoints, setSimPoints] = useState(100);

  useEffect(() => {
    if (!open) return;
    setForm({
      enableLoyalty: loyalty?.enableLoyalty ?? pos?.enableLoyalty ?? true,
      loyaltySpendAmount: Number(loyalty?.loyaltySpendAmount ?? pos?.loyaltySpendAmount) || 100,
      loyaltyPointsPerSpend: Number(loyalty?.loyaltyPointsPerSpend ?? loyalty?.loyaltyPointsPerHundred ?? pos?.loyaltyPointsPerSpend ?? pos?.loyaltyPointsPerHundred) || 1,
      loyaltyMinSpendToEarn: Number(loyalty?.loyaltyMinSpendToEarn ?? pos?.loyaltyMinSpendToEarn) || 0,
      loyaltyRedeemValue: Number(loyalty?.loyaltyRedeemValue ?? pos?.loyaltyRedeemValue) || 0.5,
      loyaltyMinRedeemPoints: Number(loyalty?.loyaltyMinRedeemPoints ?? pos?.loyaltyMinRedeemPoints) || 50,
      loyaltyMaxRedeemPercent: Number(loyalty?.loyaltyMaxRedeemPercent ?? pos?.loyaltyMaxRedeemPercent) || 100
    });
  }, [open, pos, loyalty]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        loyaltySpendAmount: Math.max(1, Number(form.loyaltySpendAmount) || 100),
        loyaltyPointsPerSpend: Math.max(0.01, Number(form.loyaltyPointsPerSpend) || 1),
        loyaltyPointsPerHundred: Math.max(0.01, Number(form.loyaltyPointsPerSpend) || 1),
        loyaltyMinSpendToEarn: Math.max(0, Number(form.loyaltyMinSpendToEarn) || 0),
        loyaltyRedeemValue: Math.max(0.001, Number(form.loyaltyRedeemValue) || 0.5),
        loyaltyMinRedeemPoints: Math.max(0, Number(form.loyaltyMinRedeemPoints) || 0),
        loyaltyMaxRedeemPercent: Math.min(100, Math.max(1, Number(form.loyaltyMaxRedeemPercent) || 100))
      };
      await saveSection('loyalty', payload);
      const res = await saveSection('pos', payload);
      showToast(res.message || 'Loyalty Points configuration saved.');
      onClose();
    } catch (err) {
      showToast(api.message(err, 'Could not save loyalty settings.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Calculations for live preview
  const spendAmt = Math.max(1, Number(form.loyaltySpendAmount) || 100);
  const ptsPerSpend = Math.max(0, Number(form.loyaltyPointsPerSpend) || 1);
  const minSpend = Math.max(0, Number(form.loyaltyMinSpendToEarn) || 0);
  const pricePerPt = Math.max(0, Number(form.loyaltyRedeemValue) || 0.5);
  const minRedeem = Math.max(0, Number(form.loyaltyMinRedeemPoints) || 0);
  const maxPercent = Math.min(100, Math.max(1, Number(form.loyaltyMaxRedeemPercent) || 100));

  const effectiveCashbackRate = spendAmt > 0 ? ((ptsPerSpend * pricePerPt) / spendAmt) * 100 : 0;
  const simBillNum = Math.max(0, Number(simBill) || 0);
  const simEarnedPts = simBillNum >= minSpend ? Math.floor((simBillNum / spendAmt) * ptsPerSpend) : 0;
  const simEarnedValue = Math.round(simEarnedPts * pricePerPt * 100) / 100;

  const simPtsNum = Math.max(0, Number(simPoints) || 0);
  const canRedeemSim = simPtsNum >= minRedeem;
  const simMaxDiscountCap = Math.round((simBillNum * maxPercent) / 100 * 100) / 100;
  const simDiscount = canRedeemSim ? Math.min(Math.round(simPtsNum * pricePerPt * 100) / 100, simMaxDiscountCap, simBillNum) : 0;
  const simPayable = Math.max(0, Math.round((simBillNum - simDiscount) * 100) / 100);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configure Customer Loyalty & Rewards"
      subtitle="Set custom points earning rules, redemption price value, and preview live calculations"
      icon={Star}
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save Loyalty Rules
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Master Program Toggle */}
        <div className="rounded-xl p-3 border border-[color:var(--border)] bg-[color:var(--bg-subtle)]">
          <Toggle
            label="Enable Customer Loyalty Program"
            hint="Automatically awards points to registered customers on sales bills and allows redemption at billing checkout"
            checked={form.enableLoyalty}
            onChange={(v) => setForm({ ...form, enableLoyalty: v })}
          />
        </div>

        {form.enableLoyalty && (
          <>
            {/* 2 Columns: Earning Rules & Redemption Rules */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Earning Rules Card */}
              <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[color:var(--text-primary)]">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Points Earning Rules (Spend ➔ Points)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{ptsPerSpend} pts / ₹{spendAmt}
                  </span>
                </div>

                <Field
                  label="Purchase Spend Amount (₹)"
                  hint="Rupee spending unit requirement (e.g. ₹100 or ₹50)"
                >
                  <Input
                    type="number"
                    min="1"
                    step="10"
                    value={form.loyaltySpendAmount}
                    onChange={(e) => setForm({ ...form, loyaltySpendAmount: e.target.value })}
                    placeholder="100"
                  />
                </Field>

                <Field
                  label="Points Earned per Spend Unit"
                  hint="Loyalty points awarded for each spend unit"
                >
                  <Input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={form.loyaltyPointsPerSpend}
                    onChange={(e) => setForm({ ...form, loyaltyPointsPerSpend: e.target.value })}
                    placeholder="1"
                  />
                </Field>

                <Field
                  label="Minimum Bill to Earn Points (₹)"
                  hint="Minimum purchase amount before points accrue (0 = no minimum)"
                >
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={form.loyaltyMinSpendToEarn}
                    onChange={(e) => setForm({ ...form, loyaltyMinSpendToEarn: e.target.value })}
                    placeholder="0"
                  />
                </Field>

                <div className="rounded-xl p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300">
                  Customer spending ₹1,000 earns <strong className="font-bold">{Math.floor((1000 / spendAmt) * ptsPerSpend)} points</strong>.
                </div>
              </div>

              {/* Redemption Rules Card */}
              <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[color:var(--text-primary)]">
                    <Gift className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Redemption & Price (Points ➔ ₹ Discount)</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    1 pt = ₹{pricePerPt.toFixed(2)}
                  </span>
                </div>

                <Field
                  label="Price Value per 1 Point (₹)"
                  hint="Rupee discount value given for each redeemed point (e.g. ₹0.50 or ₹1.00)"
                >
                  <Input
                    type="number"
                    min="0.01"
                    step="0.1"
                    value={form.loyaltyRedeemValue}
                    onChange={(e) => setForm({ ...form, loyaltyRedeemValue: e.target.value })}
                    placeholder="0.50"
                  />
                </Field>

                <Field
                  label="Minimum Points to Redeem"
                  hint="Minimum points required in account before redemption is allowed"
                >
                  <Input
                    type="number"
                    min="0"
                    step="5"
                    value={form.loyaltyMinRedeemPoints}
                    onChange={(e) => setForm({ ...form, loyaltyMinRedeemPoints: e.target.value })}
                    placeholder="50"
                  />
                </Field>

                <Field
                  label="Max Bill Discount Cap (%)"
                  hint="Max % of bill total allowed to be paid via points (e.g. 100% or 50%)"
                >
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    step="5"
                    value={form.loyaltyMaxRedeemPercent}
                    onChange={(e) => setForm({ ...form, loyaltyMaxRedeemPercent: e.target.value })}
                    placeholder="100"
                  />
                </Field>

                <div className="rounded-xl p-2.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 text-[11px] text-indigo-800 dark:text-indigo-300">
                  100 Points = <strong className="font-bold">₹{(100 * pricePerPt).toFixed(2)}</strong> discount · Effective reward: <strong className="font-bold">{effectiveCashbackRate.toFixed(2)}%</strong>.
                </div>
              </div>
            </div>

            {/* Live Calculation Simulator Inside Modal */}
            <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
              <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">
                  <Calculator className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Live Formula Preview Simulator</span>
                </div>
                <span className="text-[10px] text-[color:var(--text-muted)]">Test your formulas in real-time</span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Sample Bill Total (₹)">
                  <Input
                    type="number"
                    min="1"
                    value={simBill}
                    onChange={(e) => setSimBill(Number(e.target.value) || 0)}
                    placeholder="1000"
                  />
                </Field>

                <Field label="Sample Customer Available Points">
                  <Input
                    type="number"
                    min="0"
                    value={simPoints}
                    onChange={(e) => setSimPoints(Number(e.target.value) || 0)}
                    placeholder="100"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                <div className="rounded-xl p-2.5 border border-[color:var(--border)] bg-[color:var(--bg-surface)]">
                  <div className="text-[10px] font-bold uppercase text-[color:var(--text-muted)]">Points Earned</div>
                  <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                    +{simEarnedPts} pts
                  </div>
                  <div className="text-[9.5px] text-[color:var(--text-muted)]">Worth ₹{simEarnedValue.toFixed(2)}</div>
                </div>

                <div className="rounded-xl p-2.5 border border-[color:var(--border)] bg-[color:var(--bg-surface)]">
                  <div className="text-[10px] font-bold uppercase text-[color:var(--text-muted)]">Effective Return</div>
                  <div className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono">
                    {effectiveCashbackRate.toFixed(2)}%
                  </div>
                  <div className="text-[9.5px] text-[color:var(--text-muted)]">Cashback rate</div>
                </div>

                <div className="rounded-xl p-2.5 border border-[color:var(--border)] bg-[color:var(--bg-surface)]">
                  <div className="text-[10px] font-bold uppercase text-[color:var(--text-muted)]">Discount Value</div>
                  <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
                    {canRedeemSim ? `−₹${simDiscount.toFixed(2)}` : 'Below Min'}
                  </div>
                  <div className="text-[9.5px] text-[color:var(--text-muted)]">{canRedeemSim ? `for ${simPoints} pts` : `Min ${minRedeem} pts`}</div>
                </div>

                <div className="rounded-xl p-2.5 border border-[color:var(--border)] bg-[color:var(--bg-surface)]">
                  <div className="text-[10px] font-bold uppercase text-[color:var(--text-muted)]">Net Payable</div>
                  <div className="text-sm font-black text-[color:var(--text-primary)] mt-0.5 font-mono">
                    ₹{simPayable.toFixed(2)}
                  </div>
                  <div className="text-[9.5px] text-[color:var(--text-muted)]">After discount</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Hardware
 * ------------------------------------------------------------------ */

const DEVICE_META = {
  printer: { label: 'Receipt Printer', interfaces: ['USB', 'Bluetooth'] },
  weighingScale: { label: 'Weighing Scale', interfaces: ['USB', 'RS232', 'Bluetooth'] },
  barcodeScanner: { label: 'Barcode Scanner', interfaces: ['USB HID', 'Bluetooth'] },
  barcodePrinter: { label: 'Barcode Printer', interfaces: ['USB', 'Bluetooth'] },
  cashDrawer: { label: 'Cash Drawer', interfaces: ['Printer Kick-out', 'USB'] }
};

function HardwareTab({ showToast }) {
  const [hardware, setHardware] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setHardware(await api.get('/hardware'));
    } catch (err) {
      showToast(api.message(err, 'Could not load hardware settings.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !hardware) return <Spinner label="Loading hardware…" />;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.keys(DEVICE_META).map((key) => (
        <DeviceCard
          key={key}
          deviceKey={key}
          device={hardware[key] || {}}
          showToast={showToast}
          onSaved={(d) => setHardware((h) => ({ ...h, [key]: d }))}
        />
      ))}
    </div>
  );
}

function DeviceCard({ deviceKey, device, showToast, onSaved }) {
  const meta = DEVICE_META[deviceKey];
  const [form, setForm] = useState(device);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setForm(device);
  }, [device]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/hardware/${deviceKey}`, form);
      showToast(res.message || `${meta.label} saved.`);
      onSaved(res.data);
    } catch (err) {
      showToast(api.message(err, `Could not save ${meta.label}.`), 'error');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await api.post(`/hardware/${deviceKey}/test`);
      showToast(res.message || 'Connection test complete.');
      onSaved(res.data);
    } catch (err) {
      showToast(api.message(err, 'Connection test failed.'), 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Panel className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-[color:var(--text-primary)]">{form.name || meta.label}</span>
        <Badge tone={form.status === 'connected' ? 'success' : 'neutral'}>{form.status || 'unknown'}</Badge>
      </div>

      <Toggle label="Enabled" checked={Boolean(form.enabled)} onChange={(v) => setForm({ ...form, enabled: v })} />

      <Field label="Interface">
        <Select value={form.interface || ''} onChange={(e) => setForm({ ...form, interface: e.target.value })}>
          {meta.interfaces.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </Select>
      </Field>

      {deviceKey === 'cashDrawer' && (
        <Toggle
          label="Open on cash payments only"
          checked={Boolean(form.openOnCashOnly)}
          onChange={(v) => setForm({ ...form, openOnCashOnly: v })}
        />
      )}

      {deviceKey === 'weighingScale' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Baud rate">
            <Input type="number" value={form.baudRate ?? ''} onChange={(e) => setForm({ ...form, baudRate: e.target.value })} />
          </Field>
          <Field label="Stable delay (ms)">
            <Input type="number" value={form.stableDelayMs ?? ''} onChange={(e) => setForm({ ...form, stableDelayMs: e.target.value })} />
          </Field>
        </div>
      )}

      {deviceKey === 'barcodePrinter' && (
        <Field label="Label size">
          <Input value={form.labelSize || ''} onChange={(e) => setForm({ ...form, labelSize: e.target.value })} />
        </Field>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" onClick={test} loading={testing}>
          Test Connection
        </Button>
        <Button size="sm" variant="primary" onClick={save} loading={saving}>
          Save
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Users & Roles
 * ------------------------------------------------------------------ */

// Which subscription feature gates each module toggle. Modules absent from
// this map (dashboard, billing, customers, settings, users) are always
// available regardless of plan.
const MODULE_FEATURE_MAP = {
  products: 'products',
  inventory: 'inventory',
  purchases: 'purchases',
  vendors: 'vendors',
  accounts: 'accounts',
  expenses: 'expenses',
  reports: 'reports',
  tables: 'tableMgmt'
};

function UsersTab({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [permUser, setPermUser] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.get('/users'));
    } catch (err) {
      showToast(api.message(err, 'Could not load users.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (u) => {
    if (!window.confirm(`Delete user "${u.name || u.username}"? They will lose access immediately.`)) return;
    try {
      const res = await api.del(`/users/${u.id}`);
      showToast(res.message || 'User removed.');
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not delete user.'), 'error');
    }
  };

  // Ensure hooks run on every render and provide safe defaults
  const {
    users = [],
    roles = [],
    permissionMatrix = {},
    permissionKeys = [],
    permissionLabels = [],
    moduleKeys = [],
    moduleLabels = [],
    planFeatures = [],
  } = data || {};

  const roleCounts = useMemo(
    () =>
      roles.reduce(
        (acc, r) => ({
          ...acc,
          [r.key]: users.filter((u) => u.role === r.key).length,
        }),
        {}
      ),
    [roles, users]
  );

  if (loading) return <Spinner label="Loading users…" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Users" value={users.length} />
        {roles.map((r) => (
          <StatTile key={r.key} label={r.label} value={roleCounts[r.key] || 0} />
        ))}
      </div>

      <RoleReferenceTable roles={roles} moduleKeys={moduleKeys} moduleLabels={moduleLabels} permissionMatrix={permissionMatrix} />

      <div className="flex justify-end">
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
        >
          Add User
        </Button>
      </div>

      <DataTable
        columns={[
          {
            key: 'name',
            label: 'Name',
            render: (u) => (
              <div>
                <div className="font-bold">{u.name}</div>
                <div className="text-[10.5px] text-[color:var(--text-muted)]">{[u.phone, u.email].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            )
          },
          {
            key: 'role',
            label: 'Role',
            width: 130,
            render: (u) => <Badge tone="accent">{u.effective?.label || permissionMatrix[u.role]?.label || u.role}</Badge>
          },
          {
            key: 'status',
            label: 'Status',
            width: 100,
            render: (u) => <Badge tone={u.status === 'active' ? 'success' : 'neutral'}>{u.status}</Badge>
          },
          {
            key: 'hasPin',
            label: 'PIN set',
            width: 90,
            render: (u) => <Badge tone={u.hasPin ? 'success' : 'neutral'}>{u.hasPin ? 'Yes' : 'No'}</Badge>
          },
          {
            key: 'actions',
            label: '',
            align: 'right',
            width: 220,
            render: (u) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" icon={ShieldCheck} onClick={() => setPermUser(u)}>
                  Permissions
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(u);
                    setShowModal(true);
                  }}
                >
                  Edit
                </Button>
                {u.role !== 'OWNER' && (
                  <Button size="sm" variant="danger" onClick={() => remove(u)}>
                    Delete
                  </Button>
                )}
              </div>
            )
          }
        ]}
        rows={users}
        empty={<EmptyState title="No users yet" hint="Add staff logins with role-based permissions." />}
      />

      <UserModal
        open={showModal}
        onClose={() => setShowModal(false)}
        editing={editing}
        roles={roles}
        showToast={showToast}
        onSaved={() => {
          setShowModal(false);
          load();
        }}
      />

      <PermissionsModal
        open={Boolean(permUser)}
        user={permUser}
        onClose={() => setPermUser(null)}
        permissionMatrix={permissionMatrix}
        permissionKeys={permissionKeys}
        permissionLabels={permissionLabels}
        moduleKeys={moduleKeys}
        moduleLabels={moduleLabels}
        planFeatures={planFeatures}
        showToast={showToast}
        onSaved={() => {
          setPermUser(null);
          load();
        }}
      />
    </div>
  );
}

/** Compact tick/cross matrix so a shop can see what each role means before assigning it. */
function RoleReferenceTable({ roles, moduleKeys, moduleLabels, permissionMatrix }) {
  return (
    <Panel padded={false} className="overflow-hidden">
      <div className="px-4 pt-3 pb-1 label-eyebrow">Role Reference — module access by role</div>
      <div className="overflow-x-auto">
        <table className="ledger-table w-full border-collapse">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Module</th>
              {roles.map((r) => (
                <th key={r.key} style={{ textAlign: 'center', width: 110 }}>
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {moduleKeys.map((mKey) => (
              <tr key={mKey}>
                <td className="text-[12px] font-semibold text-[color:var(--text-primary)]">{moduleLabels[mKey] || mKey}</td>
                {roles.map((r) => {
                  const on = Boolean(permissionMatrix[r.key]?.modules?.[mKey]);
                  return (
                    <td key={r.key} style={{ textAlign: 'center' }}>
                      {on ? (
                        <Check className="inline h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XIcon className="inline h-3.5 w-3.5 text-[color:var(--text-muted)]" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function UserModal({ open, onClose, editing, roles, showToast, onSaved }) {
  const blank = { name: '', phone: '', email: '', role: roles[0]?.key || '', pin: '' };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({ name: editing.name || '', phone: editing.phone || '', email: editing.email || '', role: editing.role, pin: '' });
    } else {
      setForm(blank);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.pin) delete body.pin;
      const res = editing ? await api.put(`/users/${editing.id}`, body) : await api.post('/users', body);
      showToast(res.message || 'User saved.');
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not save user.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'Add User'}
      icon={Plus}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Role" hint={editing?.role === 'OWNER' ? 'The Owner role cannot be changed.' : undefined}>
            <Select
              value={form.role}
              disabled={editing?.role === 'OWNER'}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="PIN" hint="4-digit login PIN">
            <Input
              value={form.pin}
              maxLength={4}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
              placeholder="••••"
            />
          </Field>
        </div>
        <p className="text-[11px] text-[color:var(--text-muted)]">
          Fine-grained module access and action permissions are set from the “Permissions” action on the user list, once the user
          has been created.
        </p>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Permission matrix modal
 * ------------------------------------------------------------------ */

function OverriddenPill() {
  return <Badge tone="warning">Overridden</Badge>;
}

function PermissionsModal({
  open,
  user,
  onClose,
  permissionMatrix,
  permissionKeys,
  permissionLabels,
  moduleKeys,
  moduleLabels,
  planFeatures,
  showToast,
  onSaved
}) {
  const roleDefaults = (user && (permissionMatrix[user.role] || permissionMatrix.CASHIER)) || {};
  const isOwner = user?.role === 'OWNER';

  const [modules, setModules] = useState({});
  const [flags, setFlags] = useState({});
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const eff = user.effective || roleDefaults;
    setModules({ ...roleDefaults.modules, ...(eff.modules || {}) });
    const f = {};
    permissionKeys.forEach((key) => {
      f[key] = Boolean(eff[key]);
    });
    setFlags(f);
    setMaxDiscountPercent(eff.maxDiscountPercent ?? roleDefaults.maxDiscountPercent ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  if (!user) return null;

  const moduleDisabled = (key) => {
    const feature = MODULE_FEATURE_MAP[key];
    return feature ? planFeatures[feature] === false : false;
  };

  const toggleModule = (key) => setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleFlag = (key) => setFlags((prev) => ({ ...prev, [key]: !prev[key] }));

  const isModuleOverridden = (key) => Boolean(modules[key]) !== Boolean(roleDefaults.modules?.[key]);
  const isFlagOverridden = (key) => Boolean(flags[key]) !== Boolean(roleDefaults[key]);
  const isDiscountOverridden = Number(maxDiscountPercent) !== Number(roleDefaults.maxDiscountPercent ?? 0);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/users/${user.id}/permissions`, {
        modules,
        ...flags,
        maxDiscountPercent: Number(maxDiscountPercent) || 0
      });
      showToast(res.message || 'Permissions updated.');
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not update permissions.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setResetting(true);
    try {
      const res = await api.put(`/users/${user.id}/permissions`, { reset: true });
      showToast(res.message || 'Reset to role defaults.');
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not reset permissions.'), 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Permissions — ${user.name}`}
      subtitle={roleDefaults.label || user.role}
      icon={ShieldCheck}
      size="xl"
      footer={
        isOwner ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button icon={RotateCcw} onClick={reset} loading={resetting}>
              Reset to role defaults
            </Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>
              Save Permissions
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        {isOwner ? (
          <div className="rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[color:var(--text-secondary)]" style={{ background: 'var(--bg-subtle)' }}>
            The Owner always has full access to every module and permission — it cannot be restricted.
          </div>
        ) : (
          <div className="rounded-xl px-3 py-2.5 text-[11px] text-[color:var(--text-secondary)]" style={{ background: 'var(--bg-subtle)' }}>
            Switches marked <OverriddenPill /> differ from the {roleDefaults.label || user.role} role default for this user.
          </div>
        )}

        <div>
          <div className="label-eyebrow mb-1.5">Module Access Control</div>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl p-3 sm:grid-cols-3" style={{ background: 'var(--bg-subtle)' }}>
            {moduleKeys.map((key) => {
              const checked = isOwner ? true : Boolean(modules[key]);
              const disabled = isOwner || moduleDisabled(key);
              return (
                <div key={key} className="flex items-center justify-between gap-2 py-1">
                  <span>
                    <span className="block text-[12px] font-semibold text-[color:var(--text-primary)]">{moduleLabels[key] || key}</span>
                    {!isOwner && moduleDisabled(key) && (
                      <span className="block text-[10px] text-[color:var(--text-muted)]">Not in your plan</span>
                    )}
                    {!isOwner && !moduleDisabled(key) && isModuleOverridden(key) && <OverriddenPill />}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    disabled={disabled}
                    onClick={() => toggleModule(key)}
                    className={cx(
                      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
                      checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    )}
                  >
                    <span
                      className={cx(
                        'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                        checked ? 'translate-x-4' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="label-eyebrow mb-1.5">Permission Toggles</div>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl p-3 sm:grid-cols-3" style={{ background: 'var(--bg-subtle)' }}>
            {permissionKeys.map((key) => {
              const checked = isOwner ? true : Boolean(flags[key]);
              return (
                <div key={key} className="flex items-center justify-between gap-2 py-1">
                  <span>
                    <span className="block text-[12px] font-semibold text-[color:var(--text-primary)]">{permissionLabels[key] || key}</span>
                    {!isOwner && isFlagOverridden(key) && <OverriddenPill />}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    disabled={isOwner}
                    onClick={() => toggleFlag(key)}
                    className={cx(
                      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
                      checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    )}
                  >
                    <span
                      className={cx(
                        'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                        checked ? 'translate-x-4' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Field label="Max Discount %" className="w-40">
              <Input
                type="number"
                min="0"
                max="100"
                value={isOwner ? 100 : maxDiscountPercent}
                disabled={isOwner}
                onChange={(e) => setMaxDiscountPercent(e.target.value)}
              />
            </Field>
            {!isOwner && isDiscountOverridden && <OverriddenPill />}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Tables
 * ------------------------------------------------------------------ */

function TablesTab({ enableTables, showToast }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setTables(await api.get('/tables'));
    } catch (err) {
      showToast(api.message(err, 'Could not load tables.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (t) => {
    if (!window.confirm(`Delete table "${t.name}"?`)) return;
    try {
      const res = await api.del(`/tables/${t.id}`);
      showToast(res.message || 'Table removed.');
      load();
    } catch (err) {
      // Occupied tables are blocked server-side — surface that reason rather than a generic error.
      showToast(api.message(err, 'Could not delete table.'), 'error');
    }
  };

  if (loading) return <Spinner label="Loading tables…" />;

  const free = tables.filter((t) => t.status === 'FREE').length;
  const occupied = tables.filter((t) => t.status === 'OCCUPIED').length;

  return (
    <div className="space-y-4">
      {!enableTables && (
        <div
          className="rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[color:var(--text-secondary)]"
          style={{ background: 'var(--bg-subtle)' }}
        >
          Table management is currently switched off in POS settings — you can still manage tables here, but they will not appear at checkout until it is enabled.
        </div>
      )}

      <p className="text-[11px] text-[color:var(--text-muted)]">
        Looking for composite / recipe items? Build them from Inventory → Products → Add Product → type “Composite”.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total" value={tables.length} />
        <StatTile label="Free" value={free} tone="success" />
        <StatTile label="Occupied" value={occupied} tone="warning" />
      </div>

      <div className="flex justify-end">
        <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>
          Add Table
        </Button>
      </div>

      {tables.length === 0 ? (
        <EmptyState title="No tables yet" hint="Add tables to start using table management at checkout." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((t) => (
            <Panel key={t.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-[color:var(--text-primary)]">{t.name}</span>
                <Badge tone={t.status === 'FREE' ? 'success' : 'warning'}>{t.status}</Badge>
              </div>
              <div className="text-[11px] text-[color:var(--text-muted)]">
                {t.area || '—'} · {t.seats} seats
              </div>
              {t.bill && <Money value={t.bill.total} className="font-bold" />}
              <div className="flex justify-end">
                <Button size="sm" variant="danger" icon={Trash2} onClick={() => remove(t)}>
                  Delete
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <AddTableModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        showToast={showToast}
        onSaved={() => {
          setShowAdd(false);
          load();
        }}
      />
    </div>
  );
}

function AddTableModal({ open, onClose, showToast, onSaved }) {
  const blank = { name: '', area: '', seats: '' };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(blank);
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/tables', { ...form, seats: Number(form.seats) || 0 });
      showToast(res.message || 'Table added.');
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not add table.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Table"
      icon={Plus}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Add
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Area">
          <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Patio" />
        </Field>
        <Field label="Seats">
          <Input type="number" min="1" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}

