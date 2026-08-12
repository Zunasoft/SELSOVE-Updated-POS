import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  KeyRound, 
  Mail, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft,
  XCircle, 
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { ADMIN_BE } from '../config/config';

const formatUrl = (url) => {
  if (!url) return 'https://selsolve-updated-backend.vercel.app/api';
  const clean = url.replace(/\/$/, '');
  return clean.startsWith('http') ? clean : `https://${clean}`;
};

const ADMIN_BE_URL = `${formatUrl(ADMIN_BE)}/auth`;

export default function OTPLogin({ onLoginSuccess }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shopName, setShopName] = useState('');

  const otpInputRef = useRef(null);

  useEffect(() => {
    if (step === 2) otpInputRef.current?.focus();
  }, [step]);

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your registered shop email address.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await axios.post(`${ADMIN_BE_URL}/send-otp`, { email: trimmed });
      if (res.data.success) {
        setDemoOtp(res.data.demoOtp || '');
        setShopName(res.data.tenant?.name || 'Your Shop');
        setStep(2);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to send OTP. Ensure email is registered.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (otp.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await axios.post(`${ADMIN_BE_URL}/verify-otp`, { email: email.trim(), otp: otp.trim() });
      if (res.data.success) {
        localStorage.setItem('pos_token', res.data.token);
        localStorage.setItem('pos_tenant', JSON.stringify(res.data.tenant));
        // Stamped onto every API call so vouchers and stock movements record who acted.
        localStorage.setItem('pos_user_name', res.data.tenant?.name || 'Owner');
        onLoginSuccess(res.data.tenant, res.data.token);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Invalid OTP verification code.');
    } finally {
      setLoading(false);
    }
  };

  const backToEmail = () => {
    setStep(1);
    setOtp('');
    setDemoOtp('');
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-950 text-slate-100 font-sans">
      {/* Left Column - Premium Hero Image */}
      <div className="hidden lg:flex lg:col-span-7 relative overflow-hidden bg-slate-950 border-r border-slate-800 flex-col justify-between p-12">
        {/* Background Generated Hero Artwork */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-luminosity scale-105 transition-transform duration-1000"
          style={{ backgroundImage: `url('/selsolve_pos_hero.png')` }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/20" />

        {/* Left Header Brand Badge */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/Selsolve Logo Square.png" alt="SelSolve Logo" className="w-10 h-10 rounded-2xl shadow-xl object-contain bg-white/10 p-1 backdrop-blur-md" />
          <span className="text-xl tracking-tight text-white">
            <span className="font-black">Sel</span><span className="font-light">Solve</span>
          </span>
        </div>

        {/* Left Bottom Tagline */}
        <div className="relative z-10 max-w-lg space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Smart Retail POS Billing Station
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight leading-tight">
            High-Speed Checkout & Inventory Counter
          </h2>
        </div>
      </div>

      {/* Right Column - Clean Premium Login Form */}
      <div className="lg:col-span-5 flex flex-col justify-center items-center p-6 sm:p-12 relative bg-white dark:bg-slate-900 transition-colors duration-300">
        <div className="w-full max-w-sm space-y-7">
          {/* Header Logo & Title */}
          <div className="text-center space-y-3">
            <img 
              src="/Selsolve Logo.png" 
              alt="SelSolve Logo" 
              className="h-16 w-auto mx-auto object-contain"
            />
            <h1 className="text-2xl tracking-tight text-slate-900 dark:text-white">
              <span className="font-black">Sel</span><span className="font-light">Solve</span>
            </h1>
          </div>

          {/* Error Notification */}
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2.5"
              >
                <XCircle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Step 1: Email Request */}
          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Shop Owner Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    autoFocus
                    placeholder="owner@freshmart.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Send OTP <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Form Step 2: OTP Verification */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* Target Email & Shop Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">{shopName}</span>
                  <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 truncate block max-w-[200px]">
                    {email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={backToEmail}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Change
                </button>
              </div>

              {/* Dev OTP Quick Fill (if simulated code present) */}
              {demoOtp && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-300">OTP Code:</span>
                  <button
                    type="button"
                    onClick={() => setOtp(demoOtp)}
                    className="font-mono text-sm font-extrabold px-3 py-1 rounded-xl bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 hover:bg-amber-300 transition-colors"
                  >
                    {demoOtp} (Fill)
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Enter 6-Digit OTP Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11 pr-4 py-3.5 text-center font-mono text-2xl font-black tracking-[0.4em] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-indigo-600 dark:text-indigo-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Verify & Open POS <ShieldCheck className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
