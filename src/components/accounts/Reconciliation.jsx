import React, { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Save, CircleCheck, AlertTriangle, History } from 'lucide-react';

import api, { money, fmtDate, fmtDateTime, todayISO } from '../../lib/api';
import {
  Panel, SectionHeader, Button, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, DataTable, DateRange
} from '../../lib/ui';

/**
 * Bank reconciliation. The operator ticks the entries that actually appear on
 * the bank statement; the cleared balance is recomputed locally on every tick
 * so the difference moves live rather than only after a save.
 */
export default function Reconciliation({ showToast }) {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cleared, setCleared] = useState({});
  const [statementBalance, setStatementBalance] = useState('');
  const [statementDate, setStatementDate] = useState(todayISO());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    api
      .get('/accounts/transfers')
      .then((d) => {
        setAccounts(d.accounts || []);
        const preferred = (d.accounts || []).find((a) => a.kind === 'BANK') || (d.accounts || [])[0];
        if (preferred) setAccountId(preferred.id);
      })
      .catch((err) => showToast(api.message(err, 'Could not load accounts.'), 'error'));
  }, []);

  useEffect(() => {
    if (!accountId) return undefined;
    let alive = true;
    setLoading(true);
    api
      .get(`/accounts/reconciliation/${accountId}`, { from: range.from || undefined, to: range.to || undefined })
      .then((d) => {
        if (!alive) return;
        setData(d);
        // Seed the tick state from whatever was cleared in a previous session.
        setCleared(
          d.entries.reduce((acc, e) => {
            acc[e.voucherId] = Boolean(e.cleared);
            return acc;
          }, {})
        );
      })
      .catch((err) => alive && showToast(api.message(err, 'Could not load the reconciliation.'), 'error'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [accountId, range]);

  const entries = data?.entries || [];

  const computed = useMemo(() => {
    const unclearedDebit = entries.filter((e) => !cleared[e.voucherId]).reduce((s, e) => s + e.debit, 0);
    const unclearedCredit = entries.filter((e) => !cleared[e.voucherId]).reduce((s, e) => s + e.credit, 0);
    const bookBalance = data?.bookBalance || 0;
    const clearedBalance = bookBalance - (unclearedDebit - unclearedCredit);
    const statement = Number(statementBalance);
    const hasStatement = statementBalance !== '' && Number.isFinite(statement);
    return {
      bookBalance,
      unclearedDebit,
      unclearedCredit,
      unclearedNet: unclearedDebit - unclearedCredit,
      clearedBalance,
      statement: hasStatement ? statement : null,
      difference: hasStatement ? statement - clearedBalance : null,
      clearedCount: entries.filter((e) => cleared[e.voucherId]).length
    };
  }, [entries, cleared, data, statementBalance]);

  const allTicked = entries.length > 0 && entries.every((e) => cleared[e.voucherId]);

  const toggleAll = () => {
    const next = !allTicked;
    setCleared(
      entries.reduce((acc, e) => {
        acc[e.voucherId] = next;
        return acc;
      }, {})
    );
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.post('/accounts/reconciliation', {
        accountId,
        statementBalance: Number(statementBalance) || 0,
        statementDate,
        clearedVoucherIds: entries.filter((e) => cleared[e.voucherId]).map((e) => e.voucherId),
        notes
      });
      showToast(res.message);
      setNotes('');
      setRange({ ...range });
    } catch (err) {
      showToast(api.message(err, 'Could not save the reconciliation.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const reconciled = computed.difference !== null && Math.abs(computed.difference) < 0.01;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Control"
        title="Bank Reconciliation"
        icon={CheckCheck}
        subtitle="Tick every entry that appears on your bank statement. When the cleared balance matches the statement, the account is reconciled."
      />

      <Panel className="grid gap-3 lg:grid-cols-4">
        <Field label="Account" className="lg:col-span-2">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— Select account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {money(a.balance, { decimals: false })}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Statement closing balance" hint="As printed on the statement">
          <Input
            type="number"
            step="0.01"
            value={statementBalance}
            onChange={(e) => setStatementBalance(e.target.value)}
            placeholder="0.00"
          />
        </Field>

        <Field label="Statement date">
          <Input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
        </Field>

        <div className="lg:col-span-4">
          <DateRange from={range.from} to={range.to} onChange={setRange} />
        </div>
      </Panel>

      {/* The reconciliation arithmetic, laid out as the operator reasons about it */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Step label="Book balance" value={computed.bookBalance} />
        <Step label="Less uncleared" value={-computed.unclearedNet} />
        <Step label="Cleared balance" value={computed.clearedBalance} bold />
        <Step label="Statement balance" value={computed.statement} placeholder="Enter above" />
        <div
          className={`rounded-2xl px-4 py-3 ${
            computed.difference === null
              ? 'surface'
              : reconciled
                ? 'bg-emerald-50 dark:bg-emerald-950/40'
                : 'bg-rose-50 dark:bg-rose-950/40'
          }`}
        >
          <div className="label-eyebrow flex items-center gap-1.5">
            {computed.difference !== null &&
              (reconciled ? (
                <CircleCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
              ))}
            Difference
          </div>
          <div
            className={`tabular mt-1 text-[19px] font-bold leading-none ${
              computed.difference === null
                ? 'text-[color:var(--text-muted)]'
                : reconciled
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
            }`}
          >
            {computed.difference === null ? '—' : money(computed.difference)}
          </div>
          <div className="mt-1 text-[10.5px] font-semibold text-[color:var(--text-muted)]">
            {computed.difference === null
              ? 'Awaiting statement balance'
              : reconciled
                ? 'Reconciled — statement matches'
                : `Out by ${money(Math.abs(computed.difference))}`}
          </div>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading account entries…" />
      ) : !accountId ? (
        <EmptyState title="Choose an account to reconcile" hint="Pick a bank or cash ledger above to begin." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11.5px] font-semibold text-[color:var(--text-muted)]">
              {computed.clearedCount} of {entries.length} entries marked as cleared
            </span>
            <Button
              variant="primary"
              icon={Save}
              onClick={save}
              loading={saving}
              disabled={!accountId || entries.length === 0}
            >
              Save Reconciliation
            </Button>
          </div>

          <Panel padded={false}>
            <div className="max-h-[52vh] overflow-auto">
              <table className="ledger-table w-full">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>
                      <input
                        type="checkbox"
                        checked={allTicked}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5 rounded accent-indigo-600"
                        title="Clear / unclear all"
                      />
                    </th>
                    <th style={{ width: 100 }}>Date</th>
                    <th style={{ width: 100 }}>Voucher</th>
                    <th>Particulars</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Debit</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Credit</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState title="No entries in this period" hint="Widen the date range to see more." />
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, i) => {
                      const isCleared = cleared[entry.voucherId];
                      return (
                        <tr
                          key={`${entry.voucherId}_${i}`}
                          className="cursor-pointer"
                          onClick={() => setCleared((p) => ({ ...p, [entry.voucherId]: !p[entry.voucherId] }))}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={Boolean(isCleared)}
                              onChange={() => setCleared((p) => ({ ...p, [entry.voucherId]: !p[entry.voucherId] }))}
                              onClick={(e) => e.stopPropagation()}
                              className="h-3.5 w-3.5 rounded accent-indigo-600"
                            />
                          </td>
                          <td className={isCleared ? 'text-[color:var(--text-muted)]' : ''}>{fmtDate(entry.date)}</td>
                          <td className={`tabular font-bold ${isCleared ? 'text-[color:var(--text-muted)]' : 'text-[color:var(--accent)]'}`}>
                            {entry.voucherNo}
                          </td>
                          <td className={isCleared ? 'text-[color:var(--text-muted)]' : 'text-[color:var(--text-secondary)]'}>
                            <span className="line-clamp-1">{entry.narration || '—'}</span>
                          </td>
                          <td className="text-right">
                            <Money value={entry.debit} showZero={false} className={isCleared ? 'text-[color:var(--text-muted)]' : ''} />
                          </td>
                          <td className="text-right">
                            <Money value={entry.credit} showZero={false} className={isCleared ? 'text-[color:var(--text-muted)]' : ''} />
                          </td>
                          <td className="text-right">
                            <Money value={entry.balance} className={isCleared ? 'text-[color:var(--text-muted)]' : 'font-semibold'} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Field label="Reconciliation notes">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Two cheques deposited on the 28th were still in clearing"
            />
          </Field>

          <div className="space-y-2">
            <SectionHeader eyebrow="Audit" title="Reconciliation History" icon={History} />
            <DataTable
              maxHeight="40vh"
              dense
              columns={[
                { key: 'statementDate', label: 'Statement Date', width: 130, render: (r) => fmtDate(r.statementDate) },
                { key: 'statementBalance', label: 'Statement', align: 'right', width: 130, render: (r) => <Money value={r.statementBalance} /> },
                { key: 'bookBalance', label: 'Book', align: 'right', width: 130, render: (r) => <Money value={r.bookBalance} /> },
                {
                  key: 'difference',
                  label: 'Difference',
                  align: 'right',
                  width: 120,
                  render: (r) => <Money value={r.difference} colored className="font-bold" />
                },
                {
                  key: 'status',
                  label: 'Status',
                  width: 120,
                  render: (r) => (
                    <Badge tone={r.status === 'RECONCILED' ? 'success' : 'warning'}>
                      {r.status === 'RECONCILED' ? 'Reconciled' : 'Difference'}
                    </Badge>
                  )
                },
                {
                  key: 'reconciledBy',
                  label: 'By',
                  render: (r) => (
                    <span className="text-[color:var(--text-muted)]">
                      {r.reconciledBy} · {fmtDateTime(r.reconciledAt)}
                    </span>
                  )
                }
              ]}
              rows={data?.history || []}
              empty={<EmptyState title="Not reconciled yet" hint="Your first saved reconciliation will appear here." />}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Step({ label, value, bold, placeholder }) {
  return (
    <div className="surface rounded-2xl px-4 py-3">
      <div className="label-eyebrow">{label}</div>
      {value === null || value === undefined ? (
        <div className="mt-1 text-[13px] font-semibold text-[color:var(--text-muted)]">{placeholder || '—'}</div>
      ) : (
        <Money value={value} className={`mt-1 block text-[19px] leading-none ${bold ? 'font-bold' : 'font-semibold'}`} />
      )}
    </div>
  );
}
