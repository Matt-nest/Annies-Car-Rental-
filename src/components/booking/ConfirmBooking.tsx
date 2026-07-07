import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, AlertCircle, Phone } from 'lucide-react';

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
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { useTheme } from '../../context/ThemeContext';

import {
  API_URL, PHONE_NUMBER,
  PAYMENT_PROVIDER, getRefCode,
  loadDraft, saveDraft,
  type WizardDraft,
} from './confirm-booking/constants';

const SquarePaymentStage = PAYMENT_PROVIDER === 'square'
  ? React.lazy(() => import('./confirm-booking/SquarePaymentStage'))
  : null;

/* ────────────────────────────────────────────────────────
   Main Orchestrator
   ──────────────────────────────────────────────────────── */
export default function ConfirmBooking() {
  const scrollToSection = useCallback((section: string) => {
    window.location.href = '/#' + section;
  }, []);

  const refCode = getRefCode();
  const { theme } = useTheme();
  // iOS/Android software-keyboard height so the fixed-bottom wizard actions
  // (Continue / pay) stay above the keyboard instead of being occluded.
  const keyboardInset = useKeyboardInset();

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
  const saveTimerRef = useRef<number | undefined>(undefined);
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

  const scanPrefilled = React.useMemo(
    () => Array.isArray(agreementData?.prefilledSteps) && agreementData.prefilledSteps.includes('scan'),
    [agreementData]
  );

  const nextSubStep = () => {
    let next = draft.subStep + 1;
    if (draft.subStep === 1 && scanPrefilled && detailsComplete()) next = 5;
    else if (draft.subStep === 2 && detailsComplete()) next = 5;
    if (next > 7) {
      completeStage(1);
      goToStage(2);
      return;
    }
    goToSubStep(next);
  };

  const prevSubStep = () => {
    let prev = draft.subStep - 1;
    if (draft.subStep === 5 && scanPrefilled) prev = 1;
    else if (draft.subStep === 5 && detailsComplete()) prev = 2;
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
      <div
        className="min-h-dvh px-4 safe-x overflow-x-clip max-w-full"
        style={{
          paddingTop: 'max(5.5rem, calc(env(safe-area-inset-top) + 4.5rem))',
          paddingBottom: keyboardInset > 0
            ? `${keyboardInset + 16}px`
            : 'max(5rem, calc(env(safe-area-inset-bottom) + 4rem))',
        }}
      >
        <div className="max-w-lg mx-auto w-full min-w-0">
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
                  alreadySigned={!!agreementData?.alreadySigned}
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
  alreadySigned,
  onBack,
  onSuccess,
}: {
  refCode: string;
  draft: WizardDraft;
  bookingSummary: any;
  depositAmount: number;
  theme: string;
  alreadySigned: boolean;
  onBack: () => void;
  onSuccess: () => void;
}) {
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
      if (!alreadySigned) {
        // 1. Sign agreement
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
        const agRes = await fetch(`${API_URL}/agreements/${refCode}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agreementPayload),
        });
        const agJson = await agRes.json();
        if (!agRes.ok && !agJson.alreadySigned) {
          throw new Error(agJson.error || 'Failed to submit agreement');
        }

        // 2. Persist insurance
        const insurancePayload: any = { source: draft.insuranceChoice };
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

      // 3. Gate on status
      const status = await fetchStatus();
      const next = classifyGateStatus(status);
      if (next === 'error') setError(`This booking has been ${status}.`);
      setPhase(next);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setPhase('error');
    }
  }, [draft, refCode, fetchStatus, alreadySigned]);

  useEffect(() => {
    if (persistedRef.current) return;
    persistedRef.current = true;
    persistAndGate();
  }, [persistAndGate]);

  useEffect(() => {
    if (phase !== 'awaiting') return;
    const id = window.setInterval(async () => {
      const status = await fetchStatus();
      if (!status) return;
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

  if (phase === 'persisting') {
    return (
      <div className="rounded-2xl border p-8 text-center space-y-3"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <Loader2 className="animate-spin mx-auto" size={24} style={{ color: 'var(--accent-color)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Finalizing your request…</p>
      </div>
    );
  }

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
      ) : (
        <div className="rounded-xl border p-4 text-sm text-center space-y-2" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Online payment is not available</p>
          <p>This site uses Square for payments. Please contact us to complete your booking.</p>
        </div>
      )}
    </React.Suspense>
  );
}
