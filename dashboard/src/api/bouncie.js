/**
 * Bouncie admin API client — mirrors backend /api/v1/admin/bouncie/* routes.
 * All requests are authed via the shared Supabase JWT header injected in client.js.
 */
import { supabase } from '../auth/supabaseClient';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function request(path, options = {}) {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${BASE}/admin/bouncie${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, data: err });
  }
  return res.json();
}

export const bouncieApi = {
  status:        () => request('/status'),
  startConnect:  () => request('/oauth/start'),
  disconnect:    () => request('/disconnect', { method: 'POST' }),
  sync:          () => request('/sync',       { method: 'POST' }),
  stats:         () => request('/stats'),

  getVehicles:   () => request('/vehicles'),
  setMapping:    (id, annie_vehicle_id) =>
    request(`/vehicles/${id}/mapping`, { method: 'PATCH', body: JSON.stringify({ annie_vehicle_id }) }),

  getTrips:      (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/trips${qs ? `?${qs}` : ''}`);
  },
  refreshTrips:  (body = {}) => request('/trips/refresh', { method: 'POST', body: JSON.stringify(body) }),

  getEvents:     (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/events${qs ? `?${qs}` : ''}`);
  },

  listGeozones:  () => request('/geozones'),
  createGeozone: (body) => request('/geozones', { method: 'POST', body: JSON.stringify(body) }),
  deleteGeozone: (id)   => request(`/geozones/${id}`, { method: 'DELETE' }),
};
