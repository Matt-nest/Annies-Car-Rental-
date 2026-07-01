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
 * The publishable key is fetched FROM THE BACKEND (GET /stripe/publishable-key)
 * so it always belongs to the same Stripe account as the secret key that mints
 * the clientSecret. This avoids the silent failure where a hardcoded/independent
 * test key is paired with a live backend (or vice-versa) and Stripe refuses to
 * mount the form. Falls back to the VITE env var if the backend doesn't supply one.
 */
const money = (cents) => `$${(Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ChargeForm({ clientSecret, amountCents, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState('');
  // Set when Stripe confirmed the charge but writing it to our ledger failed —
  // the card IS charged, so we must NOT let the operator charge again.
  const [chargedPiId, setChargedPiId] = useState(null);
  const [recordErr, setRecordErr] = useState('');

  async function recordCharge(piId) {
    // Record into the payments ledger. Surface failures (do not swallow) so the
    // operator knows the card was charged even if our write failed.
    try {
      await bookingApi.confirmPayment(piId);
      bookingApi.sendStripeReceipt(piId).catch(() => {});
      onSuccess?.(piId);
    } catch (e) {
      setChargedPiId(piId);
      setRecordErr(e.message || 'Could not record the charge.');
      setBusy(false);
    }
  }

  async function charge() {
    if (!stripe || !elements) return;
    setBusy(true); setErr('');
    const { error: submitErr } = await elements.submit();
    if (submitErr) { setErr(submitErr.message || 'Check the card details.'); setBusy(false); setConfirming(false); return; }
    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setConfirming(false);
    if (error) { setErr(error.message || 'The card was declined.'); setBusy(false); return; }
    await recordCharge(clientSecret.split('_secret_')[0]);
  }

  if (chargedPiId) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--text-secondary)' }}>
          <p className="font-bold text-[#b45309] mb-1 flex items-center gap-1.5"><AlertCircle size={13} /> Card charged — recording failed</p>
          <p>The customer's card was charged {money(amountCents)} successfully, but saving it to the payments ledger failed ({recordErr}). <strong>Do not charge again.</strong> Retry recording below, or use Sync on the Payments page.</p>
          <p className="mono-code mt-1">{chargedPiId}</p>
        </div>
        <button type="button" onClick={() => { setBusy(true); setRecordErr(''); recordCharge(chargedPiId); }} disabled={busy} className="btn-primary w-full">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Recording…</> : <>Retry recording</>}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PaymentElement options={{ layout: 'tabs' }} />
      {err && (
        <p className="text-xs text-[#ef4444] flex items-start gap-1.5"><AlertCircle size={13} className="mt-0.5 shrink-0" />{err}</p>
      )}
      {confirming ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="button" onClick={charge} disabled={busy || !stripe} className="btn-primary flex-1 justify-center">
            {busy ? <><Loader2 size={14} className="animate-spin" /> Charging…</> : <>Confirm charge {money(amountCents)}</>}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} disabled={!stripe} className="btn-primary w-full">
          <CreditCard size={14} /> Charge {money(amountCents)}
        </button>
      )}
      <p className="text-[11px] text-[var(--text-tertiary)] text-center">Enter the card the customer reads to you. Charges immediately.</p>
    </div>
  );
}

export default function StripeCardCharge({ bookingCode, onSuccess }) {
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [amountCents, setAmountCents] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load the publishable key from the backend (same account as the secret).
        const cfg = await bookingApi.getStripePublishableKey().catch(() => ({ publishableKey: '' }));
        const key = cfg?.publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
        if (!key) {
          if (!cancelled) setErr('Stripe isn’t configured — set STRIPE_PUBLISHABLE_KEY on the backend (matching the secret key) to charge cards here.');
          return;
        }
        if (cancelled) return;
        setStripePromise(loadStripe(key));

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
  if (!clientSecret || !stripePromise) {
    return <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] py-3"><Loader2 size={14} className="animate-spin" /> Preparing secure card form…</div>;
  }

  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: dark ? 'night' : 'stripe' } }}>
      <ChargeForm clientSecret={clientSecret} amountCents={amountCents} onSuccess={onSuccess} />
    </Elements>
  );
}
