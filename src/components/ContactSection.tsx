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
    <section id="contact" className="py-36 px-6 max-w-7xl mx-auto" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: EASE.dramatic }}
        className="rounded-[2rem] md:rounded-[3rem] p-8 md:p-16 overflow-hidden relative border"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block" style={{ color: 'var(--text-tertiary)' }}>
              Get In Touch
            </span>
            <h2 className="text-4xl md:text-5xl font-light mb-6 tracking-tight">
              Ready to drive?
            </h2>
            <p className="text-lg mb-10 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Browse our fleet and submit a request, or call us directly.
              Serving Port St. Lucie and the Treasure Coast — we respond quickly during business hours.
            </p>
            <div className="space-y-5">
              <a href="tel:+1234567890" className="flex items-center gap-4 text-lg font-medium transition-opacity hover:opacity-70 group">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-500 group-hover:scale-110"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  <Phone size={20} />
                </div>
                (123) 456-7890
              </a>
              <a href="sms:+1234567890" className="flex items-center gap-4 text-lg font-medium transition-opacity hover:opacity-70 group">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center border transition-transform duration-500 group-hover:scale-110"
                  style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)' }}
                >
                  <MessageSquare size={20} />
                </div>
                Text Us
              </a>
              <div className="flex items-center gap-4 text-lg font-medium">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center border"
                  style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)' }}
                >
                  <MapPin size={20} />
                </div>
                Port St. Lucie, FL
              </div>
            </div>
          </div>

          <div className="text-center space-y-6">
            <p className="text-[11px] uppercase tracking-[0.3em] font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Or get started now
            </p>
            <button
              onClick={onBrowseFleet}
              className="w-full py-5 rounded-full font-medium transition-all duration-500 active:scale-95 hover:scale-[1.02] hover:shadow-xl text-lg"
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
              ? 'linear-gradient(to left, rgba(255,255,255,0.02), transparent)'
              : 'linear-gradient(to left, rgba(0,0,0,0.02), transparent)',
          }}
        />
      </motion.div>
    </section>
  );
}
