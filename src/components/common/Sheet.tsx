import { ReactNode } from 'react';
import { Drawer } from 'vaul';

/**
 * Sheet — a Vaul-powered bottom sheet that doubles as a modal on desktop.
 *
 * Why bottom-anchored on every breakpoint:
 *   • Native iOS / Android sheets are bottom-anchored, so this matches the
 *     mobile mental model.
 *   • Drag-to-dismiss works on both mouse and touch.
 *   • On desktop we constrain width so it reads as a focused modal, not a
 *     full-width banner.
 *
 * Accessibility:
 *   • Vaul handles focus trap, body-scroll lock, ESC-to-close, and
 *     overlay-click dismiss out of the box.
 *   • The drag handle has `aria-hidden` because the dismiss affordance is
 *     also exposed via ESC and overlay click.
 *
 * Usage:
 *   <Sheet open={isOpen} onOpenChange={setIsOpen} title="Inquiry">
 *     ... your form content ...
 *   </Sheet>
 */
interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name announced by screen readers when the sheet opens. */
  title?: string;
  children: ReactNode;
  /** Override the desktop max-width. Default `28rem` (~448 px). */
  maxWidth?: string;
}

export default function Sheet({
  open,
  onOpenChange,
  title,
  children,
  maxWidth = '28rem',
}: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-[300]"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed bottom-0 inset-x-0 z-[310] flex flex-col rounded-t-3xl outline-none mx-auto"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderTop: '1px solid var(--border-subtle)',
            maxHeight: '96dvh',
            maxWidth,
          }}
        >
          {/* Drag handle — purely visual; dismiss also via overlay click + ESC. */}
          <div
            aria-hidden="true"
            className="mx-auto my-3 h-1.5 w-12 rounded-full shrink-0"
            style={{ backgroundColor: 'var(--border-medium)' }}
          />
          {/* Title is required for accessibility (Vaul forwards to dialog). */}
          {title && (
            <Drawer.Title className="sr-only">{title}</Drawer.Title>
          )}
          {/* Scrollable content with safe-area-bottom padding so the home
              indicator doesn't sit on top of action buttons. */}
          <div
            className="overflow-y-auto overscroll-contain px-6"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
