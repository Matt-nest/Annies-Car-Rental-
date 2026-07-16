import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Wallet, Loader2, AlertCircle, DollarSign } from 'lucide-react';
import { API_URL } from '../../config';
import { useTheme } from '../../context/ThemeContext';
import { getStripe } from '../booking/confirm-booking/stripeClient';
import { buildStripeAppearance } from '../booking/confirm-booking/stripeAppearance';
import {
  PAYMENT_PROVIDER,
  SQUARE_APPLICATION_ID,
  SQUARE_CONFIGURED,
  SQUARE_ENVIRONMENT,
  SQUARE_LOCATION_ID,
} from '../booking/confirm-booking/constants';
import { EASE } from '../../utils/motion';

declare global {
  interface Window {
    Square?: any;
  }
}

const stripePromise = PAYMENT_PROVIDER === 'stripe' ? getStripe() : null;
const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

interface Balance { totalCost: number; paid: number; amountDue: number; amountDueCents: number; }

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

function SquareBalancePayForm({ token, amountDue, expectedCents, onPaid, onCancel }: {
  token: string; amountDue: number; expectedCents: number;
  onPaid: () => void; onCancel: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const cardRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!SQUARE_CONFIGURED) {
        setError('Square is not configured for balance payments. Please call us to finish payment.');
        return;
      }
      try {
        await loadSquareSdk();
        if (!window.Square) throw new Error('Square SDK unavailable');
        const payments = window.Square.payments(SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        await card.attach('#square-balance-card-container');
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
        amount: amountDue.toFixed(2),
        currencyCode: 'USD',
      });
      if (tokenResult.status !== 'OK') {
        const firstError = tokenResult.errors?.[0];
        throw new Error(firstError ? `${firstError.message}` : 'Card validation failed');
      }

      const res = await fetch(`${API_URL}/portal/balance/pay-square`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          source_id: tokenResult.token,
          expectedCents,
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not finalize your payment');
      onPaid();
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-3">
      <div id="square-balance-card-container" className="min-h-[90px]" />
      {!sdkReady && !error && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Square secure card form...</p>}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{
          backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
        }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={paying}
          className="px-4 py-2.5 rounded-full text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          Back
        </button>
        <button type="submit" disabled={!sdkReady || paying}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
          {paying ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><DollarSign size={16} /> Pay {money(amountDue)}</>}
        </button>
      </div>
    </form>
  );
}

function BalancePayForm({ token, amountDue, clientSecret, paymentIntentId, onPaid, onCancel }: {
  token: string; amountDue: number; clientSecret: string; paymentIntentId: string;
  onPaid: () => void; onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || paying) return;
    setPaying(true);
    setError('');

    try {
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        redirect: 'if_required',
      });
      if (confirmError) throw new Error(confirmError.message);

      const res = await fetch(`${API_URL}/portal/balance/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payment_intent_id: paymentIntentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not finalize your payment');
      onPaid();
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-3">
      <PaymentElement />
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{
          backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
        }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={paying}
          className="px-4 py-2.5 rounded-full text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          Back
        </button>
        <button type="submit" disabled={!stripe || paying}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
          {paying ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : <><DollarSign size={16} /> Pay {money(amountDue)}</>}
        </button>
      </div>
    </form>
  );
}

export default function BalanceDueCard({ token, onPaid }: { token: string; theme: string; onPaid: () => void; }) {
  const { theme } = useTheme();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [paying, setPaying] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/portal/balance`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) setBalance(data);
      } catch { /* silent */ }
      setLoaded(true);
    })();
  }, [token]);

  const startPay = async () => {
    if (!balance) return;
    if (PAYMENT_PROVIDER === 'square') {
      setError('');
      setPaying(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/portal/balance/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expectedCents: balance.amountDueCents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start payment');
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setPaying(true);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (!loaded || done || !balance || balance.amountDue <= 0.5) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE.standard }}
      className="rounded-2xl overflow-hidden"
      style={{ border: '2px solid color-mix(in srgb, var(--accent-color) 25%, transparent)', backgroundColor: 'color-mix(in srgb, var(--accent-color) 4%, transparent)' }}
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 15%, transparent)' }}>
            <Wallet size={18} style={{ color: 'var(--accent-color)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Balance due</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              You have an outstanding balance on this rental.
            </p>
          </div>
          <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{money(balance.amountDue)}</p>
        </div>

        <div className="rounded-xl p-3 space-y-1.5 text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
            <span>Rental total</span><span className="tabular-nums">{money(balance.totalCost)}</span>
          </div>
          <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
            <span>Paid so far</span><span className="tabular-nums">-{money(balance.paid)}</span>
          </div>
          <div className="flex justify-between font-semibold pt-1.5" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
            <span>Amount due</span><span className="tabular-nums">{money(balance.amountDue)}</span>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{
            backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
          }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        {!paying ? (
          <button onClick={startPay} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Preparing…</> : <><DollarSign size={16} /> Pay {money(balance.amountDue)}</>}
          </button>
        ) : PAYMENT_PROVIDER === 'square' ? (
          <SquareBalancePayForm
            token={token}
            amountDue={balance.amountDue}
            expectedCents={balance.amountDueCents}
            onPaid={() => { setDone(true); onPaid(); }}
            onCancel={() => setPaying(false)}
          />
        ) : clientSecret && paymentIntentId ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: buildStripeAppearance(theme) }}>
            <BalancePayForm
              token={token}
              amountDue={balance.amountDue}
              clientSecret={clientSecret}
              paymentIntentId={paymentIntentId}
              onPaid={() => { setDone(true); onPaid(); }}
              onCancel={() => { setPaying(false); setClientSecret(null); setPaymentIntentId(null); }}
            />
          </Elements>
        ) : null}
      </div>
    </motion.div>
  );
}
