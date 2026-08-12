import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Plus, ReceiptText, HandCoins, ListChecks } from 'lucide-react';

import api, { money, moneyShort, fmtDate, todayISO, monthStartISO } from '../../lib/api';
import {
  Panel, SectionHeader, Button, Modal, Field, Input, Select, Textarea,
  Money, Spinner, EmptyState, DateRange, StatTile, ShareBars, DataTable
} from '../../lib/ui';

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

/**
 * Records "other income" only — bank interest, commission, scrap sales and the
 * like. POS sales revenue posts to the Sales ledger automatically from billing,
 * so it is surfaced here purely for reference and is never entered manually.
 */
export default function IncomeView({ showToast }) {
  const [period, setPeriod] = useState({ from: monthStartISO(), to: todayISO() });
  const [entries, setEntries] = useState([]);
  const [heads, setHeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [income, transfers] = await Promise.all([
        api.get('/accounts/income', { from: period.from, to: period.to }),
        api.get('/accounts/transfers')
      ]);
      setEntries(income.entries || []);
      setHeads(income.heads || []);
      setTotal(income.total || 0);
      setAccounts(transfers.accounts || []);
    } catch (err) {
      showToast(api.message(err, 'Could not load income.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [period.from, period.to]);

  // Sales carries the POS revenue balance but is read-only here — everything
  // else is what users actually record on this screen.
  const salesHead = heads.find((h) => h.name === 'Sales');
  const salesRevenue = salesHead?.balance || 0;
  const otherIncome = total - salesRevenue;

  const nonZeroHeads = useMemo(() => heads.filter((h) => h.balance !== 0), [heads]);
  const manualHeads = useMemo(() => heads.filter((h) => h.name !== 'Sales'), [heads]);
  const liquidAccounts = useMemo(
    () => accounts.filter((a) => a.kind === 'CASH' || a.kind === 'BANK'),
    [accounts]
  );

  if (loading) return <Spinner label="Loading income…" />;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Transactions"
        title="Income"
        icon={TrendingUp}
        subtitle="Bank interest, commission, scrap sales and other non-sales income. POS sales revenue posts automatically from billing — it is shown below for reference only, not entered here."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowModal(true)}>
            Record Income
          </Button>
        }
      />

      <DateRange from={period.from} to={period.to} onChange={setPeriod} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Income" value={moneyShort(total)} sub="Selected period" icon={TrendingUp} tone="success" />
        <StatTile
          label="Sales Revenue"
          value={moneyShort(salesRevenue)}
          sub="Posted automatically from billing"
          icon={ReceiptText}
          tone="accent"
        />
        <StatTile label="Other Income" value={moneyShort(otherIncome)} sub="Manually recorded" icon={HandCoins} tone="neutral" />
        <StatTile label="Entries Recorded" value={entries.length} sub="Manual income entries" icon={ListChecks} tone="neutral" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="mb-3">
            <div className="label-eyebrow">Breakdown</div>
            <div className="text-[13px] font-bold text-[color:var(--text-primary)]">Income by Head</div>
          </div>
          {nonZeroHeads.length === 0 ? (
            <EmptyState title="No income booked yet" hint="Sales revenue and manual entries will rank here once recorded." />
          ) : (
            <ShareBars items={nonZeroHeads.map((h) => ({ name: h.name, amount: h.balance }))} tone="success" />
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
                  width: 130,
                  render: (h) => <Money value={h.balance} className="font-bold" />
                }
              ]}
              rows={heads}
              empty={<EmptyState title="No income heads" />}
              footer={['', 'Total', money(heads.reduce((s, h) => s + h.balance, 0))]}
            />
          </div>
        </Panel>

        <Panel padded={false}>
          <div className="px-4 pb-2 pt-4">
            <div className="label-eyebrow">Recent</div>
            <div className="text-[13px] font-bold text-[color:var(--text-primary)]">Manual Entries</div>
          </div>
          <DataTable
            maxHeight="46vh"
            dense
            columns={[
              { key: 'date', label: 'Date', width: 90, render: (e) => fmtDate(e.date) },
              { key: 'head', label: 'Head', render: (e) => headName(heads, e.accountId) },
              {
                key: 'voucherNo',
                label: 'Voucher',
                width: 90,
                render: (e) => <span className="tabular font-bold text-[color:var(--accent)]">{e.voucherNo}</span>
              },
              {
                key: 'amount',
                label: 'Amount',
                align: 'right',
                width: 110,
                render: (e) => <Money value={e.amount} className="font-bold" />
              }
            ]}
            rows={entries}
            empty={<EmptyState title="No manual income yet" hint="Recorded entries will appear here." />}
          />
        </Panel>
      </div>

      <IncomeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        heads={manualHeads}
        accounts={liquidAccounts}
        showToast={showToast}
        onSaved={() => {
          setShowModal(false);
          load();
        }}
      />
    </div>
  );
}

function headName(heads, id) {
  return heads.find((h) => h.id === id)?.name || '—';
}

function IncomeModal({ open, onClose, heads, accounts, showToast, onSaved }) {
  const blank = { accountId: '', amount: '', settlementAccountId: '', paymentMode: 'Cash', date: todayISO(), notes: '' };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...blank, accountId: heads[0]?.id || '', settlementAccountId: accounts[0]?.id || '' });
  }, [open]);

  const incomeHead = heads.find((h) => h.id === form.accountId);
  const settlementAccount = accounts.find((a) => a.id === form.settlementAccountId);
  const amount = Number(form.amount) || 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.accountId || !form.settlementAccountId || amount <= 0) return;
    setSaving(true);
    try {
      const res = await api.post('/accounts/income', { ...form, amount });
      showToast(res.message || 'Income recorded.');
      onSaved();
    } catch (err) {
      showToast(api.message(err, 'Could not record income.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Income"
      subtitle="Bank interest, commission, scrap sales and similar receipts — not POS sales."
      icon={Plus}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Save Income
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Income head" required>
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

        <Field label="Received into" required>
          <Select
            value={form.settlementAccountId}
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

        <Field label="Payment mode">
          <Select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
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
        {incomeHead && settlementAccount && amount > 0 && (
          <div className="rounded-xl px-3 py-2.5 text-[12px] sm:col-span-2" style={{ background: 'var(--bg-subtle)' }}>
            <div className="label-eyebrow mb-1.5">Journal preview</div>
            <div className="flex items-center justify-between font-semibold text-[color:var(--text-primary)]">
              <span>Dr &nbsp; {settlementAccount.name}</span>
              <Money value={amount} className="font-bold" />
            </div>
            <div className="flex items-center justify-between font-semibold text-[color:var(--text-secondary)]">
              <span>Cr &nbsp; {incomeHead.name}</span>
              <Money value={amount} className="font-bold" />
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
