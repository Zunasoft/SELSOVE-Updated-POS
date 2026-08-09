import React, { useEffect, useMemo, useState } from 'react';
import {
  ListTree, Plus, ChevronRight, ChevronDown, Search, Lock, Trash2,
  BookOpen, Landmark, Wallet, Users, Truck
} from 'lucide-react';

import api, { money, fmtDate } from '../../lib/api';
import {
  Panel, SectionHeader, Button, Modal, Field, Input, Select, Textarea,
  Badge, Money, Spinner, EmptyState, SearchInput, SegmentedControl, DataTable
} from '../../lib/ui';

const TYPE_TONE = {
  ASSET: 'info',
  LIABILITY: 'warning',
  EQUITY: 'accent',
  INCOME: 'success',
  EXPENSE: 'danger'
};

const TYPE_LABEL = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  INCOME: 'Income',
  EXPENSE: 'Expenses'
};

/**
 * The Chart of Accounts is the foundation every other screen reads from, so it
 * is presented as a real tree with roll-up balances rather than a flat list.
 */
export default function ChartOfAccounts({ showToast }) {
  const [tree, setTree] = useState([]);
  const [flat, setFlat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const [showCreate, setShowCreate] = useState(false);
  const [ledgerAccount, setLedgerAccount] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/accounts/chart');
      setTree(data.tree);
      setFlat(data.flat);
      // Top two levels open by default: enough structure without a wall of rows.
      setExpanded((prev) =>
        Object.keys(prev).length
          ? prev
          : data.flat.reduce((acc, a) => {
              if (!a.parentId) acc[a.id] = true;
              return acc;
            }, {})
      );
    } catch (err) {
      showToast(api.message(err, 'Could not load the chart of accounts.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const searching = query.trim().length > 0;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return flat.filter((a) => {
      if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
      if (!needle) return true;
      return a.name.toLowerCase().includes(needle) || a.code.toLowerCase().includes(needle);
    });
  }, [flat, query, typeFilter]);

  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const summary = useMemo(() => {
    const totals = {};
    tree.forEach((root) => {
      totals[root.type] = (totals[root.type] || 0) + root.balance;
    });
    return totals;
  }, [tree]);

  if (loading) return <Spinner label="Loading the chart of accounts…" />;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Masters"
        title="Chart of Accounts"
        icon={ListTree}
        subtitle="Every ledger in the business, grouped under Assets, Liabilities, Equity, Income and Expenses. Balances roll up from the journal automatically."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
            New Ledger
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map((type) => (
          <Panel key={type} className="text-center">
            <div className="label-eyebrow">{TYPE_LABEL[type]}</div>
            <Money value={summary[type] || 0} className="mt-1 block text-[16px] font-bold" decimals={false} />
            <div className="mt-0.5 text-[10px] font-semibold text-[color:var(--text-muted)]">
              {flat.filter((a) => a.type === type && !a.isGroup).length} ledgers
            </div>
          </Panel>
        ))}
      </div>

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
      </div>

      {searching || typeFilter !== 'ALL' ? (
        <DataTable
          columns={[
            { key: 'code', label: 'Code', width: 110, render: (a) => <span className="tabular font-bold">{a.code}</span> },
            {
              key: 'name',
              label: 'Account',
              render: (a) => (
                <span className="flex items-center gap-1.5 font-semibold">
                  {accountIcon(a)}
                  {a.name}
                  {a.isGroup && <Badge>Group</Badge>}
                </span>
              )
            },
            { key: 'type', label: 'Type', width: 110, render: (a) => <Badge tone={TYPE_TONE[a.type]}>{a.type}</Badge> },
            {
              key: 'balance',
              label: 'Balance',
              align: 'right',
              width: 140,
              render: (a) => <Money value={a.balance} className="font-bold" />
            },
            {
              key: 'actions',
              label: '',
              align: 'right',
              width: 90,
              render: (a) =>
                a.isGroup ? null : (
                  <Button size="sm" variant="ghost" icon={BookOpen} onClick={() => setLedgerAccount(a)}>
                    Ledger
                  </Button>
                )
            }
          ]}
          rows={matches}
          empty={<EmptyState title="No accounts match" hint="Try a different name, code or type filter." />}
        />
      ) : (
        <Panel padded={false}>
          <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="label-eyebrow flex-1">Account</div>
            <div className="label-eyebrow w-28 text-right">Balance</div>
            <div className="w-20" />
          </div>
          <div className="max-h-[62vh] overflow-y-auto">
            {tree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                expanded={expanded}
                onToggle={toggle}
                onOpenLedger={setLedgerAccount}
              />
            ))}
          </div>
        </Panel>
      )}

      <CreateLedgerModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        accounts={flat}
        showToast={showToast}
        onCreated={() => {
          setShowCreate(false);
          load();
        }}
      />

      <LedgerModal account={ledgerAccount} onClose={() => setLedgerAccount(null)} showToast={showToast} onChanged={load} />
    </div>
  );
}

function accountIcon(account) {
  if (account.partyType === 'CUSTOMER') return <Users className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />;
  if (account.partyType === 'VENDOR') return <Truck className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />;
  if (account.systemKey === 'BANK') return <Landmark className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />;
  if (account.systemKey === 'CASH') return <Wallet className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />;
  return null;
}

function TreeRow({ node, expanded, onToggle, onOpenLedger }) {
  const isOpen = expanded[node.id];
  const hasChildren = node.children && node.children.length > 0;

  return (
    <>
      <div
        className="group flex items-center gap-2 px-4 py-2 transition-colors hover:bg-[color:var(--bg-subtle)]"
        style={{ borderBottom: '1px solid var(--border)', paddingLeft: 16 + node.depth * 18 }}
      >
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className={`shrink-0 rounded p-0.5 ${hasChildren ? 'text-[color:var(--text-muted)]' : 'invisible'}`}
        >
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <span className="tabular w-16 shrink-0 text-[11px] font-bold text-[color:var(--text-muted)]">{node.code}</span>

        <span
          className={`flex min-w-0 flex-1 items-center gap-1.5 truncate text-[12.5px] ${
            node.isGroup ? 'font-bold text-[color:var(--text-primary)]' : 'font-medium text-[color:var(--text-secondary)]'
          }`}
        >
          {accountIcon(node)}
          <span className="truncate">{node.name}</span>
          {node.isSystem && <Lock className="h-2.5 w-2.5 shrink-0 text-[color:var(--text-muted)]" title="System account" />}
        </span>

        <Money
          value={node.balance}
          showZero={false}
          className={`w-28 shrink-0 text-right text-[12.5px] ${node.isGroup ? 'font-bold' : ''}`}
        />

        <div className="w-20 shrink-0 text-right">
          {!node.isGroup && (
            <button
              onClick={() => onOpenLedger(node)}
              className="rounded-lg px-2 py-1 text-[10px] font-bold text-[color:var(--accent)] opacity-0 transition-opacity hover:bg-[color:var(--accent-soft)] group-hover:opacity-100"
            >
              Ledger
            </button>
          )}
        </div>
      </div>

      {isOpen &&
        hasChildren &&
        node.children.map((child) => (
          <TreeRow key={child.id} node={child} expanded={expanded} onToggle={onToggle} onOpenLedger={onOpenLedger} />
        ))}
    </>
  );
}

function CreateLedgerModal({ open, onClose, accounts, showToast, onCreated }) {
  const blank = { name: '', parentId: '', type: 'EXPENSE', isGroup: false, description: '', openingBalance: '', openingSide: 'DR' };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(blank);
  }, [open]);

  const groups = accounts.filter((a) => a.isGroup);
  const parent = accounts.find((a) => a.id === form.parentId);
  const effectiveType = parent ? parent.type : form.type;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/accounts/chart', {
        ...form,
        type: effectiveType,
        openingBalance: Number(form.openingBalance) || 0
      });
      showToast(res.message);
      onCreated();
    } catch (err) {
      showToast(api.message(err, 'Could not create the ledger.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Ledger Account"
      subtitle="Add a ledger under any existing group. Its type follows the parent."
      icon={Plus}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Create Ledger
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Account name" required className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Shop Insurance Premium"
            autoFocus
          />
        </Field>

        <Field label="Place under group" hint={parent ? `Type inherited: ${parent.type}` : 'Choose a parent group'}>
          <Select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">— Select group —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {' '.repeat(g.code.length > 4 ? 4 : 0)}
                {g.code} · {g.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Account type" hint={parent ? 'Locked to the parent group' : undefined}>
          <Select
            value={effectiveType}
            disabled={Boolean(parent)}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Opening balance" hint="Optional — posts against Opening Balance Equity">
          <Input
            type="number"
            step="0.01"
            value={form.openingBalance}
            onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
            placeholder="0.00"
          />
        </Field>

        <Field label="Opening side">
          <Select value={form.openingSide} onChange={(e) => setForm({ ...form, openingSide: e.target.value })}>
            <option value="DR">Debit (Dr)</option>
            <option value="CR">Credit (Cr)</option>
          </Select>
        </Field>

        <Field label="Description" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What is this ledger used for?"
          />
        </Field>

        <label className="flex items-center gap-2 text-[12px] font-semibold text-[color:var(--text-secondary)] sm:col-span-2">
          <input
            type="checkbox"
            checked={form.isGroup}
            onChange={(e) => setForm({ ...form, isGroup: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-indigo-600"
          />
          Create as a group header (holds other ledgers, cannot be posted to directly)
        </label>
      </form>
    </Modal>
  );
}

function LedgerModal({ account, onClose, showToast, onChanged }) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    api
      .get(`/accounts/ledger/${account.id}`)
      .then(setLedger)
      .catch((err) => showToast(api.message(err), 'error'))
      .finally(() => setLoading(false));
  }, [account]);

  const remove = async () => {
    try {
      const res = await api.del(`/accounts/chart/${account.id}`);
      showToast(res.message);
      onClose();
      onChanged();
    } catch (err) {
      showToast(api.message(err), 'error');
    }
  };

  return (
    <Modal
      open={Boolean(account)}
      onClose={onClose}
      title={account ? `${account.code} · ${account.name}` : ''}
      subtitle={account ? `${account.type} · ${ledger ? `${ledger.entries.length} entries` : 'loading…'}` : ''}
      icon={BookOpen}
      size="xl"
      footer={
        <>
          {account && !account.isSystem && (
            <Button variant="danger" icon={Trash2} onClick={remove} className="mr-auto">
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {loading || !ledger ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <Summary label="Opening" value={ledger.opening} />
            <Summary label="Total debit" value={ledger.totalDebit} />
            <Summary label="Total credit" value={ledger.totalCredit} />
            <Summary label={`Closing (${ledger.normalSide})`} value={ledger.closing} bold />
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
              {
                key: 'narration',
                label: 'Particulars',
                render: (e) => <span className="line-clamp-1">{e.narration || '—'}</span>
              },
              { key: 'debit', label: 'Debit', align: 'right', width: 100, render: (e) => <Money value={e.debit} showZero={false} /> },
              { key: 'credit', label: 'Credit', align: 'right', width: 100, render: (e) => <Money value={e.credit} showZero={false} /> },
              {
                key: 'balance',
                label: 'Balance',
                align: 'right',
                width: 110,
                render: (e) => <Money value={e.balance} className="font-bold" />
              }
            ]}
            rows={ledger.entries}
            rowKey={(e, i) => `${e.voucherId}_${i}`}
            empty={<EmptyState title="No postings yet" hint="This ledger has not been used in any voucher." />}
            footer={['', '', 'Closing balance', money(ledger.totalDebit), money(ledger.totalCredit), money(ledger.closing)]}
          />
        </div>
      )}
    </Modal>
  );
}

function Summary({ label, value, bold }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
      <div className="label-eyebrow">{label}</div>
      <Money value={value} className={`mt-0.5 block text-[13px] ${bold ? 'font-bold' : 'font-semibold'}`} />
    </div>
  );
}
