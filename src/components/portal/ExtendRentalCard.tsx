import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { CalendarPlus, Loader2, AlertCircle, ArrowRight, Check, DollarSign } from 'lucide-react';
import { API_URL } from '../../config';
import {
  SQUARE_APPLICATION_ID,
  SQUARE_LOCATION_ID,
  SQUARE_CONFIGURED,
  SQUARE_ENVIRONMENT
} from '../booking/confirm-booking/constants';
import { EASE } from '../../utils/motion';

declare global {
  interface Window {
    Square?: any;
  }
}

/* ── Helpers ───────────────────────────────────────────── */
const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;
const fmtDate = (d: string) => {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
};
/** Add `days` to a 'YYYY-MM-DD' string, returning 'YYYY-MM-DD'. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function squareSdkUrl() {
  return SQUARE_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox.web.squarecdn.com/v1/square.js'
    : 'https://web.squarecdn.com/v1/square.js';
}

function loadSquareSdk() {
  if (window.Square) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-square-sdk="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Square SDK failed to load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = squareSdkUrl();
    script.async = true;
    script.dataset.squareSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Square SDK failed to load'));
    document.head.appendChild(script);
  });
}

interface Quote {
  previousReturnDate: string;
  newReturnDate: string;
  additionalDays: number;
  dailyRate: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountCents: number;
  lineItems: { label: string; amount: number }[];
}

/* ── Inner Square payment step ─────────────────────────── */
function ExtensionPaymentForm({
  quote,
  token,
  onPaid,
  onCancel,
}: {
  quote: Quote;
  token: string;
  onPaid: () => void;
  onCancel: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const cardRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!SQUARE_CONFIGURED) {
        setError('Square is not configured on the server.');
        return;
      }
      try {
        await loadSquareSdk();
        if (!window.Square) throw new Error('Square SDK unavailable');
        const payments = window.Square.payments(SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        await card.attach('#square-card-container');
        if (cancelled) {
          card.destroy?.();
          return;
        }
        cardRef.current = card;
        setSdkReady(true);
      } catch (err: any) {
        setError(err.message || 'Square payments failed to initialize');
      }
    }
    init();
    return () => {
      cancelled = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, []);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardRef.current || paying) return;
    setPaying(true);
    setError('');

    try {
      const tokenResult = await cardRef.current.tokenize({
        amount: quote.total.toFixed(2),
        currencyCode: 'USD',
      });

      if (tokenResult.status !== 'OK') {
        const firstError = tokenResult.errors?.[0];
        throw new Error(firstError ? `${firstError.message}` : 'Card tokenization failed');
      }

      const res = await fetch(`${API_URL}/portal/extension/pay-square`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          newReturnDate: quote.newReturnDate,
          source_id: tokenResult.token,
          expectedTotalCents: quote.amountCents,
          idempotency_key: crypto.randomUUID(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not finalize your extension');
      onPaid();
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>New return date</span>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtDate(quote.newReturnDate)}</span>
        </div>
        <div className="flex justify-between text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          <span>{quote.additionalDays} extra day{quote.additionalDays === 1 ? '' : 's'}</span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{money(quote.total)}</span>
        </div>
      </div>

      <div id="square-card-container" className="min-h-[90px]" />
      {!sdkReady && !error && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Square secure card form…</p>}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{
          backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
        }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={paying}
          className="px-4 py-3 rounded-full text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!sdkReady || paying}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold transition-all hover:scale-[1.02] active:scale-95 text-sm disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917' }}
        >
          {paying ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><DollarSign size={16} /> Pay {money(quote.total)} & Extend</>}
        </button>
      </div>
    </form>
  );
}

/* ── Main card ─────────────────────────────────────────── */
export default function ExtendRentalCard({
  booking,
  token,
  onExtended,
}: {
  booking: any;
  token: string;
  onExtended: () => void;
  theme: string;
}) {
  const currentReturn = String(booking.return_date).slice(0, 10);
  const minDate = useMemo(() => addDays(currentReturn, 1), [currentReturn]);

  const [step, setStep] = useState<'choose' | 'quoted' | 'paying' | 'done'>('choose');
  const [newDate, setNewDate] = useState(minDate);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const handleGetQuote = async () => {
    if (!newDate || newDate <= currentReturn) {
      setError('Pick a date after your current return date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/portal/extension/quote`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ newReturnDate: newDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not price that extension');
      setQuote(data);
      setStep('quoted');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleProceedToPayment = () => {
    if (!quote) return;
    setStep('paying');
  };

  const handlePaid = () => {
    setStep('done');
    onExtended();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, ease: EASE.standard }}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-glow)' }}>
            <CalendarPlus size={18} style={{ color: 'var(--accent-color)' }} />
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Need more time?</h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Extend your rental and pay for the extra days — no need to rebook.
            </p>
          </div>
        </div>

        {step === 'done' ? (
          <div className="p-4 rounded-xl text-sm flex items-start gap-3" style={{
            backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e',
          }}>
            <Check size={18} className="shrink-0 mt-0.5" />
            <div>Your rental has been extended. Your new return date is updated below.</div>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                New return date
              </label>
              <input
                type="date"
                value={newDate}
                min={minDate}
                onChange={e => { setNewDate(e.target.value); setStep('choose'); setQuote(null); }}
                disabled={step === 'paying'}
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                Currently due {fmtDate(currentReturn)}.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{
                backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
              }}>
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quote breakdown */}
            {quote && step !== 'paying' && (
              <div className="rounded-xl p-3 space-y-1.5" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
                {quote.lineItems.map((li, i) => (
                  <div key={i} className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>{li.label}</span>
                    <span className="tabular-nums">{money(li.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold pt-1.5 text-sm" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                  <span>Extension total</span>
                  <span className="tabular-nums">{money(quote.total)}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            {step === 'choose' && (
              <button
                onClick={handleGetQuote}
                disabled={loading || !newDate}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold transition-all hover:scale-[1.02] active:scale-95 text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917' }}
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : <><ArrowRight size={16} /> See extension price</>}
              </button>
            )}

            {step === 'quoted' && quote && (
              <button
                onClick={handleProceedToPayment}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold transition-all hover:scale-[1.02] active:scale-95 text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917' }}
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Preparing…</> : <><ArrowRight size={16} /> Continue to payment</>}
              </button>
            )}

            {step === 'paying' && quote && (
              <ExtensionPaymentForm
                quote={quote}
                token={token}
                onPaid={handlePaid}
                onCancel={() => { setStep('quoted'); }}
              />
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
