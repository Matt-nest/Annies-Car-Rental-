import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { EASE } from '../../utils/motion';

export interface FormFieldProps {
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

/**
 * Validated form input with animated error/success states.
 * Extracted from ConfirmBooking — general-purpose reusable field.
 */
export default function FormField({
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
}: FormFieldProps) {
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
