import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders, Palette, FileText, Printer, Check, X, ArrowUp, ArrowDown,
  Eye, RefreshCw, Plus, Trash2, Copy, Download, Upload, Code,
  Layers, Type, Layout, ShieldCheck, Sparkles, CheckCircle2, Maximize2, Minimize2,
  Globe, Link, FileUp, FolderOpen, ExternalLink, HardDrive, FileCheck, Edit3
} from 'lucide-react';
import { Modal, Button, Field, Input, Select, Textarea, Badge, cx } from '../lib/ui';
import api from '../lib/api';
import {
  ThermalReceiptView, THERMAL_THEMES, DEFAULT_THERMAL_SECTIONS, SAMPLE_RECEIPT_DATA,
  BILLING_THERMAL_THEME_IDS
} from './ThermalReceiptTemplates';
import {
  InvoiceDocumentView, INVOICE_THEMES, ACCENT_COLORS, DEFAULT_INVOICE_SECTIONS, SAMPLE_INVOICE_DATA
} from './InvoiceDocumentTemplates';
import { exportInvoiceToWord, exportBillToWord, readDocumentTemplateFile } from '../lib/exporters';

function Toggle({ label, hint, checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 py-1.5 cursor-pointer select-none"
    >
      {label && (
        <span className="min-w-0 pr-2">
          <span className="block text-[12px] font-semibold text-[color:var(--text-primary)]">{label}</span>
          {hint && <span className="block text-[11px] text-[color:var(--text-muted)]">{hint}</span>}
        </span>
      )}
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

export function VisualTemplateBuilderModal({
  open,
  onClose,
  billing = {},
  company = {},
  saveSection,
  showToast,
  initialTarget = 'thermal', // 'thermal' | 'invoice'
  initialThemeId = null
}) {
  const [targetType, setTargetType] = useState(initialTarget || 'thermal'); // 'thermal' | 'invoice'
  const [activeTab, setActiveTab] = useState('sections'); // 'sections' | 'labels' | 'styling' | 'code' | 'templates'
  const [saving, setSaving] = useState(false);

  // Thermal/Bill state
  const [selectedThermalTheme, setSelectedThermalTheme] = useState(
    billing.activeThermalTemplate || 'detailed_gst'
  );
  const [activeCustomThermalId, setActiveCustomThermalId] = useState(null);
  const [thermalConfig, setThermalConfig] = useState({});

  // Invoice state
  const [selectedInvoiceTheme, setSelectedInvoiceTheme] = useState(
    billing.activeInvoiceTemplate || 'corporate_blue'
  );
  const [activeCustomInvoiceId, setActiveCustomInvoiceId] = useState(null);
  const [invoiceConfig, setInvoiceConfig] = useState({});

  // Custom Templates List
  const [customTemplates, setCustomTemplates] = useState(billing.customTemplates || []);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [showFullscreenView, setShowFullscreenView] = useState(false);
  const [renamingTemplate, setRenamingTemplate] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [downloadTarget, setDownloadTarget] = useState(null);

  // Local File & URL Template Download/Import State
  const [showUrlImportModal, setShowUrlImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importNameOverride, setImportNameOverride] = useState('');
  const [autoActivateImported, setAutoActivateImported] = useState(true);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTargetType(initialTarget);
    const customList = billing.customTemplates || [];
    setCustomTemplates(customList);

    // Builds a theme's editable config from ONLY that theme's own defaults
    // plus its own saved override (never the raw `billing` object — that's
    // one object shared by every theme, so spreading it here used to mean
    // every theme's editor opened pre-polluted with whatever the *last
    // edited* theme had saved, and editing propagated that further).
    // `custom.baseTheme` resolves an older-style custom entry (a distinct id
    // pointing at a base theme) as well as a same-id in-place override.
    const buildConfig = (themes, type, themeId, defaultSections) => {
      const custom = customList.find((t) => t.id === themeId && t.type === type);
      const baseId = custom ? (custom.baseTheme || themeId) : themeId;
      const themeMeta = themes.find((t) => t.id === baseId) || themes[0];
      const override = custom?.config || {};
      return {
        activeCustomId: custom ? custom.id : null,
        config: {
          ...themeMeta.defaults,
          ...override,
          sections: override.sections || themeMeta.defaults.sections || defaultSections,
          customLabels: {
            ...themeMeta.defaults.customLabels,
            ...(override.customLabels || {})
          }
        }
      };
    };

    const thermalId = (initialTarget === 'thermal' && initialThemeId) ? initialThemeId : (billing.activeThermalTemplate || 'detailed_gst');
    const th = buildConfig(THERMAL_THEMES, 'thermal', thermalId, DEFAULT_THERMAL_SECTIONS);
    setActiveCustomThermalId(th.activeCustomId);
    setSelectedThermalTheme(thermalId);
    setThermalConfig(th.config);

    const invoiceId = (initialTarget === 'invoice' && initialThemeId) ? initialThemeId : (billing.activeInvoiceTemplate || 'corporate_blue');
    const inv = buildConfig(INVOICE_THEMES, 'invoice', invoiceId, DEFAULT_INVOICE_SECTIONS);
    setActiveCustomInvoiceId(inv.activeCustomId);
    setSelectedInvoiceTheme(invoiceId);
    setInvoiceConfig(inv.config);
  }, [open, billing, initialTarget, initialThemeId]);

  // Active form pointer
  const isThermal = targetType === 'thermal';
  const currentConfig = isThermal ? thermalConfig : invoiceConfig;
  const setConfig = isThermal ? setThermalConfig : setInvoiceConfig;
  const currentTheme = isThermal ? selectedThermalTheme : selectedInvoiceTheme;

  // Billing only ever offers the 2 fixed thermal slots — see
  // BILLING_THERMAL_THEME_IDS. Invoice presets stay the full built-in list.
  // Either way, an in-place edit of a built-in is saved with the SAME id as
  // that built-in (self-referential baseTheme), so it must never also be
  // listed a second time under "My Custom Templates" — only genuinely new,
  // separately-created custom templates belong there.
  const presetThemesForPicker = isThermal
    ? THERMAL_THEMES.filter((th) => BILLING_THERMAL_THEME_IDS.includes(th.id))
    : INVOICE_THEMES;
  const builtInIds = new Set((isThermal ? THERMAL_THEMES : INVOICE_THEMES).map((th) => th.id));
  const trueCustomTemplates = customTemplates.filter((t) => t.type === targetType && !builtInIds.has(t.id));
  const visibleCustomTemplates = customTemplates.filter((t) => t.type === targetType);

  // Section Reordering Helpers
  const handleMoveSection = (index, direction) => {
    const sections = [...(currentConfig.sections || (isThermal ? DEFAULT_THERMAL_SECTIONS : DEFAULT_INVOICE_SECTIONS))];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const temp = sections[index];
    sections[index] = sections[targetIndex];
    sections[targetIndex] = temp;
    setConfig((prev) => ({ ...prev, sections }));
  };

  const handleToggleSection = (index) => {
    const sections = [...(currentConfig.sections || (isThermal ? DEFAULT_THERMAL_SECTIONS : DEFAULT_INVOICE_SECTIONS))];
    sections[index] = { ...sections[index], enabled: sections[index].enabled === false ? true : false };
    setConfig((prev) => ({ ...prev, sections }));
  };

  // Label editing helper
  const handleLabelChange = (key, val) => {
    setConfig((prev) => ({
      ...prev,
      customLabels: {
        ...(prev.customLabels || {}),
        [key]: val
      }
    }));
  };

  // Reset to Theme Defaults
  const handleResetThemeDefaults = () => {
    if (isThermal) {
      const th = THERMAL_THEMES.find((t) => t.id === selectedThermalTheme) || THERMAL_THEMES[0];
      setThermalConfig({
        ...th.defaults,
        sections: DEFAULT_THERMAL_SECTIONS,
        customLabels: { ...th.defaults.customLabels }
      });
      showToast(`Reset thermal template to ${th.name} defaults`);
    } else {
      const inv = INVOICE_THEMES.find((t) => t.id === selectedInvoiceTheme) || INVOICE_THEMES[0];
      setInvoiceConfig({
        ...inv.defaults,
        sections: DEFAULT_INVOICE_SECTIONS,
        customLabels: { ...inv.defaults.customLabels }
      });
      showToast(`Reset tax invoice to ${inv.name} defaults`);
    }
  };

  // Save current configuration. Every theme's config — built-in or custom —
  // now lives ONLY inside its own customTemplates[] entry, upserted here by
  // the theme's own id (baseTheme === id for an in-place edit of a built-in).
  // Nothing is ever written onto the shared `billing` object itself, so
  // editing one theme can no longer bleed into another's rendering.
  const handleSaveConfiguration = async () => {
    setSaving(true);
    try {
      const type = isThermal ? 'thermal' : 'invoice';
      const themeId = currentTheme;
      const themeMeta = isThermal
        ? (THERMAL_THEMES.find((t) => t.id === themeId))
        : (INVOICE_THEMES.find((t) => t.id === themeId));
      const existing = customTemplates.find((t) => t.id === themeId && t.type === type);

      const upserted = {
        id: themeId,
        name: existing?.name || themeMeta?.name || themeId,
        type,
        baseTheme: themeId,
        config: currentConfig,
        createdAt: existing?.createdAt || new Date().toISOString()
      };
      const updated = [...customTemplates.filter((t) => !(t.id === themeId && t.type === type)), upserted];
      setCustomTemplates(updated);

      const payload = {
        activeThermalTemplate: selectedThermalTheme,
        activeInvoiceTemplate: selectedInvoiceTheme,
        customTemplates: updated
      };

      const res = await saveSection('billing', payload);
      showToast(res.message || 'Template configuration saved successfully!');
      onClose();
    } catch (err) {
      showToast(api.message(err, 'Could not save template settings.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save as New Custom Template
  const handleSaveAsCustomTemplate = async () => {
    if (!newTemplateName.trim()) {
      showToast('Please enter a template name', 'error');
      return;
    }
    const newId = 'custom_' + Date.now();
    const baseThemeObj = targetType === 'thermal'
      ? (THERMAL_THEMES.find((t) => t.id === currentTheme) || THERMAL_THEMES[0])
      : (INVOICE_THEMES.find((t) => t.id === currentTheme) || INVOICE_THEMES[0]);

    const fullConfig = {
      ...baseThemeObj.defaults,
      ...currentConfig,
      sections: (currentConfig.sections && currentConfig.sections.length > 0)
        ? currentConfig.sections
        : (baseThemeObj.defaults.sections || (targetType === 'thermal' ? DEFAULT_THERMAL_SECTIONS : DEFAULT_INVOICE_SECTIONS)),
      customLabels: {
        ...baseThemeObj.defaults.customLabels,
        ...(currentConfig.customLabels || {})
      }
    };

    const newTemplate = {
      id: newId,
      name: newTemplateName.trim(),
      type: targetType,
      baseTheme: currentTheme,
      config: fullConfig,
      createdAt: new Date().toISOString()
    };
    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    setNewTemplateName('');
    setShowSaveAsModal(false);

    try {
      if (saveSection) {
        await saveSection('billing', { customTemplates: updated });
      }
      showToast(`Custom template "${newTemplate.name}" created and saved to library!`);
    } catch (_) {
      showToast(`Custom template "${newTemplate.name}" created!`);
    }
  };

  // Load Custom Template into editor
  const handleLoadCustomTemplate = (tmpl) => {
    const isTh = tmpl.type === 'thermal';
    const baseThemeObj = isTh
      ? (THERMAL_THEMES.find((t) => t.id === tmpl.baseTheme) || THERMAL_THEMES[0])
      : (INVOICE_THEMES.find((t) => t.id === tmpl.baseTheme) || INVOICE_THEMES[0]);

    const rawConfig = tmpl.config || {};
    const mergedConfig = {
      ...baseThemeObj.defaults,
      ...rawConfig,
      sections: (rawConfig.sections && rawConfig.sections.length > 0)
        ? rawConfig.sections
        : (baseThemeObj.defaults.sections || (isTh ? DEFAULT_THERMAL_SECTIONS : DEFAULT_INVOICE_SECTIONS)),
      customLabels: {
        ...baseThemeObj.defaults.customLabels,
        ...(rawConfig.customLabels || {})
      }
    };

    if (isTh) {
      setTargetType('thermal');
      setActiveCustomThermalId(tmpl.id);
      setSelectedThermalTheme(tmpl.baseTheme || 'detailed_gst');
      setThermalConfig(mergedConfig);
    } else {
      setTargetType('invoice');
      setActiveCustomInvoiceId(tmpl.id);
      setSelectedInvoiceTheme(tmpl.baseTheme || 'corporate_blue');
      setInvoiceConfig(mergedConfig);
    }
    setActiveTab('sections');
    showToast(`Selected template: "${tmpl.name}"`);
  };

  // General Template Switcher (Preset Theme or Custom Template)
  const handleSelectTemplate = (id) => {
    const foundCustom = customTemplates.find((t) => t.id === id);
    if (foundCustom) {
      handleLoadCustomTemplate(foundCustom);
      return;
    }

    if (isThermal) {
      setActiveCustomThermalId(null);
      setSelectedThermalTheme(id);
      const th = THERMAL_THEMES.find((t) => t.id === id) || THERMAL_THEMES[0];
      setThermalConfig((prev) => ({
        ...prev,
        ...th.defaults,
        customHtml: '',
        customLabels: { ...th.defaults.customLabels, ...(prev.customLabels || {}) }
      }));
      showToast(`Selected preset theme: ${th.name}`);
    } else {
      setActiveCustomInvoiceId(null);
      setSelectedInvoiceTheme(id);
      const inv = INVOICE_THEMES.find((t) => t.id === id) || INVOICE_THEMES[0];
      setInvoiceConfig((prev) => ({
        ...prev,
        ...inv.defaults,
        customHtml: '',
        customLabels: { ...inv.defaults.customLabels, ...(prev.customLabels || {}) }
      }));
      showToast(`Selected preset theme: ${inv.name}`);
    }
  };

  // Set Template as Default Store Template
  const handleSetAsStoreDefault = async (templateId, type) => {
    const isTh = type === 'thermal';
    const patch = isTh
      ? { activeThermalTemplate: templateId }
      : { activeInvoiceTemplate: templateId };

    try {
      if (saveSection) {
        await saveSection('billing', patch);
      }
      showToast(`Set as active store default template!`);
    } catch (_) {
      showToast('Template set as store default.');
    }
  };

  // Rename Custom Template
  const handleRenameCustomTemplate = async (id, newName) => {
    if (!newName || !newName.trim()) {
      showToast('Template name cannot be empty', 'error');
      return;
    }
    const updated = customTemplates.map((t) => (t.id === id ? { ...t, name: newName.trim() } : t));
    setCustomTemplates(updated);
    setRenamingTemplate(null);
    setRenameValue('');
    try {
      if (saveSection) {
        await saveSection('billing', { customTemplates: updated });
      }
      showToast('Custom template renamed successfully!');
    } catch (_) {
      showToast('Custom template renamed.');
    }
  };

  // Delete Custom Template
  const handleDeleteCustomTemplate = async (id) => {
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    if (activeCustomThermalId === id) setActiveCustomThermalId(null);
    if (activeCustomInvoiceId === id) setActiveCustomInvoiceId(null);
    try {
      if (saveSection) {
        await saveSection('billing', { customTemplates: updated });
      }
      showToast('Custom template deleted.');
    } catch (_) {
      showToast('Custom template deleted locally.');
    }
  };

  // Export Active Template JSON
  const handleExportTemplateJson = () => {
    const exportData = {
      name: isThermal ? 'POS Bill Template' : 'A4 Tax Invoice Template',
      type: targetType,
      baseTheme: currentTheme,
      config: currentConfig,
      exportedAt: new Date().toISOString(),
      generator: 'Selsolve Smart POS Template Engine'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${targetType}-template-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Active template configuration exported as JSON');
  };

  // Download Template in chosen format (JSON, Word, or PDF)
  const handleExecuteDownload = (format, target) => {
    if (!target) return;
    const isTh = target.type === 'thermal';
    const safeName = (target.name || (isTh ? 'pos-bill' : 'tax-invoice'))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    if (format === 'json') {
      const exportData = {
        name: target.name,
        type: target.type,
        baseTheme: target.baseTheme || (isTh ? selectedThermalTheme : selectedInvoiceTheme),
        config: target.config || (isTh ? thermalConfig : invoiceConfig),
        exportedAt: new Date().toISOString(),
        generator: 'Selsolve Smart POS Template Engine'
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${target.type}-template-${safeName}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded "${target.name}" as JSON file`);
    } else if (format === 'word') {
      const targetConfig = target.config || (isTh ? thermalConfig : invoiceConfig);
      const targetTheme = target.baseTheme || (isTh ? selectedThermalTheme : selectedInvoiceTheme);
      if (isTh) {
        exportBillToWord({
          receipt: SAMPLE_RECEIPT_DATA,
          settings: { company, billing: targetConfig },
          customConfig: targetConfig,
          activeTheme: targetTheme
        });
      } else {
        exportInvoiceToWord({
          invoice: SAMPLE_INVOICE_DATA,
          settings: { company, billing: targetConfig },
          customConfig: targetConfig,
          activeTheme: targetTheme
        });
      }
      showToast(`Exported "${target.name}" as Word (.doc) document`);
    } else if (format === 'pdf') {
      if (target.isCurrent) {
        window.print();
      } else {
        handleLoadCustomTemplate(target);
        setTimeout(() => {
          window.print();
        }, 350);
      }
      showToast(`Opening Print / PDF export dialog for "${target.name}"...`);
    }
    setDownloadTarget(null);
  };

  // Export Custom Templates as JSON Backup
  const handleExportAllCustomTemplates = () => {
    const listToExport = visibleCustomTemplates && visibleCustomTemplates.length > 0 ? visibleCustomTemplates : customTemplates;
    if (!listToExport || listToExport.length === 0) {
      showToast(`No custom ${isThermal ? 'POS bill' : 'tax invoice'} templates to export.`, 'error');
      return;
    }
    const exportData = {
      templates: listToExport,
      type: targetType,
      total: listToExport.length,
      exportedAt: new Date().toISOString(),
      generator: 'Selsolve Smart POS Template Backup'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selsolve-${targetType}-templates-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${listToExport.length} ${isThermal ? 'POS bill' : 'tax invoice'} custom templates as backup package`);
  };

  // Ingest & Validate Template Data (from Local File or Remote URL)
  const processImportedTemplateData = (data, sourceName = 'Imported Template', nameOverride = '', autoActivate = true) => {
    if (!data) {
      showToast('No valid template data found in source.', 'error');
      return;
    }

    // Handle backup package format: { templates: [...] }
    const rawItems = Array.isArray(data) ? data : (data.templates && Array.isArray(data.templates) ? data.templates : null);

    if (rawItems) {
      if (rawItems.length === 0) {
        showToast('Template package contains no templates.', 'error');
        return;
      }
      const newItems = rawItems.map((item, idx) => {
        const itemType = item.type === 'invoice' ? 'invoice' : 'thermal';
        const itemTheme = item.baseTheme || item.theme || (itemType === 'thermal' ? 'detailed_gst' : 'corporate_blue');
        return {
          id: 'custom_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6),
          name: item.name || `${sourceName} #${idx + 1}`,
          type: itemType,
          baseTheme: itemTheme,
          config: item.config || { ...item },
          createdAt: new Date().toISOString()
        };
      });
      setCustomTemplates((prev) => [...prev, ...newItems]);
      showToast(`Successfully imported ${newItems.length} custom templates!`);
      return;
    }

    // Handle single template object
    const importedType = data.type === 'invoice' ? 'invoice' : (data.type === 'thermal' ? 'thermal' : targetType);
    const importedBaseTheme = data.baseTheme || data.theme || (importedType === 'thermal' ? 'detailed_gst' : 'corporate_blue');

    const baseThemeObj = importedType === 'thermal'
      ? (THERMAL_THEMES.find((t) => t.id === importedBaseTheme) || THERMAL_THEMES[0])
      : (INVOICE_THEMES.find((t) => t.id === importedBaseTheme) || INVOICE_THEMES[0]);

    const rawConfig = data.config || { ...data };
    const mergedConfig = {
      ...baseThemeObj.defaults,
      ...rawConfig,
      sections: (rawConfig.sections && rawConfig.sections.length > 0)
        ? rawConfig.sections
        : (baseThemeObj.defaults.sections || (importedType === 'thermal' ? DEFAULT_THERMAL_SECTIONS : DEFAULT_INVOICE_SECTIONS)),
      customLabels: {
        ...baseThemeObj.defaults.customLabels,
        ...(rawConfig.customLabels || {})
      }
    };

    const importedName = (nameOverride || data.name || sourceName || 'Imported Template').trim();

    const newTemplate = {
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: importedName,
      type: importedType,
      baseTheme: importedBaseTheme,
      config: mergedConfig,
      createdAt: new Date().toISOString()
    };

    const updatedTemplates = [...customTemplates, newTemplate];
    setCustomTemplates(updatedTemplates);

    if (autoActivate) {
      if (importedType === 'thermal') {
        setTargetType('thermal');
        setSelectedThermalTheme(importedBaseTheme);
        setThermalConfig(mergedConfig);
      } else {
        setTargetType('invoice');
        setSelectedInvoiceTheme(importedBaseTheme);
        setInvoiceConfig(mergedConfig);
      }
      setActiveTab('sections');
    }

    try {
      if (saveSection) {
        saveSection('billing', { customTemplates: updatedTemplates });
      }
    } catch (_) {}

    showToast(`Successfully imported template: "${importedName}" into editor and live preview!`);
  };

  // Local File Upload Handler (reads JSON, Word, PDF, Text)
  const handleLocalFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await readDocumentTemplateFile(file);
      const sourceName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      processImportedTemplateData(parsed, sourceName, '', true);
    } catch (err) {
      showToast(`Could not read template from file: ${err.message}. Please upload a valid .json, .doc, or .txt template.`, 'error');
    } finally {
      e.target.value = '';
    }
  };

  // URL-based Template Download & Import Handler
  const handleDownloadFromUrl = async (e) => {
    e?.preventDefault?.();
    const url = importUrl.trim();
    if (!url) {
      showToast('Please enter a template URL', 'error');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
      showToast('URL must start with http:// or https://', 'error');
      return;
    }

    setFetchingUrl(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const urlName = url.split('/').pop()?.replace(/\.[^/.]+$/, '')?.replace(/[-_]/g, ' ') || 'Web Template';
      processImportedTemplateData(data, urlName, importNameOverride, autoActivateImported);
      setShowUrlImportModal(false);
      setImportUrl('');
      setImportNameOverride('');
    } catch (err) {
      showToast(`Failed to download template from URL: ${err.message}. If CORS blocks direct fetch, save the JSON locally and use 'Import from Local File'.`, 'error');
    } finally {
      setFetchingUrl(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Visual Bill & Invoice Template Editor"
        subtitle="Reorder layout sections, rename table column headers, customize statutory labels, add custom banners, and preview live in full screen"
        icon={Sliders}
        size="fullscreen"
        allowFullscreen={true}
        footer={
          <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" icon={RefreshCw} onClick={handleResetThemeDefaults}>
                Reset Defaults
              </Button>
              <Button variant="outline" icon={Download} onClick={handleExportTemplateJson}>
                Export JSON
              </Button>
              <Button variant="outline" icon={Plus} onClick={() => setShowSaveAsModal(true)}>
                Save as New Template
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                icon={Check}
                onClick={handleSaveConfiguration}
                loading={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save &amp; Apply Template
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 h-full flex flex-col">
          {/* Top Bar: Target Selector (Bill vs A4/A5 Invoice) & Base Preset Theme */}
          <div className="rounded-2xl border border-[color:var(--border)] p-3 bg-[color:var(--bg-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
            {/* Target Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-[color:var(--bg-surface)] border border-[color:var(--border)] font-bold text-xs">
              <button
                type="button"
                onClick={() => setTargetType('thermal')}
                className={cx(
                  'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                  isThermal
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                )}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>POS Bill (Slip)</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType('invoice')}
                className={cx(
                  'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                  !isThermal
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Tax Invoice (A4 / A5)</span>
              </button>
            </div>

            {/* Full Selectable Template Switcher (Presets + My Custom Templates) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[color:var(--text-muted)]">Select Template:</span>
              <select
                value={isThermal ? (activeCustomThermalId || selectedThermalTheme) : (activeCustomInvoiceId || selectedInvoiceTheme)}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="text-[11.5px] font-bold rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3 py-1.5 text-[color:var(--text-primary)] max-w-[260px]"
              >
                <optgroup label="Preset Themes">
                  {presetThemesForPicker.map((th) => {
                    const isStoreDef = isThermal
                      ? (billing.activeThermalTemplate || 'detailed_gst') === th.id
                      : (billing.activeInvoiceTemplate || 'corporate_blue') === th.id;
                    return (
                      <option key={th.id} value={th.id}>
                        {th.name} ({th.badge}) {isStoreDef ? '★ [Store Default]' : ''}
                      </option>
                    );
                  })}
                </optgroup>
                {trueCustomTemplates.length > 0 && (
                  <optgroup label="My Custom Templates">
                    {trueCustomTemplates.map((ct) => {
                      const isStoreDef = isThermal
                        ? billing.activeThermalTemplate === ct.id
                        : billing.activeInvoiceTemplate === ct.id;
                      return (
                        <option key={ct.id} value={ct.id}>
                          ★ {ct.name} {isStoreDef ? '[Store Default]' : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>

              {/* Store Default Status / Button */}
              {(() => {
                const currentLoadedId = isThermal
                  ? (activeCustomThermalId || selectedThermalTheme)
                  : (activeCustomInvoiceId || selectedInvoiceTheme);
                const storeDefaultId = isThermal
                  ? (billing.activeThermalTemplate || 'detailed_gst')
                  : (billing.activeInvoiceTemplate || 'corporate_blue');
                const isDefault = currentLoadedId === storeDefaultId;

                return isDefault ? (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Default Store Template
                  </span>
                ) : (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => handleSetAsStoreDefault(currentLoadedId, targetType)}
                    title="Set this template as the store's default active template"
                  >
                    Set as Default
                  </Button>
                );
              })()}
            </div>
          </div>

          {/* Builder Tabs */}
          <div className="flex items-center gap-1.5 border-b border-[color:var(--border)] pb-2 overflow-x-auto shrink-0">
            {[
              { key: 'sections', label: '1. Sections & Order', icon: Layers },
              { key: 'labels', label: '2. Text & Column Labels', icon: Type },
              { key: 'styling', label: '3. Styling & Rules', icon: Layout },
              { key: 'code', label: '4. Custom CSS', icon: Code },
              { key: 'templates', label: '5. Custom Templates', icon: Copy }
            ].map((tb) => {
              const Icon = tb.icon;
              const active = activeTab === tb.key;
              return (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => setActiveTab(tb.key)}
                  className={cx(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0',
                    active
                      ? 'bg-[color:var(--text-primary)] text-[color:var(--bg-surface)] shadow-xs'
                      : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-subtle)]'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tb.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main 2-Column Grid: Controls & Live Simulator */}
          <div className="grid gap-4 lg:grid-cols-12 items-start flex-1 min-h-0">
            {/* Left Controls (6 Cols) */}
            <div className="lg:col-span-6 max-h-[calc(98vh-220px)] overflow-y-auto pr-1 space-y-4">
              {/* ---------------- TAB 1: SECTIONS & ORDER ---------------- */}
              {activeTab === 'sections' && (
                <div className="space-y-3">
                  <div className="text-[11.5px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">
                    Reorder Document Layout Sections
                  </div>

                  {/* Notice Banner Input */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3 bg-[color:var(--bg-subtle)] space-y-1.5">
                    <Field label="Custom Notice / Announcement Banner" hint="Prints highlighted banner text near top of receipt/invoice">
                      <Input
                        value={currentConfig.customBannerText || ''}
                        onChange={(e) => setConfig({ ...currentConfig, customBannerText: e.target.value })}
                        placeholder="e.g. ⭐ FESTIVE OFFER: Flat 10% OFF on next visit with this bill! ⭐"
                      />
                    </Field>
                  </div>

                  {/* Section List Cards */}
                  <div className="space-y-2">
                    {(currentConfig.sections || (isThermal ? DEFAULT_THERMAL_SECTIONS : DEFAULT_INVOICE_SECTIONS)).map((sec, idx, arr) => {
                      const isEnabled = sec.enabled !== false;
                      return (
                        <div
                          key={sec.id}
                          className={cx(
                            'rounded-2xl border p-3 flex items-center justify-between transition-all gap-3',
                            isEnabled
                              ? 'border-[color:var(--border)] bg-[color:var(--bg-surface)] shadow-xs'
                              : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] opacity-60'
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-xs font-bold text-[color:var(--text-muted)] w-5">
                              {idx + 1}.
                            </span>
                            <div>
                              <div className="text-xs font-bold text-[color:var(--text-primary)]">
                                {sec.name}
                              </div>
                              <div className="text-[10px] text-[color:var(--text-muted)] font-mono">
                                id: {sec.id}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveSection(idx, -1)}
                              className="p-1 rounded-lg border border-[color:var(--border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)] disabled:opacity-30"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === arr.length - 1}
                              onClick={() => handleMoveSection(idx, 1)}
                              className="p-1 rounded-lg border border-[color:var(--border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)] disabled:opacity-30"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <Toggle
                              checked={isEnabled}
                              onChange={() => handleToggleSection(idx)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---------------- TAB 2: TEXT & COLUMN LABELS ---------------- */}
              {activeTab === 'labels' && (
                <div className="space-y-4">
                  {/* 1. Header & Title Labels */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                      Document Title & Copy
                    </div>

                    <Field label="Document Headline Title">
                      <Input
                        value={currentConfig.customLabels?.receiptTitle || currentConfig.customLabels?.invoiceTitle || ''}
                        onChange={(e) => {
                          handleLabelChange(isThermal ? 'receiptTitle' : 'invoiceTitle', e.target.value);
                        }}
                        placeholder="e.g. TAX INVOICE / CASH MEMO / RETAIL RECEIPT"
                      />
                    </Field>

                    {/* Title presets */}
                    <div className="flex flex-wrap gap-1">
                      {['TAX INVOICE', 'RETAIL TAX INVOICE', 'BILL OF SUPPLY', 'CASH MEMO', 'ESTIMATE / QUOTATION', 'ORDER RECEIPT'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleLabelChange(isThermal ? 'receiptTitle' : 'invoiceTitle', preset)}
                          className="px-2 py-0.5 rounded-lg border border-[color:var(--border)] text-[10px] font-bold text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface)]"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {!isThermal && (
                      <Field label="Recipient Copy Label">
                        <Input
                          value={currentConfig.customLabels?.recipientCopy || ''}
                          onChange={(e) => handleLabelChange('recipientCopy', e.target.value)}
                          placeholder="Original for Recipient"
                        />
                      </Field>
                    )}
                  </div>

                  {/* 2. Item Table Column Headers */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                      Table Column Headers
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <Field label="Item Description Header">
                        <Input
                          value={currentConfig.customLabels?.itemColHeader || currentConfig.customLabels?.itemHeader || ''}
                          onChange={(e) => handleLabelChange(isThermal ? 'itemHeader' : 'itemColHeader', e.target.value)}
                          placeholder="Item Description"
                        />
                      </Field>
                      <Field label="HSN / SAC Header">
                        <Input
                          value={currentConfig.customLabels?.hsnColHeader || currentConfig.customLabels?.hsnHeader || ''}
                          onChange={(e) => handleLabelChange(isThermal ? 'hsnHeader' : 'hsnColHeader', e.target.value)}
                          placeholder="HSN/SAC"
                        />
                      </Field>
                      <Field label="Quantity Header">
                        <Input
                          value={currentConfig.customLabels?.qtyColHeader || currentConfig.customLabels?.qtyHeader || ''}
                          onChange={(e) => handleLabelChange(isThermal ? 'qtyHeader' : 'qtyColHeader', e.target.value)}
                          placeholder="Qty"
                        />
                      </Field>
                      <Field label="Rate / Price Header">
                        <Input
                          value={currentConfig.customLabels?.rateColHeader || currentConfig.customLabels?.rateHeader || ''}
                          onChange={(e) => handleLabelChange(isThermal ? 'rateHeader' : 'rateColHeader', e.target.value)}
                          placeholder="Rate (₹)"
                        />
                      </Field>
                      <Field label="Tax % Header">
                        <Input
                          value={currentConfig.customLabels?.taxRateColHeader || currentConfig.customLabels?.taxHeader || ''}
                          onChange={(e) => handleLabelChange(isThermal ? 'taxHeader' : 'taxRateColHeader', e.target.value)}
                          placeholder="Tax %"
                        />
                      </Field>
                      <Field label="Amount Header">
                        <Input
                          value={currentConfig.customLabels?.amountColHeader || currentConfig.customLabels?.totalHeader || ''}
                          onChange={(e) => handleLabelChange(isThermal ? 'totalHeader' : 'amountColHeader', e.target.value)}
                          placeholder="Amount (₹)"
                        />
                      </Field>
                    </div>
                  </div>

                  {/* 3. Summary & Footer Labels */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                      Summary &amp; Footer Labels
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <Field label="Total Value Label">
                        <Input
                          value={currentConfig.customLabels?.totalLabel || ''}
                          onChange={(e) => handleLabelChange('totalLabel', e.target.value)}
                          placeholder="TOTAL INVOICE VALUE:"
                        />
                      </Field>
                      <Field label="Savings Callout Label">
                        <Input
                          value={currentConfig.customLabels?.savingsLabel || ''}
                          onChange={(e) => handleLabelChange('savingsLabel', e.target.value)}
                          placeholder="🎉 YOU SAVED"
                        />
                      </Field>
                      <Field label="Terms Title">
                        <Input
                          value={currentConfig.customLabels?.termsTitle || ''}
                          onChange={(e) => handleLabelChange('termsTitle', e.target.value)}
                          placeholder="Terms & Conditions"
                        />
                      </Field>
                      {!isThermal && (
                        <Field label="Signatory Title">
                          <Input
                            value={currentConfig.customLabels?.signatoryTitle || ''}
                            onChange={(e) => handleLabelChange('signatoryTitle', e.target.value)}
                            placeholder="Authorised Signatory"
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- TAB 3: STYLING & RULES ---------------- */}
              {activeTab === 'styling' && (
                <div className="space-y-4">
                  {isThermal ? (
                    /* Bill Styling */
                    <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                      <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                        Bill Paper &amp; Typography
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Paper Roll Width">
                          <Select
                            value={thermalConfig.paperWidth || '80mm'}
                            onChange={(e) => setThermalConfig({ ...thermalConfig, paperWidth: e.target.value })}
                          >
                            <option value="80mm">80mm (3-Inch Standard)</option>
                            <option value="58mm">58mm (2-Inch Mini)</option>
                          </Select>
                        </Field>
                        <Field label="Font Size Scale">
                          <Select
                            value={thermalConfig.fontSize || 'md'}
                            onChange={(e) => setThermalConfig({ ...thermalConfig, fontSize: e.target.value })}
                          >
                            <option value="sm">Small / Compact</option>
                            <option value="md">Medium / Standard</option>
                            <option value="lg">Large / Bold</option>
                          </Select>
                        </Field>
                        <Field label="Divider Line Style">
                          <Select
                            value={thermalConfig.dividerStyle || 'dashed'}
                            onChange={(e) => setThermalConfig({ ...thermalConfig, dividerStyle: e.target.value })}
                          >
                            <option value="dashed">Dashed (-----)</option>
                            <option value="dotted">Dotted (.....)</option>
                            <option value="solid">Solid (━━━━━)</option>
                            <option value="double">Double (═════)</option>
                            <option value="stars">Stars (*****)</option>
                            <option value="equals">Equals (=====)</option>
                          </Select>
                        </Field>
                      </div>
                    </div>
                  ) : (
                    /* Invoice Styling */
                    <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-3 bg-[color:var(--bg-subtle)]">
                      <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                        Invoice Paper & Color Accent
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Paper Size">
                          <Select
                            value={invoiceConfig.invoicePaperSize || invoiceConfig.paperSize || 'A4'}
                            onChange={(e) => setInvoiceConfig({ ...invoiceConfig, invoicePaperSize: e.target.value, paperSize: e.target.value })}
                          >
                            <option value="A4">A4 Full Page (Standard 210 × 297 mm)</option>
                            <option value="A5">A5 Half Page (Compact 148 × 210 mm)</option>
                          </Select>
                        </Field>

                        <div>
                          <div className="text-[11px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5">
                            Accent Color
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {ACCENT_COLORS.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setInvoiceConfig({ ...invoiceConfig, invoiceAccentColor: c.id, accentColor: c.id })}
                                className={cx(
                                  'px-2 py-1 rounded-xl text-[10.5px] font-bold border transition-all flex items-center gap-1',
                                  (invoiceConfig.invoiceAccentColor || invoiceConfig.accentColor || 'blue') === c.id
                                    ? 'border-slate-900 bg-white ring-2 ring-blue-500/40 text-slate-900'
                                    : 'border-slate-200 bg-white text-slate-600'
                                )}
                              >
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                                <span>{c.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Field Visibility Toggles */}
                  <div className="rounded-2xl border border-[color:var(--border)] p-3.5 space-y-2 bg-[color:var(--bg-subtle)]">
                    <div className="text-[11.5px] font-bold text-[color:var(--text-primary)] border-b pb-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                      Field Visibility Toggles
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        label="Store Logo"
                        checked={Boolean(isThermal ? thermalConfig.showLogo : invoiceConfig.showInvoiceLogo !== false)}
                        onChange={(v) => isThermal ? setThermalConfig({ ...thermalConfig, showLogo: v }) : setInvoiceConfig({ ...invoiceConfig, showInvoiceLogo: v })}
                      />
                      <Toggle
                        label="Store Tax Identifiers (GSTIN, PAN, CIN, FSSAI)"
                        checked={Boolean(isThermal ? thermalConfig.showGstin : invoiceConfig.showCompanyTaxMeta !== false)}
                        onChange={(v) => isThermal ? setThermalConfig({ ...thermalConfig, showGstin: v, showFssai: v }) : setInvoiceConfig({ ...invoiceConfig, showCompanyTaxMeta: v })}
                      />
                      <Toggle
                        label="Customer / Buyer Details"
                        checked={Boolean(isThermal ? thermalConfig.showCustomerDetails !== false : true)}
                        onChange={(v) => isThermal && setThermalConfig({ ...thermalConfig, showCustomerDetails: v })}
                      />
                      <Toggle
                        label="HSN / SAC Code column"
                        checked={Boolean(isThermal ? thermalConfig.showHsn !== false : invoiceConfig.showItemHsn !== false)}
                        onChange={(v) => isThermal ? setThermalConfig({ ...thermalConfig, showHsn: v }) : setInvoiceConfig({ ...invoiceConfig, showItemHsn: v })}
                      />
                      <Toggle
                        label="Tax Breakdown Slab Matrix"
                        checked={Boolean(isThermal ? thermalConfig.showGstBreakup !== false : invoiceConfig.showHsnSummaryTable !== false)}
                        onChange={(v) => isThermal ? setThermalConfig({ ...thermalConfig, showGstBreakup: v }) : setInvoiceConfig({ ...invoiceConfig, showHsnSummaryTable: v })}
                      />
                      <Toggle
                        label="Instant UPI QR Code"
                        checked={Boolean(isThermal ? thermalConfig.showQrCode !== false : invoiceConfig.showPaymentQr !== false)}
                        onChange={(v) => isThermal ? setThermalConfig({ ...thermalConfig, showQrCode: v }) : setInvoiceConfig({ ...invoiceConfig, showPaymentQr: v })}
                      />
                      <Toggle
                        label="Terms & Conditions"
                        checked={Boolean(isThermal ? thermalConfig.showTerms !== false : invoiceConfig.showInvoiceTerms !== false)}
                        onChange={(v) => isThermal ? setThermalConfig({ ...thermalConfig, showTerms: v }) : setInvoiceConfig({ ...invoiceConfig, showInvoiceTerms: v })}
                      />
                      {!isThermal && (
                        <Toggle
                          label="Authorized Signatory Box"
                          checked={Boolean(invoiceConfig.showInvoiceSignature !== false)}
                          onChange={(v) => setInvoiceConfig({ ...invoiceConfig, showInvoiceSignature: v })}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- TAB 4: CUSTOM CSS & HTML MARKUP ---------------- */}
              {activeTab === 'code' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11.5px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">
                        Advanced CSS Overrides
                      </div>
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)]">
                      Add custom CSS rules to directly style the receipt/invoice container. Styles are compiled in real-time in the simulator.
                    </p>

                    <Textarea
                      rows={6}
                      value={currentConfig.customCss || ''}
                      onChange={(e) => setConfig({ ...currentConfig, customCss: e.target.value })}
                      placeholder={`/* Custom CSS Rules */\n#printable-thermal-receipt { font-weight: bold; }\n#printable-tax-invoice { border-radius: 8px; }`}
                      className="font-mono text-xs"
                    />
                  </div>

                  {/* Custom HTML / Word Template Markup Block */}
                  <div className="space-y-2 pt-3 border-t border-[color:var(--border-subtle)]">
                    <div className="flex items-center justify-between">
                      <div className="text-[11.5px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Exact Document HTML Markup (Word / Custom Layout)
                      </div>
                      {currentConfig.customHtml && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setConfig({ ...currentConfig, customHtml: '' })}
                          title="Clear custom HTML and switch back to standard modular section builder"
                        >
                          Clear / Use Section Builder
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-[color:var(--text-muted)]">
                      When present (e.g. from an uploaded Word document or custom HTML file), the live simulator renders this exact layout with live dynamic variables like <code className="text-indigo-600 dark:text-indigo-400">{'{{orderId}}'}</code>, <code className="text-indigo-600 dark:text-indigo-400">{'{{companyName}}'}</code>, and <code className="text-indigo-600 dark:text-indigo-400">{'{{total}}'}</code>.
                    </p>

                    <Textarea
                      rows={10}
                      value={currentConfig.customHtml || ''}
                      onChange={(e) => setConfig({ ...currentConfig, customHtml: e.target.value })}
                      placeholder={`<!-- Optional Exact Custom HTML Markup -->\n<div class="my-custom-bill">\n  <h2>{{companyName}}</h2>\n  <p>Invoice #: {{orderId}} - Total: {{total}}</p>\n</div>`}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {/* ---------------- TAB 5: MY CUSTOM TEMPLATES ---------------- */}
              {activeTab === 'templates' && (
                <div className="space-y-3">
                  {/* Hidden File Input for Local Import (supports JSON, Word, PDF, Text) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.doc,.docx,.pdf,.txt,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                    onChange={handleLocalFileUpload}
                    className="hidden"
                  />

                  {/* Header Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[color:var(--border)]">
                    <div>
                      <div className="text-[11.5px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">
                        Saved {isThermal ? 'POS Bill' : 'Tax Invoice'} Custom Templates ({visibleCustomTemplates.length})
                      </div>
                      <div className="text-[10px] text-[color:var(--text-muted)] mt-0.5">
                        Import from local disk (.json, .doc, .pdf), download from URL, or save active {isThermal ? 'bill' : 'invoice'} layout
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="xs"
                        variant="secondary"
                        icon={HardDrive}
                        onClick={() => fileInputRef.current?.click()}
                        title="Upload and load a .json, .doc, or .pdf template from your local disk"
                      >
                        Import from Local File
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        icon={Globe}
                        onClick={() => setShowUrlImportModal(true)}
                        title="Download and install a template directly from a web URL or CDN"
                      >
                        Download from URL
                      </Button>
                      <Button
                        size="xs"
                        variant="primary"
                        icon={Plus}
                        onClick={() => setShowSaveAsModal(true)}
                        title={`Save active configuration as a new custom ${isThermal ? 'POS bill' : 'tax invoice'} template`}
                      >
                        Save Current as New
                      </Button>
                      {visibleCustomTemplates.length > 0 && (
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={Download}
                          onClick={handleExportAllCustomTemplates}
                          title={`Export all custom ${isThermal ? 'POS bill' : 'tax invoice'} templates as a backup JSON package`}
                        >
                          Backup {isThermal ? 'Bills' : 'Invoices'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {visibleCustomTemplates.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--bg-subtle)] space-y-3">
                      <div className="mx-auto w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[color:var(--text-primary)]">
                          No custom {isThermal ? 'POS bill' : 'tax invoice'} templates saved yet
                        </div>
                        <div className="text-[11px] text-[color:var(--text-muted)] max-w-sm mx-auto mt-0.5">
                          You can import an existing JSON, Word, or PDF {isThermal ? 'bill/receipt' : 'tax invoice'} template from your computer, download one from a public URL, or clone and save your active {isThermal ? 'bill' : 'invoice'} theme.
                        </div>
                      </div>
                      <div className="flex justify-center gap-2 pt-1">
                        <Button size="sm" variant="secondary" icon={HardDrive} onClick={() => fileInputRef.current?.click()}>
                          Import Local File
                        </Button>
                        <Button size="sm" variant="secondary" icon={Globe} onClick={() => setShowUrlImportModal(true)}>
                          Download from URL
                        </Button>
                        <Button size="sm" variant="primary" icon={Plus} onClick={() => setShowSaveAsModal(true)}>
                          Save Active as New
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[calc(98vh-270px)] overflow-y-auto pr-1">
                      {visibleCustomTemplates.map((tmpl) => {
                        const isStoreDef = tmpl.type === 'thermal'
                          ? billing.activeThermalTemplate === tmpl.id
                          : billing.activeInvoiceTemplate === tmpl.id;
                        const isLoaded = tmpl.type === 'thermal'
                          ? activeCustomThermalId === tmpl.id
                          : activeCustomInvoiceId === tmpl.id;

                        return (
                          <div
                            key={tmpl.id}
                            className={cx(
                              'rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-all',
                              isLoaded
                                ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-500/50'
                                : 'border-[color:var(--border)] bg-[color:var(--bg-surface)] hover:border-slate-400'
                            )}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-black text-[color:var(--text-primary)]">
                                  {tmpl.name}
                                </span>
                                <Badge tone={tmpl.type === 'thermal' ? 'indigo' : 'blue'}>
                                  {tmpl.type === 'thermal' ? 'POS Bill' : 'A4/A5 Invoice'}
                                </Badge>
                                {isStoreDef && (
                                  <span className="text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Store Default
                                  </span>
                                )}
                                {isLoaded && (
                                  <span className="text-[9px] font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded-md">
                                    Active in Editor
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[color:var(--text-muted)]">
                                Base: <span className="font-semibold">{tmpl.baseTheme}</span> · Added {new Date(tmpl.createdAt).toLocaleDateString('en-IN')}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <Button
                                size="xs"
                                variant={isLoaded ? 'primary' : 'secondary'}
                                onClick={() => handleLoadCustomTemplate(tmpl)}
                                title="Load template into editor preview"
                              >
                                {isLoaded ? 'Active in Editor' : 'Select & Edit'}
                              </Button>

                              {!isStoreDef && (
                                <Button
                                  size="xs"
                                  variant="secondary"
                                  onClick={() => handleSetAsStoreDefault(tmpl.id, tmpl.type)}
                                  title="Make this custom template the store's default active template"
                                >
                                  Set as Default
                                </Button>
                              )}

                              <Button
                                size="xs"
                                variant="ghost"
                                icon={Edit3}
                                onClick={() => {
                                  setRenamingTemplate(tmpl);
                                  setRenameValue(tmpl.name);
                                }}
                                title="Rename template"
                              >
                                Rename
                              </Button>

                              <Button
                                size="xs"
                                variant="outline"
                                icon={Download}
                                onClick={() => setDownloadTarget(tmpl)}
                                title="Download this template as JSON, Word, or PDF"
                              >
                                Download
                              </Button>

                              <Button
                                size="xs"
                                variant="danger"
                                icon={Trash2}
                                onClick={() => handleDeleteCustomTemplate(tmpl.id)}
                                title="Delete template"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Live Preview Simulator (6 Cols) */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-[11.5px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Live Real-Time Simulator
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Download}
                    onClick={() => {
                      const activeThemeObj = isThermal
                        ? THERMAL_THEMES.find((t) => t.id === selectedThermalTheme)
                        : INVOICE_THEMES.find((t) => t.id === selectedInvoiceTheme);
                      setDownloadTarget({
                        isCurrent: true,
                        type: targetType,
                        name: activeThemeObj?.name || (isThermal ? 'Active POS Bill' : 'Active Tax Invoice'),
                        baseTheme: isThermal ? selectedThermalTheme : selectedInvoiceTheme,
                        config: isThermal ? thermalConfig : invoiceConfig
                      });
                    }}
                    title="Download active template as JSON, Word, or PDF"
                  >
                    Download / Export
                  </Button>
                  <Button size="sm" variant="secondary" icon={Maximize2} onClick={() => setShowFullscreenView(true)}>
                    Full Screen
                  </Button>
                </div>
              </div>

              {/* Mockup Frame */}
              <div className="w-full max-h-[calc(98vh-220px)] overflow-y-auto p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex justify-center shadow-inner">
                {isThermal ? (
                  <ThermalReceiptView
                    receipt={SAMPLE_RECEIPT_DATA}
                    settings={{ company, billing: thermalConfig }}
                    customConfig={thermalConfig}
                    activeTheme={selectedThermalTheme}
                  />
                ) : (
                  <InvoiceDocumentView
                    invoice={SAMPLE_INVOICE_DATA}
                    settings={{ company, billing: invoiceConfig }}
                    customConfig={invoiceConfig}
                    activeTheme={selectedInvoiceTheme}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Save As New Custom Template Modal Popup */}
        <Modal
          open={showSaveAsModal}
          onClose={() => setShowSaveAsModal(false)}
          title="Save as Custom Template"
          subtitle="Give your customized layout a recognizable name"
          size="sm"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button onClick={() => setShowSaveAsModal(false)}>Cancel</Button>
              <Button variant="primary" icon={Check} onClick={handleSaveAsCustomTemplate}>
                Create Template
              </Button>
            </div>
          }
        >
          <Field label="Template Name" hint="e.g. Festive Discount Bill, Cafe Express Slip">
            <Input
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="My Custom Bill Template"
              autoFocus
            />
          </Field>
        </Modal>

        {/* Download / Import Template from URL Modal Popup */}
        {showUrlImportModal && (
          <Modal
            open={showUrlImportModal}
            onClose={() => {
              setShowUrlImportModal(false);
              setImportUrl('');
              setImportNameOverride('');
            }}
            title="Download & Import Template from URL"
            subtitle="Fetch and install any custom POS bill or invoice JSON template directly from a web link"
            icon={Globe}
            size="md"
            footer={
              <div className="flex items-center justify-between w-full">
                <Button
                  onClick={() => {
                    setShowUrlImportModal(false);
                    setImportUrl('');
                    setImportNameOverride('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  icon={Globe}
                  loading={fetchingUrl}
                  onClick={handleDownloadFromUrl}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Download &amp; Install Template
                </Button>
              </div>
            }
          >
            <form onSubmit={handleDownloadFromUrl} className="space-y-4">
              <Field
                label="Template Web URL (JSON) *"
                hint="Direct URL to a hosted template JSON file or API endpoint"
              >
                <Input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://example.com/templates/restaurant-bill.json"
                  required
                  autoFocus
                />
              </Field>

              <Field
                label="Custom Template Name (Optional)"
                hint="Override the template name when saved in your local library"
              >
                <Input
                  value={importNameOverride}
                  onChange={(e) => setImportNameOverride(e.target.value)}
                  placeholder="e.g. Online Cafe Premium Template"
                />
              </Field>

              <div className="space-y-2">
                <Toggle
                  label="Activate & Load into Editor immediately"
                  hint="Preloads this newly downloaded template into the visual simulator upon download"
                  checked={autoActivateImported}
                  onChange={setAutoActivateImported}
                />
              </div>

              <div className="rounded-xl p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Tip: Direct URL Download &amp; Local Fallback
                </div>
                <p>
                  Paste any direct URL containing valid Selsolve Bill or Invoice template JSON. If the remote server restricts cross-origin downloads (CORS), simply download the file onto your computer and use <strong>"Import from Local File"</strong>.
                </p>
              </div>
            </form>
          </Modal>
        )}
      </Modal>

      {/* Full Screen Immersive Bill Preview Modal */}
      {showFullscreenView && (
        <Modal
          open={showFullscreenView}
          onClose={() => setShowFullscreenView(false)}
          title={isThermal ? 'POS Bill — Full Screen View' : 'A4 / A5 Tax Invoice — Full Screen View'}
          subtitle={isThermal ? `${thermalConfig.paperWidth || '80mm'} Bill High-Resolution Preview` : `${invoiceConfig.invoicePaperSize || invoiceConfig.paperSize || 'A4'} Document High-Resolution Preview`}
          size="fullscreen"
          allowFullscreen={true}
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-[color:var(--text-muted)] font-mono">
                {isThermal ? `Bill Theme: ${selectedThermalTheme} · Width: ${thermalConfig.paperWidth || '80mm'}` : `Invoice Theme: ${selectedInvoiceTheme} · Size: ${invoiceConfig.invoicePaperSize || invoiceConfig.paperSize || 'A4'}`}
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
            {isThermal ? (
              <ThermalReceiptView
                receipt={SAMPLE_RECEIPT_DATA}
                settings={{ company, billing: thermalConfig }}
                customConfig={thermalConfig}
                activeTheme={selectedThermalTheme}
              />
            ) : (
              <InvoiceDocumentView
                invoice={SAMPLE_INVOICE_DATA}
                settings={{ company, billing: invoiceConfig }}
                customConfig={invoiceConfig}
                activeTheme={selectedInvoiceTheme}
              />
            )}
          </div>
        </Modal>
      )}
      {/* Rename Custom Template Modal */}
      {renamingTemplate && (
        <Modal
          open={Boolean(renamingTemplate)}
          onClose={() => setRenamingTemplate(null)}
          title="Rename Custom Template"
          subtitle={`Update template title for ${renamingTemplate.type === 'thermal' ? 'POS Bill' : 'Tax Invoice'}`}
          icon={Edit3}
          size="sm"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="secondary" onClick={() => setRenamingTemplate(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleRenameCustomTemplate(renamingTemplate.id, renameValue)}
              >
                Save Name
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <Field label="Template Name" hint="Display name shown in template galleries and print selectors">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="e.g. Modern Cafe Bill"
                autoFocus
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Download / Export Format Selector Modal */}
      {downloadTarget && (
        <Modal
          open={Boolean(downloadTarget)}
          onClose={() => setDownloadTarget(null)}
          title="Download Template"
          subtitle={`Select format for "${downloadTarget.name || (downloadTarget.type === 'thermal' ? 'POS Bill' : 'Tax Invoice')}"`}
          icon={Download}
          className="!max-w-[50vw] !w-[50vw]"
          footer={
            <div className="flex justify-end w-full">
              <Button variant="secondary" onClick={() => setDownloadTarget(null)}>
                Cancel
              </Button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3 py-2">
            {/* 1. JSON Template */}
            <button
              type="button"
              onClick={() => handleExecuteDownload('json', downloadTarget)}
              className="group flex flex-col items-center justify-center p-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)] hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 hover:border-indigo-500 transition-all text-center cursor-pointer shadow-xs hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
                <Code className="w-6 h-6" />
              </div>
              <div className="text-sm font-black text-[color:var(--text-primary)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                JSON
              </div>
              <span className="text-[11px] font-semibold text-[color:var(--text-muted)] mt-1">
                .json file
              </span>
            </button>

            {/* 2. Microsoft Word Document */}
            <button
              type="button"
              onClick={() => handleExecuteDownload('word', downloadTarget)}
              className="group flex flex-col items-center justify-center p-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)] hover:bg-blue-50/70 dark:hover:bg-blue-950/40 hover:border-blue-500 transition-all text-center cursor-pointer shadow-xs hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-sm font-black text-[color:var(--text-primary)] group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Word
              </div>
              <span className="text-[11px] font-semibold text-[color:var(--text-muted)] mt-1">
                .doc file
              </span>
            </button>

            {/* 3. PDF Document */}
            <button
              type="button"
              onClick={() => handleExecuteDownload('pdf', downloadTarget)}
              className="group flex flex-col items-center justify-center p-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)] hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 hover:border-emerald-500 transition-all text-center cursor-pointer shadow-xs hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
                <Printer className="w-6 h-6" />
              </div>
              <div className="text-sm font-black text-[color:var(--text-primary)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                PDF
              </div>
              <span className="text-[11px] font-semibold text-[color:var(--text-muted)] mt-1">
                .pdf / Print
              </span>
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
