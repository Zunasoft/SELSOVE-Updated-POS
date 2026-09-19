import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ShoppingBag } from 'lucide-react';
import { money, resolveAssetUrl } from '../lib/api';

/** Front-facing customer screen, kept in sync purely via BroadcastChannel; intentionally has no API access of its own. */
export default function CustomerDisplay() {
  const [state, setState] = useState(null);
  const [completed, setCompleted] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel('pos_customer_display');
    channel.onmessage = (e) => {
      if (e.data?.type === 'STATE') {
        setState(e.data.payload);
      } else if (e.data?.type === 'COMPLETED') {
        setCompleted(e.data.payload);
        setTimeout(() => setCompleted(null), 6000);
      }
    };
    // In case this window opens mid-transaction, ask the billing tab to resend its current state.
    channel.postMessage({ type: 'REQUEST_STATE' });
    return () => channel.close();
  }, []);

  useEffect(() => {
    // An uploaded QR image always wins; generated on the fly only as a fallback since generated UPI QRs don't scan reliably everywhere.
    if (!state?.showQr || state?.qrImageUrl || !state?.upiId) {
      setQrDataUrl('');
      return;
    }
    const payeeName = encodeURIComponent(state.companyName || 'Store');
    // qrAmount already accounts for a Partial Payment or Multi Pay split being less than the full bill total.
    const amount = Number(state.qrAmount ?? state.total ?? 0).toFixed(2);
    const payload = `upi://pay?pa=${state.upiId}&pn=${payeeName}&am=${amount}&cu=INR&tn=Payment`;
    QRCode.toDataURL(payload, { width: 220, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [state?.showQr, state?.qrImageUrl, state?.upiId, state?.qrAmount, state?.total, state?.companyName]);

  const items = state?.items || [];
  const hasItems = items.length > 0;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 text-white flex flex-col font-sans">
      <header className="flex items-center justify-center gap-3 py-6 border-b border-white/10 shrink-0">
        {state?.logoUrl && (
          <img
            src={resolveAssetUrl(state.logoUrl)}
            alt=""
            className="h-12 w-12 rounded-xl object-contain bg-white/5"
          />
        )}
        <h1 className="text-2xl font-extrabold tracking-tight">{state?.companyName || 'Welcome'}</h1>
      </header>

      {completed ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="relative flex items-center justify-center h-32 w-32">
            <span className="absolute inline-flex h-32 w-32 rounded-full bg-emerald-400/30 animate-ping" />
            <span className="absolute inline-flex h-24 w-24 rounded-full bg-emerald-400/20 animate-pulse" />
            <span className="relative text-7xl animate-bounce">😊</span>
          </div>
          <div className="text-3xl font-extrabold">Payment Received</div>
          <div className="text-xl font-mono">{money(completed.total)}</div>
          <div className="text-sm uppercase tracking-wider opacity-70">via {completed.paymentMode}</div>
          <div className="text-lg opacity-80 mt-4">Thank you for shopping with us!</div>
        </div>
      ) : !hasItems ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-80">
          <ShoppingBag className="w-16 h-16" />
          <div className="text-xl font-bold">Welcome! Your bill will appear here.</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 p-8 max-w-6xl mx-auto w-full overflow-hidden">
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div className="min-w-0 pr-3">
                  <div className="font-bold text-lg truncate">{it.name}</div>
                  <div className="text-sm opacity-70">
                    {it.qty} × {money(it.price)}
                  </div>
                </div>
                <div className="text-lg font-mono font-bold shrink-0">{money(it.total)}</div>
              </div>
            ))}
          </div>

          <div className="w-full lg:w-96 shrink-0 space-y-4">
            <div className="bg-white/10 rounded-2xl p-5 space-y-2">
              <SummaryRow label="Subtotal" value={state.subtotal} />
              {state.discount > 0 && <SummaryRow label="Discount" value={-state.discount} />}
              {state.tax > 0 && <SummaryRow label="Tax" value={state.tax} />}
              <div className="border-t border-white/20 pt-2 mt-2 flex items-center justify-between">
                <span className="text-lg font-bold">Total</span>
                <span className="text-3xl font-extrabold font-mono">{money(state.total)}</span>
              </div>
            </div>

            {state.paymentMode && (
              <div className="bg-white/10 rounded-2xl p-5 text-center space-y-3">
                <div className="text-sm uppercase tracking-wider opacity-70">Payment Method</div>
                <div className="text-xl font-bold">{state.paymentMode}</div>
                {state.showQr && (state.qrImageUrl || qrDataUrl) && (
                  <div className="bg-white p-3 rounded-xl inline-block">
                    <img
                      src={state.qrImageUrl ? resolveAssetUrl(state.qrImageUrl) : qrDataUrl}
                      alt="UPI payment QR code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="opacity-70">{label}</span>
      <span className="font-mono">{money(value)}</span>
    </div>
  );
}
