import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireApiKey } from '../middleware/apiKey.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateBookingPayload } from '../utils/validators.js';
import { createBooking, transitionBooking, getBookingDetail } from '../services/bookingService.js';
import { computeRentalPricing, DELIVERY_FEES } from '../services/pricingService.js';

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

/** PATCH /bookings/:code/insurance — public (customer submits insurance choice from unified wizard) */
router.patch('/:code/insurance', asyncHandler(async (req, res) => {
  const { source, tier, bonzah_policy_number, bonzah_email } = req.body;

  // Look up booking by booking_code (public route — no auth)
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_code, status')
    .eq('booking_code', req.params.code)
    .single();

  if (error || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Handle different insurance sources
  if (source === 'annies') {
    // Customer chose Annie's insurance — store tier
    const validTiers = ['basic', 'standard', 'premium'];
    if (!tier || !validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Valid insurance tier is required (basic, standard, premium)' });
    }

    await supabase
      .from('bookings')
      .update({
        insurance_provider: 'annies',
        insurance_policy_number: tier,
        insurance_email: null,
      })
      .eq('id', booking.id);

    console.log(`[Booking] Annie's insurance selected for ${booking.booking_code}: ${tier}`);
  } else if (source === 'own') {
    // Customer has their own insurance — mark as own (details stored in rental_agreements)
    await supabase
      .from('bookings')
      .update({
        insurance_provider: 'own',
        insurance_policy_number: null,
        insurance_email: null,
      })
      .eq('id', booking.id);

    console.log(`[Booking] Customer has own insurance for ${booking.booking_code}`);
  } else if (bonzah_policy_number) {
    // Legacy Bonzah flow — backward compatible
    await supabase
      .from('bookings')
      .update({
        insurance_provider: 'bonzah',
        insurance_policy_number: bonzah_policy_number,
        insurance_email: bonzah_email || null,
      })
      .eq('id', booking.id);

    console.log(`[Booking] Bonzah insurance updated for ${booking.booking_code}: ${bonzah_policy_number}`);
  } else {
    return res.status(400).json({ error: 'Insurance source is required (own, annies, or bonzah_policy_number)' });
  }

  res.json({ success: true, booking_code: booking.booking_code });
}));

export default router;
