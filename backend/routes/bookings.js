import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { verifyRecaptcha } from '../middleware/recaptcha.js';
import brand from '../config/brand.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateBookingPayload } from '../utils/validators.js';
import { createBooking, transitionBooking, getBookingDetail, applyCheckoutOverride } from '../services/bookingService.js';
import { createNotification } from '../services/notificationService.js';
import { sendTeamAlertAsync, TEAM_ALERT_EVENTS } from '../services/teamAlertService.js';
import { sendBookingNotification, buildBookingPayload } from '../services/notifyService.js';
import { computeRentalPricing, DELIVERY_FEES } from '../services/pricingService.js';
import { getQuote, getSetting, BonzahError } from '../services/bonzahService.js';

const router = Router();

// Rate limit public booking submissions: 5 per minute per IP
const bookingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many booking requests, please try again shortly.' },
});

/** GET /bookings — admin list with filters */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  let query = supabase
    .from('bookings')
    .select('*, customers(first_name, last_name, email, phone), vehicles(year, make, model, vehicle_code)')
    .order('created_at', { ascending: false });

  if (req.query.status)     query = query.eq('status', req.query.status);
  if (req.query.vehicle_id) query = query.eq('vehicle_id', req.query.vehicle_id);
  if (req.query.customer_id) query = query.eq('customer_id', req.query.customer_id);
  if (req.query.rental_type) query = query.eq('rental_type', req.query.rental_type);
  if (req.query.from)       query = query.gte('pickup_date', req.query.from);
  if (req.query.to)         query = query.lte('pickup_date', req.query.to);
  if (req.query.q) {
    // Search by booking code
    query = query.ilike('booking_code', `%${req.query.q}%`);
  }

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  res.json({ data, total: count, limit, offset });
}));

/** GET /bookings/:id — full detail (admin) */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const data = await getBookingDetail(req.params.id);
  if (!data) return res.status(404).json({ error: 'Booking not found' });
  res.json(data);
}));

/** GET /bookings/:id/timeline — status log (admin) */
router.get('/:id/timeline', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('booking_status_log')
    .select('*')
    .eq('booking_id', req.params.id)
    .order('created_at');

  if (error) throw error;
  res.json(data);
}));

/** GET /bookings/:id/extensions — extension history (admin) */
router.get('/:id/extensions', requireAuth, asyncHandler(async (req, res) => {
  const { listExtensions } = await import('../services/extensionService.js');
  const rows = await listExtensions(req.params.id);
  res.json(rows);
}));

/** POST /bookings/:id/extension-quote — price an admin extension (admin) */
router.post('/:id/extension-quote', requireAuth, asyncHandler(async (req, res) => {
  try {
    const { quoteExtension } = await import('../services/extensionService.js');
    const quote = await quoteExtension(req.params.id, req.body?.newReturnDate);
    const { _booking, ...safe } = quote;
    res.json(safe);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, conflicts: err.conflicts });
  }
}));

/** POST /bookings/:id/extend — admin-initiated extension (owner/admin only) */
router.post('/:id/extend', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  try {
    const { adminExtendBooking } = await import('../services/extensionService.js');
    const result = await adminExtendBooking(req.params.id, {
      newReturnDate: req.body?.newReturnDate,
      collectPayment: req.body?.collectPayment !== false,
      method: req.body?.method || 'cash',
      reference: req.body?.reference || null,
      actorId: req.user?.id || null,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, conflicts: err.conflicts });
  }
}));

/** GET /bookings/status/:bookingCode — public status lookup by code */
router.get('/status/:bookingCode', asyncHandler(async (req, res) => {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_code, status, pickup_date, return_date, pickup_time, return_time, pickup_location, vehicles(year, make, model)')
    .eq('booking_code', req.params.bookingCode.toUpperCase())
    .single();

  if (error || !booking) {
    return res.status(404).json({ error: 'Booking not found. Check your reference code and try again.' });
  }

  // Has the rental been paid? Both the Stripe and Square payment paths write a
  // rental payment row with status 'completed'. A booking still owes payment
  // once it's past approval, not in a terminal/pre-approval state, and no such
  // row exists — this drives the customer-facing "Complete your booking" CTA so
  // a booking that advanced past 'approved' (e.g. to 'active') without payment
  // isn't left with no way to pay.
  const { data: paidRow } = await supabase
    .from('payments')
    .select('id')
    .eq('booking_id', booking.id)
    .eq('payment_type', 'rental')
    .eq('status', 'completed')
    .maybeSingle();
  const awaiting_payment =
    !paidRow && !['pending_approval', 'declined', 'cancelled'].includes(booking.status);

  const nextStep = {
    pending_approval: { label: 'Awaiting approval', detail: "We're reviewing your request and will contact you shortly." },
    approved: { label: 'Approved — action needed', detail: 'Please sign your rental agreement and complete payment to confirm your booking.' },
    confirmed: { label: 'Confirmed', detail: "You're all set! We'll be in touch with pickup details." },
    active: { label: 'Active rental', detail: 'Your rental is currently active.' },
    returned: { label: 'Vehicle returned', detail: 'The vehicle has been returned. Your rental is being finalized.' },
    completed: { label: 'Completed', detail: 'Your rental is complete. Thank you!' },
    declined: { label: 'Declined', detail: 'Unfortunately your request was declined. Please call us for assistance.' },
    cancelled: { label: 'Cancelled', detail: 'This booking has been cancelled.' },
  }[booking.status] || { label: booking.status, detail: '' };

  res.json({
    booking_code: booking.booking_code,
    status: booking.status,
    awaiting_payment,
    pickup_date: booking.pickup_date,
    return_date: booking.return_date,
    pickup_time: booking.pickup_time,
    return_time: booking.return_time,
    pickup_location: booking.pickup_location,
    vehicle: booking.vehicles ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}` : null,
    next_step: nextStep,
  });
}));

/** POST /bookings — public, rate-limited, reCAPTCHA required */
router.post('/', bookingRateLimit, verifyRecaptcha, asyncHandler(async (req, res) => {
  const errors = validateBookingPayload(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const booking = await createBooking(req.body);

  res.status(201).json({
    success: true,
    booking_code: booking.booking_code,
    status: booking.status,
    message: "Booking submitted. You'll receive confirmation via text shortly.",
  });
}));

/** POST /bookings/admin-create — admin creates a booking on behalf of a customer.
 *  Reuses the public createBooking path but flags created_by_admin and emails a
 *  continue-booking link instead of the standard "request received" flow.
 *  Body: full createBooking payload (vehicle_code, pickup/return dates, customer
 *  fields, optional add-ons). The admin already vetted the request, so payment
 *  success will auto-approve in stripeService.
 */
router.post('/admin-create', requireAuth, asyncHandler(async (req, res) => {
  // agreement_prefill is admin-captured agreement data (license/address/dob/id
  // photos/signature + the step keys the admin completed). It rides alongside the
  // booking payload but is persisted separately so createBooking + validation
  // stay untouched.
  const {
    agreement_prefill,
    admin_weekly_discount_percent,
    admin_total_cost_override,
    admin_deposit_amount,
    rental_type,
    portal_notes,
    skip_availability_check,
    mark_active,
    ...bookingBody
  } = req.body;

  const errors = validateBookingPayload(bookingBody);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const booking = await createBooking({
    ...bookingBody,
    admin_weekly_discount_percent,
    admin_total_cost_override,
    admin_deposit_amount,
    rental_type: rental_type === 'long_term' ? 'long_term' : 'standard',
    portal_notes,
    skip_availability_check: !!skip_availability_check,
    source: 'admin',
    created_by_admin: true,
    insurance_status: 'pending',
  });

  if (mark_active) {
    await transitionBooking(booking.id, 'active', {
      changedBy: req.user?.email || 'admin',
      reason: 'Long-term renter onboarded — vehicle already in possession',
    });
    await supabase.from('vehicles').update({ status: 'rented' }).eq('id', booking.vehicle_id);
    booking.status = 'active';
  }

  // Persist whatever the admin pre-filled onto the booking.
  // overlays this into customerDefaults and returns prefilled_steps so the
  // customer's continue link skips those steps. Failure here must not fail the
  // booking — the customer can always fill everything on the link.
  if (agreement_prefill && Array.isArray(agreement_prefill.steps) && agreement_prefill.steps.length) {
    const { error: prefillErr } = await supabase
      .from('bookings')
      .update({ admin_prefill: agreement_prefill })
      .eq('id', booking.id);
    if (prefillErr) console.error('[admin-create] admin_prefill save failed:', prefillErr.message);
  }

  // Build the continue link the admin can copy/paste.
  const siteUrl = brand.siteUrl;
  const continueUrl = `${siteUrl}/confirm?code=${booking.booking_code}`;
  const portalUrl = `${siteUrl}/portal?code=${booking.booking_code}`;

  // Send the continue-booking email (fire-and-forget so the response isn't blocked).
  try {
    const { sendContinueBookingEmail } = await import('../services/emailService.js');
    const { data: customer } = await supabase
      .from('customers')
      .select('first_name, last_name, email, phone')
      .eq('id', booking.customer_id)
      .single();
    const { data: vehicleRow } = await supabase
      .from('vehicles')
      .select('year, make, model')
      .eq('id', booking.vehicle_id)
      .single();
    const vehicleLabel = vehicleRow ? `${vehicleRow.year} ${vehicleRow.make} ${vehicleRow.model}` : null;
    sendContinueBookingEmail({ customer, booking, vehicle: vehicleLabel })
      .catch(err => console.error('[Email] Continue-booking email failed:', err));
  } catch (err) {
    console.error('[admin-create] Continue email setup failed:', err);
  }

  res.status(201).json({
    success: true,
    booking_id: booking.id,
    booking_code: booking.booking_code,
    customer_email: bookingBody.email,
    continue_url: continueUrl,
    portal_url: portalUrl,
    status: booking.status,
  });
}));

/** POST /bookings/:id/long-term — flag an existing booking (only if they already have one in the system) */
router.post('/:id/long-term', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { portal_notes } = req.body || {};
  const { data, error } = await supabase
    .from('bookings')
    .update({
      rental_type: 'long_term',
      ...(portal_notes !== undefined ? { portal_notes } : {}),
    })
    .eq('id', req.params.id)
    .select('id, booking_code, rental_type, portal_notes')
    .single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Booking not found' });
  const portalUrl = `${brand.siteUrl}/portal?code=${data.booking_code}`;
  res.json({ ...data, portal_url: portalUrl });
}));

/** PUT /bookings/:id — update booking details (admin) */
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  // Strip fields that should only change via transitions
  const { status, customer_id, vehicle_id, ...updates } = req.body;

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/** POST /bookings/:id/approve */
router.post('/:id/approve', requireAuth, asyncHandler(async (req, res) => {
  const { is_high_risk, deposit_amount, reason } = req.body || {};
  const extraFields = {};

  if (is_high_risk != null) {
    extraFields.is_high_risk = !!is_high_risk;
  }

  if (deposit_amount != null && deposit_amount !== '') {
    const amt = Number(deposit_amount);
    if (!Number.isFinite(amt) || amt < 0) {
      return res.status(400).json({ error: 'Deposit amount must be zero or greater' });
    }
    extraFields.deposit_amount = amt;
  }

  const result = await transitionBooking(req.params.id, 'approved', {
    changedBy: req.user?.email || 'owner',
    reason,
    extraFields,
  });

  const booking = await getBookingDetail(req.params.id);
  const payment_link = `${brand.siteUrl}/confirm?code=${booking.booking_code}`;

  res.json({
    ...result,
    payment_link,
    deposit_amount: booking.deposit_amount,
    is_high_risk: booking.is_high_risk,
  });
}));

/** POST /bookings/:id/decline */
router.post('/:id/decline', requireAuth, asyncHandler(async (req, res) => {
  const result = await transitionBooking(req.params.id, 'declined', {
    changedBy: req.user?.email || 'owner',
    reason: req.body.reason,
    extraFields: { decline_reason: req.body.reason },
  });
  res.json(result);
}));

/** POST /bookings/:id/checkout-override
 *  Admin force-unlocks the CheckOutTab when the renter never self-checked-out
 *  via the customer portal. Body: { reason, note? }
 */
router.post('/:id/checkout-override', requireAuth, asyncHandler(async (req, res) => {
  const { reason, note } = req.body;
  const result = await applyCheckoutOverride(req.params.id, {
    reason,
    note,
    adminUserId: req.user?.email || 'admin',
  });
  res.json(result);
}));

/** POST /bookings/:id/cancel */
router.post('/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const { reason, cancelled_by = 'owner' } = req.body;
  const result = await transitionBooking(req.params.id, 'cancelled', {
    changedBy: req.user?.email || 'owner',
    reason,
    extraFields: { cancellation_reason: reason, cancelled_by },
  });
  res.json(result);
}));

/** POST /bookings/:id/pickup */
router.post('/:id/pickup', requireAuth, asyncHandler(async (req, res) => {
  const { mileage, fuel_level, condition_notes, photos = [] } = req.body;

  // Get the booking first to know the vehicle_id
  const { data: booking } = await supabase
    .from('bookings')
    .select('vehicle_id')
    .eq('id', req.params.id)
    .single();

  const result = await transitionBooking(req.params.id, 'active', {
    changedBy: req.user?.email || 'owner',
    reason: 'Vehicle picked up',
    extraFields: {
      pickup_mileage: mileage,
      pickup_fuel_level: fuel_level,
      pickup_condition_notes: condition_notes,
      pickup_photos: photos,
    },
  });

  // Set vehicle status to rented — this is the ONLY place this should happen
  if (booking?.vehicle_id) {
    await supabase
      .from('vehicles')
      .update({ status: 'rented' })
      .eq('id', booking.vehicle_id);
  }

  res.json(result);
}));

/** POST /bookings/:id/return */
router.post('/:id/return', requireAuth, asyncHandler(async (req, res) => {
  const { mileage, fuel_level, condition_notes, photos = [] } = req.body;

  // Check for late return — recalculate cost if returned after booked return_date
  const booking = await getBookingDetail(req.params.id);
  const todayStr = new Date().toISOString().slice(0, 10);
  const extraFields = {
    return_mileage: mileage,
    return_fuel_level: fuel_level,
    return_condition_notes: condition_notes,
    return_photos: photos,
  };

  if (todayStr > booking.return_date) {
    // Reconstruct vehicle shape for computeRentalPricing using stored + current vehicle data
    const lateVehicle = {
      daily_rate: Number(booking.daily_rate),
      weekly_discount_percent: booking.weekly_discount_applied ?? booking.vehicles?.weekly_discount_percent ?? 15,
      weekly_unlimited_mileage_enabled: booking.vehicles?.weekly_unlimited_mileage_enabled ?? true,
    };
    const pricing = computeRentalPricing({
      vehicle: lateVehicle,
      pickupDate: booking.pickup_date,
      returnDate: todayStr,
      deliveryFeeAmount: DELIVERY_FEES[booking.delivery_type] ?? Number(booking.delivery_fee || 0),
      discountAmount: Number(booking.discount_amount || 0),
      mileageAddonFee: Number(booking.mileage_addon_fee || 0),
      tollAddonFee: Number(booking.toll_addon_fee || 0),
    });
    Object.assign(extraFields, {
      return_date: todayStr,
      rental_days: pricing.rental_days,
      rate_type: pricing.rate_type,
      weekly_discount_applied: pricing.weekly_discount_applied,
      subtotal: pricing.subtotal,
      tax_amount: pricing.tax_amount,
      total_cost: pricing.total_cost,
      mileage_allowance: pricing.mileage_allowance,
      line_items: pricing.line_items,
      late_return: true,
    });
  }

  const result = await transitionBooking(req.params.id, 'returned', {
    changedBy: req.user?.email || 'owner',
    reason: todayStr > booking.return_date
      ? `Vehicle returned late (${todayStr} vs booked ${booking.return_date}) — cost recalculated`
      : 'Vehicle returned',
    extraFields,
  });

  // Set vehicle back to available
  if (booking.vehicle_id) {
    await supabase
      .from('vehicles')
      .update({ status: 'available' })
      .eq('id', booking.vehicle_id);
  }

  res.json(result);
}));

/** POST /bookings/:id/complete */
router.post('/:id/complete', requireAuth, asyncHandler(async (req, res) => {
  const result = await transitionBooking(req.params.id, 'completed', {
    changedBy: req.user?.email || 'owner',
    reason: req.body.reason || 'Rental completed',
  });
  res.json(result);
}));

/**
 * GET /bookings/insurance/config — public.
 *
 * Returns Bonzah-related runtime config the customer wizard needs to render:
 *   - enabled: master kill switch
 *   - tiers: tier metadata (id, label, coverages, default/recommended flags)
 *   - markup_percent: percent we add to Bonzah's quote before display
 *   - excluded_states: states where Bonzah is not offered at all (hide path)
 *   - pai_excluded_states: states where the Complete tier hides
 *
 * No customer-specific data, no secrets — safe to expose without auth.
 */
router.get('/insurance/config', asyncHandler(async (_req, res) => {
  const [enabled, tiers, markupPercent, excludedStates, paiExcludedStates] = await Promise.all([
    getSetting('bonzah_enabled', false),
    getSetting('bonzah_tiers', []),
    getSetting('bonzah_markup_percent', 10),
    getSetting('bonzah_excluded_states', []),
    getSetting('bonzah_pai_excluded_states', []),
  ]);
  res.json({
    enabled: !!enabled,
    tiers,
    markup_percent: Number(markupPercent),
    excluded_states: excludedStates,
    pai_excluded_states: paiExcludedStates,
  });
}));

/**
 * POST /bookings/:code/insurance/quote — public.
 *
 * Body: { tier_id }
 *
 * Calls Bonzah for a draft quote, applies our markup, persists everything onto
 * the booking record, returns price details for the wizard to display.
 *
 * Idempotent within the 24h quote window: if a quote already exists for the
 * same tier and is still fresh, we return it without round-tripping Bonzah.
 */
router.post('/:code/insurance/quote', asyncHandler(async (req, res) => {
  const { tier_id, customer_overrides } = req.body;
  if (!tier_id) return res.status(400).json({ error: 'tier_id is required' });

  // Master kill switch
  const enabled = await getSetting('bonzah_enabled', false);
  if (!enabled) return res.status(503).json({ error: 'Bonzah is not currently available' });

  // Load booking + customer + vehicle in one query
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(year, make, model)')
    .eq('booking_code', req.params.code)
    .single();
  if (error || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (['declined', 'cancelled'].includes(booking.status)) {
    return res.status(400).json({ error: `This booking has been ${booking.status}` });
  }

  // Wizard captures DOB + address + license into sessionStorage during the Agreement
  // stage, but only persists them to the customer record at Stripe-submit time. We
  // need those fields here to call Bonzah. Merge the wizard's draft onto the loaded
  // customer for quote-time only — the bind path (post-payment) re-reads the now-
  // persisted customer record, so this can't smuggle bad data into a real policy.
  const customer = { ...(booking.customers || {}), ...(customer_overrides || {}) };
  booking.customers = customer;

  // Re-use existing quote if it's still fresh AND for the same tier
  const now = Date.now();
  const expiresAt = booking.bonzah_quote_expires_at ? new Date(booking.bonzah_quote_expires_at).getTime() : 0;
  const isFresh = booking.bonzah_quote_id
    && booking.bonzah_tier_id === tier_id
    && booking.bonzah_premium_cents
    && expiresAt > now;

  let premiumCents;
  let quoteId;
  let coverageInfo;

  if (isFresh) {
    premiumCents = Number(booking.bonzah_premium_cents);
    quoteId = booking.bonzah_quote_id;
    coverageInfo = booking.bonzah_coverage_json || [];
  } else {
    // Fresh quote
    let quote;
    try {
      quote = await getQuote(booking, booking.customers, tier_id, {
        existingQuoteId: booking.bonzah_quote_id || '',
      });
    } catch (e) {
      if (e instanceof BonzahError) {
        return res.status(502).json({
          error: e.bonzahTxt || e.message,
          bonzah_status: e.bonzahStatus,
        });
      }
      throw e;
    }
    premiumCents = quote.premium_cents;
    quoteId = quote.quote_id;
    coverageInfo = quote.coverage_information;
  }

  const markupPercent = Number(await getSetting('bonzah_markup_percent', 10));
  const markupCents = Math.round(premiumCents * markupPercent / 100);
  const totalCents = premiumCents + markupCents;
  const expiresAtIso = new Date(now + 24 * 60 * 60 * 1000).toISOString();

  // Persist the quote on the booking (only if it was a fresh API call,
  // OR if anything materially changed)
  if (!isFresh) {
    await supabase
      .from('bookings')
      .update({
        bonzah_tier_id: tier_id,
        bonzah_quote_id: quoteId,
        bonzah_premium_cents: premiumCents,
        bonzah_markup_cents: markupCents,
        bonzah_coverage_json: coverageInfo,
        bonzah_quote_expires_at: expiresAtIso,
      })
      .eq('id', booking.id);
  }

  res.json({
    tier_id,
    quote_id: quoteId,
    premium_cents: premiumCents,
    markup_cents: markupCents,
    total_cents: totalCents,
    coverage_information: coverageInfo,
    expires_at: isFresh ? booking.bonzah_quote_expires_at : expiresAtIso,
  });
}));

/** PATCH /bookings/:code/insurance — public (customer submits insurance choice from unified wizard) */
router.patch('/:code/insurance', asyncHandler(async (req, res) => {
  const { source, tier_id, bonzah_policy_number, customer_receipt_snapshot } = req.body;

  const receiptFields = customer_receipt_snapshot && typeof customer_receipt_snapshot === 'object'
    ? { customer_receipt_snapshot }
    : {};

  // Look up booking by booking_code (public route — no auth)
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_code, status, bonzah_tier_id, bonzah_quote_id, bonzah_quote_expires_at, bonzah_premium_cents')
    .eq('booking_code', req.params.code)
    .single();

  if (error || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (source === 'bonzah') {
    // Customer chose Bonzah — re-quote inline for the selected tier so the booking
    // row reflects what they actually picked. The wizard fetches all 3 tier quotes
    // in parallel for the price-comparison UI; whichever Bonzah-API call lands last
    // overwrites bonzah_tier_id / bonzah_*_cents on the row, so the row may not
    // match the user's selection. Re-quoting here is authoritative + race-free.
    //
    // Safe at this point in the flow: ConfirmBooking calls POST /agreements/:code/sign
    // immediately before this PATCH, which persists DOB / address / license to the
    // customer record — so getQuote() can read them without customer_overrides.
    if (!tier_id) return res.status(400).json({ error: 'tier_id is required for Bonzah' });

    const enabled = await getSetting('bonzah_enabled', false);
    if (!enabled) return res.status(503).json({ error: 'Bonzah is not currently available' });

    const { data: bookingFull, error: bfErr } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(year, make, model)')
      .eq('id', booking.id)
      .single();
    if (bfErr || !bookingFull) return res.status(404).json({ error: 'Booking not found' });

    let quote;
    try {
      quote = await getQuote(bookingFull, bookingFull.customers, tier_id, {
        existingQuoteId: bookingFull.bonzah_quote_id || '',
      });
    } catch (e) {
      if (e instanceof BonzahError) {
        return res.status(502).json({ error: e.bonzahTxt || e.message, bonzah_status: e.bonzahStatus });
      }
      throw e;
    }

    const markupPercent = Number(await getSetting('bonzah_markup_percent', 10));
    const premiumCents = quote.premium_cents;
    const markupCents = Math.round(premiumCents * markupPercent / 100);
    const expiresAtIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: updErr } = await supabase
      .from('bookings')
      .update({
        insurance_provider: 'bonzah',
        insurance_status: 'pending', // flips to 'active' after Stripe webhook binds
        bonzah_tier_id: tier_id,
        bonzah_quote_id: quote.quote_id,
        bonzah_premium_cents: premiumCents,
        bonzah_markup_cents: markupCents,
        bonzah_coverage_json: quote.coverage_information,
        bonzah_quote_expires_at: expiresAtIso,
        ...receiptFields,
      })
      .eq('id', booking.id);
    if (updErr) return res.status(500).json({ error: `Failed to record insurance choice: ${updErr.message}` });

    console.log(`[Booking] Bonzah ${tier_id} locked in for ${booking.booking_code} (premium ${premiumCents}c, markup ${markupCents}c)`);
    return res.json({ success: true, booking_code: booking.booking_code });
  }

  if (source === 'own') {
    // When Bonzah is disabled site-wide, own-insurance submissions require
    // admin review ('pending_review'). When Bonzah is enabled, the customer
    // actively chose their own insurance — no admin review needed ('external').
    const bonzahEnabled = await getSetting('bonzah_enabled', false);
    const insuranceStatus = bonzahEnabled ? 'external' : 'pending_review';

    const { error: updErr } = await supabase
      .from('bookings')
      .update({
        insurance_provider: 'own',
        insurance_status: insuranceStatus,
        // Clear any stale Bonzah quote so we don't accidentally bind/charge
        bonzah_tier_id: null,
        bonzah_quote_id: null,
        bonzah_premium_cents: null,
        bonzah_markup_cents: null,
        bonzah_quote_expires_at: null,
        ...receiptFields,
      })
      .eq('id', booking.id);
    if (updErr) return res.status(500).json({ error: `Failed to record insurance choice: ${updErr.message}` });

    // If insurance needs admin review, fire a dashboard notification so the admin knows.
    if (insuranceStatus === 'pending_review') {
      // Load full booking for notification payload
      const { data: fullBooking } = await supabase
        .from('bookings')
        .select('*, customers(first_name, last_name, email, phone), vehicles(year, make, model, vehicle_code)')
        .eq('id', booking.id)
        .single();
      if (fullBooking) {
        createNotification(
          'insurance_review_needed',
          `Insurance review needed: ${booking.booking_code}`,
          `${fullBooking.customers?.first_name} ${fullBooking.customers?.last_name} submitted their own insurance for review.`,
          `/bookings/${booking.id}`,
          { booking_id: booking.id, booking_code: booking.booking_code }
        ).catch(() => {});
        sendTeamAlertAsync(TEAM_ALERT_EVENTS.INSURANCE_REVIEW, fullBooking);
      }
    }

    console.log(`[Booking] Customer has own insurance for ${booking.booking_code} (status: ${insuranceStatus})`);
    return res.json({ success: true, booking_code: booking.booking_code });
  }

  if (bonzah_policy_number) {
    // Legacy admin-paste path — keeps working in case any internal tool calls it.
    const { error: updErr } = await supabase
      .from('bookings')
      .update({
        insurance_provider: 'bonzah',
        bonzah_policy_no: bonzah_policy_number,
      })
      .eq('id', booking.id);
    if (updErr) return res.status(500).json({ error: `Failed to record insurance: ${updErr.message}` });

    console.log(`[Booking] Bonzah insurance manually set for ${booking.booking_code}: ${bonzah_policy_number}`);
    return res.json({ success: true, booking_code: booking.booking_code });
  }

  return res.status(400).json({ error: 'Insurance source is required (bonzah with tier_id, or own)' });
}));

/** POST /bookings/:id/approve-insurance — admin approves or rejects a customer's own insurance.
 *  Body: { action: 'approve' | 'reject', reason?: string }
 *  Only valid when insurance_status is 'pending_review'.
 */
router.post('/:id/approve-insurance', requireAuth, asyncHandler(async (req, res) => {
  const { action, reason } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be "approve" or "reject"' });
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(first_name, last_name, email, phone), vehicles(year, make, model, vehicle_code)')
    .eq('id', req.params.id)
    .single();

  if (error || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (booking.insurance_status !== 'pending_review') {
    return res.status(400).json({ error: `Insurance is not pending review (current status: ${booking.insurance_status})` });
  }

  const newStatus = action === 'approve' ? 'verified' : 'rejected';
  const { error: updErr } = await supabase
    .from('bookings')
    .update({
      insurance_status: newStatus,
      insurance_reviewed_at: new Date().toISOString(),
      insurance_reviewed_by: req.user?.email || 'admin',
    })
    .eq('id', req.params.id);

  if (updErr) throw updErr;

  // Send notification to customer about the insurance decision
  const payload = buildBookingPayload(booking);
  const stage = action === 'approve' ? 'insurance_approved' : 'insurance_rejected';
  payload.insurance_review_reason = reason || null;
  sendBookingNotification(stage, payload).catch(err =>
    console.error(`[Insurance] ${stage} notification failed:`, err.message)
  );

  // Dashboard notification
  createNotification(
    `insurance_${action}d`,
    `Insurance ${action}d: ${booking.booking_code}`,
    `${booking.customers?.first_name} ${booking.customers?.last_name}'s insurance has been ${action}d.${reason ? ` Reason: ${reason}` : ''}`,
    `/bookings/${booking.id}`,
    { booking_id: booking.id }
  ).catch(() => {});

  console.log(`[Insurance] ${action}d insurance for ${booking.booking_code} by ${req.user?.email || 'admin'}`);
  res.json({ success: true, insurance_status: newStatus });
}));

export default router;
