import { useEffect, useState } from 'react';

/**
 * useKeyboardInset - returns the number of pixels currently occluded by the
 * iOS / Android software keyboard. Returns 0 on desktop and when the keyboard
 * is closed.
 *
 * Why this exists: on iOS Safari the visual viewport shrinks when the
 * keyboard opens, but CSS `100dvh` and `100vh` do NOT shrink - they continue
 * to report the viewport without the keyboard. Layouts with a fixed-bottom
 * "Continue" button end up underneath the keyboard.
 *
 * The fix: use the `visualViewport` API (Safari 13+, Chrome 61+, Firefox 91+)
 * to read the keyboard height, and either:
 *   1) push fixed-position elements up by that amount, or
 *   2) add equivalent bottom-padding to the scrollable container so the user
 *      can scroll the Continue button into view.
 *
 * Returns 0 on server / when visualViewport is missing - components stay
 * functional, just without the iOS-specific fix.
 *
 * Reference: https://developer.mozilla.org/docs/Web/API/VisualViewport
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;

    const update = () => {
      // window.innerHeight stays at the full viewport; vv.height shrinks when
      // the keyboard opens. The difference is the keyboard height.
      // vv.offsetTop accounts for cases where the viewport has been scrolled.
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
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
