import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, ArrowRight } from 'lucide-react';
import { EASE, DURATION } from '../../../utils/motion';
import Navbar from '../../layout/Navbar';
import Footer from '../../layout/Footer';
import FormField from '../../common/FormField';

interface MissingRefScreenProps {
  scrollToSection: (section: string) => void;
  theme: string;
}

/**
 * Shown when no ?ref= parameter is present.
 * Allows the user to manually enter their booking reference code.
 */
export default function MissingRefScreen({ scrollToSection, theme }: MissingRefScreenProps) {
  const [manualRef, setManualRef] = useState('');
  const [manualTouched, setManualTouched] = useState(false);
  const [manualError, setManualError] = useState('');

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
              <FormField
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
