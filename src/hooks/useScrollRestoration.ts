import { useEffect, useRef } from 'react';

/**
 * Scroll-position restoration for the customer portal's state-machine router.
 *
 * The portal doesn't use react-router; it tracks the visible "page" in
 * useState and patches the URL via window.history.pushState. Native browser
 * scroll restoration doesn't apply because the DOM is always at `/` from the
 * router's perspective - the page tree just swaps below.
 *
 * Behaviour:
 *  - Saves `window.scrollY` keyed by page name on every settle (rAF-throttled).
 *  - When `currentPage` changes, restores the saved scroll position IF this
 *    was a POP navigation (back/forward button). PUSH navigations should
 *    scroll to top via the existing `window.scrollTo(0, 0)` calls in the
 *    handlers (so user-initiated transitions still feel intentional).
 *
 * To opt into restoration on a specific transition, set `isPop` to true via
 * the returned `markPop()` function inside your popstate handler before
 * calling setCurrentPage().
 */
export function useScrollRestoration<TPage extends string>(currentPage: TPage) {
  const positions = useRef<Map<TPage, number>>(new Map());
  const prevPage = useRef<TPage>(currentPage);
  const wasPop = useRef(false);

  // Save window.scrollY throughout the lifetime of the current page.
  useEffect(() => {
    let frameId = 0;
    const onScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        positions.current.set(currentPage, window.scrollY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', onScroll);
    };
  }, [currentPage]);

  // On page change: if it was a POP, restore. Otherwise leave to the handler
  // (which typically calls window.scrollTo(0,0) to land the user at the top
  // of the new screen).
  useEffect(() => {
    if (prevPage.current !== currentPage) {
      if (wasPop.current) {
        const saved = positions.current.get(currentPage);
        if (saved != null) {
          // rAF gives the AnimatePresence exit→enter one frame to render
          // before we adjust scrollY, so we don't fight the transition.
          requestAnimationFrame(() => {
            window.scrollTo({ top: saved, behavior: 'instant' as ScrollBehavior });
          });
        }
        wasPop.current = false;
      }
      prevPage.current = currentPage;
    }
  }, [currentPage]);

  /** Call this inside your popstate handler before setCurrentPage(). */
  const markPop = () => {
    wasPop.current = true;
  };

  return { markPop };
}
