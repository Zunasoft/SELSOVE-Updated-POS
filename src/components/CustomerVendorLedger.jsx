import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Truck, MessageSquare, Plus, Edit3, Trash2, BookOpen, Phone,
  Wallet, ShoppingBag, Save, Search, Download, RefreshCw,
  CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight, Mail,
  MapPin, FileText, X, Printer, Building2, CreditCard, History, Clock, ArrowRight
} from 'lucide-react';

import api, { money, fmtDate, fmtDateTime, todayISO } from '../lib/api';
import {
  Panel, SectionHeader, StatTile, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, SearchInput, SegmentedControl, DataTable
} from '../lib/ui';
import { exportReport } from '../lib/exporters';

/**
 * Customer and vendor masters — SOW Modules 7 and 8.
 * Operational party register with contacts, groups, credit limits, and statements.
 */
export default function CustomerVendorLedger({ showToast }) {
  const [tab, setTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, DUE, OVER_LIMIT, CLEAR

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
      setCustomers(c || []);
      setVendors(v || []);
      setGroups(g || []);
    } catch (err) {
      showToast(api.message(err, 'Could not load parties.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const source = isCustomers ? customers : vendors;
    const needle = query.trim().toLowerCase();

    return source.filter((p) => {
      // Status Filter
      if (isCustomers) {
        const out = Number(p.outstanding || 0);
        const limit = Number(p.creditLimit || 0);
        if (statusFilter === 'DUE' && out <= 0) return false;
        if (statusFilter === 'OVER_LIMIT' && (limit <= 0 || out <= limit)) return false;
        if (statusFilter === 'CLEAR' && out > 0) return false;
      } else {
        const out = Number(p.outstandingPayable || 0);
        if (statusFilter === 'DUE' && out <= 0) return false;
        if (statusFilter === 'CLEAR' && out > 0) return false;
      }

      // Search Query
      if (!needle) return true;
      return (
        String(p.name || '').toLowerCase().includes(needle) ||
        String(p.phone || '').includes(needle) ||
        String(p.email || '').toLowerCase().includes(needle) ||
        String(p.gstin || '').toLowerCase().includes(needle) ||
        String(p.group || '').toLowerCase().includes(needle) ||
        String(p.address || '').toLowerCase().includes(needle)
      );
    });
  }, [isCustomers, customers, vendors, query, statusFilter]);

  const sendReminder = async (customer) => {
    try {
      const res = await api.post(`/customers/${customer.id}/send-whatsapp`);
      if (res.data?.waLink) window.open(res.data.waLink, '_blank');
      showToast(res.message || 'WhatsApp reminder ready.');
    } catch (err) {
      showToast(api.message(err, 'Could not prepare the reminder.'), 'error');
    }
  };

  const removeParty = async (party) => {
    const isCust = isCustomers;
    if (!window.confirm(`Delete ${isCust ? 'customer' : 'vendor'} "${party.name}"?`)) return;
    try {
      const endpoint = isCust ? `/customers/${party.id}` : `/vendors/${party.id}`;
      const res = await api.del(endpoint);
      showToast(res.message || `${party.name} deleted.`);
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not delete the party.'), 'error');
    }
  };

  const exportPartyList = () => {
    const columns = isCustomers
      ? [
          { label: 'Customer Name', key: 'name' },
          { label: 'Phone', key: 'phone' },
          { label: 'Email', key: 'email' },
          { label: 'Group', key: 'group' },
          { label: 'Total Bills', key: 'billCount' },
          { label: 'Credit Limit', key: 'creditLimit' },
          { label: 'Outstanding Balance', key: 'outstanding' }
        ]
      : [
          { label: 'Vendor Name', key: 'name' },
          { label: 'Phone', key: 'phone' },
          { label: 'GSTIN', key: 'gstin' },
          { label: 'Location', key: 'address' },
          { label: 'Purchase Invoices', key: 'purchaseCount' },
          { label: 'Total Purchases', key: 'totalPurchased' },
          { label: 'Outstanding Payable', key: 'outstandingPayable' }
        ];

    exportReport('csv', {
      title: isCustomers ? 'Customers_Register' : 'Vendors_Register',
      columns,
      rows: filteredRows
    });
  };

  if (loading) return <Spinner label="Loading parties & ledgers…" />;

  const totalReceivable = customers.reduce((s, c) => s + (c.outstanding || 0), 0);
  const totalPayable = vendors.reduce((s, v) => s + (v.outstandingPayable || 0), 0);
  const overLimit = customers.filter((c) => c.creditLimit > 0 && c.outstanding > c.creditLimit);
  const totalLifetimePurchases = vendors.reduce((s, v) => s + (v.totalPurchased || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <SectionHeader
        eyebrow="Master Contacts & Ledgers"
        title="Parties Register"
        icon={Users}
        subtitle="Manage customer profiles, vendor directories, credit balances, statement ledgers, and automated payment reminders."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={tab}
              onChange={(t) => {
                setTab(t);
                setStatusFilter('ALL');
              }}
              options={[
                { value: 'customers', label: `Customers (${customers.length})` },
                { value: 'vendors', label: `Vendors (${vendors.length})` }
              ]}
            />
            <Button icon={RefreshCw} onClick={load} loading={loading}>
              Refresh
            </Button>
            <Button
              variant="outline"
              icon={Download}
              onClick={exportPartyList}
              disabled={filteredRows.length === 0}
            >
              Export CSV
            </Button>
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
          </div>
        }
      />

      {/* KPI Summary Ribbon */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isCustomers ? (
          <>
            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Customers</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-[color:var(--text-primary)]">
                {customers.length}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Active party profiles
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Receivables</span>
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-amber-600 dark:text-amber-400">
                {money(totalReceivable, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Due from {customers.filter(c => (c.outstanding || 0) > 0).length} customers
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Over Credit Limit</span>
                <div className={`p-1.5 rounded-lg ${
                  overLimit.length > 0
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className={`mt-2 text-xl font-extrabold ${overLimit.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {overLimit.length}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                {overLimit.length ? `${overLimit[0].name} exceeds limit` : 'All customers within limit'}
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Orders</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-[color:var(--text-primary)]">
                {customers.reduce((s, c) => s + (c.billCount || 0), 0)}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Recorded sales bills
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Vendors</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-[color:var(--text-primary)]">
                {vendors.length}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Active supplier accounts
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Payables</span>
                <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-rose-600 dark:text-rose-400">
                {money(totalPayable, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Owed to suppliers
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Total Purchased</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {money(totalLifetimePurchases, { decimals: false })}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Cumulative procurement
              </div>
            </div>

            <div className="surface rounded-2xl p-4 border border-[color:var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Purchase Invoices</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-xl font-extrabold text-[color:var(--text-primary)]">
                {vendors.reduce((s, v) => s + (v.purchaseCount || 0), 0)}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Recorded goods inward bills
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter & Action Ribbon */}
      <Panel className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { key: 'ALL', label: `All ${isCustomers ? 'Customers' : 'Vendors'}` },
              { key: 'DUE', label: isCustomers ? 'With Receivables' : 'With Payables' },
              ...(isCustomers ? [{ key: 'OVER_LIMIT', label: 'Over Credit Limit' }] : []),
              { key: 'CLEAR', label: 'Zero Balance' }
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === f.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              type="text"
              placeholder={isCustomers ? 'Search customer, phone, group…' : 'Search vendor, phone, GSTIN…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="field-input text-xs"
              style={{ paddingLeft: '2.1rem' }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Party Table in Rows */}
        {filteredRows.length === 0 ? (
          <EmptyState
            icon={isCustomers ? Users : Truck}
            title={`No ${isCustomers ? 'Customers' : 'Vendors'} Found`}
            hint={`Try adjusting your search criteria or register a new ${isCustomers ? 'customer' : 'vendor'}.`}
          />
        ) : isCustomers ? (
          <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider text-[10.5px]">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4 text-right">Bills</th>
                  <th className="py-3 px-4 text-right">Credit Limit</th>
                  <th className="py-3 px-4 text-right">Outstanding Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {filteredRows.map((c) => {
                  const initials = c.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0].toUpperCase())
                    .join('') || 'CU';
                  const out = Number(c.outstanding || 0);
                  const limit = Number(c.creditLimit || 0);
                  const isOver = limit > 0 && out > limit;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-[color:var(--bg-subtle)] transition-colors group cursor-pointer"
                      onClick={() => setLedgerParty({ ...c, type: 'CUSTOMER' })}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-[11px] shrink-0 border border-indigo-200 dark:border-indigo-800">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[color:var(--text-primary)] group-hover:text-indigo-600 transition-colors">
                              {c.name}
                            </div>
                            <div className="text-[10.5px] text-[color:var(--text-muted)] flex items-center gap-1.5 flex-wrap">
                              {c.phone && <span>{c.phone}</span>}
                              {c.email && <span>· {c.email}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-[color:var(--text-secondary)]">
                          {c.group || 'Retail'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-[11.5px] text-[color:var(--text-secondary)] whitespace-nowrap">
                        {c.billCount || 0}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-[12px] text-[color:var(--text-secondary)] whitespace-nowrap">
                        {c.creditLimit ? money(c.creditLimit, { decimals: false }) : '—'}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div>
                          <span className={`font-mono font-bold text-[13px] ${out > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {money(out)}
                          </span>
                          {isOver && (
                            <span className="block text-[9.5px] font-extrabold uppercase text-rose-500">
                              Over limit
                            </span>
                          )}
                          {c.advance > 0 && (
                            <span className="block text-[9.5px] font-extrabold uppercase text-emerald-500">
                              Advance held
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title="Statement / Ledger"
                            onClick={() => setLedgerParty({ ...c, type: 'CUSTOMER' })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>

                          {out > 0 && c.phone && (
                            <button
                              type="button"
                              title="WhatsApp Payment Reminder"
                              onClick={() => sendReminder(c)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            title="Edit Customer"
                            onClick={() => {
                              setEditing(c);
                              setShowForm(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            title="Delete Customer"
                            onClick={() => removeParty(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Vendors Table */
          <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider text-[10.5px]">
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">GSTIN</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Invoices</th>
                  <th className="py-3 px-4 text-right">Total Purchased</th>
                  <th className="py-3 px-4 text-right">Outstanding Payable</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {filteredRows.map((v) => {
                  const initials = v.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0].toUpperCase())
                    .join('') || 'VN';
                  const out = Number(v.outstandingPayable || 0);

                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-[color:var(--bg-subtle)] transition-colors group cursor-pointer"
                      onClick={() => setLedgerParty({ ...v, type: 'VENDOR' })}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold flex items-center justify-center text-[11px] shrink-0 border border-slate-200 dark:border-slate-700">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[color:var(--text-primary)] group-hover:text-indigo-600 transition-colors">
                              {v.name}
                            </div>
                            <div className="text-[10.5px] text-[color:var(--text-muted)]">
                              {v.phone || 'No phone'} {v.email ? `· ${v.email}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {v.gstin ? (
                          <span className="font-mono font-semibold text-[11px] text-indigo-600 dark:text-indigo-400">
                            {v.gstin}
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-[color:var(--text-muted)]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-[color:var(--text-muted)] truncate block max-w-[160px]">
                          {v.address || '—'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-[11.5px] text-[color:var(--text-secondary)] whitespace-nowrap">
                        {v.purchaseCount || 0}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-[12px] text-[color:var(--text-primary)] whitespace-nowrap">
                        {money(v.totalPurchased || 0, { decimals: false })}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div>
                          <span className={`font-mono font-bold text-[13px] ${out > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {money(out)}
                          </span>
                          {v.advancePaid > 0 && (
                            <span className="block text-[9.5px] font-extrabold uppercase text-emerald-500">
                              Advance paid
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title="Statement / Ledger"
                            onClick={() => setLedgerParty({ ...v, type: 'VENDOR' })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            title="Edit Vendor"
                            onClick={() => {
                              setEditing(v);
                              setShowForm(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            title="Delete Vendor"
                            onClick={() => removeParty(v)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Party Form Modal */}
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

      {/* Party Ledger & Statement Modal */}
      <PartyLedgerModal
        party={ledgerParty}
        onClose={() => setLedgerParty(null)}
        showToast={showToast}
      />
    </div>
  );
}

/** Structured Add/Edit Party Modal with Clean Row Sections */
function PartyFormModal({ open, isCustomer, editing, groups, onClose, showToast, onSaved }) {
  const blank = {
    name: '',
    phone: '',
    email: '',
    address: '',
    group: 'Retail',
    creditLimit: '',
    gstin: '',
    category: '',
    contactPerson: '',
    paymentTerms: '',
    openingBalance: '',
    outstandingPayable: '',
    changeReason: ''
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              ...blank,
              ...editing,
              outstandingPayable: editing.outstandingPayable !== undefined ? editing.outstandingPayable : (editing.outstanding || ''),
              changeReason: ''
            }
          : blank
      );
    }
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
      showToast(api.message(err, 'Could not save party.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${isCustomer ? 'Customer' : 'Vendor'} — ${editing.name}` : isCustomer ? 'New Customer' : 'New Vendor'}
      subtitle={
        editing
          ? isCustomer
            ? 'Customer balances are updated automatically through bills and receipts.'
            : 'Vendor details and amount payable can be updated with audited change tracking.'
          : 'An opening balance will post to the party sub-ledger.'
      }
      icon={editing ? Edit3 : Plus}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Save} onClick={submit} loading={saving} disabled={!form.name.trim()}>
            {editing ? 'Save Changes' : 'Save Party'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Row 1: Primary Contact */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
            Primary Information
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full Name" required className="sm:col-span-2">
              <Input
                value={form.name}
                onChange={set('name')}
                placeholder={isCustomer ? 'e.g. Ramesh Sharma' : 'e.g. Metro Cash & Carry Pvt Ltd'}
                autoFocus
              />
            </Field>
            <Field label="Phone Number">
              <Input value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
            </Field>
            <Field label="Email Address">
              <Input type="email" value={form.email} onChange={set('email')} placeholder="contact@example.com" />
            </Field>
          </div>
        </div>

        {/* Row 2: Tax & Classification */}
        <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
            {isCustomer ? 'Customer Classification' : 'Business & Tax Registration'}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {isCustomer ? (
              <>
                <Field label="Customer Group">
                  <select
                    value={form.group || 'Retail'}
                    onChange={set('group')}
                    className="field-input text-xs"
                  >
                    {Array.from(new Set([
                      ...(groups || []).map((g) => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean),
                      'Retail', 'Wholesale', 'Staff', 'VIP'
                    ])).map((gName) => (
                      <option key={gName} value={gName}>
                        {gName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Credit Limit (₹)" hint="Warns counter cashier when credit sales exceed limit">
                  <Input type="number" value={form.creditLimit} onChange={set('creditLimit')} placeholder="0" />
                </Field>
              </>
            ) : (
              <>
                <Field label="GSTIN" hint="15-digit GST Identification Number">
                  <Input
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    placeholder="29AABCM1234K1Z5"
                  />
                </Field>
                <Field label="Supplier Category" hint="e.g. FMCG, Grains, Dairy, Packaging">
                  <Input
                    value={form.category}
                    onChange={set('category')}
                    placeholder="e.g. FMCG Supplies"
                  />
                </Field>
              </>
            )}
          </div>
        </div>

        {/* Row 3: Address & Amount Payable / Opening Balance */}
        <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
            Address & Financial Balance
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Address" className="sm:col-span-2">
              <Textarea rows={2} value={form.address} onChange={set('address')} placeholder="Door/Street, City, Pincode, State" />
            </Field>

            {/* If Customer and not editing */}
            {isCustomer && !editing && (
              <Field
                label="Opening Receivable (₹)"
                hint="Initial balance owed by customer when starting"
                className="sm:col-span-2"
              >
                <Input
                  type="number"
                  step="0.01"
                  value={form.openingBalance}
                  onChange={set('openingBalance')}
                  placeholder="0.00"
                />
              </Field>
            )}

            {/* If Vendor: Outstanding Payable is editable both on Add and Edit */}
            {!isCustomer && (
              <Field
                label={editing ? 'Amount Payable / Outstanding Balance (₹)' : 'Opening Payable (₹)'}
                hint={
                  editing
                    ? 'Edit to adjust current payable balance owed to this vendor (posts audited ledger adjustment).'
                    : 'Initial balance owed to vendor when starting.'
                }
                className="sm:col-span-2"
              >
                <Input
                  type="number"
                  step="0.01"
                  value={form.outstandingPayable}
                  onChange={set('outstandingPayable')}
                  placeholder="0.00"
                  className="font-bold text-rose-600 dark:text-rose-400 font-mono"
                />
              </Field>
            )}

            {/* If editing vendor, offer modification reason / notes */}
            {!isCustomer && editing && (
              <Field
                label="Reason / Notes for this Modification"
                hint="Logged into vendor change history audit trail"
                className="sm:col-span-2"
              >
                <Input
                  value={form.changeReason}
                  onChange={set('changeReason')}
                  placeholder="e.g. Reconciled balance from quarterly statement / Updated contact details"
                />
              </Field>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Detailed Party Statement & Ledger Modal with Audit Change History */
function PartyLedgerModal({ party, onClose, showToast }) {
  const [activeTab, setActiveTab] = useState('statement'); // 'statement' | 'history'
  const [ledger, setLedger] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!party) {
      setLedger(null);
      setHistory([]);
      return;
    }
    setLoading(true);
    const base = party.type === 'CUSTOMER' ? '/customers' : '/vendors';

    const reqs = [api.get(`${base}/${party.id}/ledger`).then(setLedger)];
    if (party.type === 'VENDOR') {
      reqs.push(
        api.get(`/vendors/${party.id}/history`)
          .then((res) => setHistory(res.data || res || []))
          .catch(() => setHistory(party.history || []))
      );
    }

    Promise.all(reqs)
      .catch((err) => showToast(api.message(err), 'error'))
      .finally(() => setLoading(false));
  }, [party]);

  const exportStatement = (format = 'csv') => {
    if (!ledger || !ledger.entries) return;
    const columns = [
      { label: 'Date', key: 'date', value: (e) => fmtDate(e.date) },
      { label: 'Voucher #', key: 'voucherNo' },
      { label: 'Particulars', key: 'narration' },
      { label: 'Debit (₹)', key: 'debit' },
      { label: 'Credit (₹)', key: 'credit' },
      { label: 'Running Balance (₹)', key: 'balance' }
    ];

    exportReport(format, {
      title: `${party.name}_Statement`,
      columns,
      rows: ledger.entries
    });
  };

  return (
    <Modal
      open={Boolean(party)}
      onClose={onClose}
      title={party ? `${party.name} — Statement & History` : ''}
      subtitle={party ? `${party.phone || ''} ${party.gstin ? `· GSTIN: ${party.gstin}` : ''}` : ''}
      icon={BookOpen}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            {activeTab === 'statement' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={() => exportStatement('csv')}
                  disabled={!ledger?.entries?.length}
                >
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Printer}
                  onClick={() => window.print()}
                  disabled={!ledger?.entries?.length}
                >
                  Print Statement
                </Button>
              </>
            )}
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      {/* Sub-tab navigation for Vendors */}
      {party?.type === 'VENDOR' && (
        <div className="mb-4 flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('statement')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'statement'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Statement & Ledger</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Change History & Audit ({history.length})</span>
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading vendor details & history…" />
      ) : activeTab === 'history' && party?.type === 'VENDOR' ? (
        /* Vendor Change History & Audit Timeline */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[color:var(--text-primary)]">Vendor Profile & Balance Modification History</span>
              <p className="text-[11px] text-[color:var(--text-muted)]">
                Track changes to vendor contact info, GSTIN, and amount payable adjustments.
              </p>
            </div>
            <Badge tone="accent">
              <Clock className="w-3 h-3" />
              {history.length} Event{history.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {history.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Modifications Recorded"
              hint="Any future edits to vendor information or amount payable balance will be tracked here."
            />
          ) : (
            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {history.map((h, i) => (
                <div
                  key={h.id || i}
                  className="rounded-xl p-3 border border-[color:var(--border)] bg-[color:var(--surface)] space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[color:var(--text-primary)] font-mono text-[11.5px]">
                        {fmtDateTime(h.timestamp)}
                      </span>
                      <Badge tone="neutral">User: {h.user || 'Admin'}</Badge>
                    </div>
                    {h.reason && (
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                        {h.reason}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[color:var(--border-subtle)] text-xs">
                    {(h.changes || []).map((ch, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-1 p-2 rounded-lg bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]"
                      >
                        <span className="text-[10.5px] font-bold text-[color:var(--text-secondary)] uppercase">
                          {ch.field}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11.5px] font-mono flex-wrap">
                          <span className="text-slate-400 line-through truncate max-w-[120px]">
                            {String(ch.old ?? '—')}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[140px]">
                            {String(ch.new ?? '—')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : !ledger || !ledger.entries?.length ? (
        <EmptyState title="No transactions recorded" hint="Invoices, receipts, payments and vouchers will appear in this ledger." />
      ) : (
        <div className="space-y-4">
          {/* Statement Balance Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="surface rounded-xl p-3 border border-[color:var(--border)]">
              <span className="text-[10px] font-bold uppercase text-[color:var(--text-muted)]">Opening Balance</span>
              <div className="text-sm font-bold text-[color:var(--text-primary)] mt-1 font-mono">
                {money(ledger.opening)}
              </div>
            </div>

            <div className="surface rounded-xl p-3 border border-[color:var(--border)]">
              <span className="text-[10px] font-bold uppercase text-[color:var(--text-muted)]">Total Debits</span>
              <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                {money(ledger.totalDebit)}
              </div>
            </div>

            <div className="surface rounded-xl p-3 border border-[color:var(--border)]">
              <span className="text-[10px] font-bold uppercase text-[color:var(--text-muted)]">Total Credits</span>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {money(ledger.totalCredit)}
              </div>
            </div>

            <div className="surface rounded-xl p-3 border border-[color:var(--border)]">
              <span className="text-[10px] font-bold uppercase text-[color:var(--text-muted)]">Closing Balance</span>
              <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {money(ledger.closing)}
              </div>
            </div>
          </div>

          {/* Statement Table in Rows */}
          <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[color:var(--border)] bg-[color:var(--bg-subtle)] font-bold text-[color:var(--text-secondary)] uppercase tracking-wider text-[10.5px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Particulars & Narration</th>
                  <th className="py-2.5 px-3 text-right">Debit</th>
                  <th className="py-2.5 px-3 text-right">Credit</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {ledger.entries.map((e, idx) => (
                  <tr key={idx} className="hover:bg-[color:var(--bg-subtle)] transition-colors">
                    <td className="py-2 px-3 font-mono text-[11px] text-[color:var(--text-secondary)] whitespace-nowrap">
                      {fmtDate(e.date)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {e.voucherNo}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[11.5px] text-[color:var(--text-primary)]">
                      {e.narration || '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[11.5px] whitespace-nowrap">
                      {e.debit ? money(e.debit) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[11.5px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {e.credit ? money(e.credit) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-[12px] text-[color:var(--text-primary)] whitespace-nowrap">
                      {money(e.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
