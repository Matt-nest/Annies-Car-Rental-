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
            <div className="relative inline-flex h-[44px] sm:h-[56px] mb-4">
              {/* Dark mode: white logo */}
              <img
                src="/logo.png"
                alt="Annie's Car Rental"
                className="h-full w-auto object-contain"
                loading="lazy"
                decoding="async"
                style={{
                  opacity: theme !== 'light' ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                  pointerEvents: theme !== 'light' ? 'auto' : 'none',
                }}
              />
              {/* Light mode: same PNG, brightness(0) turns white→black, identical dimensions */}
              <img
                src="/logo.png"
                alt=""
                aria-hidden="true"
                className="absolute top-0 left-0 h-full w-auto object-contain"
                loading="lazy"
                decoding="async"
                style={{
                  filter: 'brightness(0)',
                  opacity: theme === 'light' ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                  pointerEvents: 'none',
                }}
              />
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
              <a href="tel:+17729856667" className="flex items-center gap-3 text-sm transition-opacity hover:opacity-70 group">
                <Phone size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>(772) 985-6667</span>
              </a>
              <a href="sms:+17729856667" className="flex items-center gap-3 text-sm transition-opacity hover:opacity-70">
                <MessageSquare size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Text Us</span>
              </a>
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>586 NW Mercantile Pl, Port St. Lucie, FL 34986</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.2em] font-semibold mb-4" style={{ color: 'var(--text-tertiary)' }}>
              Legal
            </h4>
            <div className="flex flex-col gap-3">
              <a href="#" className="nav-link text-sm">Terms of Service</a>
              <a href="#" className="nav-link text-sm">Privacy Policy</a>
              <a href="/rental-agreement" className="nav-link text-sm">Rental Agreement</a>
              <a
                href="/confirm"
                className="nav-link text-sm"
              >
                Complete Your Booking
              </a>
              <a
                href="https://www.bonzah.com/faq"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link text-sm"
              >
                Bonzah FAQs
              </a>
              <a
                href="https://www.bonzah.com/about"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link text-sm"
              >
                Bonzah: How It Works
              </a>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div
          className="pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs sm:text-sm"
          style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
        >
          <p>© {new Date().getFullYear()} Annie's Car Rental. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <p>Port St. Lucie, FL · Treasure Coast</p>
            <span style={{ opacity: 0.3 }}>·</span>
            <a
              href="http://localhost:5174"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Admin
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
