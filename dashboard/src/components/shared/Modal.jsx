import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { EASE_OUT_EXPO } from '../../lib/animation';

/**
 * Modal — adaptive dialog.
 *
 *   • Mobile  (< md / 768 px): Vaul bottom sheet with drag-to-dismiss + safe-
 *                              area-aware bottom padding. Reads like a native
 *                              iOS / Android sheet.
 *   • Desktop (≥ md):          Classic centered scale-in dialog with blur
 *                              backdrop. Preserved from the original Modal
 *                              implementation so 7 existing consumers (Bookings,
 *                              BookingDetail, Fleet, VehicleDetail, Payments,
 *                              PendingApprovalsWidget, AgreementSection) keep
 *                              their feel on big screens.
 *
 * Consumers don't need to know which variant renders — same props (open,
 * onClose, title, children, maxWidth) work in both modes.
 *
 * Vaul handles focus-trap, body-scroll lock, ESC-to-close, and overlay-click
 * dismiss in the sheet variant. The desktop variant keeps the existing manual
 * body-scroll lock and explicit close button.
 */
export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', isDirty = false }) {
  // Track whether we're on a mobile-width viewport. Defer the initial read
  // to useEffect so SSR / hydration is happy (matchMedia is window-only).
  const [isMobile, setIsMobile] = useState(false);

  // When `isDirty`, guard accidental dismissal so a half-filled form isn't
  // lost to a stray backdrop click / Escape. Opt-in — default preserves the
  // original unconditional close behavior for all existing consumers.
  const requestClose = () => {
    if (isDirty && !window.confirm('Discard your unsaved changes?')) return;
    onClose?.();
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = (e) => setIsMobile('matches' in e ? e.matches : mq.matches);
    update(mq);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Desktop variant handles its own body-scroll lock. Vaul does this in the
  // mobile variant so we don't double-lock.
  useEffect(() => {
    if (isMobile) return undefined;
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open, isMobile]);

  // Desktop Escape-to-close (Vaul already handles ESC in the mobile sheet).
  useEffect(() => {
    if (isMobile || !open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isMobile, onClose, isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Mobile: native-feeling bottom sheet via Vaul ───────────────────── */
  if (isMobile) {
    return (
      <Drawer.Root
        open={open}
        dismissible={!isDirty}
        onOpenChange={(next) => { if (!next) onClose?.(); }}
        /* `shouldScaleBackground` shrinks the page behind the sheet to ~0.94×
           with a subtle blur — iOS's signature affordance when a sheet rises.
           Combined with Vaul's spring physics, the gesture feels native. */
        shouldScaleBackground={true}
        setBackgroundColorOnScale={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay
            className="fixed inset-0 z-[300]"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed bottom-0 inset-x-0 z-[310] flex flex-col rounded-t-3xl outline-none mx-auto"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderTop: '1px solid var(--border-subtle)',
              maxHeight: '92dvh',
              maxWidth: '32rem',
            }}
          >
            {/* Drag handle — visual affordance. Dismiss also via overlay/ESC. */}
            <div
              aria-hidden="true"
              className="mx-auto my-3 h-1.5 w-12 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--border-medium)' }}
            />
            {/* Vaul requires a Drawer.Title for accessibility. */}
            {title && (
              <Drawer.Title
                className="px-6 pb-3 text-base font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}
              >
                {title}
              </Drawer.Title>
            )}
            {/* Scrollable body with safe-area-aware bottom padding. */}
            <div
              className="overflow-y-auto overscroll-contain glass-scroll px-6 pt-4"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            >
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  /* ── Desktop: centered scale-in dialog (preserved from original) ────── */
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0"
            style={{
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
            onClick={requestClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto glass-scroll`}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: '20px',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <h2
                className="text-base font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {title}
              </h2>
              <button
                onClick={requestClose}
                className="flex items-center justify-center rounded-lg transition-all duration-200"
                style={{ width: 32, height: 32, color: 'var(--text-tertiary)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
