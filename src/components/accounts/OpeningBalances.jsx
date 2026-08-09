import React, { useEffect, useMemo, useState } from 'react';
import { Scale, CheckCircle2, AlertTriangle } from 'lucide-react';

import api, { fmtDate, financialYearStartISO } from '../../lib/api';
import {
  Panel, SectionHeader, Button, Field, Input, Badge, Money,
  Spinner, EmptyState, SearchInput, SegmentedControl, DataTable
} from '../../lib/ui';

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
const TYPE_LABEL = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  INCOME: 'Income',
  EXPENSE: 'Expenses'
};

/**
 * Lets a shop entering Selsolve mid-year key in its existing balances. Every
 * row posts against Opening Balance Equity, a suspense account that should net
 * to zero once the batch is complete — that's the signal the books are ready.
 */
export default function OpeningBalances({ showToast }) {
  const [accounts, setAccounts] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [suspenseBalance, setSuspenseBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(financialYearStartISO());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  const [rows, setRows] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/accounts/opening-balances');
      setAccounts(data.accounts || []);
      setVouchers(data.vouchers || []);
      setSuspenseBalance(data.suspenseBalance || 0);
    } catch (err) {
      showToast(api.message(err, 'Could not load opening balances.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
      if (needle && !a.name.toLowerCase().includes(needle) && !a.code.toLowerCase().includes(needle)) return false;
      if (onlyWithBalance && !a.hasOpening && !rows[a.id]) return false;
      return true;
    });
  }, [accounts, query, typeFilter, onlyWithBalance, rows]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((a) => {
      groups[a.type] = groups[a.type] || [];
      groups[a.type].push(a);
    });
    return groups;
  }, [filtered]);

  // Debit and credit are mutually exclusive per row: typing in one clears the other.
  const setDebit = (id, value) => setRows((p) => ({ ...p, [id]: { debit: value, credit: '' } }));
  const setCredit = (id, value) => setRows((p) => ({ ...p, [id]: { debit: '', credit: value } }));

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    Object.values(rows).forEach((r) => {
      debit += Number(r.debit) || 0;
      credit += Number(r.credit) || 0;
    });
    return { debit, credit, diff: debit - credit };
  }, [rows]);

  const filledCount = Object.values(rows).filter((r) => (Number(r.debit) || 0) > 0 || (Number(r.credit) || 0) > 0).length;
  const squared = Math.abs(suspenseBalance) < 0.005;

  const submit = async () => {
    const filledRows = Object.entries(rows)
      .filter(([, r]) => (Number(r.debit) || 0) > 0 || (Number(r.credit) || 0) > 0)
      .map(([accountId, r]) => ({
        accountId,
        amount: Number(r.debit) || Number(r.credit) || 0,
        side: Number(r.debit) > 0 ? 'DR' : 'CR',
        date
      }));

    if (!filledRows.length) {
      showToast('Enter at least one opening balance before posting.', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/accounts/opening-balances', { rows: filledRows, date });
      showToast(res.message);
      setRows({});
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not post opening balances.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading opening balances…" />;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Masters"
        title="Opening Balances"
        icon={Scale}
        subtitle="Each opening balance posts against Opening Balance Equity, a suspense ledger. The books are fully set up once that account nets to zero."
      />

      <Panel className="flex items-center gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: squared ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }}
        >
          {squared ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {squared ? (
            <>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                Opening balances are fully squared
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--text-secondary)]">
                Opening Balance Equity nets to zero — the books are fully set up.
              </p>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                <Money value={Math.abs(suspenseBalance)} /> still unallocated in Opening Balance Equity
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--text-secondary)]">
                Keep entering existing balances until this account nets to zero. Any remaining difference belongs in
                Capital Account.
              </p>
            </>
          )}
        </div>
      </Panel>

      <Field label="As-on date" hint="Applies to every row posted in this batch" className="max-w-[220px]">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by account name or code…" className="min-w-[240px]" />
        <SegmentedControl
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'ASSET', label: 'Assets' },
            { value: 'LIABILITY', label: 'Liabilities' },
            { value: 'EQUITY', label: 'Equity' },
            { value: 'INCOME', label: 'Income' },
            { value: 'EXPENSE', label: 'Expenses' }
          ]}
        />
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)]">
          <input
            type="checkbox"
            checked={onlyWithBalance}
            onChange={(e) => setOnlyWithBalance(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-indigo-600"
          />
          Show only accounts with a balance
        </label>
      </div>

      <Panel padded={false}>
        {filtered.length === 0 ? (
          <EmptyState title="No accounts match" hint="Try a different name, code or type filter." />
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            {TYPE_ORDER.filter((type) => grouped[type]?.length).map((type) => (
              <div key={type}>
                <div
                  className="label-eyebrow px-4 py-1.5"
                  style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}
                >
                  {TYPE_LABEL[type]}
                </div>
                {grouped[type].map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    row={rows[account.id]}
                    onDebit={(v) => setDebit(account.id, v)}
                    onCredit={(v) => setCredit(account.id, v)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        <div
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border-strong)' }}
        >
          <div className="flex items-center gap-5">
            <div>
              <div className="label-eyebrow">Total Debit</div>
              <Money value={totals.debit} className="font-bold" />
            </div>
            <div>
              <div className="label-eyebrow">Total Credit</div>
              <Money value={totals.credit} className="font-bold" />
            </div>
            <div>
              <div className="label-eyebrow">Difference</div>
              <Money
                value={totals.diff}
                className={`font-bold ${Math.abs(totals.diff) < 0.005 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
              />
            </div>
          </div>
          <Button variant="primary" icon={Scale} loading={saving} disabled={filledCount === 0} onClick={submit}>
            Post Opening Balances
          </Button>
        </div>
      </Panel>

      <DataTable
        columns={[
          { key: 'date', label: 'Date', width: 100, render: (v) => fmtDate(v.date) },
          {
            key: 'voucherNo',
            label: 'Voucher No',
            width: 120,
            render: (v) => <span className="tabular font-bold text-[color:var(--accent)]">{v.voucherNo}</span>
          },
          { key: 'narration', label: 'Narration', render: (v) => <span className="line-clamp-1">{v.narration || '—'}</span> },
          {
            key: 'amount',
            label: 'Amount',
            align: 'right',
            width: 130,
            render: (v) => <Money value={v.totalDebit} className="font-bold" />
          }
        ]}
        rows={vouchers}
        empty={<EmptyState title="No opening balances posted yet" hint="Post your first batch above to seed the books." />}
      />
    </div>
  );
}

function AccountRow({ account, row, onDebit, onCredit }) {
  return (
    <div className="grid grid-cols-12 items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="tabular col-span-1 text-[11px] font-bold text-[color:var(--text-muted)]">{account.code}</span>
      <span className="col-span-4 truncate text-[12.5px] font-medium text-[color:var(--text-primary)]">{account.name}</span>
      <span className="col-span-3">
        {account.hasOpening && (
          <Badge tone="info">
            Set · <Money value={account.openingDebit || account.openingCredit} showZero={false} className="ml-0.5" />
            {account.openingDebit ? ' Dr' : ' Cr'}
          </Badge>
        )}
      </span>
      <div className="col-span-2">
        <Input type="number" step="0.01" value={row?.debit || ''} onChange={(e) => onDebit(e.target.value)} placeholder="Debit" />
      </div>
      <div className="col-span-2">
        <Input type="number" step="0.01" value={row?.credit || ''} onChange={(e) => onCredit(e.target.value)} placeholder="Credit" />
      </div>
    </div>
  );
}
