import axios from 'axios';
import { ADMIN_BE } from '../config/config';

const formatUrl = (url) => {
  if (!url) return 'https://selsolve-updated-backend.vercel.app/api';
  const clean = url.replace(/\/$/, '');
  return clean.startsWith('http') ? clean : `https://${clean}`;
};

export const API_BASE = `${formatUrl(ADMIN_BE)}/pos`;

/** Resolves a backend-relative asset path (e.g. `/uploads/...`) against the API host; already-absolute or empty values pass through unchanged. */
export const resolveAssetUrl = (url) => {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${API_BASE.replace('/api/pos', '')}${trimmed}`;
  }
  return trimmed;
};

// Every request carries the tenant's JWT and database name, read from localStorage per-request so a page refresh doesn't lose the session.
const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_token');
  const user = localStorage.getItem('pos_user_name');

  let dbName = null;
  try {
    dbName = JSON.parse(localStorage.getItem('pos_tenant') || 'null')?.dbName;
  } catch {
    dbName = null;
  }

  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (dbName) config.headers['x-tenant-db'] = dbName;
  if (user) config.headers['x-user-name'] = user;

  return config;
});

export const SESSION_KEYS = ['pos_token', 'pos_tenant', 'pos_user_name'];

// Codes for a truly finished session — a bare 403 also covers plan/permission limits, which must not sign the cashier out.
const SESSION_ENDED_CODES = new Set([
  'NO_TOKEN',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'TOKEN_UNBOUND',
  'TOKEN_STALE',
  'TENANT_MISMATCH',
  'TENANT_NOT_FOUND',
  'TENANT_INACTIVE'
]);

let onSessionExpired = null;
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

const isSessionEnded = (err) => {
  const status = err?.response?.status;
  const code = err?.response?.data?.code;

  if (code) return SESSION_ENDED_CODES.has(code);
  // An unlabelled 401 is still an authentication failure; an unlabelled 403 is not.
  return status === 401;
};

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (isSessionEnded(err)) {
      SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
      if (onSessionExpired) {
        onSessionExpired(err?.response?.data?.message || 'Your session has ended. Please sign in again.');
      }
    }
    return Promise.reject(err);
  }
);

/** Unwrap the { success, data, message } envelope the API always returns. */
const unwrap = (res) => res.data?.data ?? res.data;

const message = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback || 'Something went wrong.';

export const api = {
  get: (path, params) => client.get(path, { params }).then(unwrap),
  post: (path, body) => client.post(path, body).then((r) => r.data),
  put: (path, body) => client.put(path, body).then((r) => r.data),
  del: (path) => client.delete(path).then((r) => r.data),
  raw: client,
  message
};

/* ------------------------------- Formatting helpers shared across every screen ------------------------------- */

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inrCache = {};

const getInrFormatter = (digits) => {
  if (digits === 2) return inr;
  if (digits === 0) return inrCompact;
  if (!inrCache[digits]) {
    inrCache[digits] = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }
  return inrCache[digits];
};

export const money = (value, { decimals = true, fractionDigits, sign = false } = {}) => {
  const n = Number(value) || 0;
  const digits = typeof fractionDigits === 'number'
    ? fractionDigits
    : (typeof decimals === 'number'
        ? decimals
        : (decimals ? 2 : 0));
  const formatter = getInrFormatter(digits);
  const body = formatter.format(Math.abs(n));
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${prefix}₹${body}`;
};

/** Indian short-scale for dashboard tiles: 1.2L, 3.4Cr. */
export const moneyShort = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${inrCompact.format(abs)}`;
};

export const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

// Local calendar date, not UTC — the backend buckets rows by local day (dayKey in accounting/engine.js), so UTC would misdate reports east of UTC.
const localDateParts = (d) => ({
  y: d.getFullYear(),
  m: String(d.getMonth() + 1).padStart(2, '0'),
  day: String(d.getDate()).padStart(2, '0')
});

export const todayISO = () => {
  const { y, m, day } = localDateParts(new Date());
  return `${y}-${m}-${day}`;
};

export const monthStartISO = () => {
  const { y, m } = localDateParts(new Date());
  return `${y}-${m}-01`;
};

export const financialYearStartISO = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
};

export default api;
