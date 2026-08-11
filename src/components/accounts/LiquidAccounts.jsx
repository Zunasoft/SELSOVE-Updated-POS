import React, { useEffect, useState } from 'react';
import {
  Landmark, Wallet, Plus, BookOpen, ArrowDownLeft, ArrowUpRight,
  ChevronRight, ChevronDown, CalendarDays
} from 'lucide-react';

import api, { money, fmtDate, fmtDateTime, todayISO } from '../../lib/api';
import {
  Panel, SectionHeader, StatTile, Button, Modal, Field, Input, Select,
  Badge, Money, Spinner, EmptyState, DataTable, DateRange
} from '../../lib/ui';

/**
 * Bank and cash ledgers. Both are "liquid" accounts that behave identically in
 * the journal, so one component serves both with the bank-specific detail
 * fields and the cash book switched on by `kind`.
 */
export default function LiquidAccounts({ kind, showToast }) {
  const isBank = kind === 'BANK';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [ledgerAccount, setLedgerAccount] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.get(isBank ? '/accounts/banks' : '/accounts/cash'));
    } catch (err) {
      showToast(api.message(err, 'Could not load accounts.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [kind]);

  if (loading) return <Spinner label={isBank ? 'Loading bank accounts…' : 'Loading cash accounts…'} />;
  if (!data) return <EmptyState title="Could not load accounts" />;

  const accounts = data.accounts || [];
  const today = data.today;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Masters"
        title={isBank ? 'Bank Accounts' : 'Cash Accounts'}
        icon={isBank ? Landmark : Wallet}
        subtitle={
          isBank
            ? 'Every bank ledger with its live balance. Card and UPI settlements from the POS land in the primary account automatically.'
            : 'The counter drawer and any other cash ledger, with a day-by-day cash book showing opening, receipts, payments and closing.'
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
            {isBank ? 'Add Bank Account' : 'Add Cash Account'}
          </Button>
        }
      />

      {isBank ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Total Bank Balance" value={money(data.total, { decimals: false })} icon={Landmark} tone="accent" />
          <StatTile label="Accounts" value={accounts.length} sub="Active bank ledgers" />
          <StatTile
            label="Total Inflow"
            value={money(accounts.reduce((s, a) => s + a.totalInflow, 0), { decimals: false })}
            icon={ArrowDownLeft}
            tone="success"
          />
          <StatTile
            label="Total Outflow"
            value={money(accounts.reduce((s, a) => s + a.totalOutflow, 0), { decimals: false })}
            icon={ArrowUpRight}
            tone="danger"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Cash in Hand" value={money(data.total, { decimals: false })} icon={Wallet} tone="accent" />
          <StatTile label="Today's Opening" value={money(today?.opening || 0, { decimals: false })} />
          <StatTile
            label="Today's Receipts"
            value={money(today?.inflow || 0, { decimals: false })}
            icon={ArrowDownLeft}
            tone="success"
          />
          <StatTile
            label="Today's Payments"
            value={money(today?.outflow || 0, { decimals: false })}
            icon={ArrowUpRight}
            tone="danger"
          />
        </div>
      )}

      {/* Account cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.length === 0 ? (
          <Panel className="sm:col-span-2 xl:col-span-3">
            <EmptyState
              icon={isBank ? Landmark : Wallet}
              title={isBank ? 'No bank accounts yet' : 'No cash accounts yet'}
              hint="Add one to start tracking balances and reconciling statements."
              action={
                <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
                  Add account
                </Button>
              }
            />
          </Panel>
        ) : (
          accounts.map((account) => (
            <Panel key={account.id} className="flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-bold text-[color:var(--text-primary)]">
                      {account.name}
                    </div>
                    <div className="tabular text-[10.5px] font-semibold text-[color:var(--text-muted)]">
                      {account.code}
                      {isBank && account.bankDetails?.accountType ? ` · ${account.bankDetails.accountType}` : ''}
                    </div>
                  </div>
                  {isBank ? (
                    <Landmark className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
                  ) : (
                    <Wallet className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
                  )}
                </div>

                {isBank && (
                  <div className="mt-2 space-y-0.5 text-[10.5px] text-[color:var(--text-muted)]">
                    {/* Only the last four digits — full numbers do not belong on a dashboard. */}
                    <div className="tabular">
                      {account.bankDetails?.accountNumber
                        ? `•••• ${String(account.bankDetails.accountNumber).slice(-4)}`
                        : 'Account number not set'}
                    </div>
                    {account.bankDetails?.ifsc && <div>IFSC {account.bankDetails.ifsc}</div>}
                    {account.bankDetails?.branch && <div>{account.bankDetails.branch}</div>}
                  </div>
                )}

                <Money value={account.balance} className="mt-3 block text-[22px] font-bold leading-none" />
              </div>

              <div className="mt-3 flex items-end justify-between gap-2 border-t pt-2.5" style={{ borderColor: 'var(--border)' }}>
                <div className="flex gap-4">
                  <Micro label="In" value={account.totalInflow} tone="success" />
                  <Micro label="Out" value={account.totalOutflow} tone="danger" />
                </div>
                <Button size="sm" variant="ghost" icon={BookOpen} onClick={() => setLedgerAccount(account)}>
                  Ledger
                </Button>
              </div>

              <div className="mt-1.5 text-[10px] text-[color:var(--text-muted)]">
                {account.transactionCount} entries · last activity {fmtDate(account.lastActivity)}
              </div>
            </Panel>
          ))
        )}
      </div>

      {/* Cash book — the day-wise view a shopkeeper actually reconciles against */}
      {!isBank && data.book && data.book.length > 0 && (
        <div className="space-y-2">
          <SectionHeader eyebrow="Last 30 days" title="Cash Book" icon={CalendarDays} />
          <Panel padded={false}>
            <div className="max-h-[52vh] overflow-y-auto">
              <table className="ledger-table w-full">
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th style={{ width: 130 }}>Date</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Opening</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Cash In</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Cash Out</th>
                    <th style={{ width: 140, textAlign: 'right' }}>Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {data.book.map((day) => {
                    const open = expandedDay === day.date;
                    return (
                      <React.Fragment key={day.date}>
                        <tr
                          className="cursor-pointer"
                          onClick={() => setExpandedDay(open ? null : day.date)}
                        >
                          <td>
                            {open ? (
                              <ChevronDown className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />
                            )}
                          </td>
                          <td className="font-semibold">{fmtDate(day.date)}</td>
                          <td className="text-right">
                            <Money value={day.opening} />
                          </td>
                          <td className="text-right">
                            <Money value={day.inflow} showZero={false} className="text-emerald-600 dark:text-emerald-400" />
                          </td>
                          <td className="text-right">
                            <Money value={day.outflow} showZero={false} className="text-rose-600 dark:text-rose-400" />
                          </td>
                          <td className="text-right">
                            <Money value={day.closing} className="font-bold" />
                          </td>
                        </tr>

                        {open &&
                          day.entries.map((entry, i) => (
                            <tr key={`${day.date}_${i}`} style={{ background: 'var(--bg-subtle)' }}>
                              <td />
                              <td colSpan={2} className="text-[11.5px]">
                                <span className="tabular mr-2 font-bold text-[color:var(--accent)]">
                                  {entry.voucherNo}
                                </span>
                                <span className="text-[color:var(--text-secondary)]">{entry.narration}</span>
                              </td>
                              <td className="text-right text-[11.5px]">
                                <Money value={entry.debit} showZero={false} />
                              </td>
                              <td className="text-right text-[11.5px]">
                                <Money value={entry.credit} showZero={false} />
                              </td>
                              <td className="text-right text-[11.5px]">
                                <Money value={entry.balance} />
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      <CreateAccountModal
        open={showCreate}
        isBank={isBank}
        onClose={() => setShowCreate(false)}
        showToast={showToast}
        onCreated={() => {
          setShowCreate(false);
          load();
        }}
      />

      <LedgerModal account={ledgerAccount} onClose={() => setLedgerAccount(null)} showToast={showToast} />
    </div>
  );
}

function Micro({ label, value, tone }) {
  return (
    <div>
      <div className="label-eyebrow">{label}</div>
      <Money
        value={value}
        decimals={false}
        className={`text-[11.5px] font-bold ${
          tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
        }`}
      />
    </div>
  );
}

function CreateAccountModal({ open, isBank, onClose, showToast, onCreated }) {
  const blank = {
    name: '',
    accountNumber: '',
    ifsc: '',
    branch: '',
    accountType: 'Current',
    openingBalance: '',
    openingDate: todayISO()
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(blank);
  }, [open]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(isBank ? '/accounts/banks' : '/accounts/cash', {
        ...form,
        openingBalance: Number(form.openingBalance) || 0
      });
      showToast(res.message);
      onCreated();
    } catch (err) {
      showToast(api.message(err, 'Could not create the account.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isBank ? 'Add Bank Account' : 'Add Cash Account'}
      subtitle="An opening balance posts against Opening Balance Equity so the books stay square."
      icon={Plus}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!form.name.trim()}>
            Create Account
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={isBank ? 'Bank name' : 'Cash account name'} required className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={isBank ? 'e.g. HDFC Current Account' : 'e.g. Counter 2 Drawer'}
            autoFocus
          />
        </Field>

        {isBank && (
          <>
            <Field label="Account number">
              <Input
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="50100XXXXXXXXX"
              />
            </Field>
            <Field label="IFSC code">
              <Input
                value={form.ifsc}
                onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
                placeholder="HDFC0001234"
              />
            </Field>
            <Field label="Branch">
              <Input
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                placeholder="Anna Nagar, Chennai"
              />
            </Field>
            <Field label="Account type">
              <Select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                <option value="Current">Current</option>
                <option value="Savings">Savings</option>
                <option value="OD">Overdraft (OD)</option>
                <option value="CC">Cash Credit (CC)</option>
              </Select>
            </Field>
          </>
        )}

        <Field label="Opening balance" hint="Leave blank to start at zero">
          <Input
            type="number"
            step="0.01"
            value={form.openingBalance}
            onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
            placeholder="0.00"
          />
        </Field>

        <Field label="Opening as-on date">
          <Input
            type="date"
            value={form.openingDate}
            onChange={(e) => setForm({ ...form, openingDate: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}

function LedgerModal({ account, onClose, showToast }) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });

  useEffect(() => {
    if (!account) {
      setLedger(null);
      return;
    }
    setLoading(true);
    api
      .get(`/accounts/ledger/${account.id}`, { from: range.from || undefined, to: range.to || undefined })
      .then(setLedger)
      .catch((err) => showToast(api.message(err), 'error'))
      .finally(() => setLoading(false));
  }, [account, range]);

  return (
    <Modal
      open={Boolean(account)}
      onClose={onClose}
      title={account ? `${account.code} · ${account.name}` : ''}
      subtitle={ledger ? `${ledger.entries.length} entries in this period` : 'Loading…'}
      icon={BookOpen}
      size="xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="space-y-3">
        <div className="no-print">
          <DateRange from={range.from} to={range.to} onChange={setRange} />
        </div>

        {loading || !ledger ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3">
              <Summary label="Opening" value={ledger.opening} />
              <Summary label="Total In" value={ledger.totalDebit} />
              <Summary label="Total Out" value={ledger.totalCredit} />
              <Summary label="Closing" value={ledger.closing} bold />
            </div>

            <DataTable
              maxHeight="44vh"
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
                { key: 'debit', label: 'In', align: 'right', width: 100, render: (e) => <Money value={e.debit} showZero={false} /> },
                { key: 'credit', label: 'Out', align: 'right', width: 100, render: (e) => <Money value={e.credit} showZero={false} /> },
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
              empty={<EmptyState title="No movement in this period" />}
              footer={['', '', 'Closing', money(ledger.totalDebit), money(ledger.totalCredit), money(ledger.closing)]}
            />
          </>
        )}
      </div>
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
