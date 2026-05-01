/**
 * Bonzah admin API client. Sibling of api/client.js — keeps the Phase 4
 * dashboard surfaces fully decoupled from the 25-consumer main client.
 *
 * All endpoints under /admin/bonzah/* require Bearer auth. Auth header is
 * obtained the same way client.js does it: from the active Supabase session.
 */

import { supabase } from '../auth/supabaseClient';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()), ...options.headers };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, data: err });
  }
  return res.json();
}

export const bonzahApi = {
  health: () => request('/admin/bonzah/health'),
  getSettings: () => request('/admin/bonzah/settings'),
  putSettings: (body) => request('/admin/bonzah/settings', { method: 'PUT', body: JSON.stringify(body) }),
  getEvents: ({ limit = 50, bookingId, errorsOnly } = {}) => {
    const qs = new URLSearchParams();
    if (limit) qs.set('limit', limit);
    if (bookingId) qs.set('booking_id', bookingId);
    if (errorsOnly) qs.set('errors_only', '1');
    return request(`/admin/bonzah/events?${qs.toString()}`);
  },
  listPolicies: ({ status } = {}) => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    const q = qs.toString();
    return request(`/admin/bonzah/policies${q ? `?${q}` : ''}`);
  },
  stats: () => request('/admin/bonzah/stats'),
  refreshBookingPolicy: (bookingId) =>
    request(`/admin/bonzah/booking/${bookingId}/refresh`, { method: 'POST' }),
  cancelBookingPolicy: (bookingId, remarks) =>
    request(`/admin/bonzah/booking/${bookingId}/cancel`, { method: 'POST', body: JSON.stringify({ remarks }) }),

  /**
   * Download a policy PDF as a blob and trigger a browser download.
   * Bonzah's PDF endpoint requires our backend in-auth-token, so we proxy.
   */
  downloadBookingPdf: async (bookingId, coverage) => {
    const headers = await authHeader();
    const res = await fetch(`${BASE}/admin/bonzah/booking/${bookingId}/pdf/${coverage}`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw Object.assign(new Error(err.error || 'PDF download failed'), { status: res.status });
    }
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const match = /filename="([^"]+)"/.exec(cd);
    const filename = match?.[1] || `bonzah-${coverage}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
