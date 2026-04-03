import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';
import { EASE } from '../../../utils/motion';
import { STEPS } from './constants';

interface ProgressStepperProps {
  currentStep: 1 | 2 | 3;
}

export default function ProgressStepper({ currentStep }: ProgressStepperProps) {
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
                    animate={{ width: step.number < currentStep ? '100%' : '0%' }}
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
