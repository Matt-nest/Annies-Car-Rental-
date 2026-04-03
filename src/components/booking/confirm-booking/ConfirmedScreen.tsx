import { motion } from 'motion/react';
import { CheckCircle2, Home } from 'lucide-react';
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
