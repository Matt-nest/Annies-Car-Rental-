import { ChevronUp, Menu } from 'lucide-react';

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
    ? { color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', backgroundColor: 'var(--bg-elevated)' }
    : { color: 'var(--text-primary)', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-elevated)' };

  function openMenu() {
    window.dispatchEvent(new CustomEvent('dashboard:open-mobile-menu'));
  }

  return (
    <div
      data-mobile-taskbar
      className="md:hidden fixed inset-x-0 z-[130] pointer-events-none safe-x px-4"
      style={{ bottom: 'calc(var(--bottom-nav-offset) + 0.75rem)' }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2">
        <button
          type="button"
          onClick={openMenu}
          aria-label="Open full navigation menu"
          className="tap-target flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-2xl transition-transform active:scale-95"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-medium)',
            boxShadow: '0 10px 30px rgba(15,23,42,0.22)',
          }}
        >
          <Menu size={22} />
        </button>

        {secondaryLabel && SecondaryIcon && (
          <button
            type="button"
            onClick={onSecondary}
            disabled={disabled}
            aria-label={secondaryLabel}
            className="tap-target flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-xl transition-transform active:scale-95 disabled:opacity-50"
            style={{
              ...secondaryStyle,
              boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
            }}
          >
            <SecondaryIcon size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={onPrimary}
          disabled={disabled}
          className="tap-target flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-2xl transition-transform active:scale-95 disabled:opacity-50"
          style={{
            ...primaryStyle,
            boxShadow: '0 10px 30px rgba(15,23,42,0.28)',
          }}
        >
          <span className="min-w-0 truncate">{primaryLabel}</span>
          <PrimaryIcon size={18} className="shrink-0" />
        </button>
      </div>
    </div>
  );
}
