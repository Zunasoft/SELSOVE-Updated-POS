export const ADMIN_BE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ADMIN_BE_URL)
  ? import.meta.env.VITE_ADMIN_BE_URL.replace(/\/$/, '')
  : 'http://localhost:5001/api';
