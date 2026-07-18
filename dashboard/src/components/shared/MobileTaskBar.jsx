import { ChevronUp } from 'lucide-react';

export default function MobileTaskBar({
  eyebrow,
  title,
  subtitle,
  primaryLabel,
  primaryIcon: PrimaryIcon = ChevronUp,
  secondaryLabel,
  secondaryIcon: SecondaryIcon,
  onPrimary,
  onSecondary,
  primaryTone = 'accent',
  secondaryTone = 'ghost',
  disabled = false,
}) {
  const primaryStyle = primaryTone === 'success'
    ? { backgroundColor: '#22c55e', color: '#fff' }
    : { backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg, #fff)' };

  const secondaryStyle = secondaryTone === 'danger'
    ? { color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }
    : { color: 'var(--text-primary)', border: '1px solid var(--border-medium)' };

  return (
    <div
      data-mobile-taskbar
      className="md:hidden fixed inset-x-0 z-[130] pointer-events-none safe-x"
      style={{ bottom: 'var(--bottom-nav-offset)' }}
    >
      <div
        className="pointer-events-auto border-t px-4 pt-3"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          boxShadow: '0 -12px 36px rgba(15,23,42,0.14)',
          paddingBottom: '0.75rem',
        }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                {eyebrow}
              </p>
            )}
            <p className="truncate text-sm font-semibold leading-tight text-[var(--text-primary)]">
              {title}
            </p>
            {subtitle && (
              <p className="truncate text-[11px] leading-tight text-[var(--text-tertiary)]">
                {subtitle}
              </p>
            )}
          </div>

          {secondaryLabel && SecondaryIcon && (
            <button
              type="button"
              onClick={onSecondary}
              disabled={disabled}
              className="tap-target flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-transparent px-3.5 py-3 text-xs font-semibold shadow-sm active:scale-95 disabled:opacity-50"
              style={secondaryStyle}
            >
              <SecondaryIcon size={15} />
              {secondaryLabel}
            </button>
          )}

          <button
            type="button"
            onClick={onPrimary}
            disabled={disabled}
            className="tap-target flex shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            style={primaryStyle}
          >
            <PrimaryIcon size={17} />
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
