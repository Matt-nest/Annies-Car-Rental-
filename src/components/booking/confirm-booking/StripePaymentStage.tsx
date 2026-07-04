import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

import { brand } from '../../../config/brand';
import OrderSummary from './wizard-steps/OrderSummary';
import SubmitLoader from './wizard-steps/SubmitLoader';
import {
  API_URL,
  STRIPE_CONFIGURED,
  PHONE_NUMBER,
  clearDraft,
  formatCurrency,
  type WizardDraft,
} from './constants';

const stripePromise = STRIPE_CONFIGURED
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

interface PaymentStageProps {
  bookingSummary: any;
  draft: WizardDraft;
  depositAmount: number;
  bookingCode: string;
  onBack: () => void;
  onSuccess: () => void;
  theme: string;
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
  if (!agRes.ok && !agJson.alreadySigned) {
    throw new Error(agJson.error || 'Failed to submit agreement');
  }

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

function StripeForm({ bookingSummary, draft, depositAmount, bookingCode, onBack, onSuccess, theme }: PaymentStageProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<'agreement' | 'insurance' | 'payment' | 'confirming' | 'done'>('agreement');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const insuranceCost = draft.insuranceChoice === 'bonzah' && draft.bonzahQuote
    ? draft.bonzahQuote.total_cents / 100
    : 0;
  const grandTotal = (bookingSummary?.totalCost || 0) + insuranceCost + depositAmount;

  async function triggerReceiptWithRetry(piId: string, attempt = 0): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/stripe/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_intent_id: piId }),
      });
      if (res.ok) return;
      throw new Error(`Receipt dispatch returned ${res.status}`);
    } catch (err) {
      if (attempt >= 2) return;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      return triggerReceiptWithRetry(piId, attempt + 1);
    }
  }

  const handlePayNow = async () => {
    if (!stripe || !elements) return;
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
      const { error: submitErr } = await elements.submit();
      if (submitErr) throw new Error(submitErr.message || 'Card validation failed');

      const piRes = await fetch(`${API_URL}/stripe/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_code: bookingCode, expected_total_cents: expectedTotalCents }),
      });
      const piJson = await piRes.json();
      if (!piRes.ok) throw new Error(piJson.error || 'Failed to create payment');

      if (piJson.alreadyPaid) {
        setSubmitStep('done');
        clearDraft(bookingCode);
        onSuccess();
        return;
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: piJson.clientSecret,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (confirmError) throw new Error(confirmError.message || 'Payment failed. Please try again.');

      setSubmitStep('confirming');
      const piId = piJson.clientSecret.split('_secret_')[0];
      await fetch(`${API_URL}/stripe/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_intent_id: piId }),
      }).catch(() => {});
      if (piId) triggerReceiptWithRetry(piId).catch(() => {});

      setSubmitStep('done');
      clearDraft(bookingCode);
      onSuccess();
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {submitting && <SubmitLoader currentStep={submitStep} error={submitError} onRetry={handlePayNow} onDismiss={() => { setSubmitError(null); setSubmitting(false); }} />}
      </AnimatePresence>

      <div className="space-y-5">
        <OrderSummary bookingSummary={bookingSummary} draft={draft} depositAmount={depositAmount} theme={theme} />
        <div className="rounded-xl border p-4 sm:p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Payment Method</h3>
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
        {submitError && !submitting && (
          <div className="flex items-start gap-3 p-4 rounded-xl border text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onBack} className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>Back</button>
          <button type="button" onClick={handlePayNow} disabled={!stripe || submitting} className={`flex-1 py-4 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 ${submitting ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] hover:-translate-y-px active:scale-95 hover:shadow-lg cursor-pointer'}`} style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
            {submitting ? <><Loader2 className="animate-spin" size={18} /> Processing…</> : <>Pay {formatCurrency(grandTotal)}</>}
          </button>
        </div>
        <p className="text-[10px] text-center leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          By clicking "Pay", you authorize {brand.name} to charge your card for the rental total, insurance, and refundable security deposit.
        </p>
      </div>
    </>
  );
}

export default function StripePaymentStage(props: PaymentStageProps) {
  if (!STRIPE_CONFIGURED) {
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(254,242,242,0.9)' }}>
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-red-500 mt-0.5" />
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Stripe is not configured</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              This Stripe deployment cannot take payment until `VITE_STRIPE_PUBLISHABLE_KEY` is configured. Please call {PHONE_NUMBER}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalCents = Math.round(((props.bookingSummary?.totalCost || 0) + (props.draft.insuranceChoice === 'bonzah' && props.draft.bonzahQuote ? props.draft.bonzahQuote.total_cents / 100 : 0) + props.depositAmount) * 100);

  return (
    <Elements stripe={stripePromise} options={{
      mode: 'payment',
      amount: totalCents || 50000,
      currency: 'usd',
      appearance: {
        theme: props.theme === 'dark' ? 'night' : 'stripe',
        variables: { colorPrimary: '#C8A97E', borderRadius: '12px', fontFamily: '"Inter", system-ui, sans-serif' },
      },
    }}>
      <StripeForm {...props} />
    </Elements>
  );
}
