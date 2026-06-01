import { useId } from 'react';
import { motion } from 'motion/react';
import { RateMode } from '../../types';

interface RateToggleProps {
  value: RateMode;
  onChange: (mode: RateMode) => void;
  compact?: boolean;
}

const OPTIONS: { value: RateMode; label: string }[] = [
  { value: 'daily',   label: 'Daily'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
];

export default function RateToggle({ value, onChange, compact = false }: RateToggleProps) {
  const uid = useId();

  return (
    <div
      className="inline-flex items-center relative rounded-full p-1 gap-0.5"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
      }}
      role="group"
      aria-label="Rate period"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`relative z-10 rounded-full font-medium tracking-wide transition-colors duration-200 cursor-pointer ${
            compact ? 'px-3.5 py-1.5 text-xs' : 'px-5 py-2 text-sm'
          }`}
          style={{
            color: value === opt.value ? '#0a0a0a' : 'var(--text-secondary)',
          }}
          aria-pressed={value === opt.value}
        >
          {value === opt.value && (
            <motion.span
              layoutId={`rate-pill-${uid}`}
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: 'var(--accent-color)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
