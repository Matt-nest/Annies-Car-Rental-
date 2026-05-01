import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, AlertCircle, Phone } from 'lucide-react';
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import ProgressStepper from './confirm-booking/ProgressStepper';
import ConfirmedScreen from './confirm-booking/ConfirmedScreen';
import MissingRefScreen from './confirm-booking/MissingRefScreen';

// Wizard steps
import RentalSummaryStep from './confirm-booking/wizard-steps/RentalSummaryStep';
import AddressStep from './confirm-booking/wizard-steps/AddressStep';
import LicenseStep from './confirm-booking/wizard-steps/LicenseStep';
import TermsStep from './confirm-booking/wizard-steps/TermsStep';
import AcknowledgementsStep from './confirm-booking/wizard-steps/AcknowledgementsStep';
import SignatureStep from './confirm-booking/wizard-steps/SignatureStep';
import InsuranceStep from './confirm-booking/wizard-steps/InsuranceStep';
import OrderSummary from './confirm-booking/wizard-steps/OrderSummary';
import SubmitLoader from './confirm-booking/wizard-steps/SubmitLoader';

import {
  API_URL, PHONE_NUMBER,
  stripePromise, getRefCode,
  formatCurrency,
  loadDraft, saveDraft, clearDraft,
  type WizardDraft,
} from './confirm-booking/constants';

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
  const [submitStep, setSubmitStep] = useState<'agreement' | 'insurance' | 'payment' | 'confirming' | 'done'>('agreement');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Calculate grand total for display — Bonzah quote stored on the draft
  let insuranceCost = 0;
  if (draft.insuranceChoice === 'bonzah' && draft.bonzahQuote) {
    insuranceCost = draft.bonzahQuote.total_cents / 100;
  }
  const rentalTotal = bookingSummary?.totalCost || 0;
  const grandTotal = rentalTotal + insuranceCost + depositAmount;

  /** Idempotent receipt dispatch with retries — backend dedupes via PI metadata */
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

  const handlePayNow = async () => {
    if (!stripe || !elements) return;
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
        // Personal insurance fields (if they filled them in)
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

      // ── Step 3: Validate card with Stripe Elements ──────
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
      try {
        await fetch(`${API_URL}/stripe/confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_intent_id: piId }),
        });
      } catch {
        // Non-critical: webhook will catch it
        console.warn('Could not confirm payment with backend');
      }

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
        <OrderSummary
          bookingSummary={bookingSummary}
          draft={draft}
          depositAmount={depositAmount}
          theme={theme}
        />

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
          By clicking "Pay", you authorize Annie's Car Rental to charge your card for the rental total, insurance, and refundable security deposit.
          Your deposit will be returned after vehicle inspection.
        </p>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────
   Main Orchestrator
   ──────────────────────────────────────────────────────── */
export default function ConfirmBooking() {
  const scrollToSection = useCallback((section: string) => {
    window.location.href = '/#' + section;
  }, []);

  const refCode = getRefCode();
  const [theme, setTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') || 'dark'
  );

  // Booking data from server
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreementData, setAgreementData] = useState<any>(null);
  const [bookingSummary, setBookingSummary] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState(150);

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

  // Theme observer
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

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

        // Fetch payment/booking summary for pricing
        const piRes = await fetch(`${API_URL}/stripe/create-payment-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_code: refCode }),
        });
        const piJson = await piRes.json();

        if (piJson.alreadyPaid) {
          setConfirmed(true);
        }

        if (piJson.booking) {
          setBookingSummary(piJson.booking);
          setDepositAmount(piJson.booking.depositAmount || 150);
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
  const nextSubStep = () => {
    if (draft.subStep < 6) {
      goToSubStep(draft.subStep + 1);
    } else {
      // Stage 1 complete → Stage 2
      completeStage(1);
      goToStage(2);
    }
  };

  const prevSubStep = () => {
    if (draft.subStep > 1) {
      goToSubStep(draft.subStep - 1);
    }
  };

  // ── Missing ref code ──────────────────────────────────
  if (!refCode) {
    return <MissingRefScreen scrollToSection={scrollToSection} />;
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
        <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: '120px' }}>
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
        <div className="min-h-screen flex items-center justify-center px-4" style={{ paddingTop: '120px' }}>
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
      <div className="min-h-screen px-4" style={{ paddingTop: '100px', paddingBottom: '80px' }}>
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
                <AddressStep draft={draft} onUpdate={updateDraft} onContinue={nextSubStep} onBack={prevSubStep} theme={theme} />
              )}
              {draft.stage === 1 && draft.subStep === 3 && (
                <LicenseStep draft={draft} onUpdate={updateDraft} onContinue={nextSubStep} onBack={prevSubStep} theme={theme} />
              )}
              {draft.stage === 1 && draft.subStep === 4 && (
                <TermsStep draft={draft} onUpdate={updateDraft} onContinue={nextSubStep} onBack={prevSubStep} theme={theme} />
              )}
              {draft.stage === 1 && draft.subStep === 5 && (
                <AcknowledgementsStep draft={draft} onUpdate={updateDraft} onContinue={nextSubStep} onBack={prevSubStep} theme={theme} />
              )}
              {draft.stage === 1 && draft.subStep === 6 && (
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

              {/* ═══ Stage 3: Payment ═══ */}
              {draft.stage === 3 && (
                (() => {
                  // Compute amount for Stripe Elements initialization
                  let insCost = 0;
                  if (draft.insuranceChoice === 'bonzah' && draft.bonzahQuote) {
                    insCost = draft.bonzahQuote.total_cents / 100;
                  }
                  const totalCents = Math.round(((bookingSummary?.totalCost || af.totalCost || 0) + insCost + depositAmount) * 100);

                  return (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        mode: 'payment',
                        amount: totalCents || 50000, // fallback min
                        currency: 'usd',
                        appearance: {
                          theme: theme === 'dark' ? 'night' : 'stripe',
                          variables: {
                            colorPrimary: '#C8A97E',
                            borderRadius: '12px',
                            fontFamily: '"Inter", system-ui, sans-serif',
                          },
                        },
                      }}
                    >
                      <PaymentForm
                        bookingSummary={bookingSummary}
                        draft={draft}
                        depositAmount={depositAmount}
                        bookingCode={refCode}
                        onUpdate={updateDraft}
                        onBack={() => goToStage(2)}
                        onSuccess={() => setConfirmed(true)}
                        theme={theme}
                      />
                    </Elements>
                  );
                })()
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
