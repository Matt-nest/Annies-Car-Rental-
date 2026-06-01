import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api/client';
import { invalidateCache } from './queryCache';

/**
 * AlertsContext — single source of truth for header alert pills.
 *
 * Pills shown (when count > 0): Approve, Counter-Sign, Check-Ins, Active, Inspections.
 * Mutations call refresh() to immediately re-pull counts so pills dismiss without reload.
 *
 * Active pill is transient: only shown when a fresh active-rental transition is
 * unacknowledged. Clearing happens via acknowledgeActive() (modal dismiss).
 */
const AlertsContext = createContext({
  alerts: {},
  refresh: () => Promise.resolve(),
  onActiveRentalStarted: () => () => {},
  acknowledgeActive: () => {},
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
    pickups_today_count: 0,
    has_unacknowledged_active: false,
  });
  const prevActiveRef = useRef(null);
  const subscribersRef = useRef(new Set());

  const refresh = useCallback(async () => {
    invalidateCache('overview');
    try {
      const ov = await api.getOverview();
      setAlerts(prev => {
        const pickupsToday = (ov.pickups_today || []).length;
        const nextActive = ov.active_rentals || 0;
        let hasUnack = prev.has_unacknowledged_active;
        if (prevActiveRef.current != null && nextActive > prevActiveRef.current) {
          const delta = nextActive - prevActiveRef.current;
          hasUnack = true;
          subscribersRef.current.forEach(fn => {
            try { fn({ delta }); } catch { /* swallow */ }
          });
        }
        prevActiveRef.current = nextActive;
        return {
          pending_approvals: ov.pending_approvals || 0,
          pending_agreements: ov.pending_agreements || 0,
          pending_reviews: ov.pending_reviews || 0,
          active_rentals: nextActive,
          pending_inspections: ov.pending_inspections || 0,
          pickups_today_count: pickupsToday,
          has_unacknowledged_active: hasUnack,
        };
      });
    } catch {
      /* swallow */
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

  const acknowledgeActive = useCallback(() => {
    setAlerts(prev => ({ ...prev, has_unacknowledged_active: false }));
  }, []);

  return (
    <AlertsContext.Provider value={{ alerts, refresh, onActiveRentalStarted, acknowledgeActive }}>
      {children}
    </AlertsContext.Provider>
  );
}
