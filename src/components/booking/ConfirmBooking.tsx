import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, AlertCircle, Phone } from 'lucide-react';
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import ProgressStepper from './confirm-booking/ProgressStepper';
import ConfirmedScreen from './confirm-booking/ConfirmedScreen';
import MissingRefScreen from './confirm-booking/MissingRefScreen';
import { brand } from '../../config/brand';

// Wizard steps
import RentalSummaryStep from './confirm-booking/wizard-steps/RentalSummaryStep';
import ScanStep from './confirm-booking/wizard-steps/ScanStep';
import AddressStep from './confirm-booking/wizard-steps/AddressStep';
import LicenseStep from './confirm-booking/wizard-steps/LicenseStep';
import TermsStep from './confirm-booking/wizard-steps/TermsStep';
import AcknowledgementsStep from './confirm-booking/wizard-steps/AcknowledgementsStep';
import SignatureStep from './confirm-booking/wizard-steps/SignatureStep';
import InsuranceStep from './confirm-booking/wizard-steps/InsuranceStep';
import ReviewStep from './confirm-booking/wizard-steps/ReviewStep';
import SubmitLoader from './confirm-booking/wizard-steps/SubmitLoader';

import { buildCustomerReceiptSnapshot } from '../../utils/buildCustomerReceiptSnapshot';
import {
  API_URL, PHONE_NUMBER,
  PAYMENT_PROVIDER, CARD_ON_FILE_ENABLED,
  getRefCode,
  formatCurrency,
  loadDraft, saveDraft, clearDraft,
  type WizardDraft,
} from './confirm-booking/constants';
import { getStripe } from './confirm-booking/stripeClient';
import { buildStripeAppearance } from './confirm-booking/stripeAppearance';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { useTheme } from '../../context/ThemeContext';

// Stripe SDK is loaded here (not in constants.ts) so importing wizard helpers
// elsewhere doesn't pull in @stripe/stripe-js.
const stripePromise = getStripe();
const SquarePaymentStage = PAYMENT_PROVIDER === 'square'
  ? React.lazy(() => import('./confirm-booking/SquarePaymentStage'))
  : null;

/* ────────────────────────────────────────────────────────
   Inner form (needs Stripe context)
   ──────────────────────────────────────────────────────── */
function PaymentForm({
  bookingSummary,
  draft,
  depositAmount,
  bookingCode,
  onUpdate,
  onBack,
  onSuccess,
  theme,
}: {
  bookingSummary: any;
  draft: WizardDraft;
  depositAmount: number;
  bookingCode: string;
  onUpdate: (patch: Partial<WizardDraft>) => void;
  onBack: () => void;
  onSuccess: () => void;
  theme: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<'agreement' | 'insurance' | 'payment' | 'confirming' | 'done'>('payment');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Grand total for display. Prefer the draft's live Bonzah quote; on a return
  // visit (empty draft after approval) fall back to the server-computed
  // insurance cost so the total still matches what the backend will charge.
  let insuranceCost = bookingSummary?.insuranceCost ?? 0;
  if (draft.insuranceChoice === 'bonzah' && draft.bonzahQuote) {
    insuranceCost = draft.bonzahQuote.total_cents / 100;
  }
  const rentalTotal = bookingSummary?.totalCost || 0;
  const grandTotal = rentalTotal + insuranceCost + depositAmount;

  /** Idempotent receipt dispatch with retries - backend dedupes via PI metadata */
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
      if (attempt >= 2) {
        console.warn('Receipt dispatch failed after retries:', err);
        return;
      }
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      return triggerReceiptWithRetry(piId, attempt + 1);
    }
  }

  /**
   * Idempotent backend payment confirmation with retries. confirmPayment dedupes
   * via the PaymentIntent's reference_id, so re-firing is safe. fetch() does NOT
   * reject on HTTP 5xx, so we must check res.ok explicitly - otherwise a
   * server-side finalization failure is completely invisible here and we silently
   * fall back to the Stripe webhook as the only data backstop.
   */
  async function confirmPaymentWithRetry(piId: string, attempt = 0): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/stripe/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_intent_id: piId }),
      });
      if (res.ok) return;
      throw new Error(`confirm-payment returned ${res.status}`);
    } catch (err) {
      if (attempt >= 2) {
        // Payment already succeeded at Stripe; the webhook reconciles the DB.
        // Surface the failure instead of swallowing it silently.
        console.error('[confirm-payment] failed after retries (webhook will reconcile):', err);
        return;
      }
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      return confirmPaymentWithRetry(piId, attempt + 1);
    }
  }

  const handlePayNow = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Agreement + insurance were already persisted at the approval gate
      // (PaymentGate) before this booking was approved, so payment goes straight
      // to charging the card.

      // ── Step 1: Validate card with Stripe Elements ──────
      setSubmitStep('payment');
      const { error: submitErr } = await elements.submit();
      if (submitErr) {
        throw new Error(submitErr.message || 'Card validation failed');
      }

      // ── Step 3b: Create PaymentIntent (server computes amount) ──
      // Insurance state already lives on the booking (set by PATCH /insurance
      // above); backend reads bonzah_premium_cents + markup directly.
      const piRes = await fetch(`${API_URL}/stripe/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_code: bookingCode,
          expected_total_cents: Math.round(grandTotal * 100),
        }),
      });
      const piJson = await piRes.json();
      if (!piRes.ok) throw new Error(piJson.error || 'Failed to create payment');

      if (piJson.alreadyPaid) {
        // Payment already completed (e.g. page refresh)
        setSubmitStep('done');
        clearDraft(bookingCode);
        onSuccess();
        return;
      }

      // ── Step 3c: Confirm payment with Stripe ──────────────
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: piJson.clientSecret,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment failed. Please try again.');
      }

      // ── Step 4: Confirm with backend ──────────────────────
      setSubmitStep('confirming');
      // The PaymentIntent ID is in the client secret
      const piId = piJson.clientSecret.split('_secret_')[0];
      await confirmPaymentWithRetry(piId);

      // Fire the receipt dispatch on a separate, idempotent endpoint with
      // retries. The backend dedupes via PI metadata, so multiple triggers
      // (webhook, confirm-payment, this) yield at most one email.
      if (piId) {
        triggerReceiptWithRetry(piId).catch(() => {
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

        {/* Stripe Payment Element */}
        <div className="rounded-xl border p-4 sm:p-5"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Payment Method</h3>
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>

        {submitError && !submitting && (
          <div className="flex items-start gap-3 p-4 rounded-xl border text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{submitError}</span>
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
            disabled={!stripe || submitting}
            className={`flex-1 py-4 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
              submitting ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] hover:-translate-y-px active:scale-95 hover:shadow-lg cursor-pointer'
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
          By clicking "Pay", you authorize {brand.name} to charge your card for the rental total, insurance, and refundable security deposit.
          Your deposit will be returned after vehicle inspection.
        </p>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────
   Approval gate — persists the signed agreement + insurance choice, then holds
   the customer at "awaiting approval" until an admin approves the request.
   Payment (Stripe Elements) only renders once the booking is approved, so no
   card is charged ahead of approval. Enforced server-side too (the payment
   endpoint rejects pending_approval bookings).
   ──────────────────────────────────────────────────────── */

// Map a booking status to what the payment gate should show.
//   'awaiting' → hold (still pending approval, or status unknown/unreachable)
//   'error'    → declined/cancelled, dead end
//   'ready'    → payment unlocked
// Payment unlocks on 'approved' AND every later lifecycle state (confirmed,
// active, returned, …): only unpaid bookings ever reach this gate — the
// orchestrator sends alreadyPaid bookings to the confirmed screen — so any
// booking that has moved past pending_approval without being declined/cancelled
// still owes payment and must not be trapped on "Awaiting Approval". Matching
// only the exact string 'approved' left the customer stuck forever the moment
// the booking advanced (e.g. an admin marking pickup flips it to 'active').
function classifyGateStatus(status: string | null): 'awaiting' | 'ready' | 'error' {
  if (!status || status === 'pending_approval') return 'awaiting';
  if (status === 'declined' || status === 'cancelled') return 'error';
  return 'ready';
}

function PaymentGate({
  refCode,
  draft,
  bookingSummary,
  depositAmount,
  theme,
  cardOnFileEnabled,
  alreadySigned,
  autoFilled,
  onUpdate,
  onBack,
  onSuccess,
}: {
  refCode: string;
  draft: WizardDraft;
  bookingSummary: any;
  depositAmount: number;
  theme: string;
  cardOnFileEnabled: boolean;
  alreadySigned: boolean;
  autoFilled?: any;
  onUpdate: (patch: Partial<WizardDraft>) => void;
  onBack: () => void;
  onSuccess: () => void;
}) {
  // 'persisting' → saving agreement + insurance; 'awaiting' → pending approval;
  // 'ready' → approved, show payment; 'error' → persist failed / declined.
  const [phase, setPhase] = useState<'persisting' | 'awaiting' | 'ready' | 'error'>('persisting');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const persistedRef = useRef(false);

  const fetchStatus = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_URL}/bookings/status/${refCode}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.status || null;
    } catch {
      return null;
    }
  }, [refCode]);

  const persistAndGate = useCallback(async () => {
    setError(null);
    setPhase('persisting');
    try {
      // Persist agreement + insurance on the FIRST pass only. On a return visit
      // (already signed) they're saved server-side; re-PATCHing insurance from an
      // empty draft would wipe the customer's choice — so skip straight to the gate.
      if (!alreadySigned) {
      // 1. Persist the signed agreement (idempotent — backend returns alreadySigned)
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
        license_scan_metadata: draft.licenseScanMetadata || undefined,
      };
      const agRes = await fetch(`${API_URL}/agreements/${refCode}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agreementPayload),
      });
      const agJson = await agRes.json();
      if (!agRes.ok && !agJson.alreadySigned) {
        throw new Error(agJson.error || 'Failed to submit agreement');
      }

      // 2. Persist the insurance choice + frozen itemized receipt
      const receiptSnapshot = buildCustomerReceiptSnapshot(
        bookingSummary,
        draft,
        depositAmount,
        {
          pickupTime: autoFilled?.pickupTime,
          returnTime: autoFilled?.returnTime,
          deliveryType: autoFilled?.deliveryType,
          deliveryAddress: autoFilled?.deliveryAddress,
        },
      );
      const insurancePayload: any = {
        source: draft.insuranceChoice,
        customer_receipt_snapshot: receiptSnapshot,
      };
      if (draft.insuranceChoice === 'bonzah') insurancePayload.tier_id = draft.bonzahTierId;
      const insRes = await fetch(`${API_URL}/bookings/${refCode}/insurance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insurancePayload),
      });
      if (!insRes.ok) {
        const insJson = await insRes.json();
        throw new Error(insJson.error || 'Failed to record insurance');
      }
      }

      // 3. Gate on approval status
      const status = await fetchStatus();
      const next = classifyGateStatus(status);
      if (next === 'error') setError(`This booking has been ${status}.`);
      setPhase(next);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setPhase('error');
    }
  }, [draft, refCode, fetchStatus, alreadySigned, bookingSummary, depositAmount, autoFilled]);

  // Persist once when the gate first mounts
  useEffect(() => {
    if (persistedRef.current) return;
    persistedRef.current = true;
    persistAndGate();
  }, [persistAndGate]);

  // Poll for approval while awaiting so the page advances on its own
  useEffect(() => {
    if (phase !== 'awaiting') return;
    const id = window.setInterval(async () => {
      const status = await fetchStatus();
      if (!status) return; // unreachable/unknown — keep polling
      const next = classifyGateStatus(status);
      if (next === 'ready') setPhase('ready');
      else if (next === 'error') {
        setError(`This booking has been ${status}.`);
        setPhase('error');
      }
    }, 12000);
    return () => window.clearInterval(id);
  }, [phase, fetchStatus]);

  const handleCheckNow = async () => {
    setChecking(true);
    const status = await fetchStatus();
    setChecking(false);
    const next = classifyGateStatus(status);
    if (next === 'ready') setPhase('ready');
    else if (next === 'error') {
      setError(`This booking has been ${status}.`);
      setPhase('error');
    }
  };

  // ── Persisting ──
  if (phase === 'persisting') {
    return (
      <div className="rounded-2xl border p-8 text-center space-y-3"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <Loader2 className="animate-spin mx-auto" size={24} style={{ color: 'var(--accent-color)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Finalizing your request…</p>
      </div>
    );
  }

  // ── Error / declined ──
  if (phase === 'error') {
    return (
      <div className="rounded-2xl border p-6 text-center space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <AlertCircle size={36} style={{ color: '#ef4444' }} className="mx-auto" />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <div className="flex gap-3 justify-center">
          <button type="button" onClick={onBack}
            className="px-6 py-3 rounded-full font-medium border cursor-pointer"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>Back</button>
          <button type="button" onClick={persistAndGate}
            className="px-6 py-3 rounded-full font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>Try again</button>
        </div>
      </div>
    );
  }

  // ── Awaiting approval ──
  if (phase === 'awaiting') {
    return (
      <div className="rounded-2xl border p-6 sm:p-8 text-center space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
          style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 12%, transparent)' }}>
          <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Awaiting Approval</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          We’ve received everything and your request is with our team for approval.
          As soon as it’s approved we’ll email you a secure link to complete payment
          and lock in your dates — this page will update automatically too.
        </p>
        <div className="rounded-xl border p-3 text-sm"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
          Ref <span className="font-mono font-bold">{refCode}</span>
          {bookingSummary?.vehicle ? <> · {bookingSummary.vehicle}</> : null}
        </div>
        <button type="button" onClick={handleCheckNow} disabled={checking}
          className="px-6 py-3 rounded-full font-medium cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
          {checking ? <><Loader2 className="animate-spin" size={16} /> Checking…</> : 'Check again'}
        </button>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <Phone size={12} className="inline mr-1" /> Questions? Call {PHONE_NUMBER}
        </p>
      </div>
    );
  }

  // ── Ready: approved → render payment ──
  if (PAYMENT_PROVIDER === 'square') {
    return (
      <React.Suspense fallback={
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin" size={22} style={{ color: 'var(--accent-color)' }} />
        </div>
      }>
        {SquarePaymentStage ? (
          <SquarePaymentStage
            bookingSummary={bookingSummary}
            draft={draft}
            depositAmount={depositAmount}
            bookingCode={refCode}
            onBack={onBack}
            onSuccess={onSuccess}
            theme={theme}
          />
        ) : null}
      </React.Suspense>
    );
  }

  let insCost = bookingSummary?.insuranceCost ?? 0;
  if (draft.insuranceChoice === 'bonzah' && draft.bonzahQuote) {
    insCost = draft.bonzahQuote.total_cents / 100;
  }
  const totalCents = Math.round(((bookingSummary?.totalCost || 0) + insCost + depositAmount) * 100);

  const elementsOptions = {
    mode: 'payment' as const,
    amount: totalCents || 50000, // fallback min
    currency: 'usd',
    appearance: buildStripeAppearance(theme),
  // Must match backend setup_future_usage when card-on-file is enabled —
  // deferred Elements + server-created PaymentIntents reject mismatches.
    ...(cardOnFileEnabled ? { setupFutureUsage: 'off_session' as const } : {}),
  };

  return (
    <Elements
      stripe={stripePromise}
      options={elementsOptions}
    >
      <PaymentForm
        bookingSummary={bookingSummary}
        draft={draft}
        depositAmount={depositAmount}
        bookingCode={refCode}
        onUpdate={onUpdate}
        onBack={onBack}
        onSuccess={onSuccess}
        theme={theme}
      />
    </Elements>
  );
}

/* ────────────────────────────────────────────────────────
   Main Orchestrator
   ──────────────────────────────────────────────────────── */
export default function ConfirmBooking() {
  const scrollToSection = useCallback((section: string) => {
    window.location.href = '/#' + section;
  }, []);

  // Mobile keyboard tracking - when iOS keyboard opens, expand bottom padding
  // of the wizard so the focused input + Continue button can scroll into view.
  const keyboardInset = useKeyboardInset();

  const refCode = getRefCode();
  // Theme comes from ThemeContext (the theme class lives on the provider's
  // wrapper div, NOT <html>, so reading a data-theme attribute always missed it
  // and pinned the wizard — and the Stripe widget — to the dark fallback).
  const { theme } = useTheme();

  // Booking data from server
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreementData, setAgreementData] = useState<any>(null);
  const [bookingSummary, setBookingSummary] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState(150);
  const [cardOnFileEnabled, setCardOnFileEnabled] = useState(CARD_ON_FILE_ENABLED);

  // Wizard state
  const [draft, setDraft] = useState<WizardDraft>(() => loadDraft(refCode || ''));
  const [confirmed, setConfirmed] = useState(false);

  // Debounced save
  const saveTimerRef = useRef<number>();
  const updateDraft = useCallback((patch: Partial<WizardDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...patch };
      // Debounce sessionStorage write
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        if (refCode) saveDraft(refCode, next);
      }, 500);
      return next;
    });
  }, [refCode]);

  // Fetch agreement data + booking summary
  useEffect(() => {
    if (!refCode) { setLoading(false); return; }

    (async () => {
      try {
        // Fetch agreement data (auto-filled fields, already-signed status)
        const agRes = await fetch(`${API_URL}/agreements/${refCode}`);
        const agJson = await agRes.json();
        if (!agRes.ok) throw new Error(agJson.error || 'Failed to load booking data');

        setAgreementData(agJson);

        // Pre-fill draft from customer defaults (only if draft is fresh)
        if (agJson.customerDefaults && !draft.address.line1) {
          const cd = agJson.customerDefaults;
          updateDraft({
            address: {
              line1: cd.address_line1 || '',
              city: cd.city || '',
              state: cd.state || '',
              zip: cd.zip || '',
            },
            dob: cd.date_of_birth || '',
            license: {
              number: cd.driver_license_number || '',
              state: cd.driver_license_state || '',
              expiry: cd.driver_license_expiry || '',
            },
          });
        }

        if (PAYMENT_PROVIDER === 'square') {
          const summaryRes = await fetch(`${API_URL}/square/booking-summary/${refCode}`);
          const summaryJson = await summaryRes.json();
          if (!summaryRes.ok) throw new Error(summaryJson.error || 'Failed to load booking summary');

          if (summaryJson.alreadyPaid) {
            setConfirmed(true);
          }

          if (summaryJson.booking) {
            setBookingSummary(summaryJson.booking);
            setDepositAmount(summaryJson.booking.depositAmount || 150);
          }

          // Returning after approval (or any reload once the wizard is done): the
          // customer already signed the agreement + chose insurance (saved
          // server-side). Skip straight to payment instead of making them redo the
          // whole flow.
          if (agJson.alreadySigned && !summaryJson.alreadyPaid) {
            updateDraft({ stage: 4 });
          }
        } else {
          // Read-only pricing — do NOT mint a PaymentIntent on page load.
          const summaryRes = await fetch(`${API_URL}/stripe/booking-summary/${refCode}`);
          const summaryJson = await summaryRes.json();
          if (!summaryRes.ok) throw new Error(summaryJson.error || 'Failed to load booking summary');

          if (summaryJson.alreadyPaid) {
            setConfirmed(true);
          }

          if (summaryJson.booking) {
            setBookingSummary(summaryJson.booking);
            setDepositAmount(summaryJson.booking.depositAmount || 150);
          }

          if (typeof summaryJson.cardOnFileEnabled === 'boolean') {
            setCardOnFileEnabled(summaryJson.cardOnFileEnabled);
          }

          // Returning after approval (or any reload once the wizard is done): the
          // customer already signed the agreement + chose insurance (saved
          // server-side). Skip straight to payment instead of making them redo the
          // whole flow.
          if (agJson.alreadySigned && !summaryJson.alreadyPaid) {
            updateDraft({ stage: 4 });
          }
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [refCode]);

  // If already signed & paid, skip to confirmed
  useEffect(() => {
    if (agreementData?.alreadySigned && confirmed) {
      // Already fully done
    }
  }, [agreementData, confirmed]);

  // Navigation helpers
  const goToStage = (stage: number, subStep = 1) => {
    updateDraft({ stage, subStep });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Update URL for browser history
    const url = new URL(window.location.href);
    url.searchParams.set('stage', String(stage));
    window.history.pushState({}, '', url.toString());
  };

  const goToSubStep = (subStep: number) => {
    updateDraft({ subStep });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const completeStage = (stageNum: number) => {
    const completed = [...draft.completedStages];
    if (!completed.includes(stageNum)) completed.push(stageNum);
    updateDraft({ completedStages: completed });
  };

  // Stage 1 sub-step navigation
  // Address (3) + License (4) are redundant once the scan has filled them, so
  // skip straight from Scan (2) to Terms (5) when the details are complete.
  const detailsComplete = () => !!(
    draft.address.line1 && draft.address.city && draft.address.state && draft.address.zip &&
    draft.license.number && draft.license.state && draft.license.expiry && draft.dob
  );

  // Admin pre-filled the ID at booking creation (GET /agreements prefilledSteps
  // includes 'scan'). When so, the customer skips the Scan step too — going
  // straight from the Rental Summary (1) to Terms (5), past Scan/Address/License.
  const scanPrefilled = React.useMemo(
    () => Array.isArray(agreementData?.prefilledSteps) && agreementData.prefilledSteps.includes('scan'),
    [agreementData]
  );

  const nextSubStep = () => {
    let next = draft.subStep + 1;
    if (draft.subStep === 1 && scanPrefilled && detailsComplete()) next = 5; // Summary → Terms (admin pre-filled ID)
    else if (draft.subStep === 2 && detailsComplete()) next = 5;             // Scan → Terms (skip Address+License)
    if (next > 7) {
      completeStage(1);
      goToStage(2);
      return;
    }
    goToSubStep(next);
  };

  const prevSubStep = () => {
    let prev = draft.subStep - 1;
    if (draft.subStep === 5 && scanPrefilled) prev = 1;            // Terms → Summary (Scan skipped by admin)
    else if (draft.subStep === 5 && detailsComplete()) prev = 2;   // Terms → Scan
    if (prev >= 1) goToSubStep(prev);
  };

  // ── Missing ref code ──────────────────────────────────
  if (!refCode) {
    return <MissingRefScreen scrollToSection={scrollToSection} theme={theme} />;
  }

  // ── Confirmed ──────────────────────────────────────────
  if (confirmed) {
    return <ConfirmedScreen refCode={refCode} scrollToSection={scrollToSection} />;
  }

  // ── Loading ──────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar onNavigate={scrollToSection} />
        <div className="min-h-dvh flex items-center justify-center" style={{ paddingTop: '120px' }}>
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin" size={22} style={{ color: 'var(--accent-color)' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading your booking…</span>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ── Error ──────────────────────────────────────────────
  if (error) {
    return (
      <>
        <Navbar onNavigate={scrollToSection} />
        <div className="min-h-dvh flex items-center justify-center px-4" style={{ paddingTop: '120px' }}>
          <div className="max-w-md w-full rounded-2xl border p-6 text-center space-y-4"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <AlertCircle size={40} style={{ color: '#ef4444' }} className="mx-auto" />
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Unable to Load Booking</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <Phone size={12} className="inline mr-1" />
              Need help? Call {PHONE_NUMBER}
            </p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const af = agreementData?.autoFilled || {};

  // ── Wizard ──────────────────────────────────────────────
  return (
    <>
      <Navbar onNavigate={scrollToSection} />
      <div
        className="min-h-dvh px-4"
        style={{
          paddingTop: '100px',
          // Bottom padding expands by the keyboard height so the Continue
          // button can be scrolled into view on iOS. Adds 16px breathing room
          // above the keyboard. Falls back to the original 80px on desktop /
          // when keyboard is closed (keyboardInset === 0).
          paddingBottom: keyboardInset > 0 ? `${keyboardInset + 16}px` : '80px',
          transition: 'padding-bottom 200ms ease-out',
        }}
      >
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <h1 className="text-2xl sm:text-3xl font-light" style={{ color: 'var(--text-primary)' }}>
              Complete Your{' '}
              <span className="font-serif italic" style={{ color: 'var(--accent-color)' }}>Booking</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Ref: <span className="font-mono font-bold">{refCode}</span>
            </p>
          </motion.div>

          {/* Progress stepper */}
          <ProgressStepper
            currentStage={draft.stage}
            currentSubStep={draft.subStep}
            completedStages={draft.completedStages}
            theme={theme}
          />

          {/* Stage content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${draft.stage}-${draft.subStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* ═══ Stage 1: Agreement ═══ */}
              {draft.stage === 1 && draft.subStep === 1 && (
                <RentalSummaryStep autoFilled={af} theme={theme} onContinue={nextSubStep} />
              )}
              {draft.stage === 1 && draft.subStep === 2 && (
                <ScanStep draft={draft} onUpdate={updateDraft} onContinue={nextSubStep} onBack={prevSubStep} onEdit={() => goToSubStep(3)} theme={theme} bookingName={af.customerName} />
              )}
              {draft.stage === 1 && draft.subStep === 3 && (
                <AddressStep draft={draft} onUpdate={updateDraft} onContinue={nextSubStep} onBack={prevSubStep} theme={theme} />
              )}
              {draft.stage === 1 && draft.subStep === 4 && (
                <LicenseStep draft={draft} onUpdate={updateDraft} onContinue={nextSubStep} onBack={prevSubStep} theme={theme} />
              )}
              {draft.stage === 1 && draft.subStep === 5 && (
                <TermsStep draft={draft} onUpdate={updateDraft} onContinue={nextSubStep} onBack={prevSubStep} theme={theme} />
              )}
              {draft.stage === 1 && draft.subStep === 6 && (
                <AcknowledgementsStep draft={draft} onUpdate={updateDraft} onContinue={nextSubStep} onBack={prevSubStep} theme={theme} />
              )}
              {draft.stage === 1 && draft.subStep === 7 && (
                <SignatureStep draft={draft} onUpdate={updateDraft} onContinue={nextSubStep} onBack={prevSubStep} theme={theme} />
              )}

              {/* ═══ Stage 2: Insurance ═══ */}
              {draft.stage === 2 && (
                <InsuranceStep
                  draft={draft}
                  rentalDays={af.rentalDays || bookingSummary?.rentalDays || 1}
                  bookingCode={refCode}
                  pickupState={af.pickupState || bookingSummary?.pickupState || af.state}
                  onUpdate={updateDraft}
                  onContinue={() => { completeStage(2); goToStage(3); }}
                  onBack={() => goToStage(1, 6)}
                  theme={theme}
                />
              )}

              {/* ═══ Stage 3: Review ═══ */}
              {draft.stage === 3 && (
                <ReviewStep
                  bookingSummary={bookingSummary}
                  draft={draft}
                  depositAmount={depositAmount}
                  theme={theme}
                  onContinue={() => { completeStage(3); goToStage(4); }}
                  onBack={() => goToStage(2)}
                />
              )}

              {/* ═══ Stage 4: Approval gate → Payment ═══ */}
              {draft.stage === 4 && (
                <PaymentGate
                  refCode={refCode}
                  draft={draft}
                  bookingSummary={bookingSummary}
                  depositAmount={depositAmount}
                  theme={theme}
                  cardOnFileEnabled={cardOnFileEnabled}
                  alreadySigned={!!agreementData?.alreadySigned}
                  autoFilled={agreementData?.autoFilled}
                  onUpdate={updateDraft}
                  onBack={() => goToStage(3)}
                  onSuccess={() => setConfirmed(true)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Help footer */}
          <div className="mt-8 text-center">
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Questions? Call us at{' '}
              <a href={`tel:${PHONE_NUMBER.replace(/\D/g, '')}`} className="underline" style={{ color: 'var(--accent-color)' }}>
                {PHONE_NUMBER}
              </a>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
