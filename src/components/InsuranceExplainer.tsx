import { Info } from 'lucide-react';
import bonzahLogo from '../assets/bonzah-logo.png';

export default function InsuranceExplainer() {
  return (
    <div
      className="rounded-2xl border p-6 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Header: Bonzah logo + heading */}
      <div className="flex items-center gap-4">
        <a
          href="https://bonzah.com/faq"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Bonzah — Rental Car Insurance Partner (opens in new tab)"
          className="shrink-0 transition-opacity duration-150 hover:opacity-80 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outline: 'none' }}
        >
          <div
            className="p-2 rounded-xl overflow-hidden shrink-0"
            style={{
              backgroundColor: 'var(--bg-card-hover)',
              border: '1px solid var(--border-subtle)',
              width: '52px',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={bonzahLogo}
              alt="Bonzah — Rental Car Insurance Partner"
              style={{
                width: '36px',
                height: '36px',
                objectFit: 'contain',
                mixBlendMode: 'screen',
              }}
            />
          </div>
        </a>
        <div>
          <h4 className="font-medium text-sm">Insurance by Bonzah</h4>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Coverage options available after approval
          </p>
        </div>
      </div>

      {/* Info bullets */}
      <div className="space-y-3 pt-2">
        <div className="flex items-start gap-3 text-sm">
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-secondary)' }} className="leading-relaxed">
            We've partnered with Bonzah to offer affordable rental insurance. Collision damage
            coverage up to $35,000, liability protection, and personal accident insurance — all
            purchased before your trip at a fraction of the rental counter price.
          </p>
        </div>
        <div className="flex items-start gap-3 text-sm">
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-secondary)' }} className="leading-relaxed">
            You can bring your own coverage or choose a Bonzah plan starting from $7.99/day.
            We'll walk you through your options after your booking is confirmed — no insurance
            purchase is required upfront.
          </p>
        </div>
      </div>

      {/* Disclaimer box */}
      <div
        className="rounded-xl border p-4 text-xs leading-relaxed"
        style={{
          backgroundColor: 'var(--bg-card-hover)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-tertiary)',
        }}
      >
        No insurance purchase is required at the time of request. All coverage details are
        finalized after availability is confirmed.{' '}
        <a
          href="https://bonzah.com/faq"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View Bonzah insurance FAQ (opens in new tab)"
          className="cursor-pointer transition-colors duration-150 hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-1"
          style={{ color: 'var(--accent-color)' }}
        >
          View Bonzah's FAQ →
        </a>
      </div>
    </div>
  );
}
