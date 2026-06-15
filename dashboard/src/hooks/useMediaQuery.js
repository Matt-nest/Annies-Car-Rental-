import { useEffect, useState } from 'react';

/**
 * useMediaQuery — subscribe to a CSS media query and re-render on change.
 * SSR-safe (returns false before mount). Used by chart widgets that need
 * JS-driven responsiveness Recharts can't express in CSS (axis widths,
 * tick density, cell counts).
 *
 * @param {string} query - e.g. '(max-width: 479px)'
 * @returns {boolean} whether the query currently matches
 */
export function useMediaQuery(query) {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    // Safari < 14 used addListener/removeListener.
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

/** Convenience: true below the Tailwind `sm` breakpoint (640px). */
export function useIsMobile() {
  return useMediaQuery('(max-width: 639px)');
}
