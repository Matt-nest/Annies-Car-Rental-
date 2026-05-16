import { useEffect, useState } from 'react';

/**
 * useMediaQuery — subscribes to a CSS media query and returns its current
 * match state. Used to conditionally mount different React trees on mobile
 * vs desktop (rather than CSS hide/show, which would mount BOTH trees and
 * cause stateful children — file inputs, form refs, photo uploaders — to
 * exist twice and race each other).
 *
 * SSR-safe: returns the `initialValue` on first render, then syncs to the
 * real match state once `window.matchMedia` is available. Vite SPAs render
 * entirely in the browser so this is mostly a defensive default.
 */
export function useMediaQuery(query: string, initialValue: boolean = false): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
