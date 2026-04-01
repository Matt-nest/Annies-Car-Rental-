import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  ExternalLink,
  CreditCard,
  Shield,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Home,
  Check,
  Search,
} from 'lucide-react';
import { useTheme } from '../App';
import { EASE, DURATION } from '../utils/motion';
import Navbar from './Navbar';
import Footer from './Footer';

/* ────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────── */
const PAYMENT_URL = 'https://www.anniescarrental.com';
const BONZAH_URL = 'https://www.bonzah.com';
const WEBHOOK_URL =
  'https://services.leadconnectorhq.com/hooks/kP7owzBOHxXk0Ch6wiZT/webhook-trigger/7214c771-a6e1-4167-b1cf-59b957e57309';
const PHONE_NUMBER = '(772) 985-6667';

const STEPS = [
  { number: 1, label: 'Payment', sublabel: 'Pay for your rental' },
  { number: 2, label: 'Insurance', sublabel: 'Purchase policy' },
];

/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */
function getRefCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ────────────────────────────────────────────────────────
   Progress Stepper
   ──────────────────────────────────────────────────────── */
function ProgressStepper({ currentStep }: { currentStep: 1 | 2 }) {
  const step1Complete = currentStep === 2;

  return (
    <div className="mb-10 sm:mb-12" role="list" aria-label="Booking steps">
      <div className="flex items-start">
        {STEPS.map((step, idx) => {
          const isComplete = step.number < currentStep;
          const isActive = step.number === currentStep;

          return (
            <React.Fragment key={step.number}>
              <div
                className="flex flex-col items-center"
                role="listitem"
                aria-current={isActive ? 'step' : undefined}
              >
                {/* Bubble */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500"
                  style={{
                    backgroundColor: isComplete
                      ? 'rgba(34,197,94,0.15)'
                      : isActive
                        ? 'var(--accent-glow)'
                        : 'var(--bg-card-hover)',
                    borderColor: isComplete
                      ? '#22c55e'
                      : isActive
                        ? 'var(--accent-color)'
                        : 'var(--border-medium)',
                    color: isComplete
                      ? '#22c55e'
                      : isActive
                        ? 'var(--accent-color)'
                        : 'var(--text-tertiary)',
                  }}
                >
                  <AnimatePresence mode="wait">
                    {isComplete ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                        className="flex items-center justify-center"
                      >
                        <Check size={18} strokeWidth={3} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="num"
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.2, ease: EASE.smooth }}
                        className="text-sm font-semibold"
                      >
                        {step.number}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Labels */}
                <div className="mt-2.5 text-center">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors duration-300"
                    style={{
                      color: isActive
                        ? 'var(--text-primary)'
                        : isComplete
                          ? '#22c55e'
                          : 'var(--text-tertiary)',
                    }}
                  >
                    {step.label}
                  </p>
                  <p
                    className="text-[10px] mt-0.5 hidden sm:block transition-colors duration-300"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {step.sublabel}
                  </p>
                </div>
              </div>

              {/* Connector bar */}
              {idx < STEPS.length - 1 && (
                <div
                  className="flex-1 mx-3 sm:mx-4 mt-5 h-0.5 overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: step1Complete ? '100%' : '0%' }}
                    transition={{ duration: 0.7, ease: EASE.dramatic }}
                    style={{ backgroundColor: '#22c55e' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Field Component
   ──────────────────────────────────────────────────────── */
interface FieldProps {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  isTouched?: boolean;
  value: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  autoComplete?: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  theme: string;
}

function Field({
  id,
  label,
  helper,
  error,
  isTouched,
  value,
  type = 'text',
  inputMode,
  placeholder,
  autoComplete,
  onChange,
  onBlur,
  theme,
}: FieldProps) {
  const hasError = isTouched && !!error;
  const isValid = isTouched && !error && value.trim() !== '';

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] uppercase tracking-[0.15em] font-semibold mb-1.5 ml-0.5"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full px-4 pr-10 min-h-[52px] rounded-xl border text-[15px] focus:outline-none transition-all duration-200 placeholder:opacity-40 appearance-none"
          style={{
            backgroundColor:
              theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
            color: 'var(--text-primary)',
            borderColor: hasError
              ? 'rgba(239,68,68,0.6)'
              : isValid
                ? 'rgba(34,197,94,0.5)'
                : 'var(--border-subtle)',
          }}
          aria-describedby={
            hasError ? `${id}-error` : helper ? `${id}-helper` : undefined
          }
          aria-invalid={hasError ? 'true' : undefined}
        />
        {/* Trailing state icon */}
        {hasError && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <AlertCircle size={16} style={{ color: '#ef4444' }} />
          </div>
        )}
        {isValid && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {hasError ? (
          <motion.p
            id={`${id}-error`}
            key="error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: EASE.smooth }}
            className="flex items-center gap-1.5 text-xs mt-1.5 ml-0.5 overflow-hidden"
            style={{ color: '#ef4444' }}
            role="alert"
          >
            <AlertCircle size={11} className="shrink-0" />
            {error}
          </motion.p>
        ) : helper ? (
          <p
            id={`${id}-helper`}
            key="helper"
            className="text-xs mt-1.5 ml-0.5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {helper}
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────── */
export default function ConfirmBooking() {
  const { theme } = useTheme();
  const refCode = useMemo(() => getRefCode(), []);

  // Navigation state
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  // direction: 0 = initial load, 1 = forward, -1 = backward
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);

  // Step 1 state
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // Step 2 state
  const [policyNumber, setPolicyNumber] = useState('');
  const [bonzahEmail, setBonzahEmail] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [shake, setShake] = useState(false);

  // Missing Ref state
  const [manualRef, setManualRef] = useState('');
  const [manualTouched, setManualTouched] = useState(false);
  const [manualError, setManualError] = useState('');

  const scrollToSection = (section: string) => {
    if (section === 'home') window.location.href = '/';
    else window.location.href = `/#${section}`;
  };

  const advanceToStep2 = () => {
    setDirection(1);
    setCurrentStep(2);
    setTimeout(() => document.getElementById('policyNumber')?.focus(), 320);
  };

  const goBackToStep1 = () => {
    setDirection(-1);
    setCurrentStep(1);
  };

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
    const err = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleFieldChange = (field: string, value: string) => {
    if (field === 'policyNumber') setPolicyNumber(value);
    if (field === 'bonzahEmail') setBonzahEmail(value);
    // Re-validate live once the field has been touched
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched = { policyNumber: true, bonzahEmail: true };
    setTouched(allTouched);

    const nextErrors: Record<string, string> = {};
    const pnErr = validateField('policyNumber', policyNumber);
    const emErr = validateField('bonzahEmail', bonzahEmail);
    if (pnErr) nextErrors.policyNumber = pnErr;
    if (emErr) nextErrors.bonzahEmail = emErr;
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstKey = Object.keys(nextErrors)[0];
      document.getElementById(firstKey)?.focus();
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const urlEmail = new URLSearchParams(window.location.search).get('email') || '';
      
      const params = new URLSearchParams({
        booking_reference_code: refCode!,
        bonzah_policy_number: policyNumber.trim(),
        bonzah_email: bonzahEmail.trim(),
        email: urlEmail.trim(),
      });
      const res = await fetch(WEBHOOK_URL + '?' + params.toString());
      if (!res.ok) throw new Error('Request failed');
      setIsConfirmed(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitError(
        `Something went wrong. Please try again or call us at ${PHONE_NUMBER}.`
      );
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ════════════════════════════════════════════════════════
     RENDER — Invalid ref link
     ════════════════════════════════════════════════════════ */
  if (!refCode) {
    return (
      <>
        <Navbar onNavigate={scrollToSection} />
        <div
          className="min-h-screen flex items-center justify-center px-4"
          style={{ paddingTop: '120px' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.normal, ease: EASE.standard }}
            className="max-w-md w-full rounded-2xl border overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
              borderLeftWidth: '3px',
              borderLeftColor: 'var(--accent-color)',
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!manualRef.trim()) {
                  setManualError('Please enter a reference code');
                  setManualTouched(true);
                  return;
                }
                window.location.href = `/confirm?ref=${encodeURIComponent(manualRef.trim())}`;
              }}
              className="p-6 sm:p-8 text-left"
              noValidate
            >
              <h2
                className="text-xl sm:text-2xl font-medium mb-2 flex items-center gap-2.5"
                style={{ color: 'var(--text-primary)' }}
              >
                <Search size={22} style={{ color: 'var(--accent-color)' }} />
                Find Your Booking
              </h2>
              <p
                className="text-sm sm:text-[15px] leading-relaxed mb-6"
                style={{ color: 'var(--text-secondary)' }}
              >
                Please enter the booking reference code from your approval email or text message to continue.
              </p>

              <div
                className="space-y-5 pt-6 mb-6"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <Field
                  id="manualRef"
                  label="Reference Code"
                  placeholder="e.g. WL43"
                  value={manualRef}
                  error={manualError}
                  isTouched={manualTouched}
                  onChange={(v) => {
                    setManualRef(v);
                    if (manualTouched) {
                      setManualError(v.trim() ? '' : 'Please enter a reference code');
                    }
                  }}
                  onBlur={() => {
                    setManualTouched(true);
                    setManualError(manualRef.trim() ? '' : 'Please enter a reference code');
                  }}
                  theme={theme}
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                className="group w-full py-4 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] hover:-translate-y-px active:scale-95 hover:shadow-lg cursor-pointer"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Open Booking
                <ArrowRight
                  size={18}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </button>
            </form>
          </motion.div>
        </div>
        <Footer />
      </>
    );
  }

  /* ════════════════════════════════════════════════════════
     RENDER — Booking confirmed
     ════════════════════════════════════════════════════════ */
  if (isConfirmed) {
    return (
      <>
        <Navbar onNavigate={scrollToSection} />
        <div
          className="min-h-screen flex items-center justify-center px-4"
          style={{ paddingTop: '120px', paddingBottom: '80px' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DURATION.slow, ease: EASE.dramatic }}
            className="max-w-lg w-full rounded-3xl border p-8 sm:p-10 text-center space-y-6"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {/* Animated checkmark */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
              style={{ backgroundColor: 'rgba(34,197,94,0.12)' }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, duration: 0.4, ease: EASE.smooth }}
              >
                <CheckCircle2 size={44} style={{ color: '#22c55e' }} />
              </motion.div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, ease: EASE.standard }}
              className="text-3xl sm:text-4xl font-light"
              style={{ color: 'var(--text-primary)' }}
            >
              Booking{' '}
              <span className="font-serif italic" style={{ color: 'var(--accent-color)' }}>
                Confirmed!
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, ease: EASE.standard }}
              className="text-base leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Your booking is locked in. You'll receive a confirmation email and text with
              your check-in details shortly.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.82, ease: EASE.standard }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              Ref:{' '}
              <span className="font-mono font-bold tracking-wider">{refCode}</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.95, ease: EASE.standard }}
            >
              <button
                onClick={() => (window.location.href = '/')}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.03] hover:-translate-y-px active:scale-95 mt-4 cursor-pointer"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                <Home size={16} />
                Back to Homepage
              </button>
            </motion.div>
          </motion.div>
        </div>
        <Footer />
      </>
    );
  }

  /* ════════════════════════════════════════════════════════
     RENDER — Wizard
     ════════════════════════════════════════════════════════ */
  return (
    <>
      <Navbar onNavigate={scrollToSection} />

      <main
        className="min-h-screen px-4 sm:px-6"
        style={{ paddingTop: '120px', paddingBottom: '80px' }}
      >
        <div className="max-w-xl mx-auto">

          {/* ── Page Header ── */}
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
              Two quick steps to finalize your reservation.
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

          {/* ── Progress Stepper ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, ease: EASE.standard }}
          >
            <ProgressStepper currentStep={currentStep} />
          </motion.div>

          {/* ── Step Cards (AnimatePresence) ── */}
          <AnimatePresence mode="wait">

            {/* ══════════════════════════════════════════════
                STEP 1 — Pay for Your Rental
                ══════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{
                  opacity: 0,
                  x: direction === -1 ? -24 : 0,
                  y: direction === 0 ? 20 : 0,
                }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: EASE.standard }}
              >
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
                      <CreditCard
                        size={22}
                        style={{ color: 'var(--accent-color)' }}
                      />
                      Pay for Your Rental
                    </h2>
                    <p
                      className="text-sm sm:text-[15px] leading-relaxed mb-6"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Click below to securely pay for your rental. Once payment is
                      complete, return here and check the box to continue.
                    </p>

                    {/* Pay Now CTA */}
                    <a
                      href={PAYMENT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.03] hover:-translate-y-px active:scale-95 hover:shadow-lg text-sm sm:text-base cursor-pointer"
                      style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                    >
                      Pay Now
                      <ExternalLink
                        size={15}
                        className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </a>

                    {/* Payment confirmation checkbox */}
                    <div
                      className="mt-6 pt-5"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <div className="relative shrink-0">
                          <input
                            type="checkbox"
                            id="paymentCheck"
                            checked={paymentConfirmed}
                            onChange={(e) => setPaymentConfirmed(e.target.checked)}
                            className="sr-only"
                          />
                          <div
                            className="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 cursor-pointer"
                            style={{
                              borderColor: paymentConfirmed
                                ? '#22c55e'
                                : 'var(--border-medium)',
                              backgroundColor: paymentConfirmed ? '#22c55e' : 'transparent',
                            }}
                          >
                            <AnimatePresence>
                              {paymentConfirmed && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{
                                    type: 'spring',
                                    stiffness: 300,
                                    damping: 20,
                                  }}
                                >
                                  <Check size={14} strokeWidth={3} color="#fff" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                        <span
                          className="text-sm sm:text-[15px] font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          I've completed my payment
                        </span>
                      </label>
                    </div>

                    {/* Continue button */}
                    <div className="mt-6">
                      <button
                        onClick={advanceToStep2}
                        disabled={!paymentConfirmed}
                        className={`group w-full py-4 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                          paymentConfirmed
                            ? 'hover:scale-[1.02] hover:-translate-y-px active:scale-95 hover:shadow-lg cursor-pointer'
                            : 'opacity-40 cursor-not-allowed'
                        }`}
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                      >
                        Continue to Insurance
                        <ArrowRight
                          size={18}
                          className={`transition-transform duration-300 ${paymentConfirmed ? 'group-hover:translate-x-1' : ''}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 2 — Purchase Insurance
                ══════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.25, ease: EASE.standard }}
              >
                <motion.div
                  animate={
                    shake
                      ? { x: [0, -6, 6, -5, 5, -3, 3, -1, 1, 0] }
                      : { x: 0 }
                  }
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

                    {/* Get Insurance button */}
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

                    {/* Form fields */}
                    <div
                      className="space-y-5 pt-6"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    >
                      <Field
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

                      <Field
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

                    {/* Submit error banner */}
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
                        onClick={goBackToStep1}
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

          {/* ── Help text ── */}
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
