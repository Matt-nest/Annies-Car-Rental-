import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { EASE } from '../../../utils/motion';
import { API_URL, BONZAH_URL, isValidEmail } from './constants';
import FormField from '../../common/FormField';

/* ────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────── */
type InsuranceChoice = 'own' | 'bonzah' | 'later';

interface InsuranceStepProps {
  bookingCode: string;
  theme: string;
  onContinue: () => void;
  onBack: () => void;
}

/* ────────────────────────────────────────────────────────
   Choice Card micro-component
   ──────────────────────────────────────────────────────── */
function ChoiceCard({
  selected,
  onClick,
  icon: Icon,
  title,
  description,
  badge,
  theme,
}: {
  selected: boolean;
  onClick: () => void;
  icon: any;
  title: string;
  description: string;
  badge?: string;
  theme: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer relative overflow-hidden"
      style={{
        backgroundColor: selected
          ? 'rgba(200,169,126,0.08)'
          : theme === 'dark'
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(0,0,0,0.02)',
        borderColor: selected ? 'var(--accent-color)' : 'var(--border-subtle)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Radio circle */}
        <div
          className="w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all duration-200"
          style={{
            borderColor: selected ? 'var(--accent-color)' : 'var(--border-medium)',
            backgroundColor: selected ? 'var(--accent-color)' : 'transparent',
          }}
        >
          {selected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--accent-fg)' }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon
              size={16}
              style={{ color: selected ? 'var(--accent-color)' : 'var(--text-tertiary)' }}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              {title}
            </span>
            {badge && (
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'rgba(34,197,94,0.12)',
                  color: '#22c55e',
                }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

/* ────────────────────────────────────────────────────────
   Main InsuranceStep Component
   ──────────────────────────────────────────────────────── */
export default function InsuranceStep({
  bookingCode,
  theme,
  onContinue,
  onBack,
}: InsuranceStepProps) {
  const [choice, setChoice] = useState<InsuranceChoice | null>(null);

  // Bonzah-specific fields
  const [policyNumber, setPolicyNumber] = useState('');
  const [bonzahEmail, setBonzahEmail] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [shake, setShake] = useState(false);

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

  /* ── Continue handler ── */
  const handleContinue = async () => {
    if (!choice) return;

    // If Bonzah selected, validate and save
    if (choice === 'bonzah') {
      setTouched({ policyNumber: true, bonzahEmail: true });

      const nextErrors: Record<string, string> = {};
      const pnErr = validateField('policyNumber', policyNumber);
      const emErr = validateField('bonzahEmail', bonzahEmail);
      if (pnErr) nextErrors.policyNumber = pnErr;
      if (emErr) nextErrors.bonzahEmail = emErr;
      setErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) {
        document.getElementById(Object.keys(nextErrors)[0])?.focus();
        setShake(true);
        setTimeout(() => setShake(false), 600);
        return;
      }

      setIsSubmitting(true);
      setSubmitError('');

      try {
        const res = await fetch(`${API_URL}/bookings/${bookingCode}/insurance`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bonzah_policy_number: policyNumber.trim(),
            bonzah_email: bonzahEmail.trim(),
          }),
        });
        if (!res.ok) throw new Error('Request failed');
      } catch {
        setSubmitError('Could not save insurance info. Please try again.');
        setShake(true);
        setTimeout(() => setShake(false), 600);
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    // For 'own' and 'later', no backend call needed
    // (own insurance was already captured in the agreement form)
    onContinue();
  };

  return (
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
      <div className="p-6 sm:p-8">
        <h2
          className="text-xl sm:text-2xl font-medium mb-2 flex items-center gap-2.5"
          style={{ color: 'var(--text-primary)' }}
        >
          <Shield size={22} style={{ color: 'var(--accent-color)' }} />
          Insurance Coverage
        </h2>
        <p
          className="text-sm sm:text-[15px] leading-relaxed mb-6"
          style={{ color: 'var(--text-secondary)' }}
        >
          How would you like to handle insurance for this rental?
        </p>

        {/* ── Choice Cards ── */}
        <div className="space-y-3 mb-6">
          <ChoiceCard
            selected={choice === 'own'}
            onClick={() => setChoice('own')}
            icon={ShieldCheck}
            title="I have my own coverage"
            description="Your personal auto insurance info was already collected in the rental agreement."
            badge="Collected"
            theme={theme}
          />
          <ChoiceCard
            selected={choice === 'bonzah'}
            onClick={() => setChoice('bonzah')}
            icon={Shield}
            title="I purchased coverage on Bonzah"
            description="Enter your Bonzah policy details below. Coverage starts from $7.99/day."
            theme={theme}
          />
          <ChoiceCard
            selected={choice === 'later'}
            onClick={() => setChoice('later')}
            icon={Clock}
            title="I'll handle insurance later"
            description="You can purchase coverage anytime before your pickup date."
            theme={theme}
          />
        </div>

        {/* ── Bonzah fields (conditional) ── */}
        <AnimatePresence>
          {choice === 'bonzah' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE.standard }}
              className="overflow-hidden"
            >
              <div
                className="rounded-xl p-4 mb-6 space-y-4"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* Bonzah CTA */}
                <div className="flex items-start gap-3 mb-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'rgba(200,169,126,0.12)',
                      color: 'var(--accent-color)',
                    }}
                  >
                    <ExternalLink size={14} />
                  </div>
                  <div>
                    <p
                      className="text-xs leading-relaxed mb-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Don't have a policy yet? Purchase one on Bonzah first, then enter your
                      details below.
                    </p>
                    <a
                      href={BONZAH_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 hover:opacity-80"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      Get Insurance on Bonzah
                      <ExternalLink
                        size={12}
                        className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </a>
                  </div>
                </div>

                {/* Policy fields */}
                <div
                  className="space-y-4 pt-3"
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── "Later" warning ── */}
        <AnimatePresence>
          {choice === 'later' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE.standard }}
              className="overflow-hidden"
            >
              <div
                className="flex items-start gap-3 p-4 rounded-xl border text-xs mb-6"
                style={{
                  backgroundColor: 'rgba(234,179,8,0.08)',
                  borderColor: 'rgba(234,179,8,0.25)',
                  color: '#eab308',
                }}
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Insurance is required before vehicle pickup. You can purchase coverage
                  from{' '}
                  <a
                    href={BONZAH_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: 'var(--accent-color)' }}
                  >
                    Bonzah
                  </a>{' '}
                  or verify your own auto policy covers rentals.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── "Own" confirmation ── */}
        <AnimatePresence>
          {choice === 'own' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE.standard }}
              className="overflow-hidden"
            >
              <div
                className="flex items-start gap-3 p-4 rounded-xl border text-xs mb-6"
                style={{
                  backgroundColor: 'rgba(34,197,94,0.08)',
                  borderColor: 'rgba(34,197,94,0.2)',
                }}
              >
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: '#22c55e' }} />
                <span className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Your insurance details were saved when you signed the rental agreement.
                  No additional action needed.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Submit error ── */}
        <AnimatePresence>
          {submitError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
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

        {/* ── Action Buttons ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onBack}
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
            type="button"
            onClick={handleContinue}
            disabled={!choice || isSubmitting}
            className={`group flex-1 py-4 rounded-full font-medium transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 ${
              !choice || isSubmitting
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:scale-[1.02] hover:-translate-y-px hover:shadow-lg cursor-pointer'
            }`}
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Saving…
              </>
            ) : (
              <>
                Continue to Payment
                <ArrowRight
                  size={18}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
