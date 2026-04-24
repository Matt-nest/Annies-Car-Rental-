import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Elements } from '@stripe/react-stripe-js';
import { useTheme } from '../../context/ThemeContext';
import { EASE, DURATION } from '../../utils/motion';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import RentalAgreement from './RentalAgreement';

// Extracted sub-components
import {
  stripePromise,
  API_URL,
  PHONE_NUMBER,
  getRefCode,
} from './confirm-booking/constants';
import ProgressStepper from './confirm-booking/ProgressStepper';
import StripeCheckoutForm from './confirm-booking/StripeCheckoutForm';
import MissingRefScreen from './confirm-booking/MissingRefScreen';
import ConfirmedScreen from './confirm-booking/ConfirmedScreen';
import InsuranceStep from './confirm-booking/InsuranceStep';

/* ────────────────────────────────────────────────────────
   Main Wizard Orchestrator
   ────────────────────────────────────────────────────────
   Flow: Agreement (1) → Insurance (2) → Payment (3)
   ──────────────────────────────────────────────────────── */
export default function ConfirmBooking() {
  const { theme } = useTheme();
  const refCode = useMemo(() => getRefCode(), []);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);

  // Agreement state
  const [agreementSigned, setAgreementSigned] = useState(false);

  // Payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingSummary, setBookingSummary] = useState<any>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  // Confirmation state
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Fetch PaymentIntent
  useEffect(() => {
    if (!refCode) return;
    setPaymentLoading(true);
    fetch(`${API_URL}/stripe/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_code: refCode }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setPaymentError(data.error);
        } else if (data.alreadyPaid) {
          setAlreadyPaid(true);
          setBookingSummary(data.booking);
          setAgreementSigned(true);
          setIsConfirmed(true);
        } else {
          setClientSecret(data.clientSecret);
          setBookingSummary(data.booking);
        }
      })
      .catch(() => setPaymentError('Could not load payment form. Please try again.'))
      .finally(() => setPaymentLoading(false));
  }, [refCode]);

  const scrollToSection = (section: string) => {
    if (section === 'home') window.location.href = '/';
    else window.location.href = `/#${section}`;
  };

  /* ── Step navigation ── */
  const advanceToStep2 = () => { setDirection(1); setCurrentStep(2); };
  const advanceToStep3 = () => { setDirection(1); setCurrentStep(3); };
  const goBackToStep1 = () => { setDirection(-1); setCurrentStep(1); };
  const goBackToStep2 = () => { setDirection(-1); setCurrentStep(2); };

  const handlePaymentSuccess = () => {
    setIsConfirmed(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ═══════════════════════════════════════
     Early returns for special states
     ═══════════════════════════════════════ */
  if (!refCode) {
    return <MissingRefScreen scrollToSection={scrollToSection} theme={theme} />;
  }

  if (isConfirmed) {
    return <ConfirmedScreen refCode={refCode} scrollToSection={scrollToSection} />;
  }

  /* ═══════════════════════════════════════
     Main wizard render
     ═══════════════════════════════════════ */
  const stepTransition = (dir: -1 | 0 | 1) => ({
    initial: { opacity: 0, x: dir === -1 ? -24 : 0, y: dir === 0 ? 20 : 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: dir === 1 ? -24 : 24 },
    transition: { duration: 0.25, ease: EASE.standard },
  });

  return (
    <>
      <Navbar onNavigate={scrollToSection} />

      <main
        className="min-h-screen px-4 sm:px-6"
        style={{ paddingTop: '120px', paddingBottom: '80px' }}
      >
        <div className="max-w-xl mx-auto">

          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE.dramatic }}
            className="text-center mb-10 sm:mb-12"
          >
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-light mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Complete Your{' '}
              <span className="font-serif italic" style={{ color: 'var(--accent-color)' }}>
                Booking
              </span>
            </h1>
            <p
              className="text-sm sm:text-base leading-relaxed max-w-sm mx-auto mb-5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Three quick steps to finalize your reservation.
            </p>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, ease: EASE.smooth }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: 'var(--accent-glow)',
                border: '1px solid var(--accent-color)',
                color: 'var(--accent-color)',
              }}
            >
              Ref:{' '}
              <span className="font-mono font-bold tracking-wider text-base">{refCode}</span>
            </motion.div>
          </motion.div>

          {/* Progress Stepper */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, ease: EASE.standard }}
          >
            <ProgressStepper currentStep={currentStep} />
          </motion.div>

          {/* Step Cards */}
          <AnimatePresence mode="wait">

            {/* STEP 1 — Rental Agreement */}
            {currentStep === 1 && (
              <motion.div key="step1" {...stepTransition(direction)}>
                <div
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-subtle)',
                    borderLeftWidth: '3px',
                    borderLeftColor: 'var(--accent-color)',
                  }}
                >
                  <div className="p-6 sm:p-8">
                    <h2
                      className="text-xl sm:text-2xl font-medium mb-2 flex items-center gap-2.5"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <FileText size={22} style={{ color: 'var(--accent-color)' }} />
                      Rental Agreement
                    </h2>
                    <p
                      className="text-sm sm:text-[15px] leading-relaxed mb-6"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Review and sign the rental agreement before proceeding.
                    </p>

                    <RentalAgreement
                      bookingCode={refCode}
                      theme={theme}
                      onSigned={() => {
                        setAgreementSigned(true);
                        advanceToStep2();
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2 — Insurance Selection */}
            {currentStep === 2 && (
              <motion.div key="step2" {...stepTransition(direction)}>
                <InsuranceStep
                  bookingCode={refCode}
                  theme={theme}
                  onContinue={advanceToStep3}
                  onBack={goBackToStep1}
                />
              </motion.div>
            )}

            {/* STEP 3 — Payment */}
            {currentStep === 3 && (
              <motion.div key="step3" {...stepTransition(direction)}>
                <div
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-subtle)',
                    borderLeftWidth: '3px',
                    borderLeftColor: 'var(--accent-color)',
                  }}
                >
                  <div className="p-6 sm:p-8">
                    <h2
                      className="text-xl sm:text-2xl font-medium mb-2 flex items-center gap-2.5"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <CreditCard size={22} style={{ color: 'var(--accent-color)' }} />
                      Pay for Your Rental
                    </h2>
                    <p
                      className="text-sm sm:text-[15px] leading-relaxed mb-6"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Complete your payment below to secure your reservation.
                    </p>

                    {paymentLoading && (
                      <div className="flex items-center justify-center py-12 gap-3">
                        <Loader2 className="animate-spin" size={22} style={{ color: 'var(--accent-color)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading payment form…</span>
                      </div>
                    )}

                    {paymentError && !paymentLoading && (
                      <div
                        className="flex items-start gap-3 p-4 rounded-xl border text-sm"
                        style={{
                          backgroundColor: 'rgba(239,68,68,0.08)',
                          borderColor: 'rgba(239,68,68,0.25)',
                          color: '#ef4444',
                        }}
                      >
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                        <span>{paymentError}</span>
                      </div>
                    )}

                    {clientSecret && !paymentLoading && (
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret,
                          appearance: {
                            theme: theme === 'dark' ? 'night' : 'stripe',
                            variables: {
                              colorPrimary: '#c8a97e',
                              borderRadius: '12px',
                              fontFamily: 'Inter, system-ui, sans-serif',
                            },
                          },
                          loader: 'auto',
                        }}
                      >
                        <StripeCheckoutForm
                          bookingSummary={bookingSummary}
                          onSuccess={handlePaymentSuccess}
                          theme={theme}
                        />
                      </Elements>
                    )}

                    {/* Back button for payment step */}
                    {!paymentLoading && (
                      <button
                        type="button"
                        onClick={goBackToStep2}
                        className="group flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer text-sm mt-4 w-full sm:w-auto"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        ← Back to Insurance
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Help text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, ease: EASE.standard }}
            className="text-center text-xs mt-6"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Need help? Call us at{' '}
            <a
              href={`tel:${PHONE_NUMBER.replace(/\D/g, '')}`}
              className="underline underline-offset-2 transition-opacity hover:opacity-70 cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              {PHONE_NUMBER}
            </a>
          </motion.p>
        </div>
      </main>

      <Footer />
    </>
  );
}
