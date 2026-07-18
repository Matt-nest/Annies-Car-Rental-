import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { EASE_OUT_EXPO } from '../../lib/animation';

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = (e) => setIsMobile('matches' in e ? e.matches : mq.matches);
    update(mq);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isMobile) return undefined;
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open, isMobile]);

  if (isMobile) {
    return (
      <Drawer.Root
        open={open}
        onOpenChange={(next) => { if (!next) onClose?.(); }}
        shouldScaleBackground={false}
        repositionInputs={false}
        setBackgroundColorOnScale={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay
            className="fixed inset-0 z-[100001]"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed bottom-0 inset-x-0 z-[100002] mx-auto flex flex-col rounded-t-3xl outline-none"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderTop: '1px solid var(--border-subtle)',
              maxHeight: '94dvh',
              maxWidth: '34rem',
            }}
          >
            <div
              aria-hidden="true"
              className="mx-auto my-3 h-1.5 w-12 shrink-0 rounded-full"
              style={{ backgroundColor: 'var(--border-medium)' }}
            />
            {title && (
              <Drawer.Title
                className="px-6 pb-3 text-base font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}
              >
                {title}
              </Drawer.Title>
            )}
            <div
              className="overflow-y-auto overscroll-contain glass-scroll px-4 pt-4 sm:px-6"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            >
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100002] flex items-center justify-center p-4">
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
            onClick={onClose}
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
                onClick={onClose}
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
