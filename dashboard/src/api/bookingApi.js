/**
 * bookingApi — sibling to api/client.js for the New Booking modal's ID-scan and
 * photo-upload calls. Kept separate so the 25-consumer api/client.js stays
 * untouched (per CLAUDE.md hard rule). Mirrors client.js's auth pattern: bearer
 * token from the current Supabase session, multipart body (no JSON content-type).
 */
import { supabase } from '../auth/supabaseClient';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export const bookingApi = {
  /**
   * Server-side OCR (Azure Document Intelligence) on a still photo of an ID.
   * Used as the desktop / camera-less fallback to the in-browser PDF417 scan.
   * Returns { ok, fields? } — fields: { firstName, lastName, licenseNumber,
   * state, dob, expiry, addressLine1, city, zip }. Never throws on a bad scan;
   * resolves { ok:false } so the caller can fall through to manual entry.
   */
  scanId: async (file) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${BASE}/uploads/scan-id`, {
        method: 'POST',
        headers: { ...(await authHeader()) },
        body: form,
      });
      if (!res.ok) return { ok: false, reason: `http_${res.status}` };
      return await res.json();
    } catch {
      return { ok: false, reason: 'network' };
    }
  },

  /**
   * Upload an ID photo to the private id-photos bucket. Returns
   * { url, path, bucket }. `path` is what we persist (signed urls expire).
   */
  uploadIdPhoto: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/uploads/id-photo`, {
      method: 'POST',
      headers: { ...(await authHeader()) },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw Object.assign(new Error(err.error || 'Upload failed'), { status: res.status });
    }
    return res.json();
  },

  /**
   * Admin-generate a rental agreement/contract in person (no customer link).
   * body: { address/license/dob/insurance fields, customer_signature_data?,
   *         owner_signature_data?, signature_mode: 'digital'|'wet', license_photo_paths? }
   * Returns { success, agreementId, signature_mode, document }.
   */
  adminGenerateAgreement: async (bookingId, body) => jsonPost(`/agreements/${bookingId}/admin-generate`, body),

  /** List the documents (contracts + invoices) archived for a customer. */
  getCustomerDocuments: async (customerId) => jsonGet(`/customers/${customerId}/documents`),

  /** List the documents archived for a single booking. */
  getBookingDocuments: async (bookingId) => jsonGet(`/bookings/${bookingId}/documents`),

  /** Resolve a short-lived signed download URL for one archived document. */
  downloadDocument: async (documentId) => jsonGet(`/documents/${documentId}/download`),

  /** Price preview for the New Booking modal (mirrors createBooking pricing). */
  adminQuote: async (body) => jsonPost(`/bookings/admin-quote`, body),

  /** The backend's Stripe publishable key (matches its secret key's account). */
  getStripePublishableKey: async () => jsonGet(`/stripe/publishable-key`),

  /** Create a Stripe PaymentIntent for a booking (admin charging a card over the phone). */
  createPaymentIntent: async (bookingCode, expectedTotalCents) =>
    jsonPost(`/stripe/create-payment-intent`, { booking_code: bookingCode, expected_total_cents: expectedTotalCents }),

  /** Tell the backend to record a succeeded PaymentIntent into the payments ledger. */
  confirmPayment: async (paymentIntentId) => jsonPost(`/stripe/confirm-payment`, { payment_intent_id: paymentIntentId }),

  /** Fire the branded receipt email for a succeeded PaymentIntent. */
  sendStripeReceipt: async (paymentIntentId) => jsonPost(`/stripe/send-receipt`, { payment_intent_id: paymentIntentId }),

  // ── Square (Annie's processor) ──────────────────────────────────────────────
  /** Web Payments SDK bootstrap config (applicationId + locationId + environment). */
  getSquareConfig: async () => jsonGet(`/square/config`),

  /** The amount + booking summary for an over-the-phone charge (read-only). */
  getSquareBookingSummary: async (bookingCode) => jsonGet(`/square/booking-summary/${bookingCode}`),

  /** Charge a tokenized card for a booking (admin over-the-phone). */
  squarePay: async (bookingCode, sourceToken, verificationToken, expectedTotalCents) =>
    jsonPost(`/square/pay`, {
      booking_code: bookingCode,
      source_token: sourceToken,
      verification_token: verificationToken,
      expected_total_cents: expectedTotalCents,
    }),

  /** Fire the branded receipt email for a succeeded Square payment. */
  sendSquareReceipt: async (paymentId) => jsonPost(`/square/send-receipt`, { payment_id: paymentId }),

  /** Square location/account info for the payments admin page. */
  getSquareAccount: async () => jsonGet(`/square/account`),
  /** Recent Square payouts (Square has no live balance endpoint). */
  getSquareBalance: async () => jsonGet(`/square/balance`),
  /** Recent Square payments + refunds for the admin page. */
  getSquareTransactions: async ({ limit = 25 } = {}) => jsonGet(`/square/transactions?limit=${limit}`),

  /**
   * Booking conversion funnel for the BookingFunnelWidget. `days` window is
   * clamped server-side to 365. Returns { window_days, conversion_rate,
   * steps: [{ key, label, count, pct }], outcomes: { declined, cancelled } }.
   */
  getBookingFunnel: async (days = 90) => jsonGet(`/stats/funnel?days=${days}`),

  // ── Customer portal accounts (admin-provisioned) — Phase 2, migration 008 ────
  /** Account status for a customer: { username, status, must_change_password, last_login_at } or null. */
  getCustomerAccount: async (customerId) => jsonGet(`/customers/${customerId}/account`),

  /** Provision a portal login. Returns { username, tempPassword, alreadyExisted }. */
  provisionCustomerAccount: async (customerId) => jsonPost(`/customers/${customerId}/account`, {}),

  /** Reset the account's password back to the customer's phone#. Returns { tempPassword }. */
  resetCustomerAccountPassword: async (customerId) => jsonPost(`/customers/${customerId}/account/reset-password`, {}),

  // ── Recurring rentals (long-term private rentals) — Phase 4c, migration 008 ──
  /** A customer's recurring plans (each with its charge ledger). */
  getCustomerRecurring: async (customerId) => jsonGet(`/recurring/customer/${customerId}`),
  /** The customer's saved cards — to pick which one an auto-charge plan bills. */
  getCustomerSavedCards: async (customerId) => jsonGet(`/recurring/customer/${customerId}/cards`),
  /** Create a plan. body: { customerId, amount, interval, intervalCount, collectionMethod, squareCardId?, startDate?, notes? }. */
  createRecurring: async (body) => jsonPost(`/recurring`, body),
  pauseRecurring: async (id) => jsonPost(`/recurring/${id}/pause`, {}),
  resumeRecurring: async (id) => jsonPost(`/recurring/${id}/resume`, {}),
  cancelRecurring: async (id) => jsonPost(`/recurring/${id}/cancel`, {}),
  /** Manually settle a recurring cycle (e.g. a send_link payment confirmed in Square). */
  markRecurringChargePaid: async (chargeId) => jsonPost(`/recurring/charges/${chargeId}/mark-paid`, {}),
};

async function jsonGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { ...(await authHeader()) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, data: err });
  }
  return res.json();
}

async function jsonPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, data: err });
  }
  return res.json();
}
