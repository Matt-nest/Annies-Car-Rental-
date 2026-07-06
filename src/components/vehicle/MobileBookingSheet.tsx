import { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { useTheme } from '../../context/ThemeContext';

/**
 * MobileBookingSheet — a Vaul bottom sheet that hosts the existing booking
 * wizard (RequestToBookForm) on mobile, opened from the sticky "Book Now" bar.
 *
 * It is intentionally a thin shell: it does NOT reimplement any booking logic —
 * it just presents the same wizard as an app-style modal. The `${theme}` class
 * is applied to the portaled content so the app's CSS-variable tokens
 * (--bg-elevated, --accent, …) resolve inside the body portal.
 *
 * Vaul provides drag-to-dismiss, body-scroll lock, focus trap, ESC, and
 * overlay-click dismiss out of the box.
 */
interface MobileBookingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export default function MobileBookingSheet({ open, onOpenChange, children }: MobileBookingSheetProps) {
  const { theme } = useTheme();

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-[300]"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        />
        <Drawer.Content
          aria-describedby={undefined}
          className={`fixed bottom-0 inset-x-0 z-[310] flex flex-col rounded-t-3xl outline-none mx-auto ${theme}`}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderTop: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            maxHeight: '94dvh',
            maxWidth: '34rem',
          }}
        >
          {/* Drag handle — dismiss also via overlay click + ESC. */}
          <div aria-hidden="true" className="mx-auto my-3 h-1.5 w-12 rounded-full shrink-0" style={{ backgroundColor: 'var(--border-medium)' }} />
          <Drawer.Title className="sr-only">Book this vehicle</Drawer.Title>
          <div
            className="overflow-y-auto overscroll-contain px-4"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
