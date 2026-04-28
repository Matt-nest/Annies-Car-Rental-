import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api/client';
import { invalidateCache } from './queryCache';

/**
 * AlertsContext — single source of truth for header/sidebar alert badges.
 *
 * Why: prior to this, each badge polled its own data and stale alerts lingered
 * after a mutation (approve / decline / complete inspection) until the next 30s
 * poll. Mutating components now call `useAlerts().refresh()` to dirty-invalidate
 * the overview cache and re-pull alert counts immediately.
 *
 * Polling interval kept at 30s as a fallback; mutations short-circuit the wait.
 *
 * Detected events:
 *  - `onActiveRentalStarted(callback)` — fires when `active_rentals` increments
 *    between two polls. Used to trigger the cash-rain confirmation overlay.
 */
const AlertsContext = createContext({
  alerts: {},
  refresh: () => Promise.resolve(),
  onActiveRentalStarted: () => () => {},
});

export function useAlerts() {
  return useContext(AlertsContext);
}

export function AlertsProvider({ children }) {
  const [alerts, setAlerts] = useState({
    pending_approvals: 0,
    pending_agreements: 0,
    pending_reviews: 0,
    active_rentals: 0,
    pending_inspections: 0,
  });
  const prevActiveRef = useRef(null);
  const subscribersRef = useRef(new Set());

  const refresh = useCallback(async () => {
    invalidateCache('overview');
    try {
      const ov = await api.getOverview();
      const next = {
        pending_approvals: ov.pending_approvals || 0,
        pending_agreements: ov.pending_agreements || 0,
        pending_reviews: ov.pending_reviews || 0,
        active_rentals: ov.active_rentals || 0,
        pending_inspections: ov.pending_inspections || 0,
      };
      // Detect a fresh active-rental transition between polls.
      if (prevActiveRef.current != null && next.active_rentals > prevActiveRef.current) {
        const delta = next.active_rentals - prevActiveRef.current;
        subscribersRef.current.forEach(fn => {
          try { fn({ delta }); } catch { /* swallow */ }
        });
      }
      prevActiveRef.current = next.active_rentals;
      setAlerts(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const onActiveRentalStarted = useCallback((cb) => {
    subscribersRef.current.add(cb);
    return () => subscribersRef.current.delete(cb);
  }, []);

  return (
    <AlertsContext.Provider value={{ alerts, refresh, onActiveRentalStarted }}>
      {children}
    </AlertsContext.Provider>
  );
}
