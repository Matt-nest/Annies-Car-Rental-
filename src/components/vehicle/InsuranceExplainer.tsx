import { memo } from 'react';
import { Info, ShieldCheck, Scale, HeartPulse, Wallet } from 'lucide-react';
import bonzahLogo from '../../assets/bonzah-logo.svg';

const FAQ_URL = 'https://bonzah.com/faq';

const FEATURES = [
  { icon: ShieldCheck, label: 'Up to $35,000 collision damage' },
  { icon: Scale, label: 'Liability protection' },
  { icon: HeartPulse, label: 'Personal accident & effects' },
  { icon: Wallet, label: 'A fraction of the counter price' },
];

function LogoBadge({ size = 52 }: { size?: number }) {
  return (
    <a
      href={FAQ_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Bonzah, Rental Car Insurance Partner (opens in new tab)"
      className="shrink-0 inline-flex transition-opacity duration-150 hover:opacity-80 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ outline: 'none' }}
    >
      <div
        className="rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', width: size, height: size }}
      >
        <img src={bonzahLogo} alt="Bonzah, Rental Car Insurance Partner" style={{ width: size * 0.66, height: size * 0.66, objectFit: 'contain' }} />
      </div>
    </a>
  );
}

const InsuranceExplainer = memo(function InsuranceExplainer({ horizontal = false }: { horizontal?: boolean }) {
  // ── Horizontal: identity panel (logo + price) | scannable coverage chips ──
  if (horizontal) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-col md:flex-row">
          {/* Identity panel */}
          <div
            className="md:w-60 md:shrink-0 p-5 sm:p-6 flex flex-row md:flex-col items-center md:items-start gap-4 border-b md:border-b-0 md:border-r"
            style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)' }}
          >
            <LogoBadge size={56} />
            <div className="md:mt-1">
              <p className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-tertiary)' }}>Insurance Partner</p>
              <h4 className="font-semibold text-[15px] leading-tight" style={{ color: 'var(--text-primary)' }}>Insurance by Bonzah</h4>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>from</span>
                <span className="text-2xl font-semibold" style={{ color: 'var(--accent-color)' }}>$7.99</span>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>/day</span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Optional · after approval</p>
            </div>
          </div>

          {/* Coverage + reassurance */}
          <div className="flex-1 p-5 sm:p-6 space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Buy affordable coverage <span style={{ color: 'var(--text-primary)' }} className="font-medium">before your trip</span>, at a fraction of the rental-counter price. Bring your own — or add a Bonzah plan and we'll walk you through the options after booking.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-glow)' }}>
                    <Icon size={15} style={{ color: 'var(--accent-color)' }} />
                  </span>
                  <span className="text-[13px] font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 pt-0.5">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                No purchase required upfront — coverage is finalized after availability is confirmed.
              </p>
              <a href={FAQ_URL} target="_blank" rel="noopener noreferrer"
                aria-label="View Bonzah insurance FAQ (opens in new tab)"
                className="text-sm font-medium shrink-0 cursor-pointer transition-colors duration-150 hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-1"
                style={{ color: 'var(--accent-color)' }}>
                View Bonzah's FAQ →
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Vertical (default) — stacked card for narrow columns ──
  return (
    <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-4">
        <LogoBadge />
        <div>
          <h4 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Insurance by Bonzah</h4>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Coverage options available after approval</p>
        </div>
      </div>
      <div className="space-y-2">
        {FEATURES.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2.5 text-sm">
            <Icon size={15} className="shrink-0" style={{ color: 'var(--accent-color)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-4 text-xs leading-relaxed"
        style={{ backgroundColor: 'var(--bg-card-hover)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
        <span className="flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            Plans from $7.99/day. No purchase required upfront — finalized after availability is confirmed.{' '}
            <a href={FAQ_URL} target="_blank" rel="noopener noreferrer"
              className="cursor-pointer transition-colors duration-150 hover:underline underline-offset-2"
              style={{ color: 'var(--accent-color)' }}>
              View Bonzah's FAQ →
            </a>
          </span>
        </span>
      </div>
    </div>
  );
});

export default InsuranceExplainer;
