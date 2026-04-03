import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard,
  Shield,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { Elements } from '@stripe/react-stripe-js';
import { useTheme } from '../../context/ThemeContext';
import { EASE, DURATION } from '../../utils/motion';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import FormField from '../common/FormField';
import RentalAgreement from './RentalAgreement';

// Extracted sub-components
import {
  stripePromise,
  API_URL,
  BONZAH_URL,
  WEBHOOK_URL,
  PHONE_NUMBER,
  getRefCode,
  isValidEmail,
} from './confirm-booking/constants';
import ProgressStepper from './confirm-booking/ProgressStepper';
import StripeCheckoutForm from './confirm-booking/StripeCheckoutForm';
import MissingRefScreen from './confirm-booking/MissingRefScreen';
import ConfirmedScreen from './confirm-booking/ConfirmedScreen';

/* ────────────────────────────────────────────────────────
   Main Wizard Orchestrator
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

  // Insurance form state
  const [policyNumber, setPolicyNumber] = useState('');
  const [bonzahEmail, setBonzahEmail] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [shake, setShake] = useState(false);

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
          setCurrentStep(3);
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
  const advanceToStep3 = () => {
    setDirection(1);
    setCurrentStep(3);
    setTimeout(() => document.getElementById('policyNumber')?.focus(), 320);
  };
  const goBackToStep2 = () => { setDirection(-1); setCurrentStep(2); };

  /* ── Validation ── */
  const validateField = useCallback((field: string, value: string): string => {
    if (field === 'policyNumber' && !value.trim()) return 'Policy number is required';
    if (field === 'bonzahEmail') {
      if (!value.trim()) return 'Email address is required';
      if (!isValidEmail(value)) return 'Please enter a valid email address';
    }
    return '';
  }, []);

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  };

  const handleFieldChange = (field: string, value: string) => {
    if (field === 'policyNumber') setPolicyNumber(value);
    if (field === 'bonzahEmail') setBonzahEmail(value);
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ policyNumber: true, bonzahEmail: true });

    const nextErrors: Record<string, string> = {};
    const pnErr = validateField('policyNumber', policyNumber);
    const emErr = validateField('bonzahEmail', bonzahEmail);
    if (pnErr) nextErrors.policyNumber = pnErr;
    if (emErr) nextErrors.bonzahEmail = emErr;
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const params = new URLSearchParams({
        booking_reference_code: refCode!,
        bonzah_policy_number: policyNumber.trim(),
        bonzah_email: bonzahEmail.trim(),
        email: (searchParams.get('email') || '').trim(),
        phone: (searchParams.get('phone') || '').trim(),
      });
      const res = await fetch(WEBHOOK_URL + '?' + params.toString());
      if (!res.ok) throw new Error('Request failed');
      setIsConfirmed(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitError(`Something went wrong. Please try again or call us at ${PHONE_NUMBER}.`);
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setIsSubmitting(false);
    }
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
                      Review and sign the rental agreement before proceeding to payment.
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

            {/* STEP 2 — Payment */}
            {currentStep === 2 && (
              <motion.div key="step2" {...stepTransition(direction)}>
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
                          onSuccess={advanceToStep3}
                          theme={theme}
                        />
                      </Elements>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3 — Insurance */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.25, ease: EASE.standard }}
              >
                <motion.div
                  animate={shake ? { x: [0, -6, 6, -5, 5, -3, 3, -1, 1, 0] } : { x: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-subtle)',
                    borderLeftWidth: '3px',
                    borderLeftColor: 'var(--accent-color)',
                  }}
                >
                  <form onSubmit={handleSubmit} className="p-6 sm:p-8" noValidate>
                    <h2
                      className="text-xl sm:text-2xl font-medium mb-2 flex items-center gap-2.5"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Shield size={22} style={{ color: 'var(--accent-color)' }} />
                      Purchase Rental Insurance
                    </h2>
                    <p
                      className="text-sm sm:text-[15px] leading-relaxed mb-6"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Purchase a daily rental insurance policy from Bonzah, then enter your
                      policy details below to complete your booking.
                    </p>

                    <a
                      href={BONZAH_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.03] hover:-translate-y-px active:scale-95 hover:shadow-lg text-sm sm:text-base mb-8 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--bg-card-hover)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-medium)',
                      }}
                    >
                      Get Insurance on Bonzah
                      <ExternalLink
                        size={15}
                        className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </a>

                    <div
                      className="space-y-5 pt-6"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <FormField
                        id="policyNumber"
                        label="Bonzah Policy Number"
                        helper="Found in your Bonzah confirmation email (e.g. BZ-123456)"
                        error={errors.policyNumber}
                        isTouched={touched.policyNumber}
                        value={policyNumber}
                        placeholder="e.g. BZ-123456"
                        autoComplete="off"
                        onChange={(v) => handleFieldChange('policyNumber', v)}
                        onBlur={() => handleBlur('policyNumber', policyNumber)}
                        theme={theme}
                      />

                      <FormField
                        id="bonzahEmail"
                        label="Bonzah Account Email"
                        helper="The email address you used when purchasing on Bonzah"
                        error={errors.bonzahEmail}
                        isTouched={touched.bonzahEmail}
                        value={bonzahEmail}
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        onChange={(v) => handleFieldChange('bonzahEmail', v)}
                        onBlur={() => handleBlur('bonzahEmail', bonzahEmail)}
                        theme={theme}
                      />
                    </div>

                    {/* Submit error */}
                    <AnimatePresence>
                      {submitError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-5 overflow-hidden"
                          role="alert"
                        >
                          <div
                            className="flex items-start gap-3 p-4 rounded-xl border text-sm"
                            style={{
                              backgroundColor: 'rgba(239,68,68,0.08)',
                              borderColor: 'rgba(239,68,68,0.25)',
                              color: '#ef4444',
                            }}
                          >
                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                            <span>{submitError}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-6">
                      <button
                        type="button"
                        onClick={goBackToStep2}
                        className="group flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer text-sm sm:text-base"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <ArrowLeft
                          size={16}
                          className="transition-transform duration-300 group-hover:-translate-x-1"
                        />
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`group flex-1 py-4 rounded-full font-medium transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 ${
                          isSubmitting
                            ? 'opacity-60 cursor-not-allowed'
                            : 'hover:scale-[1.02] hover:-translate-y-px hover:shadow-lg cursor-pointer'
                        }`}
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="animate-spin" size={18} />
                            Confirming...
                          </>
                        ) : (
                          <>
                            Confirm My Booking
                            <ArrowRight
                              size={18}
                              className="transition-transform duration-300 group-hover:translate-x-1"
                            />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
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
