import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import api, { money, fmtDate, todayISO } from '../../lib/api';
import {
  SectionHeader, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, StatTile, Spinner, EmptyState, DataTable
} from '../../lib/ui';

const CONFIG = {
  RECEIPT: {
    title: 'Customer Receipts',
    subtitle: 'Money collected from customers — reduces what they owe on account.',
    listEndpoint: '/accounts/receipts',
    postEndpoint: '/accounts/receipts',
    partyEndpoint: '/accounts/customers',
    partyKey: 'customerId',
    partyNameKey: 'customerName',
    partyLabel: 'Customer',
    entryNoun: 'Receipt'
  },
  PAYMENT: {
    title: 'Vendor Payments',
    subtitle: 'Settlement of dues already owed to vendors — this is not a new expense.',
    listEndpoint: '/accounts/payments',
    postEndpoint: '/accounts/payments',
    partyEndpoint: '/accounts/vendors',
    partyKey: 'vendorId',
    partyNameKey: 'vendorName',
    partyLabel: 'Vendor',
    entryNoun: 'Payment'
  }
};

/**
 * Receipts and payments are the same shape of screen from opposite sides of the
 * ledger, so one component drives both via CONFIG rather than duplicating markup.
 */
export default function MoneyMovement({ mode, showToast }) {
  const cfg = CONFIG[mode];

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEntry, setShowEntry] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(cfg.listEndpoint);
      setEntries(res || []);
    } catch (err) {
      showToast(api.message(err, 'Could not load the history.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const stats = useMemo(() => {
    const monthPrefix = todayISO().slice(0, 7);
    const thisMonth = entries.filter((e) => (e.date || '').slice(0, 7) === monthPrefix);
    const totalMonth = thisMonth.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const largest = entries.reduce((m, e) => Math.max(m, Number(e.amount) || 0), 0);
    return { totalMonth, count: entries.length, largest };
  }, [entries]);

  const totals = useMemo(
    () => ({
      amount: entries.reduce((s, e) => s + (Number(e.amount) || 0), 0),
      discount: entries.reduce((s, e) => s + (Number(e.discount) || 0), 0)
    }),
    [entries]
  );

  if (loading) return <Spinner label="Loading history…" />;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Accounts"
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowEntry(true)}>
            New {cfg.entryNoun}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="This month" value={money(stats.totalMonth)} tone="accent" />
        <StatTile label="Entry count" value={stats.count} tone="neutral" />
        <StatTile label="Largest single entry" value={money(stats.largest)} tone="success" />
      </div>

      <DataTable
        columns={[
          { key: 'date', label: 'Date', width: 100, render: (e) => fmtDate(e.date) },
          {
            key: 'voucherNo',
            label: 'Voucher No',
            width: 110,
            render: (e) => <span className="tabular font-bold text-[color:var(--accent)]">{e.voucherNo}</span>
          },
          { key: 'party', label: cfg.partyLabel, render: (e) => e[cfg.partyNameKey] },
          { key: 'mode', label: 'Mode', width: 110, render: (e) => <Badge>{e.paymentMode}</Badge> },
          { key: 'reference', label: 'Reference', render: (e) => e.reference || '—' },
          { key: 'discount', label: 'Discount', align: 'right', width: 100, render: (e) => <Money value={e.discount} showZero={false} /> },
          { key: 'amount', label: 'Amount', align: 'right', width: 130, render: (e) => <Money value={e.amount} className="font-bold" /> }
        ]}
        rows={entries}
        rowKey={(e) => e.id}
        empty={
          <EmptyState
            title="Nothing recorded yet"
            hint={`Record your first ${cfg.partyLabel.toLowerCase()} ${cfg.entryNoun.toLowerCase()}.`}
          />
        }
        footer={['', '', '', '', 'Totals', money(totals.discount), money(totals.amount)]}
      />

      <EntryModal
        open={showEntry}
        mode={mode}
        cfg={cfg}
        showToast={showToast}
        onClose={() => setShowEntry(false)}
        onSaved={() => {
          setShowEntry(false);
          load();
        }}
      />
    </div>
  );
}

function EntryModal({ open, mode, cfg, showToast, onClose, onSaved }) {
  const blank = {
    partyId: '',
    amount: '',
    discount: '',
    paymentMode: 'CASH',
    settlementAccountId: '',
    reference: '',
    notes: '',
    date: todayISO()
  };
  const [form, setForm] = useState(blank);
  const [parties, setParties] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [saving, setSaving] = useState(false);

  // Party and settlement-account options depend on mode, so reload every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setForm(blank);
    setLoadingLists(true);
    Promise.all([api.get(cfg.partyEndpoint), api.get('/accounts/transfers')])
      .then(([partyRes, transferRes]) => {
        setParties(partyRes?.parties || []);
        setAccounts((transferRes?.accounts || []).filter((a) => a.kind === 'CASH' || a.kind === 'BANK'));
      })
      .catch((err) => showToast(api.message(err, 'Could not load the form data.'), 'error'))
      .finally(() => setLoadingLists(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const selectedParty = parties.find((p) => p.id === form.partyId);
  const outstanding = selectedParty ? Number(selectedParty.balance) || 0 : 0;
  const amount = Number(form.amount) || 0;
  const resultingBalance = outstanding - amount;
  // Advances are legitimate, so an over-amount is a warning, not a blocker.
  const overpaying = Boolean(selectedParty) && outstanding > 0 && amount > outstanding;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.partyId || !amount) {
      showToast('Select a party and enter a non-zero amount.', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        [cfg.partyKey]: form.partyId,
        amount,
        discount: Number(form.discount) || 0,
        paymentMode: form.paymentMode,
        settlementAccountId: form.settlementAccountId,
        reference: form.reference,
        notes: form.notes,
        date: form.date
      };
      const res = await api.post(cfg.postEndpoint, body);
      showToast(res.message);
      onSaved();
    } catch (err) {
      showToast(api.message(err, `Could not record the ${cfg.entryNoun.toLowerCase()}.`), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'RECEIPT' ? 'Record Customer Receipt' : 'Record Vendor Payment'}
      subtitle={cfg.subtitle}
      icon={Plus}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Record {cfg.entryNoun}
          </Button>
        </>
      }
    >
      {loadingLists ? (
        <Spinner />
      ) : (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label={cfg.partyLabel} required className="sm:col-span-2">
            <Select value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
              <option value="">— Select {cfg.partyLabel.toLowerCase()} —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({money(p.balance)} outstanding)
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Amount" required>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Settlement discount" hint="Posts to Discount Allowed / Discount Received, not the settlement account.">
            <Input
              type="number"
              step="0.01"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Payment mode">
            <Select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
            </Select>
          </Field>

          <Field label={mode === 'RECEIPT' ? 'Deposit into' : 'Pay from'}>
            <Select value={form.settlementAccountId} onChange={(e) => setForm({ ...form, settlementAccountId: e.target.value })}>
              <option value="">— Select ledger —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Reference no">
            <Input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Cheque / UTR / transaction ref"
            />
          </Field>

          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>

          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes for this entry"
            />
          </Field>

          {selectedParty && (
            <div className="rounded-xl px-3 py-2.5 sm:col-span-2" style={{ background: 'var(--bg-subtle)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <span className="text-[color:var(--text-secondary)]">Current outstanding</span>
                <Money value={outstanding} className="font-bold" />
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <span className="text-[color:var(--text-secondary)]">Being settled</span>
                <Money value={amount} className="font-bold" />
              </div>
              <div
                className="mt-1 flex flex-wrap items-center justify-between gap-2 pt-1.5 text-[12px]"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <span className="font-bold text-[color:var(--text-primary)]">Balance after posting</span>
                <Money value={resultingBalance} className="font-bold" />
              </div>
              {overpaying && (
                <div className="mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  This exceeds the outstanding balance — the excess will be recorded as an advance.
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
