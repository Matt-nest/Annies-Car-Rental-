import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll-position restoration for a single scroll container (e.g. the dashboard
 * <main> element). react-router-dom v6's built-in `<ScrollRestoration>` only
 * works with the Data Router APIs (createBrowserRouter); we use the classic
 * `<BrowserRouter>` so we implement this manually.
 *
 * Behaviour:
 *  - PUSH / REPLACE navigation: scroll the container back to top.
 *  - POP navigation (back/forward button or back-gesture): restore the
 *    position the user had at that history entry, if any.
 *
 * Persists to sessionStorage so back-nav across full page reloads still works.
 * Throttles writes via requestAnimationFrame so mid-scroll updates don't
 * dominate the main thread.
 *
 * Usage:
 *   const mainRef = useRef(null);
 *   useScrollRestoration(mainRef);
 *   return <main ref={mainRef}>…</main>;
 */
export function useScrollRestoration(scrollElementRef) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const currentKey = useRef(location.key);

  // Save the container's scrollTop on every settle, keyed by location.key.
  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return undefined;

    let frameId = 0;
    const onScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(
            `scroll:${currentKey.current}`,
            String(el.scrollTop),
          );
        } catch {
          /* sessionStorage may be unavailable (Safari Private mode) */
        }
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frameId);
      el.removeEventListener('scroll', onScroll);
    };
  }, [scrollElementRef]);

  // On route change: restore scroll on POP, jump to top on PUSH/REPLACE.
  // useLayoutEffect runs after DOM mutation but before paint, so the user
  // never sees an interim scroll-to-zero flicker before the restore.
  useLayoutEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return;

    currentKey.current = location.key;

    if (navigationType === 'POP') {
      let saved = null;
      try {
        saved = sessionStorage.getItem(`scroll:${location.key}`);
      } catch {
        /* ignore */
      }
      el.scrollTop = saved ? parseInt(saved, 10) || 0 : 0;
    } else {
      el.scrollTop = 0;
    }
  }, [location.key, navigationType, scrollElementRef]);
}
