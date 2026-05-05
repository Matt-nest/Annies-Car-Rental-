import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireApiKey } from '../middleware/apiKey.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateBookingPayload } from '../utils/validators.js';
import { createBooking, transitionBooking, getBookingDetail, applyCheckoutOverride } from '../services/bookingService.js';
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

/** GET /bookings/status/:bookingCode — public status lookup by code */
router.get('/status/:bookingCode', asyncHandler(async (req, res) => {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('booking_code, status, pickup_date, return_date, pickup_time, return_time, pickup_location, vehicles(year, make, model)')
    .eq('booking_code', req.params.bookingCode.toUpperCase())
    .single();

  if (error || !booking) {
    return res.status(404).json({ error: 'Booking not found. Check your reference code and try again.' });
  }

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
    pickup_date: booking.pickup_date,
    return_date: booking.return_date,
    pickup_time: booking.pickup_time,
    return_time: booking.return_time,
    pickup_location: booking.pickup_location,
    vehicle: booking.vehicles ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}` : null,
    next_step: nextStep,
  });
}));

/** POST /bookings — public, rate-limited, API key required */
router.post('/', bookingRateLimit, requireApiKey, asyncHandler(async (req, res) => {
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
  const errors = validateBookingPayload(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const booking = await createBooking({
    ...req.body,
    source: 'admin',
    created_by_admin: true,
    insurance_status: 'pending',
  });

  // Build the continue link the admin can copy/paste.
  const siteUrl = process.env.SITE_URL || 'https://anniescarrental.com';
  const continueUrl = `${siteUrl}/booking?code=${booking.booking_code}`;

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
    continue_url: continueUrl,
  });
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
  const result = await transitionBooking(req.params.id, 'approved', {
    changedBy: req.user?.email || 'owner',
    reason: req.body.reason,
  });
  res.json(result);
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
  const { source, tier_id, bonzah_policy_number } = req.body;

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
      })
      .eq('id', booking.id);
    if (updErr) return res.status(500).json({ error: `Failed to record insurance choice: ${updErr.message}` });

    console.log(`[Booking] Bonzah ${tier_id} locked in for ${booking.booking_code} (premium ${premiumCents}c, markup ${markupCents}c)`);
    return res.json({ success: true, booking_code: booking.booking_code });
  }

  if (source === 'own') {
    // Customer has their own insurance — mark as own (details stored in rental_agreements)
    const { error: updErr } = await supabase
      .from('bookings')
      .update({
        insurance_provider: 'own',
        insurance_status: 'external',
        // Clear any stale Bonzah quote so we don't accidentally bind/charge
        bonzah_tier_id: null,
        bonzah_quote_id: null,
        bonzah_premium_cents: null,
        bonzah_markup_cents: null,
        bonzah_quote_expires_at: null,
      })
      .eq('id', booking.id);
    if (updErr) return res.status(500).json({ error: `Failed to record insurance choice: ${updErr.message}` });

    console.log(`[Booking] Customer has own insurance for ${booking.booking_code}`);
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

export default router;
