import { motion } from 'motion/react';
import { CheckCircle2, LayoutDashboard } from 'lucide-react';
import { EASE, DURATION } from '../../../utils/motion';
import Navbar from '../../layout/Navbar';
import Footer from '../../layout/Footer';

interface ConfirmedScreenProps {
  refCode: string;
  scrollToSection: (section: string) => void;
}

/**
 * Success screen shown after the booking is fully confirmed.
 * Features animated checkmark and reference code display.
 */
export default function ConfirmedScreen({ refCode, scrollToSection }: ConfirmedScreenProps) {
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

          {/* What Happens Next */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.78, ease: EASE.standard }}
            className="text-left rounded-xl border p-4 space-y-3"
            style={{ backgroundColor: 'rgba(200,169,126,0.04)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-color)' }}>
              What Happens Next
            </p>
            {[
              { num: 1, text: 'You\'ll receive a confirmation email with your rental details and receipt.' },
              { num: 2, text: 'On your pickup day, Annie will reach out with vehicle location and handoff instructions.' },
              { num: 3, text: 'Complete a quick walk-around inspection and you\'re on your way!' },
            ].map(step => (
              <div key={step.num} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                  style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
                  {step.num}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step.text}</p>
              </div>
            ))}
          </motion.div>

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
              onClick={() => (window.location.href = `/portal?code=${encodeURIComponent(refCode)}`)}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.03] hover:-translate-y-px active:scale-95 mt-4 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              <LayoutDashboard size={16} />
              Go to Customer Portal
            </button>
          </motion.div>
        </motion.div>
      </div>
      <Footer />
    </>
  );
}
