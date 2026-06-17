import { useEffect, useRef, useState } from 'react';
import { Loader2, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { bookingApi } from '../../api/bookingApi';

/**
 * SquareCardCharge — the Square counterpart to StripeCardCharge. Lets the admin
 * take a card payment over the phone from inside the dashboard.
 *
 * Square's Web Payments SDK tokenizes the card client-side, so there's no
 * clientSecret: we load the SDK with the backend's app/location config
 * (GET /square/config — same account as the access token), mount a card field,
 * read the booking amount (GET /square/booking-summary), then tokenize and POST
 * /square/pay which charges and records into the payments ledger.
 */
const money = (cents) => `$${(Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function loadSquareSdk(environment) {
  if (window.Square) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const src = environment === 'production'
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js';
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { existing.addEventListener('load', () => resolve()); existing.addEventListener('error', () => reject(new Error('SDK load failed'))); return; }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load the Square payment SDK.'));
    document.head.appendChild(script);
  });
}

export default function SquareCardCharge({ bookingCode, onSuccess }) {
  const cardContainerRef = useRef(null);
  const paymentsRef = useRef(null);
  const cardRef = useRef(null);

  const [amountCents, setAmountCents] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await bookingApi.getSquareConfig().catch(() => null);
        if (!cfg?.applicationId || !cfg?.locationId) {
          if (!cancelled) setErr('Square isn’t configured — set SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID and SQUARE_APPLICATION_ID on the backend to charge cards here.');
          return;
        }

        // Amount comes from the booking (rental + deposit + insurance).
        const summary = await bookingApi.getSquareBookingSummary(bookingCode);
        if (cancelled) return;
        if (summary.alreadyPaid) { onSuccess?.('already'); return; }
        setAmountCents(summary.amount || 0);

        await loadSquareSdk(cfg.environment);
        if (cancelled || !cardContainerRef.current) return;
        const payments = window.Square.payments(cfg.applicationId, cfg.locationId);
        const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        const card = await payments.card({
          style: {
            input: { color: dark ? '#F5F5F5' : '#1A1A1A', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '15px' },
            'input::placeholder': { color: dark ? '#6B7280' : '#9CA3AF' },
            '.input-container': { borderColor: dark ? 'rgba(255,255,255,0.12)' : '#E5E7EB', borderRadius: '10px' },
            '.input-container.is-focus': { borderColor: '#465FFF' },
            '.input-container.is-error': { borderColor: '#EF4444' },
            '.message-text.is-error': { color: '#EF4444' },
          },
        });
        await card.attach(cardContainerRef.current);
        if (cancelled) { try { await card.destroy(); } catch { /* noop */ } return; }
        paymentsRef.current = payments;
        cardRef.current = card;
        setReady(true);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Could not start the charge.');
      }
    })();
    return () => {
      cancelled = true;
      if (cardRef.current) { try { cardRef.current.destroy(); } catch { /* noop */ } cardRef.current = null; }
    };
  }, [bookingCode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function charge() {
    if (!ready || !cardRef.current || !paymentsRef.current) return;
    setBusy(true); setErr('');
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK' || !result.token) {
        throw new Error(result.errors?.[0]?.message || 'Check the card details.');
      }
      let verificationToken;
      try {
        const verify = await paymentsRef.current.verifyBuyer(result.token, {
          amount: (amountCents / 100).toFixed(2),
          currencyCode: 'USD',
          intent: 'CHARGE',
          billingContact: {},
        });
        verificationToken = verify?.token;
      } catch { /* best-effort */ }

      const res = await bookingApi.squarePay(bookingCode, result.token, verificationToken, amountCents);
      bookingApi.sendSquareReceipt(res.paymentId).catch(() => {});
      onSuccess?.(res.paymentId);
    } catch (e) {
      setErr(e.message || 'The card was declined.');
      setBusy(false);
    }
  }

  if (err && !ready) {
    return <p className="text-sm text-[#ef4444] flex items-start gap-1.5"><AlertCircle size={14} className="mt-0.5 shrink-0" />{err}</p>;
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl px-3 py-1"
        style={{ backgroundColor: 'var(--bg-elevated, rgba(127,127,127,0.04))', border: '1px solid var(--border-subtle)', minHeight: 52 }}
      >
        <div ref={cardContainerRef} />
        {!ready && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] py-3"><Loader2 size={14} className="animate-spin" /> Preparing secure card form…</div>
        )}
      </div>
      {err && (
        <p className="text-xs text-[#ef4444] flex items-start gap-1.5"><AlertCircle size={13} className="mt-0.5 shrink-0" />{err}</p>
      )}
      <button type="button" onClick={charge} disabled={busy || !ready} className="btn-primary w-full">
        {busy ? <><Loader2 size={14} className="animate-spin" /> Charging…</> : <><Lock size={14} /> Charge {money(amountCents)}</>}
      </button>
      <p className="text-[11px] text-[var(--text-tertiary)] text-center flex items-center justify-center gap-1.5">
        <ShieldCheck size={11} /> Encrypted by Square · enter the card the customer reads to you.
      </p>
    </div>
  );
}
