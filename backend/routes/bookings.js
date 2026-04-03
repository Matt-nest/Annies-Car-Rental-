import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireApiKey } from '../middleware/apiKey.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateBookingPayload } from '../utils/validators.js';
import { createBooking, transitionBooking, getBookingDetail } from '../services/bookingService.js';

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

  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
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
  res.json(result);
}));

/** POST /bookings/:id/return */
router.post('/:id/return', requireAuth, asyncHandler(async (req, res) => {
  const { mileage, fuel_level, condition_notes, photos = [] } = req.body;
  const result = await transitionBooking(req.params.id, 'returned', {
    changedBy: req.user?.email || 'owner',
    reason: 'Vehicle returned',
    extraFields: {
      return_mileage: mileage,
      return_fuel_level: fuel_level,
      return_condition_notes: condition_notes,
      return_photos: photos,
    },
  });
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

export default router;
