import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle } from 'lucide-react';
import { API_URL, formatCurrency, clearDraft, type WizardDraft } from './constants';
import { brand } from '../../../config/brand';
import { getSquarePayments, mountCard, tokenizeAndVerify } from './squareClient';
import SubmitLoader from './wizard-steps/SubmitLoader';

/**
 * Square Stage-4 checkout — the Square counterpart to the Stripe <PaymentForm>.
 *
 * Mirrors PaymentForm's layout exactly (Total-due card · Payment Method card ·
 * Back/Pay buttons) so Annie's /confirm flow matches the JD Coastal reference;
 * only the payment field differs. Square tokenizes client-side (no clientSecret),
 * so on submit we run the same agreement → insurance steps, then tokenize and
 * POST /square/pay. The card iframe is themed via the SDK `style` object
 * (concrete colors — it's cross-origin).
 */
export default function SquareCheckoutForm({
  bookingSummary,
  draft,
  depositAmount,
  bookingCode,
  onBack,
  onSuccess,
  theme = 'dark',
}: {
  bookingSummary: any;
  draft: WizardDraft;
  depositAmount: number;
  bookingCode: string;
  onBack: () => void;
  onSuccess: () => void;
  theme?: string;
}) {
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const paymentsRef = useRef<any>(null);
  const cardRef = useRef<any>(null);

  const [cardReady, setCardReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<'agreement' | 'insurance' | 'payment' | 'confirming' | 'done'>('agreement');
  const [submitError, setSubmitError] = useState<string | null>(null);

  let insuranceCost = 0;
  if (draft.insuranceChoice === 'bonzah' && draft.bonzahQuote) {
    insuranceCost = draft.bonzahQuote.total_cents / 100;
  }
  const rentalTotal = bookingSummary?.totalCost || 0;
  const grandTotal = rentalTotal + insuranceCost + depositAmount;

  // Theme-matched style for the Square card iframe (cross-origin → concrete colors).
  const squareStyle = useMemo(() => {
    const dark = theme === 'dark';
    return {
      input: {
        color: dark ? '#F5F5F5' : '#1A1A1A',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '16px',
      },
      'input::placeholder': { color: dark ? '#6B7280' : '#9CA3AF' },
      '.input-container': {
        borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        borderRadius: '12px',
      },
      '.input-container.is-focus': { borderColor: 'var(--accent-color)' },
      '.input-container.is-error': { borderColor: '#EF4444' },
      '.message-text.is-error': { color: '#EF4444' },
    } as Record<string, unknown>;
  }, [theme]);

  // Mount the Square card field once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payments = await getSquarePayments();
        if (cancelled || !cardContainerRef.current) return;
        const card = await mountCard(payments, cardContainerRef.current, { style: squareStyle });
        if (cancelled) {
          try { await card.destroy(); } catch { /* noop */ }
          return;
        }
        paymentsRef.current = payments;
        cardRef.current = card;
        setCardReady(true);
      } catch (e: any) {
        if (!cancelled) setInitError(e.message || 'Could not load the payment form.');
      }
    })();
    return () => {
      cancelled = true;
      if (cardRef.current) {
        try { cardRef.current.destroy(); } catch { /* noop */ }
        cardRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function triggerReceiptWithRetry(paymentId: string, attempt = 0): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/square/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId }),
      });
      if (res.ok) return;
      throw new Error(`Receipt dispatch returned ${res.status}`);
    } catch (err) {
      if (attempt >= 2) {
        console.warn('Receipt dispatch failed after retries:', err);
        return;
      }
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      return triggerReceiptWithRetry(paymentId, attempt + 1);
    }
  }

  const handlePayNow = async () => {
    if (!cardReady || !cardRef.current || !paymentsRef.current) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // ── Step 1: Submit agreement ──────────────────────────
      setSubmitStep('agreement');
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

      // ── Step 2: Submit insurance ──────────────────────────
      setSubmitStep('insurance');
      const insurancePayload: any = { source: draft.insuranceChoice };
      if (draft.insuranceChoice === 'bonzah') {
        insurancePayload.tier_id = draft.bonzahTierId;
      }
      const insRes = await fetch(`${API_URL}/bookings/${bookingCode}/insurance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insurancePayload),
      });
      if (!insRes.ok) {
        const insJson = await insRes.json();
        throw new Error(insJson.error || 'Failed to record insurance');
      }

      // ── Step 3: Tokenize the card (+ buyer verification) ──
      setSubmitStep('payment');
      const billingContact = {
        addressLines: [draft.address.line1].filter(Boolean),
        city: draft.address.city,
        state: draft.address.state,
        postalCode: draft.address.zip,
        countryCode: 'US',
      };
      const { token, verificationToken } = await tokenizeAndVerify(
        paymentsRef.current,
        cardRef.current,
        { amountCents: Math.round(grandTotal * 100), billingContact }
      );

      // ── Step 4: Charge + record ───────────────────────────
      setSubmitStep('confirming');
      const payRes = await fetch(`${API_URL}/square/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_code: bookingCode,
          source_token: token,
          verification_token: verificationToken,
          expected_total_cents: Math.round(grandTotal * 100),
        }),
      });
      const payJson = await payRes.json();
      if (!payRes.ok) throw new Error(payJson.error || 'Payment failed. Please try again.');

      if (payJson.paymentId) {
        triggerReceiptWithRetry(payJson.paymentId).catch(() => {
          // Receipt failures must never block the success UX.
        });
      }

      setSubmitStep('done');
      clearDraft(bookingCode);
      onSuccess();
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setSubmitError(null);
    handlePayNow();
  };

  const handleDismiss = () => {
    setSubmitError(null);
    setSubmitting(false);
  };

  return (
    <>
      <AnimatePresence>
        {submitting && (
          <SubmitLoader
            currentStep={submitStep}
            error={submitError}
            onRetry={handleRetry}
            onDismiss={handleDismiss}
          />
        )}
      </AnimatePresence>

      <div className="space-y-5">
        {/* Compact total — the full breakdown lives on the Review step */}
        <div className="rounded-xl border p-4 flex items-center justify-between"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total due today</span>
          <span className="text-xl font-bold" style={{ color: 'var(--accent-color)' }}>{formatCurrency(grandTotal)}</span>
        </div>

        {/* Square card field */}
        <div className="rounded-xl border p-4 sm:p-5"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Payment Method</h3>
          <div ref={cardContainerRef} />
          {!cardReady && !initError && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              <Loader2 className="animate-spin" size={14} /> Loading secure card form…
            </div>
          )}
        </div>

        {(submitError || initError) && !submitting && (
          <div className="flex items-start gap-3 p-4 rounded-xl border text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{submitError || initError}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onBack}
            className="px-6 py-4 rounded-full font-medium transition-all duration-300 cursor-pointer border"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
            Back
          </button>
          <button
            type="button"
            onClick={handlePayNow}
            disabled={!cardReady || submitting}
            className={`flex-1 py-4 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
              !cardReady || submitting ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] hover:-translate-y-px active:scale-95 hover:shadow-lg cursor-pointer'
            }`}
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}
          >
            {submitting ? (
              <><Loader2 className="animate-spin" size={18} /> Processing…</>
            ) : (
              <>Pay {formatCurrency(grandTotal)}</>
            )}
          </button>
        </div>

        <p className="text-[10px] text-center leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          By clicking "Pay", you authorize {brand.name} to charge your card for the rental total, insurance, and refundable
          security deposit. Your deposit will be returned after vehicle inspection.
        </p>
      </div>
    </>
  );
}
