import { Phone, MapPin, MessageSquare } from 'lucide-react';
import { useTheme } from '../App';

export default function Footer() {
  const { theme } = useTheme();

  return (
    <footer
      className="py-12 sm:py-16 px-4 sm:px-6"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Top row: Brand + Contact + Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10 mb-10 sm:mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-9 h-9 flex items-center justify-center">
                <div
                  className="absolute inset-0 border rounded-lg rotate-45"
                  style={{ borderColor: 'var(--border-strong)' }}
                />
                <span className="relative text-base font-serif italic" style={{ color: 'var(--text-primary)' }}>A</span>
              </div>
              <div className="flex flex-col -space-y-0.5">
                <span className="text-base font-light tracking-wider" style={{ color: 'var(--text-primary)' }}>Annie's</span>
                <span className="text-[9px] font-medium tracking-[0.3em] uppercase" style={{ color: 'var(--text-tertiary)' }}>
                  Car Rental
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed max-w-[260px]" style={{ color: 'var(--text-secondary)' }}>
              Port St. Lucie's trusted private car rental. Quality vehicles, direct service, flexible terms.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.2em] font-semibold mb-4" style={{ color: 'var(--text-tertiary)' }}>
              Contact
            </h4>
            <div className="space-y-3">
              <a href="tel:+1234567890" className="flex items-center gap-3 text-sm transition-opacity hover:opacity-70 group">
                <Phone size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>(123) 456-7890</span>
              </a>
              <a href="sms:+1234567890" className="flex items-center gap-3 text-sm transition-opacity hover:opacity-70">
                <MessageSquare size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Text Us</span>
              </a>
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Port St. Lucie, FL</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.2em] font-semibold mb-4" style={{ color: 'var(--text-tertiary)' }}>
              Legal
            </h4>
            <div className="flex flex-col gap-3">
              {['Terms of Service', 'Privacy Policy', 'Rental Agreement'].map((link) => (
                <a
                  key={link}
                  href="#"
                  className="nav-link text-sm"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div
          className="pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs sm:text-sm"
          style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
        >
          <p>© {new Date().getFullYear()} Annie's Car Rental. All rights reserved.</p>
          <p>Port St. Lucie, FL · Treasure Coast</p>
        </div>
      </div>
    </footer>
  );
}
