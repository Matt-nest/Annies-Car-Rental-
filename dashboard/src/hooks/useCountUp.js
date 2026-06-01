import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number from 0 to `target` over `duration` ms.
 * Respects prefers-reduced-motion.
 * Returns the target unchanged if it's not a finite number.
 */
export function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined) return;

    const num =
      typeof target === 'number'
        ? target
        : parseFloat(String(target).replace(/[^0-9.]/g, ''));

    if (isNaN(num) || num === 0) {
      setVal(target);
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target);
      return;
    }

    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      // Quartic ease-out
      const e = 1 - Math.pow(1 - p, 4);
      setVal(Math.round(e * num));
      if (p < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        setVal(target);
      }
    };

    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return val;
}
