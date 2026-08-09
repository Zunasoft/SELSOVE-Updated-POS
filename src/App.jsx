import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Package, Users, BarChart3, LogOut, Database, CheckCircle2,
  XCircle, Sun, Moon, Truck, Landmark, Settings as SettingsIcon, Menu, X
} from 'lucide-react';

import api from './lib/api';
import OTPLogin from './components/OTPLogin';
import POSTerminal from './components/POSTerminal';
import InventoryManager from './components/InventoryManager';
import CustomerVendorLedger from './components/CustomerVendorLedger';
import PurchaseManager from './components/PurchaseManager';
import ReportsManager from './components/ReportsManager';
import SettingsManager from './components/SettingsManager';
import AccountsModule from './components/accounts/AccountsModule';

const TABS = [
  { id: 'pos', label: 'POS Billing', short: 'Billing', icon: ShoppingCart },
  { id: 'inventory', label: 'Products & Stock', short: 'Stock', icon: Package },
  { id: 'purchases', label: 'Purchases', short: 'Purchase', icon: Truck },
  { id: 'customers', label: 'Customers & Vendors', short: 'Parties', icon: Users },
  { id: 'accounts', label: 'Accounts', short: 'Accounts', icon: Landmark },
  { id: 'reports', label: 'Reports', short: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: SettingsIcon }
];

export default function App() {
  const [tenant, setTenant] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pos');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('pos_theme') === 'dark');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('pos_token');
    const savedTenant = localStorage.getItem('pos_tenant');

    if (savedToken && savedTenant) {
      try {
        setToken(savedToken);
        setTenant(JSON.parse(savedTenant));
      } catch (e) {
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_tenant');
      }
    }
    setLoading(false);
  }, []);

  const fetchStoreData = async () => {
    if (!tenant) return;
    try {
      const data = await api.get('/init');
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setSettings(data.settings || null);
    } catch (err) {
      console.error('Store init failed:', err);
    }
  };

  useEffect(() => {
    if (tenant && token) fetchStoreData();
  }, [tenant, token]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('pos_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleLoginSuccess = (tenantData, jwtToken) => {
    setTenant(tenantData);
    setToken(jwtToken);
  };

  const handleLogout = () => {
    ['pos_token', 'pos_tenant', 'pos_user_name'].forEach((k) => localStorage.removeItem(k));
    setTenant(null);
    setToken(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-[color:var(--text-secondary)]">
        Loading Selsolve POS…
      </div>
    );
  }

  if (!tenant || !token) return <OTPLogin onLoginSuccess={handleLoginSuccess} />;

  const shared = { tenant, token, showToast };

  const screens = {
    pos: <POSTerminal {...shared} settings={settings} />,
    inventory: (
      <InventoryManager
        {...shared}
        products={products}
        categories={categories}
        onRefresh={fetchStoreData}
      />
    ),
    purchases: <PurchaseManager {...shared} />,
    customers: <CustomerVendorLedger {...shared} />,
    accounts: <AccountsModule {...shared} />,
    reports: <ReportsManager {...shared} />,
    settings: <SettingsManager {...shared} onSettingsChange={fetchStoreData} />
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            className={`fixed right-5 top-5 z-[60] flex max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl ${
              toast.type === 'error'
                ? 'border-rose-300/60 bg-rose-50/95 text-rose-800 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-200'
                : 'border-emerald-300/60 bg-emerald-50/95 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200'
            }`}
          >
            {toast.type === 'error' ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="text-[12.5px] font-semibold leading-snug">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header
        className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 px-3 backdrop-blur-md sm:px-5"
        style={{ background: 'color-mix(in srgb, var(--surface) 92%, transparent)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/Selsolve Logo Square.png"
            alt="Selsolve"
            className="h-8 w-8 shrink-0 rounded-xl object-contain"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13.5px] font-bold text-[color:var(--text-primary)]">
                {settings?.company?.name || tenant.name}
              </span>
              <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {tenant.plan}
              </span>
            </div>
            <div className="tabular flex items-center gap-1 text-[10.5px] font-semibold text-[color:var(--accent)]">
              <Database className="h-2.5 w-2.5" />
              {tenant.dbName}
            </div>
          </div>
        </div>

        {/* Desktop nav */}
        <nav
          className="hidden items-center gap-0.5 rounded-2xl p-1 xl:flex"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                    : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.short}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="rounded-xl p-2 transition-colors hover:bg-[color:var(--bg-subtle)]"
            style={{ background: 'var(--bg-subtle)' }}
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-bold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>

          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="rounded-xl p-2 xl:hidden"
            style={{ background: 'var(--bg-subtle)' }}
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Mobile / tablet nav drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="sticky top-16 z-30 overflow-hidden xl:hidden"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="grid grid-cols-2 gap-1.5 p-3 sm:grid-cols-4">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileNavOpen(false);
                    }}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold transition-all ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-[color:var(--text-secondary)]'
                    }`}
                    style={isActive ? undefined : { background: 'var(--bg-subtle)' }}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <main className="w-full flex-1 p-3 sm:p-4 lg:p-5">{screens[activeTab]}</main>
    </div>
  );
}

