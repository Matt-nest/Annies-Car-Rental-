import { Phone } from 'lucide-react';
import { useTheme } from '../App';

export default function MobileStickyCTA() {
  const { theme } = useTheme();

  return (
    <div className="fixed bottom-0 inset-x-0 z-[150] md:hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <a
        href="tel:+1234567890"
        className="flex items-center justify-center gap-2 w-full py-4 rounded-full font-medium shadow-2xl active:scale-95 transition-all duration-300 text-sm"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-fg)',
          boxShadow: theme === 'dark'
            ? '0 -4px 30px rgba(0,0,0,0.5)'
            : '0 -4px 30px rgba(0,0,0,0.12)',
        }}
      >
        <Phone size={16} /> Call or Text
      </a>
    </div>
  );
}
