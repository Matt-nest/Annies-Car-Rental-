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
  deleteVehicle: (id) => request(`/vehicles/${id}`, { method: 'DELETE' }),
  updateVehicleStatus: (id, status) => request(`/vehicles/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getVehicleAvailability: (id, start, end) => request(`/vehicles/${id}/availability?start=${start}&end=${end}`),
  getBlockedDates: (vehicleId) => request(`/vehicles/${vehicleId}/blocked-dates`),
  addBlockedDates: (vehicleId, body) => request(`/vehicles/${vehicleId}/blocked-dates`, { method: 'POST', body: JSON.stringify(body) }),
  deleteBlockedDate: (id) => request(`/blocked-dates/${id}`, { method: 'DELETE' }),

  // Bookings
  getBookings: (params = {}) => request(`/bookings?${new URLSearchParams(params)}`),
  getBooking: (id) => request(`/bookings/${id}`),
  updateBooking: (id, body) => request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateInsuranceStatus: (id, status, policyId) => request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify({ insurance_status: status, ...(policyId ? { bonzah_policy_id: policyId } : {}) }) }),
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
  getAllPayments: (params = {}) => request(`/payments?${new URLSearchParams(params)}`),
  getPayments: (bookingId) => request(`/bookings/${bookingId}/payments`),
  recordPayment: (bookingId, body) => request(`/bookings/${bookingId}/payments`, { method: 'POST', body: JSON.stringify(body) }),
  issueRefund: (paymentId, body) => request(`/payments/${paymentId}/refund`, { method: 'POST', body: JSON.stringify(body) }),

  // Damage
  fileDamageReport: (bookingId, body) => request(`/bookings/${bookingId}/damage`, { method: 'POST', body: JSON.stringify(body) }),
  getDamageReports: (params = {}) => request(`/damage-reports?${new URLSearchParams(params)}`),

  // Stats
  getOverview: () => request('/stats/overview'),
  getRevenue: (params = {}) => request(`/stats/revenue?${new URLSearchParams(params)}`),
  getVehicleStats: () => request('/stats/vehicles'),
  getUpcoming: () => request('/stats/upcoming'),
  getActivity: (limit = 20) => request(`/stats/activity?limit=${limit}`),
  getWebhookFailures: (limit = 50) => request(`/stats/webhook-failures?limit=${limit}`),

  // Search
  searchAll: (q) => request(`/search?q=${encodeURIComponent(q)}`),

  // Notifications
  getNotifications: (limit = 50) => request(`/notifications?limit=${limit}`),
  getUnreadCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),

  // Stripe Admin
  getStripeAccount: () => request('/stripe/account'),
  getStripeBalance: () => request('/stripe/balance'),
  getStripeTransactions: (params = {}) => request(`/stripe/transactions?${new URLSearchParams(params)}`),

  // Messaging
  getConversations: () => request('/messaging/conversations'),
  getMessages: (customerId) => request(`/messaging/conversations/${customerId}/messages`),
  sendMessage: (customerId, payload) => request(`/messaging/conversations/${customerId}/send`, { method: 'POST', body: JSON.stringify(payload) }),

  // Email Templates
  getEmailTemplates: () => request('/messaging/email-templates'),
  createEmailTemplate: (template) => request('/messaging/email-templates', { method: 'POST', body: JSON.stringify(template) }),
  updateEmailTemplate: (id, template) => request(`/messaging/email-templates/${id}`, { method: 'PUT', body: JSON.stringify(template) }),
  deleteEmailTemplate: (id) => request(`/messaging/email-templates/${id}`, { method: 'DELETE' }),

  // Agreements
  getPendingCounterSign: () => request('/agreements/pending-counter-sign'),
  getAgreementDetail: (bookingId) => request(`/agreements/${bookingId}/detail`),
  counterSignAgreement: (bookingId, signatureData) =>
    request(`/agreements/${bookingId}/counter-sign`, {
      method: 'POST',
      body: JSON.stringify({ signature_data: signatureData, signature_type: 'drawn' }),
    }),
  downloadAgreementPdf: async (bookingId) => {
    const authHeader = await getAuthHeader();
    const res = await fetch(`${BASE}/agreements/${bookingId}/pdf`, {
      headers: { ...authHeader }
    });
    if (!res.ok) throw new Error('Failed to download PDF');
    return res.blob();
  },

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

  // Users & Profiles
  getMyProfile: () => request('/users/me'),
  updateMyProfile: (body) => request('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (new_password) => request('/users/me/password', { method: 'POST', body: JSON.stringify({ new_password }) }),
  getUsers: () => request('/users'),
  inviteUser: (body) => request('/users/invite', { method: 'POST', body: JSON.stringify(body) }),
  updateUserRole: (id, role) => request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  deactivateUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  reactivateUser: (id) => request(`/users/${id}/reactivate`, { method: 'POST' }),

  // ── Rental Operations ──────────────────────────────────────────────────────

  // Deposits
  getVehicleDeposit: (vehicleId) => request(`/vehicles/${vehicleId}/deposit`),
  getBookingDeposit: (bookingId) => request(`/bookings/${bookingId}/deposit`),
  releaseDeposit: (bookingId) => request(`/bookings/${bookingId}/deposit/release`, { method: 'POST' }),
  settleDeposit: (bookingId, body) => request(`/bookings/${bookingId}/deposit/settle`, { method: 'POST', body: JSON.stringify(body) }),

  // Add-ons
  getBookingAddons: (bookingId) => request(`/bookings/${bookingId}/addons`),
  saveBookingAddons: (bookingId, body) => request(`/bookings/${bookingId}/addons`, { method: 'POST', body: JSON.stringify(body) }),

  // Check-in / Check-out
  recordCheckIn: (bookingId, body) => request(`/bookings/${bookingId}/checkin`, { method: 'POST', body: JSON.stringify(body) }),
  recordCheckOut: (bookingId, body) => request(`/bookings/${bookingId}/checkout`, { method: 'POST', body: JSON.stringify(body) }),
  recordInspection: (bookingId, body) => request(`/bookings/${bookingId}/inspection`, { method: 'POST', body: JSON.stringify(body) }),
  markReadyForPickup: (bookingId) => request(`/bookings/${bookingId}/ready`, { method: 'PATCH' }),
  getBookingLockbox: (bookingId) => request(`/bookings/${bookingId}/lockbox`),
  getCheckinRecords: (bookingId) => request(`/bookings/${bookingId}/checkin-records`),

  // Incidentals
  getIncidentals: (bookingId) => request(`/bookings/${bookingId}/incidentals`),
  addIncidental: (bookingId, body) => request(`/bookings/${bookingId}/incidentals`, { method: 'POST', body: JSON.stringify(body) }),
  updateIncidental: (id, body) => request(`/incidentals/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteIncidental: (id) => request(`/incidentals/${id}`, { method: 'DELETE' }),

  // Invoices
  generateInvoice: (bookingId) => request(`/bookings/${bookingId}/invoice`, { method: 'POST' }),
  getInvoice: (bookingId) => request(`/bookings/${bookingId}/invoice`),
  sendInvoice: (invoiceId) => request(`/invoices/${invoiceId}/send`, { method: 'POST' }),

  // Tolls
  getVehicleTolls: (vehicleId) => request(`/vehicles/${vehicleId}/tolls`),
  addTollCharge: (vehicleId, body) => request(`/vehicles/${vehicleId}/tolls`, { method: 'POST', body: JSON.stringify(body) }),
  updateTollCharge: (id, body) => request(`/tolls/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTollCharge: (id) => request(`/tolls/${id}`, { method: 'DELETE' }),

  // Disputes
  getDisputes: (params = {}) => request(`/disputes?${new URLSearchParams(params)}`),
  resolveDispute: (id, body) => request(`/disputes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
};
