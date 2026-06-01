import { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import { VEHICLES as FALLBACK_VEHICLES } from '../data/vehicles';
import { API_URL } from '../config';

let cachedVehicles: Vehicle[] | null = null;

/**
 * Fetches the fleet catalog from the backend API.
 * Falls back to hardcoded data if the API is unreachable.
 */
export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(cachedVehicles || FALLBACK_VEHICLES);
  const [loading, setLoading] = useState(!cachedVehicles);

  useEffect(() => {
    if (cachedVehicles) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/vehicles/catalog`);
        if (!res.ok) throw new Error('API error');
        const data: Vehicle[] = await res.json();
        if (!cancelled && data.length > 0) {
          cachedVehicles = data;
          setVehicles(data);
        }
      } catch {
        // Silently fall back to hardcoded data — API unreachable
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { vehicles, loading };
}

/**
 * Synchronous accessor — returns cached API data or hardcoded fallback.
 * Useful for components that need a vehicle by ID outside of React context.
 */
export function getVehicleByIdSync(id: string): Vehicle | undefined {
  const source = cachedVehicles || FALLBACK_VEHICLES;
  return source.find(v => v.id === id);
}
