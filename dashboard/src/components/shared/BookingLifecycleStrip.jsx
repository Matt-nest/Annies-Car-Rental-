import { CheckCircle2, Circle, ClipboardCheck } from 'lucide-react';
import { BOOKING_LIFECYCLE_STEPS, getBookingLifecycle, toneClasses } from '../../lib/bookingOps';

export default function BookingLifecycleStrip({ booking, onPrimaryAction }) {
  const lifecycle = getBookingLifecycle(booking);
  const tone = toneClasses(lifecycle.tone);
  const activeStep = Math.max(0, lifecycle.step);

  return (
    <section className={`rounded-xl border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 w-9 h-9 rounded-lg border ${tone.border} ${tone.bg} flex items-center justify-center shrink-0`}>
            <ClipboardCheck size={17} className={tone.text} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-sm font-semibold ${tone.text}`}>{lifecycle.label}</p>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-tertiary)]">
                Step {activeStep || '-'} of {BOOKING_LIFECYCLE_STEPS.length}
              </span>
            </div>
            <p className="text-xs mt-1 leading-relaxed text-[var(--text-secondary)]">
              {lifecycle.description}
            </p>
          </div>
        </div>

        {onPrimaryAction && (
          <button type="button" onClick={onPrimaryAction} className="btn-secondary justify-center shrink-0">
            {lifecycle.action}
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-9" aria-label="Booking lifecycle progress">
        {BOOKING_LIFECYCLE_STEPS.map((step, idx) => {
          const stepNumber = idx + 1;
          const complete = activeStep > stepNumber;
          const current = activeStep === stepNumber;
          return (
            <div
              key={step}
              className={`min-h-[54px] rounded-lg border px-2 py-2 flex flex-col justify-between ${
                current
                  ? `${tone.border} bg-[var(--bg-card)]`
                  : complete
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)]/45'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">
                  {stepNumber}
                </span>
                {complete ? (
                  <CheckCircle2 size={12} className="text-emerald-500" />
                ) : (
                  <Circle size={10} className={current ? tone.text : 'text-[var(--text-tertiary)]'} />
                )}
              </div>
              <span className={`text-[11px] font-semibold leading-tight ${current ? tone.text : 'text-[var(--text-secondary)]'}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
