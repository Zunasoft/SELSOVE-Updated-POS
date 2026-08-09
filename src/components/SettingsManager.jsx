import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Plus, Trash2 } from 'lucide-react';

import api, { money } from '../lib/api';
import {
  Panel, SectionHeader, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, StatTile, DataTable, cx
} from '../lib/ui';

const TABS = [
  { key: 'company', label: 'Company' },
  { key: 'billing', label: 'Billing & Tax' },
  { key: 'hardware', label: 'Hardware' },
  { key: 'users', label: 'Users & Roles' },
  { key: 'tables', label: 'Tables' },
  { key: 'recipes', label: 'Composite Items' }
];

/**
 * Store configuration in one place — company profile, billing/tax defaults,
 * connected hardware, staff access, dine-in tables and composite (recipe)
 * items. Each tab owns its own data so switching tabs never re-fetches
 * everything else.
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
      <SectionHeader eyebrow="Configuration" title="Settings" icon={Settings} subtitle="Company profile, billing, tax, hardware, staff access, tables and composite items." />

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
      {tab === 'billing' && <BillingTaxTab billing={settings.billing} tax={settings.tax} saveSection={saveSection} showToast={showToast} />}
      {tab === 'hardware' && <HardwareTab showToast={showToast} />}
      {tab === 'users' && <UsersTab showToast={showToast} />}
      {tab === 'tables' && <TablesTab enableTables={settings.pos?.enableTables} showToast={showToast} />}
      {tab === 'recipes' && <CompositeItemsTab showToast={showToast} />}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span>
        <span className="block text-[12px] font-semibold text-[color:var(--text-primary)]">{label}</span>
        {hint && <span className="block text-[11px] text-[color:var(--text-muted)]">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-indigo-600' : '')}
        style={{ background: checked ? undefined : 'var(--bg-subtle)', border: '1px solid var(--border)' }}
      >
        <span
          className={cx(
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </label>
  );
}

function Summary({ label, value, bold }) {
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <div className={`mt-0.5 text-[13px] text-[color:var(--text-primary)] ${bold ? 'font-bold' : 'font-semibold'}`}>{value}</div>
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

function BillingTaxTab({ billing, tax, saveSection, showToast }) {
  const [bForm, setBForm] = useState(billing || {});
  const [tForm, setTForm] = useState(tax || {});
  const [savingBilling, setSavingBilling] = useState(false);
  const [savingTax, setSavingTax] = useState(false);

  useEffect(() => {
    setBForm(billing || {});
  }, [billing]);
  useEffect(() => {
    setTForm(tax || {});
  }, [tax]);

  const saveBilling = async () => {
    setSavingBilling(true);
    try {
      const res = await saveSection('billing', bForm);
      showToast(res.message || 'Billing settings saved.');
    } catch (err) {
      showToast(api.message(err, 'Could not save billing settings.'), 'error');
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

  return (
    <div className="space-y-4">
      <Panel className="space-y-4">
        <div className="label-eyebrow">Billing</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Invoice prefix">
            <Input value={bForm.invoicePrefix || ''} onChange={(e) => setBForm({ ...bForm, invoicePrefix: e.target.value })} />
          </Field>
          <Field label="Next invoice no.">
            <Input type="number" value={bForm.nextInvoiceNo ?? ''} onChange={(e) => setBForm({ ...bForm, nextInvoiceNo: e.target.value })} />
          </Field>
          <Field label="Currency symbol">
            <Input value={bForm.currency || ''} onChange={(e) => setBForm({ ...bForm, currency: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Terms & conditions">
            <Textarea rows={3} value={bForm.termsText || ''} onChange={(e) => setBForm({ ...bForm, termsText: e.target.value })} />
          </Field>
          <Field label="Receipt footer text">
            <Textarea rows={3} value={bForm.footerText || ''} onChange={(e) => setBForm({ ...bForm, footerText: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-1 sm:grid-cols-3">
          <Toggle label="Show GST breakup" checked={Boolean(bForm.showGstBreakup)} onChange={(v) => setBForm({ ...bForm, showGstBreakup: v })} />
          <Toggle label="Round off total" checked={Boolean(bForm.roundOff)} onChange={(v) => setBForm({ ...bForm, roundOff: v })} />
          <Toggle label="Print after checkout" checked={Boolean(bForm.printAfterCheckout)} onChange={(v) => setBForm({ ...bForm, printAfterCheckout: v })} />
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={saveBilling} loading={savingBilling}>
            Save Billing Settings
          </Button>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <div className="label-eyebrow">Tax</div>
        <Toggle label="Enable GST" checked={Boolean(tForm.enableGst)} onChange={(v) => setTForm({ ...tForm, enableGst: v })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tax mode">
            <Select value={tForm.taxMode || 'EXCLUSIVE'} onChange={(e) => setTForm({ ...tForm, taxMode: e.target.value })}>
              <option value="EXCLUSIVE">Exclusive</option>
              <option value="INCLUSIVE">Inclusive</option>
            </Select>
          </Field>
          <Field label="Default tax rate (%)">
            <Input type="number" value={tForm.defaultTaxRate ?? ''} onChange={(e) => setTForm({ ...tForm, defaultTaxRate: e.target.value })} />
          </Field>
          <Field label="GST scheme">
            <Select value={tForm.gstScheme || 'REGULAR'} onChange={(e) => setTForm({ ...tForm, gstScheme: e.target.value })}>
              <option value="REGULAR">Regular</option>
              <option value="COMPOSITION">Composition</option>
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
    </div>
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

function UsersTab({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

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
    try {
      const res = await api.del(`/users/${u.id}`);
      showToast(res.message || 'User removed.');
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not delete user.'), 'error');
    }
  };

  if (loading || !data) return <Spinner label="Loading users…" />;

  const { users, roles, permissionMatrix, permissionKeys } = data;
  const roleCounts = useMemo(
    () => roles.reduce((acc, r) => ({ ...acc, [r]: users.filter((u) => u.role === r).length }), {}),
    [roles, users]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Users" value={users.length} />
        {roles.map((r) => (
          <StatTile key={r} label={r} value={roleCounts[r] || 0} />
        ))}
      </div>

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
          { key: 'role', label: 'Role', width: 100, render: (u) => <Badge tone="accent">{u.role}</Badge> },
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
            width: 150,
            render: (u) => (
              <div className="flex justify-end gap-1.5">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(u);
                    setShowModal(true);
                  }}
                >
                  Edit
                </Button>
                {u.role !== 'Owner' && (
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
        permissionMatrix={permissionMatrix}
        permissionKeys={permissionKeys}
        showToast={showToast}
        onSaved={() => {
          setShowModal(false);
          load();
        }}
      />
    </div>
  );
}

function UserModal({ open, onClose, editing, roles, permissionMatrix, permissionKeys, showToast, onSaved }) {
  const blank = { name: '', phone: '', email: '', role: roles[0] || '', pin: '' };
  const [form, setForm] = useState(blank);
  const [overrides, setOverrides] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({ name: editing.name || '', phone: editing.phone || '', email: editing.email || '', role: editing.role, pin: '' });
      setOverrides(editing.permissions || {});
    } else {
      setForm(blank);
      setOverrides({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const roleDefaults = permissionMatrix[form.role] || {};
  const effective = (key) => (key in overrides ? overrides[key] : Boolean(roleDefaults[key]));
  const toggleKey = (key) => setOverrides((prev) => ({ ...prev, [key]: !effective(key) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      // Only send an override map when the user actually deviated from the role default.
      const body = { ...form, permissions: Object.keys(overrides).length ? overrides : null };
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
          <Field label="Role">
            <Select
              value={form.role}
              onChange={(e) => {
                setForm({ ...form, role: e.target.value });
                setOverrides({});
              }}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
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

        <div>
          <div className="label-eyebrow mb-1.5">Permissions</div>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl p-3 sm:grid-cols-3" style={{ background: 'var(--bg-subtle)' }}>
            {permissionKeys.map((key) => (
              <label key={key} className="flex items-center gap-2 text-[12px] font-semibold text-[color:var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={effective(key)}
                  onChange={() => toggleKey(key)}
                  className="h-3.5 w-3.5 rounded accent-indigo-600"
                />
                {key}
              </label>
            ))}
          </div>
        </div>
      </form>
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

/* ------------------------------------------------------------------ *
 * Composite Items (recipes)
 * ------------------------------------------------------------------ */

function CompositeItemsTab({ showToast }) {
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, p, u] = await Promise.all([api.get('/recipes'), api.get('/products'), api.get('/units')]);
      setRecipes(r || []);
      setProducts(p || []);
      setUnits(u || []);
    } catch (err) {
      showToast(api.message(err, 'Could not load composite items.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (r) => {
    try {
      const res = await api.del(`/recipes/${r.id}`);
      showToast(res.message || 'Recipe removed.');
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not delete recipe.'), 'error');
    }
  };

  if (loading) return <Spinner label="Loading composite items…" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" icon={Plus} onClick={() => setShowNew(true)}>
          New Recipe
        </Button>
      </div>

      <DataTable
        columns={[
          { key: 'productName', label: 'Product', render: (r) => <span className="font-bold">{r.productName}</span> },
          { key: 'yieldQty', label: 'Yield Qty', align: 'right', width: 90, render: (r) => r.yieldQty },
          { key: 'ingredients', label: 'Ingredients', align: 'right', width: 100, render: (r) => r.ingredients?.length || 0 },
          { key: 'unitCost', label: 'Unit Cost', align: 'right', width: 110, render: (r) => <Money value={r.unitCost} /> },
          { key: 'sellingPrice', label: 'Selling Price', align: 'right', width: 120, render: (r) => <Money value={r.sellingPrice} /> },
          {
            key: 'margin',
            label: 'Margin',
            align: 'right',
            width: 110,
            render: (r) => <Money value={r.margin} colored className="font-bold" />
          },
          {
            key: 'producible',
            label: 'Producible',
            align: 'right',
            width: 100,
            render: (r) => <Badge tone={r.producible === 0 ? 'danger' : 'neutral'}>{r.producible}</Badge>
          },
          {
            key: 'actions',
            label: '',
            align: 'right',
            width: 60,
            render: (r) => <Button size="sm" variant="danger" icon={Trash2} onClick={() => remove(r)} />
          }
        ]}
        rows={recipes}
        empty={<EmptyState title="No composite items yet" hint="Build a recipe from raw-material ingredients to track its cost and margin." />}
      />

      <RecipeModal
        open={showNew}
        onClose={() => setShowNew(false)}
        products={products}
        units={units}
        showToast={showToast}
        onSaved={() => {
          setShowNew(false);
          load();
        }}
      />
    </div>
  );
}

const blankIngredient = () => ({ productId: '', qty: '' });

function RecipeModal({ open, onClose, products, units, showToast, onSaved }) {
  const [productId, setProductId] = useState('');
  const [yieldQty, setYieldQty] = useState('1');
  const [ingredients, setIngredients] = useState([blankIngredient()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProductId('');
      setYieldQty('1');
      setIngredients([blankIngredient()]);
    }
  }, [open]);

  const setIngredient = (idx, patch) => setIngredients((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addIngredient = () => setIngredients((ls) => [...ls, blankIngredient()]);
  const removeIngredient = (idx) => setIngredients((ls) => ls.filter((_, i) => i !== idx));

  // Live raw-material cost preview — same math the backend will use to derive unitCost.
  const rawCost = useMemo(
    () =>
      ingredients.reduce((s, l) => {
        const p = products.find((pr) => pr.id === l.productId);
        return s + (Number(l.qty) || 0) * (p?.purchasePrice || 0);
      }, 0),
    [ingredients, products]
  );

  const canSubmit = Boolean(productId) && Number(yieldQty) > 0 && ingredients.some((l) => l.productId && Number(l.qty) > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await api.post('/recipes', {
        productId,
        yieldQty: Number(yieldQty),
        ingredients: ingredients
          .filter((l) => l.productId && Number(l.qty) > 0)
          .map((l) => ({ productId: l.productId, qty: Number(l.qty) }))
      });
      showToast(res.message || 'Recipe created.');
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not create recipe.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Recipe"
      subtitle="Define the raw materials consumed to produce a finished item."
      icon={Plus}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!canSubmit}>
            Create Recipe
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Finished product" required>
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">— Select product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Yield qty" required>
            <Input type="number" min="1" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label-eyebrow">Ingredients</span>
            <Button type="button" size="sm" icon={Plus} onClick={addIngredient}>
              Add line
            </Button>
          </div>

          <div className="surface overflow-hidden rounded-2xl">
            <table className="ledger-table w-full border-collapse">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Ingredient</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Qty</th>
                  <th style={{ width: 70 }}>Unit</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {ingredients.map((line, idx) => {
                  const p = products.find((pr) => pr.id === line.productId);
                  return (
                    <tr key={idx}>
                      <td>
                        <Select value={line.productId} onChange={(e) => setIngredient(idx, { productId: e.target.value })}>
                          <option value="">— Select product —</option>
                          {products.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.qty}
                          onChange={(e) => setIngredient(idx, { qty: e.target.value })}
                          className="text-right"
                        />
                      </td>
                      <td className="text-center text-[11px] text-[color:var(--text-muted)]">
                        {p?.unit || units.find((u) => u === p?.unit) || '—'}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => removeIngredient(idx)}
                          disabled={ingredients.length === 1}
                          className="rounded-lg p-1.5 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--bg-subtle)] disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end rounded-xl px-4 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
          <Summary label="Raw Material Cost" value={money(rawCost)} bold />
        </div>
      </form>
    </Modal>
  );
}
