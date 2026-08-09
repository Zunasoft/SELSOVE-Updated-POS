import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck, Plus, ChevronRight, ChevronDown, Trash2, FileText, Wallet, Cpu, Pencil
} from 'lucide-react';

import api, { money, fmtDate, todayISO } from '../../lib/api';
import {
  Panel, SectionHeader, Button, Modal, Field, Input, Select,
  Badge, Money, Spinner, EmptyState, SearchInput, SegmentedControl, DateRange
} from '../../lib/ui';

const VOUCHER_TONE = {
  SALES: 'success',
  PURCHASE: 'warning',
  RECEIPT: 'success',
  PAYMENT: 'danger',
  EXPENSE: 'danger',
  INCOME: 'success',
  CONTRA: 'info',
  JOURNAL: 'accent',
  OPENING: 'neutral',
  STOCK: 'neutral'
};

/**
 * Every sale, purchase, receipt and payment posts a voucher here automatically,
 * so this register doubles as the complete audit trail. Manual journals are the
 * exception, not the rule — the composer exists for corrections and adjustments.
 */
export default function JournalEntries({ showToast }) {
  const [vouchers, setVouchers] = useState([]);
  const [count, setCount] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [range, setRange] = useState({ from: '', to: '' });

  const [expanded, setExpanded] = useState({});
  const [flat, setFlat] = useState([]);
  const [showComposer, setShowComposer] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/accounts/journal', {
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        from: range.from || undefined,
        to: range.to || undefined,
        q: query.trim() || undefined,
        limit: 200
      });
      setVouchers(data.vouchers || []);
      setCount(data.count ?? (data.vouchers || []).length);
      setTotalDebit(data.totalDebit || 0);
      setTypes(data.types || []);
    } catch (err) {
      showToast(api.message(err, 'Could not load the journal register.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // The account picker in the composer only needs postable ledgers, loaded once.
  useEffect(() => {
    api
      .get('/accounts/chart')
      .then((data) => setFlat((data.flat || []).filter((a) => !a.isGroup)))
      .catch((err) => showToast(api.message(err, 'Could not load the chart of accounts.'), 'error'));
  }, []);

  // Debounced so free-text search doesn't hammer the server on every keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [query, typeFilter, range.from, range.to]);

  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const systemCount = useMemo(() => vouchers.filter((v) => v.isSystem).length, [vouchers]);
  const manualCount = vouchers.length - systemCount;

  const reverseVoucher = async (voucher) => {
    if (!window.confirm(`Reverse voucher ${voucher.voucherNo}? This posts an equal and opposite entry.`)) return;
    try {
      const res = await api.post(`/accounts/journal/${voucher.id}/reverse`);
      showToast(res.message);
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not reverse the voucher.'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Transactions"
        title="Journal Entries"
        icon={BookOpenCheck}
        subtitle="Every sale, purchase, receipt and payment posts a voucher here automatically — this register is the complete, unbroken audit trail of the books."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowComposer(true)}>
            New Journal Voucher
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search voucher no, narration or account…"
          className="min-w-[240px]"
        />
        <SegmentedControl
          value={typeFilter}
          onChange={setTypeFilter}
          options={[{ value: 'ALL', label: 'All' }, ...types.map((t) => ({ value: t, label: t }))]}
        />
        <DateRange from={range.from} to={range.to} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTileLite label="Vouchers" value={count} icon={FileText} />
        <StatTileLite label="Total value" value={money(totalDebit)} icon={Wallet} />
        <StatTileLite label="System-posted" value={systemCount} icon={Cpu} />
        <StatTileLite label="Manual" value={manualCount} icon={Pencil} />
      </div>

      {loading ? (
        <Spinner label="Loading the journal register…" />
      ) : vouchers.length === 0 ? (
        <Panel>
          <EmptyState title="No vouchers match" hint="Try widening the date range or clearing the filters." />
        </Panel>
      ) : (
        <Panel padded={false}>
          <div className="max-h-[65vh] overflow-y-auto">
            {vouchers.map((voucher) => (
              <VoucherRow
                key={voucher.id}
                voucher={voucher}
                isOpen={Boolean(expanded[voucher.id])}
                onToggle={() => toggle(voucher.id)}
                onReverse={() => reverseVoucher(voucher)}
              />
            ))}
          </div>
        </Panel>
      )}

      <ComposerModal
        open={showComposer}
        onClose={() => setShowComposer(false)}
        accounts={flat}
        showToast={showToast}
        onPosted={() => {
          setShowComposer(false);
          load();
        }}
      />
    </div>
  );
}

function StatTileLite({ label, value, icon: Icon }) {
  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="label-eyebrow">{label}</div>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-[color:var(--accent)]" />}
      </div>
      <div className="tabular mt-2 text-[20px] font-bold leading-none tracking-tight text-[color:var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function VoucherRow({ voucher, isOpen, onToggle, onReverse }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--bg-subtle)]"
      >
        <span className="w-20 shrink-0 text-[11px] text-[color:var(--text-secondary)]">{fmtDate(voucher.date)}</span>
        <span className="w-24 shrink-0 tabular text-[12.5px] font-bold text-[color:var(--accent)]">
          {voucher.voucherNo}
        </span>
        <Badge tone={VOUCHER_TONE[voucher.type] || 'neutral'}>{voucher.type}</Badge>
        {voucher.isReversed && <Badge tone="neutral">Reversed</Badge>}
        {voucher.reversalOf && <Badge tone="info">Reversal</Badge>}
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[color:var(--text-secondary)]">
          {voucher.narration || '—'}
        </span>
        <Money value={voucher.totalDebit} className="w-28 shrink-0 text-right font-bold" />
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-3" style={{ background: 'var(--bg-subtle)' }}>
          <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-[12px]">
              <thead>
                <tr>
                  <th className="label-eyebrow px-3 py-1.5 text-left">Account</th>
                  <th className="label-eyebrow px-3 py-1.5 text-left">Narration</th>
                  <th className="label-eyebrow px-3 py-1.5 text-right">Debit</th>
                  <th className="label-eyebrow px-3 py-1.5 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {voucher.lines.map((line, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-3 py-1.5 font-semibold text-[color:var(--text-primary)]">
                      <span className="tabular font-bold">{line.accountCode}</span> · {line.accountName}
                    </td>
                    <td className="px-3 py-1.5 text-[color:var(--text-secondary)]">{line.narration || '—'}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Money value={line.debit} showZero={false} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Money value={line.credit} showZero={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-strong)' }}>
                  <td className="px-3 py-1.5 font-bold text-[color:var(--text-primary)]" colSpan={2}>
                    Total
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Money value={voucher.totalDebit} className="font-bold" />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Money value={voucher.totalCredit} className="font-bold" />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {!voucher.isReversed && (
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="danger" onClick={onReverse}>
                Reverse voucher
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComposerModal({ open, onClose, accounts, showToast, onPosted }) {
  const blankLine = () => ({ accountId: '', debit: '', credit: '', narration: '' });
  const [date, setDate] = useState(todayISO());
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState([blankLine(), blankLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setNarration('');
      setLines([blankLine(), blankLine()]);
    }
  }, [open]);

  const updateLine = (i, patch) => setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((p) => [...p, blankLine()]);
  const removeLine = (i) => setLines((p) => p.filter((_, idx) => idx !== i));

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff = totalDebit - totalCredit;
  const balanced = Math.abs(diff) < 0.005;
  const filledLines = lines.filter((l) => l.accountId && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0));
  const canSubmit = filledLines.length >= 2 && balanced && narration.trim().length > 0;

  let blockReason = '';
  if (!narration.trim()) blockReason = 'Narration is required.';
  else if (filledLines.length < 2) blockReason = 'Add at least two lines with an account and an amount.';
  else if (!balanced) blockReason = 'Debits and credits must be equal before this voucher can post.';

  const submit = async () => {
    setSaving(true);
    try {
      const res = await api.post('/accounts/journal', {
        date,
        narration,
        lines: filledLines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration
        }))
      });
      showToast(res.message);
      onPosted();
    } catch (err) {
      showToast(api.message(err, 'Could not post the journal voucher.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Journal Voucher"
      subtitle="Manual entries — corrections and adjustments that don't come from a sale, purchase, receipt or payment."
      icon={Plus}
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!canSubmit}>
            Post Voucher
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Narration" required className="sm:col-span-2">
            <Input
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="What is this entry for?"
              autoFocus
            />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 grid grid-cols-12 gap-2 px-1">
            <span className="label-eyebrow col-span-4">Account</span>
            <span className="label-eyebrow col-span-3">Line narration</span>
            <span className="label-eyebrow col-span-2">Debit</span>
            <span className="label-eyebrow col-span-2">Credit</span>
          </div>

          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-4">
                  <Select value={line.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })}>
                    <option value="">— Select account —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    value={line.narration}
                    onChange={(e) => updateLine(i, { narration: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={line.debit}
                    onChange={(e) => updateLine(i, { debit: e.target.value, credit: '' })}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={line.credit}
                    onChange={(e) => updateLine(i, { credit: e.target.value, debit: '' })}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 1}
                    className="rounded-lg p-1.5 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--bg-subtle)] disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Button size="sm" icon={Plus} onClick={addLine} className="mt-2">
            Add line
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-5 rounded-xl px-4 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
          <div className="text-right">
            <div className="label-eyebrow">Total Debit</div>
            <Money value={totalDebit} className="font-bold" />
          </div>
          <div className="text-right">
            <div className="label-eyebrow">Total Credit</div>
            <Money value={totalCredit} className="font-bold" />
          </div>
          <div className="text-right">
            <div className="label-eyebrow">Difference</div>
            <Money
              value={diff}
              className={`font-bold ${balanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
            />
          </div>
        </div>

        {blockReason && (
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{blockReason}</p>
        )}
      </div>
    </Modal>
  );
}
