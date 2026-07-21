import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { deleteCustomerCompletely, getCustomerDeletionPreview } from '../services/customerService.js';
import { withDedupedBookingPayments } from '../services/paymentLedgerService.js';

const router = Router();

const REVENUE_STATUSES = ['completed', 'active', 'returned', 'confirmed', 'approved'];
const OPEN_STATUSES = ['pending_approval', 'approved', 'confirmed', 'ready_for_pickup', 'active', 'returned'];
const UPCOMING_STATUSES = ['approved', 'confirmed', 'ready_for_pickup'];

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function firstAgreement(booking) {
  return asArray(booking?.rental_agreements)[0] || null;
}

function hasCompletedRentalPayment(booking) {
  return asArray(booking?.payments).some((payment) =>
    payment.payment_type === 'rental' &&
    ['completed', 'paid', 'succeeded'].includes(payment.status)
  );
}

function hasSignedAgreement(booking) {
  return !!firstAgreement(booking)?.customer_signed_at;
}

function vehicleLabel(booking) {
  const vehicle = booking?.vehicles || {};
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_code || null;
}

function compactBooking(booking) {
  if (!booking) return null;
  const agreement = firstAgreement(booking);
  return {
    id: booking.id,
    booking_code: booking.booking_code,
    status: booking.status,
    pickup_date: booking.pickup_date,
    return_date: booking.return_date,
    total_cost: booking.total_cost,
    deposit_amount: booking.deposit_amount,
    deposit_status: booking.deposit_status,
    insurance_provider: booking.insurance_provider,
    insurance_status: booking.insurance_status,
    vehicle: vehicleLabel(booking),
    paid: hasCompletedRentalPayment(booking),
    agreement_signed: !!agreement?.customer_signed_at,
    owner_signed: !!agreement?.owner_signed_at,
  };
}

function buildCustomerSummary(customer, bookings) {
  const today = todayYmd();
  const sorted = [...bookings].sort((a, b) =>
    String(b.pickup_date || b.created_at || '').localeCompare(String(a.pickup_date || a.created_at || ''))
  );
  const revenueBookings = bookings.filter((booking) => REVENUE_STATUSES.includes(booking.status));
  const agreements = bookings.flatMap((booking) => asArray(booking.rental_agreements));
  const latestAgreement = agreements.find((agreement) => agreement?.customer_signed_at) || agreements[0] || null;

  const currentBooking = sorted.find((booking) => booking.status === 'active')
    || sorted.find((booking) => booking.status === 'ready_for_pickup')
    || null;
  const nextBooking = [...bookings]
    .filter((booking) => UPCOMING_STATUSES.includes(booking.status) && (!booking.pickup_date || booking.pickup_date >= today))
    .sort((a, b) => String(a.pickup_date || '').localeCompare(String(b.pickup_date || '')))[0] || null;
  const latestBooking = sorted[0] || null;

  const paymentDue = bookings.filter((booking) => booking.status === 'approved' && !hasCompletedRentalPayment(booking));
  const needsDocs = bookings.filter((booking) => {
    if (!OPEN_STATUSES.includes(booking.status)) return false;
    const insuranceNeedsReview = ['pending', 'pending_review', 'rejected', 'bind_failed'].includes(booking.insurance_status);
    return !hasSignedAgreement(booking) || insuranceNeedsReview;
  });
  const insuranceReview = bookings.filter((booking) => ['pending_review', 'bind_failed', 'rejected'].includes(booking.insurance_status));

  const idOnFile = !!(customer.id_photo_url || customer.driver_license_number || latestAgreement?.driver_license_number);
  const agreementOnFile = agreements.some((agreement) => !!agreement?.customer_signed_at);
  const insuranceAgreement = agreements.find((agreement) => agreement?.insurance_company || agreement?.insurance_policy_number);
  const bonzahInsurance = bookings.find((booking) =>
    booking.insurance_provider === 'bonzah' && ['active', 'verified'].includes(booking.insurance_status)
  );
  const ownInsurance = bookings.find((booking) =>
    booking.insurance_provider === 'own_policy' && booking.insurance_status && booking.insurance_status !== 'none'
  );
  const insuranceOnFile = !!(insuranceAgreement || bonzahInsurance || ownInsurance);
  const insuranceVerified = !!(insuranceAgreement || bonzahInsurance || bookings.find((booking) =>
    booking.insurance_provider === 'own_policy' && ['active', 'verified'].includes(booking.insurance_status)
  ));

  const riskFlags = [
    paymentDue.length ? 'payment_due' : null,
    insuranceReview.length ? 'insurance_review' : null,
    needsDocs.length ? 'needs_docs' : null,
    customer.sms_opt_out ? 'sms_opt_out' : null,
  ].filter(Boolean);

  return {
    total_rentals: bookings.length,
    total_revenue: revenueBookings.reduce((sum, booking) => sum + Number(booking.total_cost || 0), 0),
    completed_rentals: bookings.filter((booking) => booking.status === 'completed').length,
    active_rentals: bookings.filter((booking) => ['active', 'ready_for_pickup'].includes(booking.status)).length,
    upcoming_rentals: bookings.filter((booking) => UPCOMING_STATUSES.includes(booking.status)).length,
    payment_due_count: paymentDue.length,
    needs_docs_count: needsDocs.length,
    insurance_review_count: insuranceReview.length,
    risk_flags: riskFlags,
    current_booking: compactBooking(currentBooking),
    next_booking: compactBooking(nextBooking),
    latest_booking: compactBooking(latestBooking),
    verification: {
      id_on_file: idOnFile,
      agreement_on_file: agreementOnFile,
      insurance_on_file: insuranceOnFile,
      insurance_verified: insuranceVerified,
      sms_opt_out: !!customer.sms_opt_out,
      trusted: !!customer.is_trusted,
      stripe_customer: !!customer.stripe_customer_id,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// SMS opt-out admin routes (Phase 1 — migration 018 audit log)
// Placed BEFORE /:id routes so the literal path matches first.
// ────────────────────────────────────────────────────────────────────────────

/** GET /customers/sms-opt-outs — list opted-out customers, newest first. */
router.get('/sms-opt-outs', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone, sms_opt_out_at')
    .eq('sms_opt_out', true)
    .order('sms_opt_out_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  res.json(data || []);
}));

/** POST /customers/:id/sms-opt-in — clear the opt-out flag + write audit row. */
router.post('/:id/sms-opt-in', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { note } = req.body || {};

  // Verify the customer is actually opted out (no-op otherwise)
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('id, sms_opt_out')
    .eq('id', req.params.id)
    .single();
  if (cErr) throw cErr;
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (!customer.sms_opt_out) return res.status(409).json({ error: 'Customer is not opted out' });

  // Clear the flag
  const { error: updateErr } = await supabase
    .from('customers')
    .update({ sms_opt_out: false, sms_opt_out_at: null })
    .eq('id', req.params.id);
  if (updateErr) throw updateErr;

  // Audit log row — captures who/why for TCPA defensibility
  await supabase.from('sms_opt_out_log').insert({
    customer_id: req.params.id,
    action: 'opt_in',
    source: 'admin',
    actor_id: req.user?.id || null,
    note: note || null,
  });

  res.json({ success: true });
}));

/** PATCH /customers/:id/trust — toggle is_trusted (auto-approve future bookings). */
router.patch('/:id/trust', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { is_trusted, note } = req.body || {};
  if (typeof is_trusted !== 'boolean') {
    return res.status(400).json({ error: 'is_trusted (boolean) is required' });
  }

  const updates = {
    is_trusted,
    trusted_at: is_trusted ? new Date().toISOString() : null,
    trusted_by: is_trusted ? (req.user?.id || null) : null,
    trusted_note: is_trusted ? (note || null) : null,
  };

  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, is_trusted, trusted_at, trusted_by, trusted_note')
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Customer not found' });
  res.json(data);
}));

/** GET /customers — list with search, includes booking stats */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  let query = supabase
    .from('customers')
    .select('*')
    .order(req.query.sort || 'created_at', { ascending: false });

  if (req.query.q) {
    const q = req.query.q;
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  // Fetch booking stats for each customer via explicit query (not join)
  const customerIds = (data || []).map(c => c.id);

  let bookingsByCustomer = {};
  if (customerIds.length > 0) {
    const { data: allBookings } = await supabase
      .from('bookings')
      .select(`
        id, customer_id, booking_code, status, pickup_date, return_date, total_cost,
        deposit_amount, deposit_status, insurance_provider, insurance_status, created_at,
        vehicles(year, make, model, vehicle_code),
        rental_agreements(customer_signed_at, owner_signed_at, driver_license_number, insurance_company, insurance_policy_number, insurance_expiry),
        payments(id, payment_type, amount, method, status, paid_at, created_at)
      `)
      .in('customer_id', customerIds);

    for (const b of (allBookings || [])) {
      if (!bookingsByCustomer[b.customer_id]) bookingsByCustomer[b.customer_id] = [];
      bookingsByCustomer[b.customer_id].push(withDedupedBookingPayments(b));
    }
  }

  const enriched = (data || []).map(c => {
    const bks = bookingsByCustomer[c.id] || [];
    return {
      ...c,
      ...buildCustomerSummary(c, bks),
    };
  });

  res.json(enriched);
}));

/** GET /customers/:id — detail with booking history */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (cErr) throw cErr;
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, vehicles(year, make, model, vehicle_code), rental_agreements(*), payments(id, payment_type, amount, method, status, reference_id, paid_at, created_at)')
    .eq('customer_id', req.params.id)
    .order('created_at', { ascending: false });

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('customer_id', req.params.id)
    .order('created_at', { ascending: false });

  res.json({ ...customer, bookings: (bookings || []).map(withDedupedBookingPayments), reviews: reviews || [] });
}));

/** GET /customers/:id/bookings */
router.get('/:id/bookings', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, vehicles(year, make, model, vehicle_code), rental_agreements(*), payments(id, payment_type, amount, method, status, reference_id, paid_at, created_at)')
    .eq('customer_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json((data || []).map(withDedupedBookingPayments));
}));

/** PUT /customers/:id */
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('customers')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/** GET /customers/:id/deletion-preview — counts of related data that will be removed */
router.get('/:id/deletion-preview', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const preview = await getCustomerDeletionPreview(req.params.id);
  res.json(preview);
}));

/** DELETE /customers/:id — permanently delete customer and all related records */
router.delete('/:id', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { confirm_email } = req.body || {};
  const preview = await getCustomerDeletionPreview(req.params.id);

  if (!confirm_email || String(confirm_email).trim().toLowerCase() !== preview.customer.email.toLowerCase()) {
    return res.status(400).json({
      error: 'Type the customer email to confirm deletion',
      expected_email: preview.customer.email,
    });
  }

  const result = await deleteCustomerCompletely(req.params.id, {
    actorEmail: req.user?.email,
  });
  res.json(result);
}));

export default router;
