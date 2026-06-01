import { supabase } from '../auth/supabaseClient';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function request(path, options = {}) {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${BASE}${path}`, {
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

async function downloadBlob(path) {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...authHeader },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Download failed'), { status: res.status });
  }

  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const match = cd.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : 'brand.env';

  // Trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const brandsApi = {
  list:      ()           => request('/brands'),
  get:       (id)         => request(`/brands/${id}`),
  create:    (data)       => request('/brands', { method: 'POST', body: JSON.stringify(data) }),
  update:    (id, data)   => request(`/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove:    (id)         => request(`/brands/${id}`, { method: 'DELETE' }),
  exportEnv: (id)         => downloadBlob(`/brands/${id}/env`),
};
