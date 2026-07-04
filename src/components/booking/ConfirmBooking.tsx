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

import {
  API_URL, PHONE_NUMBER,
  PAYMENT_PROVIDER, getRefCode,
  loadDraft, saveDraft,
  type WizardDraft,
} from './confirm-booking/constants';

const StripePaymentStage = PAYMENT_PROVIDER === 'stripe'
  ? React.lazy(() => import('./confirm-booking/StripePaymentStage'))
  : null;
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
        if (agJson.alreadyPaid) {
          setConfirmed(true);
        }

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

        if (agJson.bookingSummary) {
          setBookingSummary(agJson.bookingSummary);
          setDepositAmount(agJson.bookingSummary.depositAmount || 150);
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

  const nextSubStep = () => {
    let next = draft.subStep + 1;
    if (draft.subStep === 2 && detailsComplete()) next = 5; // Scan → Terms (skip Address+License)
    if (next > 7) {
      completeStage(1);
      goToStage(2);
      return;
    }
    goToSubStep(next);
  };

  const prevSubStep = () => {
    let prev = draft.subStep - 1;
    if (draft.subStep === 5 && detailsComplete()) prev = 2; // Terms → Scan (skip back over the filled steps)
    if (prev >= 1) goToSubStep(prev);
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

              {/* ═══ Stage 3: Payment ═══ */}
              {draft.stage === 3 && (
                <React.Suspense fallback={
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="animate-spin" size={22} style={{ color: 'var(--accent-color)' }} />
                  </div>
                }>
                  {PAYMENT_PROVIDER === 'stripe' ? (
                    StripePaymentStage ? <StripePaymentStage
                      bookingSummary={bookingSummary}
                      draft={draft}
                      depositAmount={depositAmount}
                      bookingCode={refCode}
                      onBack={() => goToStage(2)}
                      onSuccess={() => setConfirmed(true)}
                      theme={theme}
                    /> : null
                  ) : (
                    SquarePaymentStage ? <SquarePaymentStage
                      bookingSummary={bookingSummary}
                      draft={draft}
                      depositAmount={depositAmount}
                      bookingCode={refCode}
                      onBack={() => goToStage(2)}
                      onSuccess={() => setConfirmed(true)}
                      theme={theme}
                    /> : null
                  )}
                </React.Suspense>
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
