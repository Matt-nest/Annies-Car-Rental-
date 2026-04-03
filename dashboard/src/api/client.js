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

export const api = {
  // Vehicles
  getVehicles: (params = {}) => request(`/vehicles?${new URLSearchParams(params)}`),
  getVehicle: (id) => request(`/vehicles/${id}`),
  createVehicle: (body) => request('/vehicles', { method: 'POST', body: JSON.stringify(body) }),
  updateVehicle: (id, body) => request(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateVehicleStatus: (id, status) => request(`/vehicles/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getVehicleAvailability: (id, start, end) => request(`/vehicles/${id}/availability?start=${start}&end=${end}`),
  getBlockedDates: (vehicleId) => request(`/vehicles/${vehicleId}/blocked-dates`),
  addBlockedDates: (vehicleId, body) => request(`/vehicles/${vehicleId}/blocked-dates`, { method: 'POST', body: JSON.stringify(body) }),
  deleteBlockedDate: (id) => request(`/blocked-dates/${id}`, { method: 'DELETE' }),

  // Bookings
  getBookings: (params = {}) => request(`/bookings?${new URLSearchParams(params)}`),
  getBooking: (id) => request(`/bookings/${id}`),
  updateBooking: (id, body) => request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  approveBooking: (id) => request(`/bookings/${id}/approve`, { method: 'POST' }),
  declineBooking: (id, reason) => request(`/bookings/${id}/decline`, { method: 'POST', body: JSON.stringify({ reason }) }),
  cancelBooking: (id, reason, cancelled_by = 'owner') => request(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason, cancelled_by }) }),
  recordPickup: (id, body) => request(`/bookings/${id}/pickup`, { method: 'POST', body: JSON.stringify(body) }),
  recordReturn: (id, body) => request(`/bookings/${id}/return`, { method: 'POST', body: JSON.stringify(body) }),
  completeBooking: (id) => request(`/bookings/${id}/complete`, { method: 'POST' }),
  getBookingTimeline: (id) => request(`/bookings/${id}/timeline`),

  // Customers
  getCustomers: (params = {}) => request(`/customers?${new URLSearchParams(params)}`),
  getCustomer: (id) => request(`/customers/${id}`),
  updateCustomer: (id, body) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  getCustomerBookings: (id) => request(`/customers/${id}/bookings`),

  // Payments
  getPayments: (bookingId) => request(`/bookings/${bookingId}/payments`),
  recordPayment: (bookingId, body) => request(`/bookings/${bookingId}/payments`, { method: 'POST', body: JSON.stringify(body) }),

  // Damage
  fileDamageReport: (bookingId, body) => request(`/bookings/${bookingId}/damage`, { method: 'POST', body: JSON.stringify(body) }),
  getDamageReports: (params = {}) => request(`/damage-reports?${new URLSearchParams(params)}`),

  // Stats
  getOverview: () => request('/stats/overview'),
  getRevenue: (params = {}) => request(`/stats/revenue?${new URLSearchParams(params)}`),
  getVehicleStats: () => request('/stats/vehicles'),
  getUpcoming: () => request('/stats/upcoming'),
  getActivity: (limit = 20) => request(`/stats/activity?limit=${limit}`),

  // Agreements
  getAgreementDetail: (bookingId) => request(`/agreements/${bookingId}/detail`),
  counterSignAgreement: (bookingId, signatureData) =>
    request(`/agreements/${bookingId}/counter-sign`, {
      method: 'POST',
      body: JSON.stringify({ signature_data: signatureData, signature_type: 'drawn' }),
    }),

  // File uploads (multipart — no JSON content-type)
  uploadVehicleImage: async (file) => {
    const authHeader = await getAuthHeader();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/uploads/vehicle-image`, {
      method: 'POST',
      headers: { ...authHeader },
      body: form,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
};
