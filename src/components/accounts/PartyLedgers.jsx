import React, { useEffect, useMemo, useState } from 'react';
import { Users, Truck, MessageSquare, BookOpen, Wallet, AlertTriangle, IndianRupee, Plus } from 'lucide-react';

import api, { money, fmtDate } from '../../lib/api';
import {
  SectionHeader, Button, Modal, Badge, Money, StatTile, Spinner, EmptyState,
  SearchInput, SegmentedControl, DateRange, DataTable
} from '../../lib/ui';

const CONFIG = {
  CUSTOMER: {
    title: 'Customers — Receivables',
    subtitle: 'Running balances, ageing buckets and full ledgers for every customer account.',
    icon: Users,
    endpoint: '/accounts/customers',
    totalKey: 'totalReceivable',
    advanceLabel: 'Advance Held',
    recordLabel: 'Record Receipt',
    recordNav: 'receipts',
    partyNoun: 'Customers',
    whatsapp: true
  },
  VENDOR: {
    title: 'Vendors — Payables',
    subtitle: 'Running balances, ageing buckets and full ledgers for every vendor account.',
    icon: Truck,
    endpoint: '/accounts/vendors',
    totalKey: 'totalPayable',
    advanceLabel: 'Advance Paid',
    recordLabel: 'Record Payment',
    recordNav: 'payments',
    partyNoun: 'Vendors',
    whatsapp: false
  }
};

/** Balance sign tells the story on its own: 0 = settled, negative = we owe them (advance). */
function statusBadge(balance) {
  const n = Number(balance) || 0;
  if (n === 0) return <Badge tone="success">Settled</Badge>;
  if (n < 0) return <Badge tone="info">Advance</Badge>;
  return <Badge tone="warning">Due</Badge>;
}

/**
 * One screen serves both Customers (Receivables) and Vendors (Payables) — the
 * shapes returned by the two list endpoints are identical apart from field names.
 */
export default function PartyLedgers({ partyType, showToast, navigate }) {
  const cfg = CONFIG[partyType];

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('BALANCES');

  const [selectedParty, setSelectedParty] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(cfg.endpoint);
      setData(res);
    } catch (err) {
      showToast(api.message(err, `Could not load ${cfg.partyNoun.toLowerCase()}.`), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType]);

  // Refetch the party's ledger whenever the drawer opens or the date range changes.
  useEffect(() => {
    if (!selectedParty) return;
    setLedgerLoading(true);
    api
      .get(`/accounts/reports/party-ledger/${partyType}/${selectedParty.id}`, { from: range.from, to: range.to })
      .then(setLedger)
      .catch((err) => showToast(api.message(err, 'Could not load the ledger.'), 'error'))
      .finally(() => setLedgerLoading(false));
  }, [selectedParty, range, partyType]);

  const openLedger = (party) => {
    setRange({ from: '', to: '' });
    setLedger(null);
    setSelectedParty(party);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const parties = data?.parties || [];
    if (!needle) return parties;
    return parties.filter((p) => p.name.toLowerCase().includes(needle) || (p.phone || '').includes(needle));
  }, [data, query]);

  const ageingRows = data?.ageing || [];
  const ageingSum = (key) => ageingRows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const overdue90 = ageingSum('d90') + ageingSum('older');

  const sendWhatsapp = async (party) => {
    try {
      const res = await api.post(`/customers/${party.id}/send-whatsapp`);
      if (res?.data?.waLink) window.open(res.data.waLink, '_blank');
      showToast(res.message);
    } catch (err) {
      showToast(api.message(err, 'Could not send the WhatsApp reminder.'), 'error');
    }
  };

  if (loading) return <Spinner label={`Loading ${cfg.partyNoun.toLowerCase()}…`} />;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Parties"
        title={cfg.title}
        icon={cfg.icon}
        subtitle={cfg.subtitle}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => navigate(cfg.recordNav)}>
            {cfg.recordLabel}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Outstanding" value={money(data?.[cfg.totalKey] || 0)} icon={IndianRupee} tone="accent" />
        <StatTile label={cfg.advanceLabel} value={money(data?.totalAdvance || 0)} icon={Wallet} tone="success" />
        <StatTile label="Party Count" value={data?.parties?.length ?? 0} icon={cfg.icon} tone="neutral" />
        <StatTile label="Overdue 90+" value={money(overdue90)} icon={AlertTriangle} tone="danger" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name or phone…" className="min-w-[240px]" />
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: 'BALANCES', label: 'Balances' },
            { value: 'AGEING', label: 'Ageing' }
          ]}
        />
      </div>

      {view === 'BALANCES' ? (
        <DataTable
          columns={[
            { key: 'code', label: 'Code', width: 100, render: (p) => <span className="tabular font-bold">{p.accountCode}</span> },
            {
              key: 'name',
              label: 'Party',
              render: (p) => (
                <div>
                  <div className="font-semibold text-[color:var(--text-primary)]">{p.name}</div>
                  {p.phone && <div className="text-[10.5px] text-[color:var(--text-muted)]">{p.phone}</div>}
                </div>
              )
            },
            {
              key: 'balance',
              label: 'Balance',
              align: 'right',
              width: 130,
              render: (p) => <Money value={p.balance} className="font-bold" />
            },
            { key: 'status', label: 'Status', width: 90, render: (p) => statusBadge(p.balance) },
            {
              key: 'actions',
              label: '',
              align: 'right',
              width: cfg.whatsapp ? 200 : 100,
              render: (p) => (
                <div className="flex justify-end gap-1.5">
                  {cfg.whatsapp && (
                    <Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => sendWhatsapp(p)}>
                      Remind
                    </Button>
                  )}
                  <Button size="sm" variant="subtle" icon={BookOpen} onClick={() => openLedger(p)}>
                    Ledger
                  </Button>
                </div>
              )
            }
          ]}
          rows={filtered}
          rowKey={(p) => p.id}
          empty={<EmptyState icon={cfg.icon} title={`No ${cfg.partyNoun.toLowerCase()} found`} hint="Try a different search term." />}
        />
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Party', render: (r) => <span className="font-semibold">{r.name}</span> },
            { key: 'current', label: 'Current (0-30)', align: 'right', width: 110, render: (r) => <Money value={r.current} showZero={false} /> },
            { key: 'd30', label: '31-60', align: 'right', width: 100, render: (r) => <Money value={r.d30} showZero={false} /> },
            { key: 'd60', label: '61-90', align: 'right', width: 100, render: (r) => <Money value={r.d60} showZero={false} /> },
            { key: 'd90', label: '91-120', align: 'right', width: 100, render: (r) => <Money value={r.d90} showZero={false} /> },
            { key: 'older', label: 'Over 120', align: 'right', width: 110, render: (r) => <Money value={r.older} showZero={false} /> },
            { key: 'total', label: 'Total', align: 'right', width: 120, render: (r) => <Money value={r.total} className="font-bold" /> }
          ]}
          rows={ageingRows}
          rowKey={(r) => r.accountId || r.partyId}
          empty={<EmptyState title="Nothing overdue" hint="No open balances to age yet." />}
          footer={[
            'Total',
            money(ageingSum('current')),
            money(ageingSum('d30')),
            money(ageingSum('d60')),
            money(ageingSum('d90')),
            money(ageingSum('older')),
            money(ageingSum('total'))
          ]}
        />
      )}

      <Modal
        open={Boolean(selectedParty)}
        onClose={() => setSelectedParty(null)}
        title={selectedParty ? `${selectedParty.accountCode ? `${selectedParty.accountCode} · ` : ''}${selectedParty.name}` : ''}
        subtitle={selectedParty ? `${cfg.partyNoun.slice(0, -1)} ledger · ${ledger ? `${ledger.entries.length} entries` : 'loading…'}` : ''}
        icon={BookOpen}
        size="xl"
        footer={<Button onClick={() => setSelectedParty(null)}>Close</Button>}
      >
        {selectedParty && (
          <div className="space-y-3">
            <DateRange from={range.from} to={range.to} onChange={setRange} />

            {ledgerLoading || !ledger ? (
              <Spinner />
            ) : (
              <>
                <div className="grid grid-cols-4 gap-3">
                  <Summary label="Opening" value={ledger.opening} />
                  <Summary label="Total debit" value={ledger.totalDebit} />
                  <Summary label="Total credit" value={ledger.totalCredit} />
                  <Summary label={`Closing (${ledger.normalSide})`} value={ledger.closing} bold />
                </div>

                <DataTable
                  maxHeight="42vh"
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
                  rowKey={(e, i) => `${e.voucherNo}_${i}`}
                  empty={<EmptyState title="No postings yet" hint="This party has no ledger activity yet." />}
                  footer={['', '', 'Closing balance', money(ledger.totalDebit), money(ledger.totalCredit), money(ledger.closing)]}
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
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
