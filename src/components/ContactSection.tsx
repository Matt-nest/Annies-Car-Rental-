import { Phone, MapPin, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../App';
import { EASE } from '../utils/motion';

interface ContactSectionProps {
  onBrowseFleet: () => void;
}

export default function ContactSection({ onBrowseFleet }: ContactSectionProps) {
  const { theme } = useTheme();

  return (
    <section id="contact" className="py-20 sm:py-36 px-4 sm:px-6 max-w-7xl mx-auto" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: EASE.dramatic }}
        className="rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[3rem] p-6 sm:p-8 md:p-16 overflow-hidden relative border"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="relative z-10 grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div>
            <span className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block" style={{ color: 'var(--text-tertiary)' }}>
              Get In Touch
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light mb-4 sm:mb-6 tracking-tight">
              Ready to drive?
            </h2>
            <p className="text-base sm:text-lg mb-8 sm:mb-10 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Browse our fleet and submit a request, or call us directly.
              Serving Port St. Lucie and the Treasure Coast — we respond quickly during business hours.
            </p>
            <div className="space-y-4 sm:space-y-5">
              <a href="tel:+1234567890" className="flex items-center gap-3 sm:gap-4 text-base sm:text-lg font-medium transition-opacity hover:opacity-70 group">
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-transform duration-500 group-hover:scale-110"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  <Phone size={18} />
                </div>
                (123) 456-7890
              </a>
              <a href="sms:+1234567890" className="flex items-center gap-3 sm:gap-4 text-base sm:text-lg font-medium transition-opacity hover:opacity-70 group">
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border transition-transform duration-500 group-hover:scale-110"
                  style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)' }}
                >
                  <MessageSquare size={18} />
                </div>
                Text Us
              </a>
              <div className="flex items-center gap-3 sm:gap-4 text-base sm:text-lg font-medium">
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border"
                  style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)' }}
                >
                  <MapPin size={18} />
                </div>
                Port St. Lucie, FL
              </div>
            </div>
          </div>

          <div className="text-center space-y-5 sm:space-y-6">
            <p className="text-[11px] uppercase tracking-[0.3em] font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Or get started now
            </p>
            <button
              onClick={onBrowseFleet}
              className="w-full py-4 sm:py-5 rounded-full font-medium transition-all duration-500 active:scale-95 hover:scale-[1.02] hover:shadow-xl text-base sm:text-lg"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              Browse Fleet
            </button>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Submit your first request in under 2 minutes
            </p>
          </div>
        </div>

        {/* Decorative gradient */}
        <div
          className="absolute top-0 right-0 w-1/2 h-full pointer-events-none"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(to left, rgba(255,255,255,0.015), transparent)'
              : 'linear-gradient(to left, rgba(0,0,0,0.015), transparent)',
          }}
        />
      </motion.div>
    </section>
  );
}
