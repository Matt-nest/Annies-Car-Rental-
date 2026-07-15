import { supabase } from '../auth/supabaseClient';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function requestPreview(body) {
  const res = await fetch(`${BASE}/portal/admin-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Could not open customer portal preview'), { status: res.status });
  }
  return data;
}

export const portalPreviewApi = {
  forBooking: (bookingId) => requestPreview({ bookingId }),
  forCustomer: (customerId) => requestPreview({ customerId }),
};
