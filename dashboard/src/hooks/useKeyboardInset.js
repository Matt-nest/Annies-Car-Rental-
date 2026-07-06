import { useEffect, useState } from 'react';

/**
 * useKeyboardInset — returns the number of pixels currently occluded by the
 * iOS / Android software keyboard. Returns 0 on desktop and when the keyboard
 * is closed.
 *
 * Why this exists: on iOS Safari the visual viewport shrinks when the
 * keyboard opens, but CSS `100dvh` and `100vh` do NOT shrink — they continue
 * to report the viewport without the keyboard. Layouts with a fixed-bottom
 * compose / submit button end up underneath the keyboard.
 *
 * The fix: use the `visualViewport` API (Safari 13+, Chrome 61+) to read the
 * keyboard height and push the affected element up by that amount.
 *
 * Returns 0 on server / when visualViewport is missing — components stay
 * functional, just without the iOS-specific fix.
 *
 * Mirror of the customer portal's src/hooks/useKeyboardInset.ts so both apps
 * speak the same keyboard-aware vocabulary.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return undefined;
    const vv = window.visualViewport;

    const update = () => {
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop,
      );
      setInset(keyboardHeight);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
