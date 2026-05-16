import { useEffect, useRef, useState } from 'react';

/**
 * usePullToRefresh — native-feeling pull-down gesture on touch devices.
 *
 * Returns `pullDistance` (0..THRESHOLD) for rendering a visual indicator and
 * `isRefreshing` while the `onRefresh` promise is in flight.
 *
 * Activation rules (matches iOS/Android conventions):
 *   • Only fires when the scroll container is already at top (`scrollY === 0`).
 *   • Pull threshold ~ 80 px; further pulls saturate at THRESHOLD.
 *   • Releases below threshold → snaps back, no refresh.
 *   • Releases above threshold → fires `onRefresh`, holds the indicator until
 *     the promise resolves.
 *
 * Desktop/mouse pointers are ignored — pull-to-refresh is a touch gesture.
 *
 * Caller owns the visual; this hook only exposes state.
 */
const THRESHOLD = 80;

export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function onTouchStart(e: TouchEvent) {
      // Only engage at top of document — anywhere else and we're competing
      // with native scroll which is jarring.
      if (window.scrollY > 0) return;
      startY.current = e.touches[0]?.clientY ?? null;
      trackedRef.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!trackedRef.current || startY.current == null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0) {
        // Pulling up — let native scroll do its thing.
        setPullDistance(0);
        return;
      }
      // Damping factor — heavier pull → smaller incremental movement, like iOS.
      const eased = Math.min(THRESHOLD * 1.5, dy * 0.5);
      setPullDistance(eased);
      // Prevent the rubber-band over-scroll fight with the document.
      if (eased > 4) e.preventDefault();
    }

    function onTouchEnd() {
      if (!trackedRef.current) return;
      trackedRef.current = false;
      startY.current = null;
      if (pullDistance >= THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(THRESHOLD);
        void Promise.resolve(onRefresh())
          .finally(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          });
      } else {
        setPullDistance(0);
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    // touchmove must be NON-passive so we can preventDefault() the rubber band.
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onRefresh, pullDistance]);

  return {
    pullDistance,
    isRefreshing,
    threshold: THRESHOLD,
    /** 0..1 — useful for spinner rotation or progress ring */
    progress: Math.min(1, pullDistance / THRESHOLD),
    /** true once the user has pulled past the trigger point */
    triggered: pullDistance >= THRESHOLD,
  };
}
