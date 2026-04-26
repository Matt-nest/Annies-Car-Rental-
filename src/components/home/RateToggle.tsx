import { motion } from 'motion/react';
import { RateMode } from '../../types';

interface RateToggleProps {
  value: RateMode;
  onChange: (mode: RateMode) => void;
}

const OPTIONS: { value: RateMode; label: string }[] = [
  { value: 'daily',   label: 'Daily'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
];

export default function RateToggle({ value, onChange }: RateToggleProps) {
  return (
    <div
      className="inline-flex items-center relative rounded-full p-1 gap-0.5"
      style={{
        backgroundColor: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(212,175,55,0.2)',
        backdropFilter: 'blur(12px)',
      }}
      role="group"
      aria-label="Rate period"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="relative z-10 px-5 py-2 rounded-full text-sm font-medium tracking-wide transition-colors duration-200 cursor-pointer"
          style={{
            color: value === opt.value ? '#0a0a0a' : 'rgba(255,255,255,0.65)',
          }}
          aria-pressed={value === opt.value}
        >
          {value === opt.value && (
            <motion.span
              layoutId="rate-pill"
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: '#D4AF37' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
