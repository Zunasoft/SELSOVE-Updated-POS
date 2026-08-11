import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Truck, MessageSquare, Plus, Edit3, Trash2, BookOpen, Phone,
  Star, Wallet, ShoppingBag, Save
} from 'lucide-react';

import api, { money, fmtDate, fmtDateTime } from '../lib/api';
import {
  Panel, SectionHeader, StatTile, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, SearchInput, SegmentedControl, DataTable
} from '../lib/ui';

/**
 * Customer and vendor masters — SOW Modules 7 and 8.
 * This is the operational party register: contacts, groups, credit limits and
 * reminders. Balances shown here are read from the accounting sub-ledgers, and
 * settling them happens under Accounts → Receipts / Payments.
 */
export default function CustomerVendorLedger({ showToast }) {
  const [tab, setTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [ledgerParty, setLedgerParty] = useState(null);

  const isCustomers = tab === 'customers';

  const load = async () => {
    setLoading(true);
    try {
      const [c, v, g] = await Promise.all([
        api.get('/customers'),
        api.get('/vendors'),
        api.get('/customer-groups').catch(() => [])
      ]);
      setCustomers(c);
      setVendors(v);
      setGroups(g);
    } catch (err) {
      showToast(api.message(err, 'Could not load parties.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const source = isCustomers ? customers : vendors;
    const needle = query.trim().toLowerCase();
    if (!needle) return source;
    return source.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        String(p.phone || '').includes(needle) ||
        String(p.gstin || '').toLowerCase().includes(needle)
    );
  }, [isCustomers, customers, vendors, query]);

  const sendReminder = async (customer) => {
    try {
      const res = await api.post(`/customers/${customer.id}/send-whatsapp`);
      // Open the prepared WhatsApp message so the shopkeeper only has to press send.
      if (res.data?.waLink) window.open(res.data.waLink, '_blank');
      showToast(res.message);
    } catch (err) {
      showToast(api.message(err, 'Could not prepare the reminder.'), 'error');
    }
  };

  const remove = async (vendor) => {
    if (!window.confirm(`Delete vendor "${vendor.name}"?`)) return;
    try {
      const res = await api.del(`/vendors/${vendor.id}`);
      showToast(res.message);
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not delete the vendor.'), 'error');
    }
  };

  if (loading) return <Spinner label="Loading customers and vendors…" />;

  const totalReceivable = customers.reduce((s, c) => s + (c.outstanding || 0), 0);
  const totalPayable = vendors.reduce((s, v) => s + (v.outstandingPayable || 0), 0);
  const overLimit = customers.filter((c) => c.creditLimit > 0 && c.outstanding > c.creditLimit);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Parties"
        title="Customers & Vendors"
        icon={Users}
        subtitle="Contact details, customer groups, credit limits and loyalty. Outstanding balances come straight from the accounting sub-ledgers."
        actions={
          <>
            <SegmentedControl
              value={tab}
              onChange={setTab}
              options={[
                { value: 'customers', label: 'Customers' },
                { value: 'vendors', label: 'Vendors' }
              ]}
            />
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              {isCustomers ? 'Add Customer' : 'Add Vendor'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isCustomers ? (
          <>
            <StatTile label="Customers" value={customers.length} icon={Users} />
            <StatTile label="Total Receivable" value={money(totalReceivable, { decimals: false })} tone="warning" icon={Wallet} />
            <StatTile
              label="Over Credit Limit"
              value={overLimit.length}
              sub={overLimit.length ? overLimit[0].name : 'All within limit'}
              tone={overLimit.length ? 'danger' : 'success'}
            />
            <StatTile
              label="Loyalty Points Issued"
              value={customers.reduce((s, c) => s + (c.loyaltyPoints || 0), 0)}
              icon={Star}
            />
          </>
        ) : (
          <>
            <StatTile label="Vendors" value={vendors.length} icon={Truck} />
            <StatTile label="Total Payable" value={money(totalPayable, { decimals: false })} tone="danger" icon={Wallet} />
            <StatTile
              label="Total Purchased"
              value={money(vendors.reduce((s, v) => s + (v.totalPurchased || 0), 0), { decimals: false })}
              icon={ShoppingBag}
            />
            <StatTile label="Purchase Invoices" value={vendors.reduce((s, v) => s + (v.purchaseCount || 0), 0)} />
          </>
        )}
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={isCustomers ? 'Search customer name or phone…' : 'Search vendor name, phone or GSTIN…'}
        className="max-w-md"
      />

      {isCustomers ? (
        <DataTable
          maxHeight="60vh"
          columns={[
            {
              key: 'name',
              label: 'Customer',
              render: (c) => (
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[color:var(--text-primary)]">{c.name}</div>
                  <div className="text-[10.5px] text-[color:var(--text-muted)]">
                    {c.phone || 'No phone'}
                    {c.email ? ` · ${c.email}` : ''}
                  </div>
                </div>
              )
            },
            { key: 'group', label: 'Group', width: 110, render: (c) => <Badge tone="info">{c.group || 'Retail'}</Badge> },
            {
              key: 'loyaltyPoints',
              label: 'Loyalty',
              align: 'right',
              width: 100,
              render: (c) => (
                <span className="tabular font-semibold text-[color:var(--accent)]">★ {c.loyaltyPoints || 0}</span>
              )
            },
            { key: 'billCount', label: 'Bills', align: 'right', width: 80 },
            {
              key: 'totalPurchases',
              label: 'Lifetime Value',
              align: 'right',
              width: 130,
              render: (c) => <Money value={c.totalPurchases} decimals={false} />
            },
            { key: 'creditLimit', label: 'Credit Limit', align: 'right', width: 120, render: (c) => <Money value={c.creditLimit} showZero={false} decimals={false} /> },
            {
              key: 'outstanding',
              label: 'Outstanding',
              align: 'right',
              width: 130,
              render: (c) => (
                <div>
                  <Money value={c.outstanding} className="font-bold" />
                  {c.creditLimit > 0 && c.outstanding > c.creditLimit && (
                    <div className="text-[9.5px] font-bold uppercase text-rose-500">Over limit</div>
                  )}
                  {c.advance > 0 && <div className="text-[9.5px] font-bold uppercase text-emerald-500">Advance held</div>}
                </div>
              )
            },
            {
              key: 'actions',
              label: '',
              align: 'right',
              width: 140,
              render: (c) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" icon={BookOpen} onClick={() => setLedgerParty({ ...c, type: 'CUSTOMER' })} />
                  {c.outstanding > 0 && c.phone && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={MessageSquare}
                      onClick={() => sendReminder(c)}
                      className="text-emerald-600 dark:text-emerald-400"
                      title="WhatsApp payment reminder"
                    />
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Edit3}
                    onClick={() => {
                      setEditing(c);
                      setShowForm(true);
                    }}
                  />
                </div>
              )
            }
          ]}
          rows={rows}
          empty={<EmptyState icon={Users} title="No customers registered" hint="Add a customer to track credit sales and loyalty." />}
          footer={['Total', '', '', '', money(customers.reduce((s, c) => s + (c.totalPurchases || 0), 0)), '', money(totalReceivable), '']}
        />
      ) : (
        <DataTable
          maxHeight="60vh"
          columns={[
            {
              key: 'name',
              label: 'Vendor',
              render: (v) => (
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[color:var(--text-primary)]">{v.name}</div>
                  <div className="text-[10.5px] text-[color:var(--text-muted)]">
                    {v.phone || 'No phone'}
                    {v.gstin ? ` · GSTIN ${v.gstin}` : ''}
                  </div>
                </div>
              )
            },
            { key: 'address', label: 'Location', width: 160, render: (v) => <span className="text-[color:var(--text-muted)]">{v.address || '—'}</span> },
            { key: 'purchaseCount', label: 'Invoices', align: 'right', width: 100 },
            {
              key: 'totalPurchased',
              label: 'Total Purchased',
              align: 'right',
              width: 150,
              render: (v) => <Money value={v.totalPurchased} decimals={false} />
            },
            {
              key: 'outstandingPayable',
              label: 'Payable',
              align: 'right',
              width: 130,
              render: (v) => (
                <div>
                  <Money value={v.outstandingPayable} className="font-bold" />
                  {v.advancePaid > 0 && <div className="text-[9.5px] font-bold uppercase text-emerald-500">Advance paid</div>}
                </div>
              )
            },
            {
              key: 'actions',
              label: '',
              align: 'right',
              width: 130,
              render: (v) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" icon={BookOpen} onClick={() => setLedgerParty({ ...v, type: 'VENDOR' })} />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Edit3}
                    onClick={() => {
                      setEditing(v);
                      setShowForm(true);
                    }}
                  />
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(v)} className="text-rose-500" />
                </div>
              )
            }
          ]}
          rows={rows}
          empty={<EmptyState icon={Truck} title="No vendors registered" hint="Add a vendor to record purchases and payables." />}
          footer={[
            'Total',
            '',
            vendors.reduce((s, v) => s + (v.purchaseCount || 0), 0),
            money(vendors.reduce((s, v) => s + (v.totalPurchased || 0), 0)),
            money(totalPayable),
            ''
          ]}
        />
      )}

      <PartyFormModal
        open={showForm}
        isCustomer={isCustomers}
        editing={editing}
        groups={groups}
        onClose={() => setShowForm(false)}
        showToast={showToast}
        onSaved={() => {
          setShowForm(false);
          load();
        }}
      />

      <PartyLedgerModal party={ledgerParty} onClose={() => setLedgerParty(null)} showToast={showToast} />
    </div>
  );
}

function PartyFormModal({ open, isCustomer, editing, groups, onClose, showToast, onSaved }) {
  const blank = {
    name: '',
    phone: '',
    email: '',
    address: '',
    group: 'Retail',
    creditLimit: '',
    gstin: '',
    openingBalance: '',
    outstandingPayable: ''
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(editing ? { ...blank, ...editing } : blank);
  }, [open, editing]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const base = isCustomer ? '/customers' : '/vendors';
      if (editing) {
        await api.put(`${base}/${editing.id}`, form);
        showToast(`${form.name} updated.`);
      } else {
        await api.post(base, form);
        showToast(`${form.name} added.`);
      }
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not save.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit — ${editing.name}` : isCustomer ? 'Add Customer' : 'Add Vendor'}
      subtitle={
        editing
          ? 'Balances are changed through vouchers, not by editing this form.'
          : 'An opening balance posts to the party sub-ledger against Opening Balance Equity.'
      }
      icon={editing ? Edit3 : Plus}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Save} onClick={submit} loading={saving} disabled={!form.name.trim()}>
            {editing ? 'Save Changes' : 'Add'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2">
          <Input value={form.name} onChange={set('name')} placeholder={isCustomer ? 'e.g. Ramesh Sharma' : 'e.g. Metro Cash & Carry'} autoFocus />
        </Field>

        <Field label="Phone number">
          <Input value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
        </Field>

        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" />
        </Field>

        {isCustomer ? (
          <>
            <Field label="Customer group">
              <Select value={form.group} onChange={set('group')}>
                {[...new Set([...groups, 'Retail', 'Wholesale', 'Staff'])].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Credit limit" hint="Warns when credit sales exceed this">
              <Input type="number" value={form.creditLimit} onChange={set('creditLimit')} placeholder="0" />
            </Field>
          </>
        ) : (
          <Field label="GSTIN" className="sm:col-span-2">
            <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="29AABCM1234K1Z5" />
          </Field>
        )}

        <Field label="Address" className="sm:col-span-2">
          <Textarea rows={2} value={form.address} onChange={set('address')} placeholder="Street, city, pincode" />
        </Field>

        {!editing && (
          <Field
            label={isCustomer ? 'Opening receivable' : 'Opening payable'}
            hint="Amount already owed when you start using Selsolve"
            className="sm:col-span-2"
          >
            <Input
              type="number"
              step="0.01"
              value={isCustomer ? form.openingBalance : form.outstandingPayable}
              onChange={isCustomer ? set('openingBalance') : set('outstandingPayable')}
              placeholder="0.00"
            />
          </Field>
        )}
      </form>
    </Modal>
  );
}

function PartyLedgerModal({ party, onClose, showToast }) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!party) {
      setLedger(null);
      return;
    }
    setLoading(true);
    const base = party.type === 'CUSTOMER' ? '/customers' : '/vendors';
    api
      .get(`${base}/${party.id}/ledger`)
      .then(setLedger)
      .catch((err) => showToast(api.message(err), 'error'))
      .finally(() => setLoading(false));
  }, [party]);

  return (
    <Modal
      open={Boolean(party)}
      onClose={onClose}
      title={party ? `${party.name} — Ledger` : ''}
      subtitle={party?.phone || ''}
      icon={BookOpen}
      size="xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {loading || !ledger ? (
        <Spinner />
      ) : !ledger.entries?.length ? (
        <EmptyState title="No transactions yet" hint="Credit sales, receipts and payments will appear here." />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <Mini label="Opening" value={money(ledger.opening)} />
            <Mini label="Total Debit" value={money(ledger.totalDebit)} />
            <Mini label="Total Credit" value={money(ledger.totalCredit)} />
            <Mini label="Closing" value={money(ledger.closing)} bold />
          </div>

          <DataTable
            maxHeight="46vh"
            dense
            columns={[
              { key: 'date', label: 'Date', width: 100, render: (e) => fmtDate(e.date) },
              {
                key: 'voucherNo',
                label: 'Voucher',
                width: 100,
                render: (e) => <span className="tabular font-bold text-[color:var(--accent)]">{e.voucherNo}</span>
              },
              { key: 'narration', label: 'Particulars', render: (e) => <span className="line-clamp-1">{e.narration || '—'}</span> },
              { key: 'debit', label: 'Debit', align: 'right', width: 100, render: (e) => <Money value={e.debit} showZero={false} /> },
              { key: 'credit', label: 'Credit', align: 'right', width: 100, render: (e) => <Money value={e.credit} showZero={false} /> },
              { key: 'balance', label: 'Balance', align: 'right', width: 110, render: (e) => <Money value={e.balance} className="font-bold" /> }
            ]}
            rows={ledger.entries}
            rowKey={(e, i) => `${e.voucherId}_${i}`}
            footer={['', '', 'Closing balance', money(ledger.totalDebit), money(ledger.totalCredit), money(ledger.closing)]}
          />
        </div>
      )}
    </Modal>
  );
}

function Mini({ label, value, bold }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
      <div className="label-eyebrow">{label}</div>
      <div className={`tabular mt-0.5 text-[13px] text-[color:var(--text-primary)] ${bold ? 'font-bold' : 'font-semibold'}`}>
        {value}
      </div>
    </div>
  );
}
