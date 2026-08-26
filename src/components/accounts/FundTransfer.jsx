import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Landmark, Wallet, Send } from 'lucide-react';

import api, { money, fmtDate, todayISO } from '../../lib/api';
import {
  Panel, SectionHeader, StatTile, Button, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, DataTable
} from '../../lib/ui';

/**
 * Fund transfer (contra voucher) — moving the business's own money between its
 * cash and bank ledgers. This never touches income or expenses; only bank
 * charges, if any, land in the P&L.
 */
export default function FundTransfer({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const blank = {
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    charges: '',
    reference: '',
    notes: '',
    date: todayISO()
  };
  const [form, setForm] = useState(blank);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounts/transfers');
      setData(res);
      setForm((f) => ({
        ...f,
        fromAccountId: f.fromAccountId || res.accounts.find((a) => a.kind === 'CASH')?.id || res.accounts[0]?.id || '',
        toAccountId: f.toAccountId || res.accounts.find((a) => a.kind === 'BANK')?.id || ''
      }));
    } catch (err) {
      showToast(api.message(err, 'Could not load accounts.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const accounts = data?.accounts || [];
  const transfers = data?.transfers || [];

  const from = accounts.find((a) => a.id === form.fromAccountId);
  const to = accounts.find((a) => a.id === form.toAccountId);
  const amount = Number(form.amount) || 0;
  const charges = Number(form.charges) || 0;
  const debited = amount + charges;

  const error = useMemo(() => {
    if (!form.fromAccountId || !form.toAccountId) return 'Choose both a source and a destination account.';
    if (form.fromAccountId === form.toAccountId) return 'Source and destination must be different accounts.';
    if (amount <= 0) return 'Enter an amount greater than zero.';
    return null;
  }, [form, amount]);

  const submit = async (e) => {
    e?.preventDefault();
    if (saving || error) return;
    setSaving(true);
    try {
      const res = await api.post('/accounts/transfers', { ...form, amount, charges });
      showToast(res.message);
      setForm({ ...blank, fromAccountId: form.fromAccountId, toAccountId: form.toAccountId });
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not post the transfer.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading accounts…" />;

  const totalTransferred = transfers.reduce((s, t) => s + t.amount, 0);
  const totalCharges = transfers.reduce((s, t) => s + (t.charges || 0), 0);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Transactions"
        title="Fund Transfer"
        icon={ArrowLeftRight}
        subtitle="Move money between your own cash and bank ledgers — a cash deposit, a withdrawal, or a transfer between banks. Transfers never affect profit; only bank charges are expensed."
      />

      <Panel className="space-y-4">
        {/* From → To, with live projected balances so mistakes are obvious */}
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <Field label="Transfer from" required>
              <Select
                value={form.fromAccountId}
                onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}
              >
                <option value="">— Select account —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {money(a.balance, { decimals: false })}
                  </option>
                ))}
              </Select>
            </Field>
            {from && (
              <Projection label="Balance after transfer" current={from.balance} next={from.balance - debited} />
            )}
          </div>

          <div className="flex justify-center pb-6">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: 'var(--accent-soft)' }}
            >
              <ArrowRight className="h-4 w-4 text-[color:var(--accent)]" />
            </div>
          </div>

          <div>
            <Field label="Transfer to" required>
              <Select value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}>
                <option value="">— Select account —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {money(a.balance, { decimals: false })}
                  </option>
                ))}
              </Select>
            </Field>
            {to && <Projection label="Balance after transfer" current={to.balance} next={to.balance + amount} />}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Amount" required error={error && amount <= 0 ? 'Required' : undefined}>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Bank charges" hint="Posts to Bank Charges expense">
            <Input
              type="number"
              step="0.01"
              value={form.charges}
              onChange={(e) => setForm({ ...form, charges: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Reference / UTR">
            <Input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Cheque or UTR no."
            />
          </Field>

          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="e.g. Daily cash deposit into the current account"
          />
        </Field>

        {/* The posting itself, shown before it happens */}
        {!error && (
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
            <div className="label-eyebrow mb-1.5">Journal entry to be posted</div>
            <div className="space-y-1 text-[12px]">
              <PostingLine side="Dr" account={to?.name} amount={amount} />
              {charges > 0 && <PostingLine side="Dr" account="Bank Charges" amount={charges} />}
              <PostingLine side="Cr" account={from?.name} amount={debited} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] font-semibold text-[color:var(--text-muted)]">
            {error || `${money(debited)} will leave ${from?.name} · ${money(amount)} will reach ${to?.name}`}
          </span>
          <Button variant="primary" icon={Send} onClick={submit} loading={saving} disabled={Boolean(error)}>
            Post Transfer
          </Button>
        </div>
      </Panel>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Transfers" value={transfers.length} sub="Contra vouchers posted" />
        <StatTile label="Total Transferred" value={money(totalTransferred, { decimals: false })} tone="accent" />
        <StatTile label="Charges Paid" value={money(totalCharges, { decimals: false })} tone="danger" />
      </div>

      <div className="space-y-2">
        <SectionHeader eyebrow="History" title="Transfer Register" />
        <DataTable
          maxHeight="52vh"
          dense
          columns={[
            { key: 'date', label: 'Date', width: 110, render: (t) => fmtDate(t.date) },
            {
              key: 'voucherNo',
              label: 'Voucher',
              width: 100,
              render: (t) => <span className="tabular font-bold text-[color:var(--accent)]">{t.voucherNo}</span>
            },
            {
              key: 'fromName',
              label: 'From',
              render: (t) => <span className="font-semibold">{t.fromName || '—'}</span>
            },
            {
              key: 'toName',
              label: 'To',
              render: (t) => <span className="font-semibold">{t.toName || '—'}</span>
            },
            {
              key: 'reference',
              label: 'Reference',
              width: 140,
              render: (t) => <span className="text-[color:var(--text-muted)]">{t.reference || '—'}</span>
            },
            { key: 'charges', label: 'Charges', align: 'right', width: 110, render: (t) => <Money value={t.charges} showZero={false} /> },
            { key: 'amount', label: 'Amount', align: 'right', width: 130, render: (t) => <Money value={t.amount} className="font-bold" /> }
          ]}
          rows={transfers}
          empty={
            <EmptyState
              icon={ArrowLeftRight}
              title="No transfers yet"
              hint="Cash deposits and bank-to-bank movements will be listed here."
            />
          }
          footer={['', '', '', '', 'Total', money(totalCharges), money(totalTransferred)]}
        />
      </div>
    </div>
  );
}

function Projection({ label, current, next }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-semibold text-[color:var(--text-muted)]">
      <span>{label}:</span>
      <Money value={current} decimals={false} />
      <ArrowRight className="h-2.5 w-2.5" />
      <Money value={next} decimals={false} colored className="font-bold" />
    </div>
  );
}

function PostingLine({ side, account, amount }) {
  return (
    <div className="flex items-center gap-2">
      <Badge tone={side === 'Dr' ? 'info' : 'warning'}>{side}</Badge>
      <span className="flex-1 truncate font-semibold text-[color:var(--text-primary)]">{account || '—'}</span>
      <Money value={amount} className="font-bold" />
    </div>
  );
}
