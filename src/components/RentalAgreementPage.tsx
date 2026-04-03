import { motion } from 'motion/react';
import { FileText, ArrowLeft } from 'lucide-react';
import { RENTAL_TERMS } from '../data/rentalTerms';
import { useTheme } from '../App';
import Navbar from './Navbar';
import Footer from './Footer';

export default function RentalAgreementPage() {
  const { theme } = useTheme();

  return (
    <>
      <Navbar onNavigate={() => { window.location.href = '/'; }} />
      <div
        className="min-h-screen px-4 sm:px-6 py-20 sm:py-28"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}
            >
              <FileText size={24} />
            </div>
            <h1
              className="text-3xl sm:text-4xl font-light mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              Rental Agreement{' '}
              <span className="font-serif italic" style={{ color: 'var(--accent-color)' }}>
                Terms & Conditions
              </span>
            </h1>
            <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              Annie's Car Rental — Port St. Lucie, FL
            </p>
          </motion.div>

          {/* Terms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-2xl border p-6 sm:p-8 space-y-6"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {RENTAL_TERMS.map((term) => (
              <div key={term.number}>
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {term.number}. {term.title}
                </h3>
                <p
                  className="text-xs sm:text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {term.text}
                </p>
              </div>
            ))}
          </motion.div>

          {/* Back */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center"
          >
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent-color)' }}
            >
              <ArrowLeft size={16} />
              Back to Home
            </a>
          </motion.div>
        </div>
      </div>
      <Footer />
    </>
  );
}
