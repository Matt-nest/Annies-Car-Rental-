import { motion } from 'motion/react';
import { Check, FileCheck2, Key, Car, ClipboardCheck, Star } from 'lucide-react';

type BookingStatus =
  | 'pending_approval'
  | 'approved'
  | 'confirmed'
  | 'ready_for_pickup'
  | 'active'
  | 'returned'
  | 'completed'
  | 'cancelled'
  | 'declined';

interface Step {
  key: 'confirmed' | 'pickup' | 'during' | 'return' | 'complete';
  label: string;
  icon: typeof Check;
}

const STEPS: Step[] = [
  { key: 'confirmed', label: 'Confirmed', icon: FileCheck2 },
  { key: 'pickup', label: 'Pickup', icon: Key },
  { key: 'during', label: 'Driving', icon: Car },
  { key: 'return', label: 'Return', icon: ClipboardCheck },
  { key: 'complete', label: 'Complete', icon: Star },
];

function currentStepIndex(status: BookingStatus): number {
  switch (status) {
    case 'pending_approval':
      return -1;
    case 'approved':
    case 'confirmed':
      return 0;
    case 'ready_for_pickup':
      return 1;
    case 'active':
      return 2;
    case 'returned':
      return 3;
    case 'completed':
      return 4;
    case 'cancelled':
    case 'declined':
      return -1;
  }
}

interface BookingTimelineStepperProps {
  status: BookingStatus;
}

export default function BookingTimelineStepper({ status }: BookingTimelineStepperProps) {
  const current = currentStepIndex(status);
  if (current === -1 && (status === 'cancelled' || status === 'declined')) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="scroll-x-contained no-scrollbar max-w-full"
      aria-label="Trip progress"
    >
      <div className="flex items-start justify-between gap-1 min-w-[320px] px-1">
        {STEPS.map((step, i) => {
          const isPast = current > i;
          const isCurrent = current === i;
          const isFuture = current < i;
          const Icon = isPast ? Check : step.icon;
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center gap-2 relative">
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-3 left-[calc(50%+18px)] right-[calc(-50%+18px)] h-[2px] rounded"
                  style={{
                    backgroundColor: isPast || isCurrent ? 'var(--accent-color)' : 'var(--border-subtle)',
                    opacity: isPast || isCurrent ? 1 : 0.6,
                  }}
                />
              )}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 relative z-10 transition-colors"
                style={{
                  backgroundColor: isPast
                    ? 'var(--accent-color)'
                    : isCurrent
                      ? 'var(--bg-elevated)'
                      : 'var(--bg-card)',
                  border: isCurrent
                    ? '2px solid var(--accent-color)'
                    : isPast
                      ? '2px solid var(--accent-color)'
                      : '2px solid var(--border-subtle)',
                  boxShadow: isCurrent ? '0 0 0 4px color-mix(in srgb, var(--accent-color) 12%, transparent)' : 'none',
                }}
              >
                <Icon
                  size={12}
                  strokeWidth={isPast ? 2.4 : 1.8}
                  style={{
                    color: isPast
                      ? '#fff'
                      : isCurrent
                        ? 'var(--accent-color)'
                        : 'var(--text-tertiary)',
                  }}
                />
              </div>
              <span
                className="text-[10px] font-semibold tracking-wide text-center whitespace-nowrap"
                style={{
                  color: isFuture
                    ? 'var(--text-tertiary)'
                    : isCurrent
                      ? 'var(--accent-color)'
                      : 'var(--text-secondary)',
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
