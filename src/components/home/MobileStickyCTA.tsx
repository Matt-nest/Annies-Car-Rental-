import { Phone } from 'lucide-react';
import { brandPhoneDigits } from '../../config/brand';

/**
 * Floating mobile "Call or Text" pill.
 *
 * Intentionally NO background gradient/scrim — the gold pill + soft shadow
 * stand on their own and read cleanly over Annie's dark/light backgrounds.
 */
export default function MobileStickyCTA() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[150] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
      <a
        href={`tel:${brandPhoneDigits}`}
        className="pointer-events-auto flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-semibold shadow-2xl transition-transform duration-300 active:scale-95"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-fg)',
          boxShadow: '0 8px 28px rgba(10,10,10,0.32)',
        }}
      >
        <Phone size={16} /> Call or Text
      </a>
    </div>
  );
}
