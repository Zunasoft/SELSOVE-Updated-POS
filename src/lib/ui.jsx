import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ChevronDown, Inbox, Loader2, Printer, Download } from 'lucide-react';
import { money } from './api';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ *
 * Surfaces & layout
 * ------------------------------------------------------------------ */

export function Panel({ className = '', children, padded = true, ...rest }) {
  return (
    <div className={cx('surface rounded-2xl', padded && 'p-4', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeader({ eyebrow, title, subtitle, icon: Icon, actions, className = '' }) {
  return (
    <div className={cx('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="label-eyebrow mb-1">{eyebrow}</div>}
        <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-[color:var(--text-primary)]">
          {Icon && <Icon className="h-[18px] w-[18px] shrink-0 text-[color:var(--accent)]" />}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[color:var(--text-secondary)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Toolbar({ children, className = '' }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-2 rounded-2xl surface px-3 py-2.5', className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */

const BUTTON_VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-600/25 border-transparent',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-600/25 border-transparent',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-600/25 border-transparent',
  subtle:
    'bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] border-[color:var(--border)]',
  ghost: 'bg-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)] border-transparent',
  outline:
    'bg-transparent text-[color:var(--accent)] border-[color:var(--accent)] hover:bg-[color:var(--accent-soft)]'
};

export function Button({
  variant = 'subtle',
  size = 'md',
  icon: Icon,
  loading = false,
  className = '',
  children,
  ...rest
}) {
  const sizing = size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : size === 'lg' ? 'px-5 py-2.5 text-sm' : 'px-3.5 py-2 text-xs';
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl border font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        sizing,
        className
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, required, error, className = '', children }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="label-eyebrow mb-1.5 block">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] font-semibold text-rose-500">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-[11px] text-[color:var(--text-muted)]">{hint}</span>
      )}
    </label>
  );
}

export const Input = React.forwardRef(({ className = '', ...rest }, ref) => (
  <input ref={ref} className={cx('field-input', className)} {...rest} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef(({ className = '', rows = 3, ...rest }, ref) => (
  <textarea ref={ref} rows={rows} className={cx('field-input resize-y', className)} {...rest} />
));
Textarea.displayName = 'Textarea';

export function Select({ className = '', children, value, onChange, ...rest }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Parse children options
  const options = [];
  React.Children.forEach(children, child => {
    if (child && child.type === 'option') {
      options.push({ value: child.props.value, label: child.props.children });
    } else if (child && Array.isArray(child)) {
      child.forEach(c => {
         if (c && c.type === 'option') {
           options.push({ value: c.props.value, label: c.props.children });
         }
      })
    }
  });

  const selectedOption = options.find(o => String(o.value) === String(value));
  const selectedLabel = selectedOption ? selectedOption.label : 'Select...';

  const filtered = options.filter(o => 
    String(o.label || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (val) => {
    if (onChange) {
      onChange({ target: { value: val } });
    }
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={cx('relative', className)} ref={containerRef}>
      <div 
        className={cx('field-input pr-8 cursor-pointer flex items-center min-h-[36px]', rest.disabled && 'opacity-50 cursor-not-allowed')}
        onClick={() => !rest.disabled && setOpen(!open)}
      >
        <span className="truncate">{selectedLabel}</span>
      </div>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
      
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[color:var(--border-subtle)]">
            <input 
              type="text" 
              className="w-full text-xs p-1.5 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)] placeholder-[color:var(--text-muted)] focus:outline-none focus:border-indigo-500" 
              placeholder="Search..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="p-2 text-center text-xs text-[color:var(--text-muted)]">No results found</div>
            ) : (
              filtered.map((opt, idx) => (
                <div 
                  key={idx}
                  className={cx(
                    'px-2.5 py-2 text-xs rounded-lg cursor-pointer transition-colors',
                    String(opt.value) === String(value) ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold' : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--text-primary)]'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(opt.value);
                  }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={cx('relative flex-1', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
      <input
        className="field-input pl-8.5"
        style={{ paddingLeft: '2.1rem' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function SegmentedControl({ options, value, onChange, className = '' }) {
  return (
    <div
      className={cx('inline-flex items-center gap-0.5 rounded-xl p-0.5', className)}
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
    >
      {options.map((opt) => {
        const key = opt.value ?? opt;
        const label = opt.label ?? opt;
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cx(
              'rounded-[10px] px-3 py-1.5 text-[11px] font-bold transition-all',
              active
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Period selector shared by every report and ledger screen. */
export function DateRange({ from, to, onChange, presets = true }) {
  const apply = (nextFrom, nextTo) => onChange({ from: nextFrom, to: nextTo });
  const today = new Date().toISOString().slice(0, 10);

  const quick = [
    { label: 'Today', from: today, to: today },
    {
      label: 'This month',
      from: `${today.slice(0, 7)}-01`,
      to: today
    },
    {
      label: 'This FY',
      from: `${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-04-01`,
      to: today
    },
    { label: 'All time', from: '', to: '' }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets && (
        <div className="flex items-center gap-1">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => apply(q.from, q.to)}
              className={cx(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                from === q.from && to === q.to
                  ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
                  : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={from || ''}
          onChange={(e) => apply(e.target.value, to)}
          className="field-input py-1.5 text-[11px]"
        />
        <span className="text-[11px] font-bold text-[color:var(--text-muted)]">→</span>
        <input
          type="date"
          value={to || ''}
          onChange={(e) => apply(from, e.target.value)}
          className="field-input py-1.5 text-[11px]"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Data display
 * ------------------------------------------------------------------ */

const TONES = {
  neutral: 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)]',
  accent: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
};

export function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Right-aligned, tabular, sign-aware currency cell. */
export function Money({ value, className = '', colored = false, decimals = true, showZero = true, suffix }) {
  const n = Number(value) || 0;
  if (!showZero && n === 0) return <span className={cx('tabular text-[color:var(--text-muted)]', className)}>—</span>;
  const tone = !colored ? '' : n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : '';
  return (
    <span className={cx('tabular', tone, className)}>
      {money(n, { decimals })}
      {suffix}
    </span>
  );
}

export function StatTile({ label, value, sub, icon: Icon, tone = 'neutral', trend, onClick }) {
  const accent = {
    neutral: 'text-[color:var(--text-primary)]',
    accent: 'text-indigo-600 dark:text-indigo-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-rose-600 dark:text-rose-400',
    warning: 'text-amber-600 dark:text-amber-400'
  }[tone];

  return (
    <div
      onClick={onClick}
      className={cx(
        'surface rounded-2xl p-4 transition-all',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="label-eyebrow">{label}</div>
        {Icon && <Icon className={cx('h-4 w-4 shrink-0', accent)} />}
      </div>
      <div className={cx('tabular mt-2 text-[22px] font-bold leading-none tracking-tight', accent)}>{value}</div>
      {(sub || trend !== undefined) && (
        <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-[color:var(--text-muted)]">
          {trend !== undefined && (
            <span className={trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {sub && <span className="truncate">{sub}</span>}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-2xl"
        style={{ background: 'var(--bg-subtle)' }}
      >
        <Icon className="h-5 w-5 text-[color:var(--text-muted)]" />
      </div>
      <div className="text-sm font-bold text-[color:var(--text-primary)]">{title}</div>
      {hint && <div className="max-w-sm text-xs leading-relaxed text-[color:var(--text-secondary)]">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-xs font-semibold text-[color:var(--text-muted)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

/**
 * Table shell with sticky headers and per-column alignment.
 * columns: [{ key, label, align, width, render(row, index), className }]
 */
export function DataTable({
  columns,
  rows,
  rowKey = (row, i) => row.id ?? i,
  empty,
  footer,
  maxHeight = '60vh',
  dense = false,
  onRowClick,
  className = ''
}) {
  if (!rows || rows.length === 0) {
    return <div className="surface rounded-2xl">{empty || <EmptyState title="Nothing to show yet" />}</div>;
  }

  return (
    <div className={cx('surface overflow-hidden rounded-2xl', className)}>
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="ledger-table w-full border-collapse">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align || 'left' }}
                  className={col.headClassName}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                className={cx(onRowClick && 'cursor-pointer', dense && '[&>td]:py-1.5')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align || 'left' }}
                    className={cx(
                      col.className,
                      col.align === 'right' && 'tabular',
                      'text-[color:var(--text-primary)]'
                    )}
                  >
                    {col.render ? col.render(row, i) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot>
              <tr
                className="sticky bottom-0"
                style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border-strong)' }}
              >
                {footer.map((cell, i) => (
                  <td
                    key={i}
                    style={{ textAlign: columns[i]?.align || 'left' }}
                    className={cx(
                      'px-3 py-2.5 text-[13px] font-bold text-[color:var(--text-primary)]',
                      columns[i]?.align === 'right' && 'tabular'
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Overlays
 * ------------------------------------------------------------------ */

const MODAL_WIDTH = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl', fullscreen: 'max-w-[96vw] w-[96vw] max-h-[92vh] h-[92vh] flex flex-col justify-between' };

export function Modal({ open, onClose, title, subtitle, icon: Icon, size = 'md', className = '', footer, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(e) => e.target === ref.current && onClose?.()}
          ref={ref}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className={cx('surface-raised my-auto w-full rounded-2xl', MODAL_WIDTH[size], className)}
          >
            <div
              className="flex items-start justify-between gap-3 px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[color:var(--text-primary)]">
                  {Icon && <Icon className="h-4 w-4 text-[color:var(--accent)]" />}
                  {title}
                </h3>
                {subtitle && <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--bg-subtle)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">{children}</div>

            {footer && (
              <div
                className="flex items-center justify-end gap-2 px-5 py-3.5"
                style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ *
 * Lightweight charts (inline SVG — no chart library needed)
 * ------------------------------------------------------------------ */

/** Grouped income/expense bars for the accounts dashboard. */
export function TrendBars({ data, height = 120 }) {
  const max = Math.max(1, ...data.flatMap((d) => [Math.abs(d.income), Math.abs(d.expense)]));

  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex h-full w-full items-end justify-center gap-1">
            <div
              className="w-1/3 rounded-t bg-indigo-500/85 transition-all"
              style={{ height: `${(Math.abs(d.income) / max) * 100}%`, minHeight: d.income ? 3 : 0 }}
              title={`Income ${money(d.income)}`}
            />
            <div
              className="w-1/3 rounded-t bg-rose-400/85 transition-all"
              style={{ height: `${(Math.abs(d.expense) / max) * 100}%`, minHeight: d.expense ? 3 : 0 }}
              title={`Expense ${money(d.expense)}`}
            />
          </div>
          <span className="text-[10px] font-bold text-[color:var(--text-muted)]">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal share bars — used for top expenses and category splits. */
export function ShareBars({ items, tone = 'accent', valueFormatter = money }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.amount)));
  const colors = {
    accent: 'bg-indigo-500',
    danger: 'bg-rose-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500'
  };

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
            <span className="truncate font-semibold text-[color:var(--text-primary)]">{item.name}</span>
            <span className="tabular shrink-0 font-bold text-[color:var(--text-secondary)]">
              {valueFormatter(item.amount)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-subtle)' }}>
            <div
              className={cx('h-full rounded-full transition-all', colors[tone])}
              style={{ width: `${(Math.abs(item.amount) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Donut for payment-mode / composition splits. */
export function Donut({ segments, size = 132, thickness = 16, centerLabel, centerValue }) {
  const total = segments.reduce((s, seg) => s + Math.abs(seg.value), 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-subtle)" strokeWidth={thickness} />
        {segments.map((seg) => {
          const length = (Math.abs(seg.value) / total) * circumference;
          const el = (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += length;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[15px] font-bold text-[color:var(--text-primary)]">{centerValue}</span>
        <span className="label-eyebrow">{centerLabel}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Report shell — consistent header, print and export affordances
 * ------------------------------------------------------------------ */

export function ReportFrame({ title, company, period, onExport, children, meta }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-2">
          <Button icon={Printer} onClick={() => window.print()}>
            Print
          </Button>
          {onExport && (
            <>
              <Button icon={Download} onClick={() => onExport('csv')}>
                Excel / CSV
              </Button>
              <Button icon={Download} onClick={() => onExport('pdf')}>
                PDF
              </Button>
            </>
          )}
        </div>
        {meta}
      </div>

      <div id="printable-statement" className="surface rounded-2xl p-5">
        <header className="mb-4 flex items-start justify-between gap-4 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="text-[15px] font-bold text-[color:var(--text-primary)]">{company?.name || 'Selsolve'}</div>
            {company?.gstin && (
              <div className="text-[11px] text-[color:var(--text-secondary)]">GSTIN: {company.gstin}</div>
            )}
            {company?.city && <div className="text-[11px] text-[color:var(--text-secondary)]">{company.city}</div>}
          </div>
          <div className="text-right">
            <div className="text-[13px] font-bold uppercase tracking-wide text-[color:var(--accent)]">{title}</div>
            {period && <div className="text-[11px] text-[color:var(--text-secondary)]">{period}</div>}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export { cx };
