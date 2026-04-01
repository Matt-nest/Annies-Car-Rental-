import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  ExternalLink,
  CreditCard,
  Shield,
  Loader2,
  AlertCircle,
  ArrowRight,
  Home,
  Check,
} from 'lucide-react';
import { useTheme } from '../App';
import { EASE, DURATION, STAGGER } from '../utils/motion';
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
   Step Indicator
   ──────────────────────────────────────────────────────── */
function StepIndicator({
  stepNumber,
  totalSteps,
  isComplete,
  isActive,
}: {
  stepNumber: number;
  totalSteps: number;
  isComplete: boolean;
  isActive: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <motion.div
        animate={{
          backgroundColor: isComplete
            ? 'rgb(34,197,94)'
            : isActive
              ? 'var(--accent-color)'
              : 'var(--bg-card-hover)',
          scale: isComplete ? [1, 1.2, 1] : 1,
        }}
        transition={{ duration: 0.4, ease: EASE.smooth }}
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
        style={{
          color: isComplete || isActive ? '#fff' : 'var(--text-tertiary)',
        }}
      >
        {isComplete ? <Check size={16} strokeWidth={3} /> : stepNumber}
      </motion.div>
      <span
        className="text-[11px] uppercase tracking-[0.2em] font-semibold"
        style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
      >
        Step {stepNumber} of {totalSteps}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────── */
export default function ConfirmBooking() {
  const { theme } = useTheme();
  const refCode = useMemo(() => getRefCode(), []);

  // Step 1 state
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // Step 2 state
  const [policyNumber, setPolicyNumber] = useState('');
  const [bonzahEmail, setBonzahEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);

  const scrollToSection = (section: string) => {
    if (section === 'home') {
      window.location.href = '/';
    } else {
      window.location.href = `/#${section}`;
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
    color: 'var(--text-primary)',
  };

  const inputClass = (field: string) =>
    `w-full px-4 min-h-[52px] flex items-center rounded-xl border text-[15px] focus:outline-none transition-all placeholder:opacity-55 appearance-none ${
      errors[field] ? 'border-red-500/60 focus:border-red-400' : ''
    }`;

  const inputBorder = (field: string): React.CSSProperties => ({
    borderColor: errors[field] ? 'rgba(239,68,68,0.5)' : 'var(--border-subtle)',
  });

  /* ── Validation ── */
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!policyNumber.trim()) errs.policyNumber = 'Policy number is required';
    if (!bonzahEmail.trim()) errs.bonzahEmail = 'Email is required';
    else if (!isValidEmail(bonzahEmail)) errs.bonzahEmail = 'Please enter a valid email';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const params = new URLSearchParams({
          booking_reference_code: refCode,
          bonzah_policy_number: policyNumber.trim(),
          bonzah_email: bonzahEmail.trim(),
        });
      const res = await fetch(WEBHOOK_URL + '?' + params.toString());
      if (!res.ok) throw new Error('Request failed');
      setIsConfirmed(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitError(
        `Something went wrong. Please try again or call us at ${PHONE_NUMBER}.`
      );
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
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.normal, ease: EASE.standard }}
            className="max-w-md w-full rounded-2xl border p-8 text-center space-y-6"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
            >
              <AlertCircle size={32} style={{ color: '#ef4444' }} />
            </div>
            <h2 className="text-2xl font-medium" style={{ color: 'var(--text-primary)' }}>
              Invalid Booking Link
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Please use the link from your approval email or text message. If you're
              having trouble, call us for help.
            </p>
            <a
              href={`tel:${PHONE_NUMBER.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.03] active:scale-95"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              Call {PHONE_NUMBER}
            </a>
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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DURATION.slow, ease: EASE.dramatic }}
            className="max-w-lg w-full rounded-3xl border p-8 sm:p-10 text-center space-y-6"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            {/* Animated checkmark */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6, ease: EASE.dramatic }}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
              style={{ backgroundColor: 'rgba(34,197,94,0.12)' }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, duration: 0.4, ease: EASE.smooth }}
              >
                <CheckCircle2 size={44} style={{ color: '#22c55e' }} />
              </motion.div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, ease: EASE.standard }}
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
              transition={{ delay: 0.8, ease: EASE.standard }}
              className="text-base leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Your booking is locked in. You'll receive a confirmation email and text with
              your check-in details shortly.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, ease: EASE.standard }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              Ref: <span className="font-mono font-bold tracking-wider">{refCode}</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, ease: EASE.standard }}
            >
              <button
                onClick={() => (window.location.href = '/')}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.03] active:scale-95 mt-4"
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
        <div className="max-w-2xl mx-auto">
          {/* ── Page Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE.dramatic }}
            className="text-center mb-10 sm:mb-14"
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
              className="text-base sm:text-lg leading-relaxed max-w-lg mx-auto mb-6"
              style={{ color: 'var(--text-secondary)' }}
            >
              You're almost there — just two quick steps to finalize your reservation.
            </p>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, ease: EASE.smooth }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
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

          {/* ── Progress Bar ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, ease: EASE.standard }}
            className="mb-8 sm:mb-10"
          >
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card-hover)' }}
            >
              <motion.div
                className="h-full rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: paymentConfirmed ? '100%' : '50%' }}
                transition={{ duration: 0.8, ease: EASE.dramatic }}
                style={{ backgroundColor: 'var(--accent-color)' }}
              />
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════
              STEP 1 — Pay for Your Rental
              ══════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: DURATION.normal, ease: EASE.standard }}
            className="rounded-2xl border overflow-hidden mb-6"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: paymentConfirmed ? 'rgba(34,197,94,0.3)' : 'var(--border-subtle)',
              borderLeftWidth: '3px',
              borderLeftColor: paymentConfirmed ? '#22c55e' : 'var(--accent-color)',
              opacity: paymentConfirmed ? 0.7 : 1,
              transition: 'opacity 0.5s ease, border-color 0.5s ease',
            }}
          >
            <div className="p-6 sm:p-8">
              <StepIndicator
                stepNumber={1}
                totalSteps={2}
                isComplete={paymentConfirmed}
                isActive={!paymentConfirmed}
              />

              <h2
                className="text-xl sm:text-2xl font-medium mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <CreditCard
                  className="inline-block mr-2 -mt-1"
                  size={22}
                  style={{ color: 'var(--accent-color)' }}
                />
                Pay for Your Rental
              </h2>
              <p
                className="text-sm sm:text-[15px] leading-relaxed mb-6"
                style={{ color: 'var(--text-secondary)' }}
              >
                Click the button below to securely pay for your rental. After completing
                payment, return to this page to continue.
              </p>

              {/* Pay Now Button */}
              <a
                href={PAYMENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`group inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-full font-medium transition-all duration-300 text-sm sm:text-base ${
                  paymentConfirmed
                    ? 'opacity-50 pointer-events-none'
                    : 'hover:scale-[1.03] active:scale-95 hover:shadow-lg'
                }`}
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Pay Now
                <ExternalLink
                  size={15}
                  className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </a>

              {/* Payment confirmation checkbox */}
              <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <label className="flex items-center gap-3 cursor-pointer group select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={paymentConfirmed}
                      onChange={(e) => setPaymentConfirmed(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 peer-checked:border-green-500 peer-checked:bg-green-500"
                      style={{
                        borderColor: paymentConfirmed ? '#22c55e' : 'var(--border-medium)',
                        backgroundColor: paymentConfirmed ? '#22c55e' : 'transparent',
                      }}
                    >
                      <AnimatePresence>
                        {paymentConfirmed && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: EASE.smooth }}
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
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════
              STEP 2 — Purchase Insurance
              ══════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: DURATION.normal, ease: EASE.standard }}
            className="rounded-2xl border overflow-hidden relative"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
              borderLeftWidth: '3px',
              borderLeftColor: paymentConfirmed ? 'var(--accent-color)' : 'var(--border-subtle)',
              opacity: paymentConfirmed ? 1 : 0.45,
              transition: 'opacity 0.5s ease, border-color 0.5s ease',
              pointerEvents: paymentConfirmed ? 'auto' : 'none',
            }}
          >
            {/* Disabled overlay */}
            {!paymentConfirmed && (
              <div
                className="absolute inset-0 z-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'transparent' }}
              >
                <span
                  className="text-xs uppercase tracking-widest font-semibold px-4 py-2 rounded-full"
                  style={{
                    backgroundColor: 'var(--bg-card-hover)',
                    color: 'var(--text-tertiary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Complete Step 1 first
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 sm:p-8">
              <StepIndicator
                stepNumber={2}
                totalSteps={2}
                isComplete={false}
                isActive={paymentConfirmed}
              />

              <h2
                className="text-xl sm:text-2xl font-medium mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <Shield
                  className="inline-block mr-2 -mt-1"
                  size={22}
                  style={{ color: 'var(--accent-color)' }}
                />
                Purchase Rental Insurance
              </h2>
              <p
                className="text-sm sm:text-[15px] leading-relaxed mb-6"
                style={{ color: 'var(--text-secondary)' }}
              >
                You'll need a daily rental insurance policy from Bonzah for your rental
                period. Click below to purchase your policy, then enter your policy details
                here.
              </p>

              {/* Get Insurance Button */}
              <a
                href={BONZAH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.03] active:scale-95 hover:shadow-lg text-sm sm:text-base mb-8"
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
                className="space-y-4 pt-6"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <div>
                  <label
                    className="text-[10px] uppercase tracking-widest mb-1.5 block ml-1 font-semibold"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Bonzah Policy Number
                  </label>
                  <input
                    type="text"
                    value={policyNumber}
                    onChange={(e) => {
                      setPolicyNumber(e.target.value);
                      if (errors.policyNumber)
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.policyNumber;
                          return n;
                        });
                    }}
                    placeholder="e.g. BZ-123456"
                    className={inputClass('policyNumber')}
                    style={{ ...inputStyle, ...inputBorder('policyNumber') }}
                  />
                  {errors.policyNumber && (
                    <p className="text-red-400 text-xs mt-1 ml-1">{errors.policyNumber}</p>
                  )}
                </div>

                <div>
                  <label
                    className="text-[10px] uppercase tracking-widest mb-1.5 block ml-1 font-semibold"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Bonzah Email
                  </label>
                  <input
                    type="email"
                    value={bonzahEmail}
                    onChange={(e) => {
                      setBonzahEmail(e.target.value);
                      if (errors.bonzahEmail)
                        setErrors((prev) => {
                          const n = { ...prev };
                          delete n.bonzahEmail;
                          return n;
                        });
                    }}
                    placeholder="The email you used on Bonzah"
                    className={inputClass('bonzahEmail')}
                    style={{ ...inputStyle, ...inputBorder('bonzahEmail') }}
                  />
                  {errors.bonzahEmail && (
                    <p className="text-red-400 text-xs mt-1 ml-1">{errors.bonzahEmail}</p>
                  )}
                </div>
              </div>

              {/* Submit error */}
              <AnimatePresence>
                {submitError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4"
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

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`group w-full py-4 rounded-full font-medium transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-2 mt-6 ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Confirming...
                  </>
                ) : (
                  <>
                    Confirm My Booking{' '}
                    <ArrowRight
                      size={18}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>
          </motion.div>

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
              className="underline underline-offset-2 transition-opacity hover:opacity-70"
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
