import axios from 'axios';

export const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_POS_BE_URL)
    ? import.meta.env.VITE_POS_BE_URL.replace(/\/$/, '')
    : 'http://localhost:5001/api/pos';

/**
 * Every request carries the tenant's JWT and database name so the backend can
 * resolve the isolated store. Session credentials live in localStorage and are
 * read per-request, which keeps the client working after a page refresh.
 */
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

/* ------------------------------------------------------------------ *
 * Formatting helpers shared across every screen
 * ------------------------------------------------------------------ */

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const money = (value, { decimals = true, sign = false } = {}) => {
  const n = Number(value) || 0;
  const body = decimals ? inr.format(Math.abs(n)) : inrCompact.format(Math.abs(n));
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

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const monthStartISO = () => `${new Date().toISOString().slice(0, 7)}-01`;

export const financialYearStartISO = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
};

export default api;
