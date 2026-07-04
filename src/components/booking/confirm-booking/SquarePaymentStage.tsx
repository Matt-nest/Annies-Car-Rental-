import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle } from 'lucide-react';

import { brand } from '../../../config/brand';
import OrderSummary from './wizard-steps/OrderSummary';
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
  type WizardDraft,
} from './constants';

declare global {
  interface Window {
    Square?: any;
  }
}

interface PaymentStageProps {
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

async function submitAgreementAndInsurance({
  bookingCode,
  draft,
  fallbackTotalCents,
}: {
  bookingCode: string;
  draft: WizardDraft;
  fallbackTotalCents: number;
}) {
  const agreementPayload = {
    address_line1: draft.address.line1,
    city: draft.address.city,
    state: draft.address.state,
    zip: draft.address.zip,
    date_of_birth: draft.dob,
    driver_license_number: draft.license.number,
    driver_license_state: draft.license.state,
    driver_license_expiry: draft.license.expiry,
    insurance_company: draft.personalInsurance.company || null,
    insurance_policy_number: draft.personalInsurance.policyNumber || null,
    insurance_expiry: draft.personalInsurance.expiry || null,
    insurance_agent_name: draft.personalInsurance.agentName || null,
    insurance_agent_phone: draft.personalInsurance.agentPhone || null,
    insurance_vehicle_description: draft.personalInsurance.vehicleDescription || null,
    signature_data: draft.signature.data,
    signature_type: draft.signature.mode === 'draw' ? 'drawn' : 'typed',
    license_photo_paths: draft.licensePhotoPaths?.length ? draft.licensePhotoPaths : undefined,
  };

  const agRes = await fetch(`${API_URL}/agreements/${bookingCode}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agreementPayload),
  });
  const agJson = await agRes.json();
  if (!agRes.ok && !agJson.alreadySigned) throw new Error(agJson.error || 'Failed to submit agreement');

  const insurancePayload: any = { source: draft.insuranceChoice };
  if (draft.insuranceChoice === 'bonzah') insurancePayload.tier_id = draft.bonzahTierId;
  const insRes = await fetch(`${API_URL}/bookings/${bookingCode}/insurance`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(insurancePayload),
  });
  const insJson = await insRes.json().catch(() => ({}));
  if (!insRes.ok) throw new Error(insJson.error || 'Failed to record insurance');
  return insJson.payment_totals?.total_cents ?? fallbackTotalCents;
}

export default function SquarePaymentStage({ bookingSummary, draft, depositAmount, bookingCode, onBack, onSuccess, theme }: PaymentStageProps) {
  const cardRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<'agreement' | 'insurance' | 'payment' | 'confirming' | 'done'>('agreement');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const insuranceCost = draft.insuranceChoice === 'bonzah' && draft.bonzahQuote
    ? draft.bonzahQuote.total_cents / 100
    : 0;
  const grandTotal = (bookingSummary?.totalCost || 0) + insuranceCost + depositAmount;

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
      setSubmitStep('agreement');
      const expectedTotalCents = await submitAgreementAndInsurance({
        bookingCode,
        draft,
        fallbackTotalCents: Math.round(grandTotal * 100),
      });

      setSubmitStep('payment');
      const tokenResult = await cardRef.current.tokenize({
        amount: (expectedTotalCents / 100).toFixed(2),
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
          expected_total_cents: expectedTotalCents,
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
              This Annie payment page cannot take payment until Square application and location IDs are configured. Please call {PHONE_NUMBER}.
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
        <OrderSummary bookingSummary={bookingSummary} draft={draft} depositAmount={depositAmount} theme={theme} />
        <div className="rounded-xl border p-4 sm:p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Payment Method</h3>
          <div id="square-card-container" className="min-h-[90px]" />
          {!ready && !loadError && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Square secure card form…</p>}
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
            {submitting ? <><Loader2 className="animate-spin" size={18} /> Processing…</> : <>Pay {formatCurrency(grandTotal)}</>}
          </button>
        </div>
        <p className="text-[10px] text-center leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          By clicking "Pay", you authorize {brand.name} to charge your card through Square for the rental total, insurance, and refundable security deposit.
        </p>
      </div>
    </>
  );
}
