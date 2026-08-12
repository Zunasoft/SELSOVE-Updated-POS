import React, { useEffect, useMemo, useState } from 'react';
import { TrendingDown, Plus, AlertTriangle, Boxes, ListChecks } from 'lucide-react';

import api, { money, moneyShort, fmtDate, todayISO, monthStartISO } from '../../lib/api';
import {
  Panel, SectionHeader, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, DateRange, StatTile, SegmentedControl,
  ShareBars, DataTable
} from '../../lib/ui';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];

/**
 * Records business expenses — either paid immediately from cash/bank, or left
 * unpaid against a vendor to be settled later. Both paths post a balanced
 * voucher, which is why the modal always shows the resulting journal entry.
 */
export default function ExpensesView({ showToast }) {
  const [period, setPeriod] = useState({ from: monthStartISO(), to: todayISO() });
  const [entries, setEntries] = useState([]);
  const [heads, setHeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('HEAD');
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [expenses, transfers, vendorRes] = await Promise.all([
        api.get('/accounts/expenses', { from: period.from, to: period.to }),
        api.get('/accounts/transfers'),
        api.get('/accounts/vendors')
      ]);
      setEntries(expenses.entries || []);
      setHeads(expenses.heads || []);
      setTotal(expenses.total || 0);
      setAccounts(transfers.accounts || []);
      setVendors(vendorRes.parties || []);
    } catch (err) {
      showToast(api.message(err, 'Could not load expenses.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [period.from, period.to]);

  const nonZeroHeads = useMemo(() => heads.filter((h) => h.balance !== 0), [heads]);
  const largestHead = useMemo(
    () => nonZeroHeads.reduce((max, h) => (h.balance > (max?.balance || 0) ? h : max), null),
    [nonZeroHeads]
  );
  // Unpaid entries book their tax along with the expense, so both roll into what is owed.
  const unpaidTotal = useMemo(
    () => entries.filter((e) => e.unpaid).reduce((s, e) => s + e.amount + (e.tax || 0), 0),
    [entries]
  );
  const liquidAccounts = useMemo(
    () => accounts.filter((a) => a.kind === 'CASH' || a.kind === 'BANK'),
    [accounts]
  );

  if (loading) return <Spinner label="Loading expenses…" />;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Transactions"
        title="Expenses"
        icon={TrendingDown}
        subtitle="Rent, utilities, supplies and every other business cost — paid now or booked to a vendor for later settlement."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowModal(true)}>
            Record Expense
          </Button>
        }
      />

      <DateRange from={period.from} to={period.to} onChange={setPeriod} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Expenses" value={moneyShort(total)} sub="Selected period" icon={TrendingDown} tone="danger" />
        <StatTile
          label="Largest Head"
          value={largestHead ? moneyShort(largestHead.balance) : money(0)}
          sub={largestHead?.name || 'No expenses yet'}
          icon={Boxes}
          tone="neutral"
        />
        <StatTile label="Unpaid Expenses" value={moneyShort(unpaidTotal)} sub="Booked to vendors" icon={AlertTriangle} tone="warning" />
        <StatTile label="Entries Recorded" value={entries.length} sub="This period" icon={ListChecks} tone="neutral" />
      </div>

      <SegmentedControl
        value={view}
        onChange={setView}
        options={[
          { value: 'HEAD', label: 'By Head' },
          { value: 'ENTRIES', label: 'Entries' }
        ]}
      />

      {view === 'HEAD' ? (
        <Panel>
          {nonZeroHeads.length === 0 ? (
            <EmptyState title="No expenses booked yet" hint="Expense heads will rank here once you record them." />
          ) : (
            <ShareBars items={nonZeroHeads.map((h) => ({ name: h.name, amount: h.balance }))} tone="danger" />
          )}
          <div className="mt-4">
            <DataTable
              maxHeight="none"
              columns={[
                { key: 'code', label: 'Code', width: 90, render: (h) => <span className="tabular font-bold">{h.code}</span> },
                { key: 'name', label: 'Head', render: (h) => h.name },
                {
                  key: 'balance',
                  label: 'Amount',
                  align: 'right',
                  width: 120,
                  render: (h) => <Money value={h.balance} className="font-bold" />
                },
                {
                  key: 'share',
                  label: '% of total',
                  align: 'right',
                  width: 90,
                  render: (h) => `${total ? ((h.balance / total) * 100).toFixed(1) : '0.0'}%`
                }
              ]}
              rows={heads}
              empty={<EmptyState title="No expense heads" />}
              footer={['', 'Total', money(heads.reduce((s, h) => s + h.balance, 0)), '100.0%']}
            />
          </div>
        </Panel>
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'Date', width: 90, render: (e) => fmtDate(e.date) },
            {
              key: 'voucherNo',
              label: 'Voucher',
              width: 90,
              render: (e) => <span className="tabular font-bold text-[color:var(--accent)]">{e.voucherNo}</span>
            },
            { key: 'category', label: 'Head', render: (e) => e.category },
            {
              key: 'notes',
              label: 'Notes',
              render: (e) => <span className="line-clamp-1 text-[color:var(--text-secondary)]">{e.notes || '—'}</span>
            },
            { key: 'paymentMode', label: 'Mode', width: 100, render: (e) => <Badge>{e.paymentMode}</Badge> },
            {
              key: 'status',
              label: 'Status',
              width: 90,
              render: (e) => <Badge tone={e.unpaid ? 'warning' : 'success'}>{e.unpaid ? 'Unpaid' : 'Paid'}</Badge>
            },
            { key: 'tax', label: 'GST', align: 'right', width: 90, render: (e) => <Money value={e.tax} showZero={false} /> },
            {
              key: 'amount',
              label: 'Amount',
              align: 'right',
              width: 110,
              render: (e) => <Money value={e.amount} className="font-bold" />
            }
          ]}
          rows={entries}
          empty={<EmptyState title="No expenses recorded" hint="Recorded entries will appear here." />}
          footer={[
            '', '', '', '', '', 'Total',
            money(entries.reduce((s, e) => s + (e.tax || 0), 0)),
            money(entries.reduce((s, e) => s + e.amount, 0))
          ]}
        />
      )}

      <ExpenseModal
        open={showModal}
        onClose={() => setShowModal(false)}
        heads={heads}
        accounts={liquidAccounts}
        vendors={vendors}
        showToast={showToast}
        onSaved={() => {
          setShowModal(false);
          load();
        }}
      />
    </div>
  );
}

function ExpenseModal({ open, onClose, heads, accounts, vendors, showToast, onSaved }) {
  const blank = {
    accountId: '',
    amount: '',
    tax: '',
    paymentMode: 'Cash',
    settlementAccountId: '',
    date: todayISO(),
    notes: '',
    unpaid: false,
    vendorId: ''
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...blank, accountId: heads[0]?.id || '', settlementAccountId: accounts[0]?.id || '' });
  }, [open]);

  const expenseHead = heads.find((h) => h.id === form.accountId);
  const settlementAccount = accounts.find((a) => a.id === form.settlementAccountId);
  const vendor = vendors.find((v) => v.id === form.vendorId);
  const amount = Number(form.amount) || 0;
  const tax = Number(form.tax) || 0;
  const payable = amount + tax;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.accountId || amount <= 0) return;
    if (form.unpaid && !form.vendorId) return;
    if (!form.unpaid && !form.settlementAccountId) return;
    setSaving(true);
    try {
      const res = await api.post('/accounts/expenses', { ...form, amount, tax });
      showToast(res.message || 'Expense recorded.');
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not record expense.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Expense"
      subtitle="Book a cost paid now, or leave it unpaid against a vendor for later settlement."
      icon={Plus}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Save Expense
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Expense head" required>
          <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
            <option value="">— Select head —</option>
            {heads.map((h) => (
              <option key={h.id} value={h.id}>
                {h.code} · {h.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Amount" required>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
          />
        </Field>

        <Field label="GST / input tax" hint="Books to GST Input Credit, reclaimable against output tax">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.tax}
            onChange={(e) => setForm({ ...form, tax: e.target.value })}
            placeholder="0.00"
          />
        </Field>

        <Field label="Payment mode">
          <Select
            value={form.paymentMode}
            disabled={form.unpaid}
            onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
          >
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>

        <label className="flex items-center gap-2 text-[12px] font-semibold text-[color:var(--text-secondary)] sm:col-span-2">
          <input
            type="checkbox"
            checked={form.unpaid}
            onChange={(e) => setForm({ ...form, unpaid: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-indigo-600"
          />
          Leave unpaid (book to a vendor)
        </label>

        <Field label="Vendor" required={form.unpaid} hint={!form.unpaid ? 'Only used when left unpaid' : undefined}>
          <Select
            value={form.vendorId}
            disabled={!form.unpaid}
            onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
          >
            <option value="">— Select vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Paid from" required={!form.unpaid} hint={form.unpaid ? 'Disabled — this expense stays unpaid' : undefined}>
          <Select
            value={form.settlementAccountId}
            disabled={form.unpaid}
            onChange={(e) => setForm({ ...form, settlementAccountId: e.target.value })}
          >
            <option value="">— Select account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>

        <Field label="Notes" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional narration"
          />
        </Field>

        {/* Visible double-entry preview so the accounting treatment is never a surprise. */}
        {expenseHead && amount > 0 && (form.unpaid ? vendor : settlementAccount) && (
          <div className="rounded-xl px-3 py-2.5 text-[12px] sm:col-span-2 space-y-0.5" style={{ background: 'var(--bg-subtle)' }}>
            <div className="label-eyebrow mb-1.5">Journal preview</div>
            <div className="flex items-center justify-between font-semibold text-[color:var(--text-primary)]">
              <span>Dr &nbsp; {expenseHead.name}</span>
              <Money value={amount} className="font-bold" />
            </div>
            {tax > 0 && (
              <div className="flex items-center justify-between font-semibold text-[color:var(--text-primary)]">
                <span>Dr &nbsp; GST Input Credit</span>
                <Money value={tax} className="font-bold" />
              </div>
            )}
            <div className="flex items-center justify-between font-semibold text-[color:var(--text-secondary)]">
              <span>Cr &nbsp; {form.unpaid ? vendor?.name : settlementAccount?.name}</span>
              <Money value={payable} className="font-bold" />
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
