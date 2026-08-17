import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Package, Users, BarChart3, LogOut, Database, CheckCircle2,
  XCircle, Sun, Moon, Truck, Landmark, Settings as SettingsIcon, Menu, X, LayoutDashboard,
  Maximize2, Minimize2, Receipt
} from 'lucide-react';

import api, { setSessionExpiredHandler, SESSION_KEYS } from './lib/api';
import OTPLogin from './components/OTPLogin';
import ShopDashboard from './components/ShopDashboard';
import POSTerminal from './components/POSTerminal';
import InvoicesManager from './components/InvoicesManager';
import InventoryManager from './components/InventoryManager';
import CustomerVendorLedger from './components/CustomerVendorLedger';
import PurchaseManager from './components/PurchaseManager';
import ReportsManager from './components/ReportsManager';
import SettingsManager from './components/SettingsManager';
import AccountsModule from './components/accounts/AccountsModule';

const TABS = [
  { id: 'dashboard', label: 'Shop Dashboard', short: 'Home', icon: LayoutDashboard },
  { id: 'pos', label: 'POS Billing', short: 'Billing', icon: ShoppingCart },
  { id: 'invoices', label: 'Invoices', short: 'Invoices', icon: Receipt },
  { id: 'inventory', label: 'Products & Stock', short: 'Stock', icon: Package },
  { id: 'purchases', label: 'Purchases', short: 'Purchase', icon: Truck },
  { id: 'customers', label: 'Customers & Vendors', short: 'Parties', icon: Users },
  { id: 'accounts', label: 'Accounts', short: 'Accounts', icon: Landmark },
  { id: 'reports', label: 'Reports', short: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: SettingsIcon }
];

/** Maps a nav tab to the plan feature that gates it. Tabs absent from this
 * map (Settings) are always shown — a shop must always be able to reach it. */
const TAB_FEATURE_MAP = {
  dashboard: 'dashboard',
  pos: 'billing',
  invoices: 'billing',
  inventory: 'products',
  purchases: 'purchases',
  customers: 'customers',
  accounts: 'accounts',
  reports: 'reports'
};

export default function App() {
  const [tenant, setTenant] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('pos_theme') === 'dark');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFsHint, setShowFsHint] = useState(false);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [toast, setToast] = useState(null);
  const [features, setFeatures] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleFullscreen = async (enable) => {
    const isCurrentlyFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    const targetState = enable !== undefined ? enable : (!isFullscreen && !isCurrentlyFs);

    if (targetState) {
      if (!isCurrentlyFs) {
        try {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          } else if (document.documentElement.webkitRequestFullscreen) {
            await document.documentElement.webkitRequestFullscreen();
          } else if (document.documentElement.msRequestFullscreen) {
            await document.documentElement.msRequestFullscreen();
          }
        } catch (err) {
          console.warn('Native fullscreen request blocked:', err);
        }
      }
      setIsFullscreen(true);
    } else {
      if (isCurrentlyFs) {
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
          } else if (document.msExitFullscreen) {
            await document.msExitFullscreen();
          }
        } catch (err) {
          console.warn('Native exit fullscreen failed:', err);
        }
      }
      setIsFullscreen(false);
    }
  };

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  // Sync state with native browser fullscreenchange events
  useEffect(() => {
    const onFsChange = () => {
      const isNativeFs = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isNativeFs);
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('mozfullscreenchange', onFsChange);
      document.removeEventListener('MSFullscreenChange', onFsChange);
    };
  }, []);

  // Auto-hide full screen hint after 2.5 seconds
  useEffect(() => {
    if (isFullscreen) {
      setShowFsHint(true);
      const timer = setTimeout(() => setShowFsHint(false), 2500);
      return () => clearTimeout(timer);
    } else {
      setShowFsHint(false);
    }
  }, [isFullscreen]);

  // Listen for F11 and Escape key events
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F11') {
        e.preventDefault();
        if (activeTab === 'pos') toggleFullscreen();
      } else if (e.key === 'Escape') {
        toggleFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, activeTab]);

  // Auto-exit fullscreen when navigating away from POS Billing
  useEffect(() => {
    if (activeTab !== 'pos' && isFullscreen) {
      toggleFullscreen(false);
    }
  }, [activeTab]);

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

  // Plan-based feature gating: hide tabs the shop's plan does not include.
  // Fail open on error — never lock a shop out of its own POS because one
  // request failed.
  useEffect(() => {
    if (!tenant || !token) return;
    api
      .get('/features')
      .then((d) => setFeatures(d?.features || {}))
      .catch(() => setFeatures(null));
  }, [tenant, token]);

  const visibleTabs = TABS.filter((tab) => {
    const featureKey = TAB_FEATURE_MAP[tab.id];
    if (!featureKey || !features) return true;
    return features[featureKey] !== false;
  });

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [features]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('pos_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleLoginSuccess = (tenantData, jwtToken) => {
    setTenant(tenantData);
    setToken(jwtToken);
  };

  const handleLogout = () => {
    SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
    setTenant(null);
    setToken(null);
    setFeatures(null);
  };

  // An expired token, or a shop the Super Admin has deactivated, ends the
  // session server-side; drop back to the login screen and say why.
  useEffect(() => {
    setSessionExpiredHandler((message) => {
      setTenant(null);
      setToken(null);
      showToast(message, 'error');
    });
    return () => setSessionExpiredHandler(null);
  }, []);

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
    dashboard: <ShopDashboard {...shared} onNavigate={handleTabClick} />,
    pos: <POSTerminal {...shared} settings={settings} />,
    invoices: <InvoicesManager {...shared} onNavigate={handleTabClick} />,
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
            className={`fixed right-5 top-5 z-[120] flex max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl ${
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

      {/* Header (hidden in full-screen mode) */}
      {!isFullscreen && (
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
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
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
            {activeTab === 'pos' && (
              <button
                onClick={() => toggleFullscreen()}
                className="rounded-xl p-2 transition-colors hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)]"
                style={{ background: 'var(--bg-subtle)' }}
                title={isFullscreen ? "Exit Full Screen (F11 / Esc)" : "Native Full Screen Mode (F11)"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            )}

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
      )}

      {/* Mobile / tablet nav drawer */}
      <AnimatePresence>
        {!isFullscreen && mobileNavOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="sticky top-16 z-30 overflow-hidden xl:hidden"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="grid grid-cols-2 gap-1.5 p-3 sm:grid-cols-4">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      handleTabClick(tab.id);
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

      <main className={`w-full flex-1 ${isFullscreen ? 'fixed inset-0 z-[100] overflow-y-auto bg-[color:var(--bg-app)] p-2 sm:p-4' : 'p-3 sm:p-4 lg:p-5'}`}>
        <AnimatePresence>
          {isFullscreen && showFsHint && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="sticky top-2 z-[110] flex items-center justify-between gap-3 bg-slate-900/90 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xl backdrop-blur-md max-w-fit ml-auto mb-3 border border-slate-700/80"
            >
              <span className="flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                Native Full Screen Mode • Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-600 text-amber-300">F11</kbd> or <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-600 text-amber-300">Esc</kbd> to exit
              </span>
              <button
                onClick={() => toggleFullscreen(false)}
                className="ml-2 p-1 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                title="Exit Full Screen (F11 / Esc)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {screens[activeTab]}
      </main>
    </div>
  );
}

