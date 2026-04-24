import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, FileText, Shield, CreditCard, Check, AlertCircle } from 'lucide-react';

interface Props {
  currentStep: 'agreement' | 'insurance' | 'payment' | 'confirming' | 'done';
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const steps = [
  { key: 'agreement',  label: 'Submitting your agreement…',    icon: FileText },
  { key: 'insurance',  label: 'Recording insurance details…',  icon: Shield },
  { key: 'payment',    label: 'Processing payment…',           icon: CreditCard },
  { key: 'confirming', label: 'Confirming your booking…',      icon: Check },
];

export default function SubmitLoader({ currentStep, error, onRetry, onDismiss }: Props) {
  const currentIdx = steps.findIndex(s => s.key === currentStep);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl border p-6 space-y-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        <h3 className="text-lg font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
          {error ? 'Something went wrong' : 'Finalizing Your Booking'}
        </h3>

        {!error ? (
          <div className="space-y-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentIdx;
              const isDone = idx < currentIdx;
              const isPending = idx > currentIdx;

              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300"
                    style={{
                      backgroundColor: isDone
                        ? 'rgba(34,197,94,0.15)'
                        : isActive
                          ? 'var(--accent-glow)'
                          : 'rgba(255,255,255,0.05)',
                      color: isDone
                        ? '#22c55e'
                        : isActive
                          ? 'var(--accent-color)'
                          : 'var(--text-tertiary)',
                    }}
                  >
                    {isDone ? (
                      <Check size={16} />
                    ) : isActive ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Icon size={16} />
                    )}
                  </div>
                  <span
                    className="text-sm transition-colors duration-300"
                    style={{
                      color: isDone
                        ? '#22c55e'
                        : isActive
                          ? 'var(--text-primary)'
                          : 'var(--text-tertiary)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {isDone ? step.label.replace('…', ' ✓') : step.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl border text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex gap-3">
              {onDismiss && (
                <button type="button" onClick={onDismiss}
                  className="flex-1 py-3 rounded-full font-medium border cursor-pointer transition-all"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                  Go Back
                </button>
              )}
              {onRetry && (
                <button type="button" onClick={onRetry}
                  className="flex-1 py-3 rounded-full font-medium cursor-pointer transition-all"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}>
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}

        {!error && (
          <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
            Please don't close this page…
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
