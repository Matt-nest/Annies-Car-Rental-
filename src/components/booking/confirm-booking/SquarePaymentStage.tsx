import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle } from 'lucide-react';

import { brand } from '../../../config/brand';
import SubmitLoader from './wizard-steps/SubmitLoader';
import {
  API_URL,
  SQUARE_APPLICATION_ID,
  SQUARE_CONFIGURED,
  SQUARE_ENVIRONMENT,
  SQUARE_LOCATION_ID,
  PHONE_NUMBER,
  clearDraft,
  formatCurrency,
  resolveInsuranceDisplay,
  type WizardDraft,
} from './constants';

declare global {
  interface Window {
    Square?: any;
  }
}

interface SquarePaymentStageProps {
  bookingSummary: any;
  draft: WizardDraft;
  depositAmount: number;
  bookingCode: string;
  onBack: () => void;
  onSuccess: () => void;
  theme: string;
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
      existing.addEventListener('error', () => reject(new Error('Square payment SDK failed to load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = squareSdkUrl();
    script.async = true;
    script.dataset.squareSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Square payment SDK failed to load'));
    document.head.appendChild(script);
  });
}

export default function SquarePaymentStage({
  bookingSummary,
  draft,
  depositAmount,
  bookingCode,
  onBack,
  onSuccess,
}: SquarePaymentStageProps) {
  const cardRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<'agreement' | 'insurance' | 'payment' | 'confirming' | 'done'>('payment');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Agreement + insurance are persisted by PaymentGate before approval. On
  // return-after-approval the draft may be empty, so fall back to saved server totals.
  const insurance = resolveInsuranceDisplay(bookingSummary, draft);
  const rentalTotal = bookingSummary?.totalCost || 0;
  const grandTotal = rentalTotal + insurance.amount + depositAmount;

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!SQUARE_CONFIGURED) return;
      try {
        await loadSquareSdk();
        if (!window.Square) throw new Error('Square payment SDK unavailable');
        const payments = window.Square.payments(SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        await card.attach('#square-card-container');
        if (cancelled) {
          card.destroy?.();
          return;
        }
        cardRef.current = card;
        setReady(true);
      } catch (err: any) {
        setLoadError(err.message || 'Square payments failed to initialize');
      }
    }
    init();
    return () => {
      cancelled = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, []);

  const handlePayNow = async () => {
    if (!cardRef.current) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      setSubmitStep('payment');
      const tokenResult = await cardRef.current.tokenize({
        amount: grandTotal.toFixed(2),
        currencyCode: 'USD',
        intent: 'CHARGE',
        customerInitiated: true,
        sellerKeyedIn: false,
        billingContact: {
          givenName: bookingSummary?.customerName?.split(' ')?.[0] || '',
          familyName: bookingSummary?.customerName?.split(' ')?.slice(1).join(' ') || '',
          email: bookingSummary?.customerEmail || '',
          addressLines: [draft.address.line1].filter(Boolean),
          city: draft.address.city,
          state: draft.address.state,
          countryCode: 'US',
        },
      });
      if (tokenResult.status !== 'OK') {
        const message = tokenResult.errors?.map((e: any) => e.message).join(', ') || 'Card validation failed';
        throw new Error(message);
      }

      setSubmitStep('confirming');
      const payRes = await fetch(`${API_URL}/square/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_code: bookingCode,
          source_id: tokenResult.token,
          expected_total_cents: Math.round(grandTotal * 100),
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const payJson = await payRes.json().catch(() => ({}));
      if (!payRes.ok) throw new Error(payJson.error || 'Payment failed');

      setSubmitStep('done');
      clearDraft(bookingCode);
      onSuccess();
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  if (!SQUARE_CONFIGURED) {
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(254,242,242,0.9)' }}>
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-red-500 mt-0.5" />
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Square is not configured</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              This payment page cannot take payment until Square application and location IDs are configured. Please call {PHONE_NUMBER}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {submitting && <SubmitLoader currentStep={submitStep} error={submitError} onRetry={handlePayNow} onDismiss={() => { setSubmitError(null); setSubmitting(false); }} />}
      </AnimatePresence>

      <div className="space-y-5">
        <div className="rounded-xl border p-4 flex items-center justify-between"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total due today</span>
          <span className="text-xl font-bold" style={{ color: 'var(--accent-color)' }}>{formatCurrency(grandTotal)}</span>
        </div>
        <div className="rounded-xl border p-4 sm:p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Payment Method</h3>
          <div id="square-card-container" className="min-h-[90px]" />
          {!ready && !loadError && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Square secure card form...</p>}
          {loadError && <p className="text-sm text-red-500">{loadError}</p>}
        </div>
        {submitError && !submitting && (
          <div className="flex items-start gap-3 p-4 rounded-xl border text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onBack} className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>Back</button>
          <button type="button" onClick={handlePayNow} disabled={!ready || submitting} className={`flex-1 py-4 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 ${submitting ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] hover:-translate-y-px active:scale-95 hover:shadow-lg cursor-pointer'}`} style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
            {submitting ? <><Loader2 className="animate-spin" size={18} /> Processing...</> : <>Pay {formatCurrency(grandTotal)}</>}
          </button>
        </div>
        <p className="text-[10px] text-center leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          By clicking "Pay", you authorize {brand.name} to charge your card through Square for the rental total, insurance, and refundable security deposit.
        </p>
      </div>
    </>
  );
}
