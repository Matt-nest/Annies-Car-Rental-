import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, CreditCard, AlertCircle } from 'lucide-react';
import { bookingApi } from '../../api/bookingApi';

/**
 * StripeCardCharge — lets the admin take a card payment over the phone, from
 * inside the dashboard. The booking already exists, so it reuses the existing
 * public Stripe endpoints (POST /stripe/create-payment-intent derives the amount
 * — rental + deposit + any insurance — from the booking, including custom rate),
 * then confirms + records it into the payments ledger (POST /stripe/confirm-payment).
 *
 * Same publishable-key env var as the customer site (VITE_STRIPE_PUBLISHABLE_KEY),
 * with the shared test fallback so it works in test mode without extra config.
 */
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    'pk_test_51THqNVBDLBS4aYcfqHPZnNGlwL6E8lGdzFOxYoSmd37DjxD3ofbWe6AsrEkL90LqnHfp8fEFDfAmrqfkDgcNYYqE00CXY3fGT'
);

const money = (cents) => `$${(Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ChargeForm({ clientSecret, amountCents, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function charge() {
    if (!stripe || !elements) return;
    setBusy(true); setErr('');
    const { error: submitErr } = await elements.submit();
    if (submitErr) { setErr(submitErr.message || 'Check the card details.'); setBusy(false); return; }
    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (error) { setErr(error.message || 'The card was declined.'); setBusy(false); return; }
    // Record into the payments ledger + fire the receipt (best-effort).
    const piId = clientSecret.split('_secret_')[0];
    try { await bookingApi.confirmPayment(piId); } catch { /* charge already succeeded on Stripe */ }
    bookingApi.sendStripeReceipt(piId).catch(() => {});
    onSuccess?.(piId);
  }

  return (
    <div className="space-y-3">
      <PaymentElement options={{ layout: 'tabs' }} />
      {err && (
        <p className="text-xs text-[#ef4444] flex items-start gap-1.5"><AlertCircle size={13} className="mt-0.5 shrink-0" />{err}</p>
      )}
      <button type="button" onClick={charge} disabled={busy || !stripe} className="btn-primary w-full">
        {busy ? <><Loader2 size={14} className="animate-spin" /> Charging…</> : <><CreditCard size={14} /> Charge {money(amountCents)}</>}
      </button>
      <p className="text-[11px] text-[var(--text-tertiary)] text-center">Enter the card the customer reads to you. Charges immediately.</p>
    </div>
  );
}

export default function StripeCardCharge({ bookingCode, onSuccess }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [amountCents, setAmountCents] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await bookingApi.createPaymentIntent(bookingCode);
        if (cancelled) return;
        if (r.alreadyPaid) { onSuccess?.('already'); return; }
        setClientSecret(r.clientSecret);
        setAmountCents(r.amount);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Could not start the charge.');
      }
    })();
    return () => { cancelled = true; };
  }, [bookingCode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <p className="text-sm text-[#ef4444] flex items-start gap-1.5"><AlertCircle size={14} className="mt-0.5 shrink-0" />{err}</p>;
  if (!clientSecret) {
    return <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] py-3"><Loader2 size={14} className="animate-spin" /> Preparing secure card form…</div>;
  }

  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: dark ? 'night' : 'stripe' } }}>
      <ChargeForm clientSecret={clientSecret} amountCents={amountCents} onSuccess={onSuccess} />
    </Elements>
  );
}
