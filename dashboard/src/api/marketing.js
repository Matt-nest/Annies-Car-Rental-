import { supabase } from '../auth/supabaseClient';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/marketing${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Marketing request failed'), { status: res.status, data });
  }
  return data;
}

export const marketingApi = {
  getWorkspace: () => request('/workspace'),
  getSummary: () => request('/summary'),
  createCampaign: (body) => request('/campaigns', { method: 'POST', body: JSON.stringify(body) }),
  updateCampaign: (id, body) => request(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createLink: (body) => request('/links', { method: 'POST', body: JSON.stringify(body) }),
  updateLink: (id, body) => request(`/links/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createReferral: (body) => request('/referrals', { method: 'POST', body: JSON.stringify(body) }),
  updateReferral: (id, body) => request(`/referrals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
