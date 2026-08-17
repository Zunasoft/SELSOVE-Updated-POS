import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Plus, Trash2, ShieldCheck, RotateCcw, Check, X as XIcon } from 'lucide-react';

import api from '../lib/api';
import {
  Panel, SectionHeader, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, StatTile, DataTable, cx
} from '../lib/ui';

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
      {tab === 'billing' && <BillingTaxTab billing={settings.billing} tax={settings.tax} saveSection={saveSection} showToast={showToast} />}
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
      </Panel>

      {/* 2. Invoice Section (in rows) */}
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

        {/* Row 3: Display Toggles in Rows */}
        <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-[11px] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider">
            Invoice Layout & Display Options
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle
              label="Show GST breakdown & rate slabs"
              hint="Displays CGST, SGST, and IGST breakdown rows on invoices"
              checked={Boolean(bForm.showGstBreakup !== false)}
              onChange={(v) => setBForm({ ...bForm, showGstBreakup: v })}
            />
            <Toggle
              label="Show cashier name on invoice"
              hint="Includes the counter operator / cashier name"
              checked={Boolean(bForm.showCashier !== false)}
              onChange={(v) => setBForm({ ...bForm, showCashier: v })}
            />
            <Toggle
              label="Show total amount in words"
              hint="Prints words format (e.g. Five Hundred Rupees Only) on A4 tax invoices"
              checked={Boolean(bForm.showWordsTotal !== false)}
              onChange={(v) => setBForm({ ...bForm, showWordsTotal: v })}
            />
            <Toggle
              label="Show authorized signature block"
              hint="Displays signature box at bottom right of tax invoices"
              checked={Boolean(bForm.showSignature !== false)}
              onChange={(v) => setBForm({ ...bForm, showSignature: v })}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={saveBilling} loading={savingBilling}>
            Save Invoice & Billing Settings
          </Button>
        </div>
      </Panel>

      {/* 3. Tax Settings Panel */}
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
    try {
      const res = await api.del(`/users/${u.id}`);
      showToast(res.message || 'User removed.');
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not delete user.'), 'error');
    }
  };

  if (loading || !data) return <Spinner label="Loading users…" />;

  const { users, roles, permissionMatrix, permissionKeys, permissionLabels, moduleKeys, moduleLabels, planFeatures } = data;
  const roleCounts = useMemo(
    () => roles.reduce((acc, r) => ({ ...acc, [r.key]: users.filter((u) => u.role === r.key).length }), {}),
    [roles, users]
  );

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
                      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                      checked ? 'bg-indigo-600' : ''
                    )}
                    style={{ background: checked ? undefined : 'var(--bg-subtle)', border: '1px solid var(--border)' }}
                  >
                    <span
                      className={cx(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                        checked ? 'translate-x-4' : 'translate-x-0.5'
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
                      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                      checked ? 'bg-indigo-600' : ''
                    )}
                    style={{ background: checked ? undefined : 'var(--bg-subtle)', border: '1px solid var(--border)' }}
                  >
                    <span
                      className={cx(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                        checked ? 'translate-x-4' : 'translate-x-0.5'
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

