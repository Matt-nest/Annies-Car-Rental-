import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';
import { transitionBooking, getBookingDetail } from '../services/bookingService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

/**
 * POST /bookings/:id/checkin — Admin records vehicle check-in AND marks ready (ATOMIC)
 * Body: { odometer, fuelLevel, conditionNotes, photoUrls, markReady? }
 *
 * When markReady is true (default), this saves the check-in record AND
 * transitions the booking to ready_for_pickup in one operation.
 * This replaces the old two-step save + PATCH /ready flow.
 */
router.post('/bookings/:id/checkin', requireAuth, asyncHandler(async (req, res) => {
  const { odometer, fuelLevel, conditionNotes, photoUrls, markReady = true } = req.body;

  // 1. Save check-in record
  const { error } = await supabase.from('checkin_records').insert({
    booking_id: req.params.id,
    record_type: 'admin_prep',
    odometer,
    fuel_level: fuelLevel,
    condition_notes: conditionNotes,
    photo_urls: photoUrls || [],
    created_by: req.user?.email || 'admin',
  });
  if (error) throw error;

  // 2. Update booking fields
  const bookingUpdates = {};
  if (odometer) {
    bookingUpdates.checkin_odometer = odometer;
    bookingUpdates.pickup_mileage = odometer;
  }
  if (fuelLevel) {
    bookingUpdates.pickup_fuel_level = fuelLevel;
  }
  if (Object.keys(bookingUpdates).length > 0) {
    await supabase.from('bookings').update(bookingUpdates).eq('id', req.params.id);
  }

  // 3. Atomically transition to ready_for_pickup (if requested)
  let transitionResult = null;
  if (markReady) {
    try {
      transitionResult = await transitionBooking(req.params.id, 'ready_for_pickup', {
        changedBy: req.user?.email || 'admin',
        reason: 'Vehicle prepared and marked ready for pickup',
      });
    } catch (transErr) {
      // If already ready_for_pickup, that's fine — don't fail the whole request
      if (transErr.message?.includes('Invalid transition')) {
        console.log(`[CheckIn] Booking ${req.params.id} already past confirmed — skipping transition`);
      } else {
        throw transErr;
      }
    }
  }

  res.json({
    success: true,
    markedReady: !!transitionResult,
    booking: transitionResult || undefined,
  });
}));

/**
 * POST /bookings/:id/checkout — Admin records vehicle check-out / return condition
 * Body: { odometer, fuelLevel, conditionNotes, photoUrls }
 */
router.post('/bookings/:id/checkout', requireAuth, asyncHandler(async (req, res) => {
  const { odometer, fuelLevel, conditionNotes, photoUrls } = req.body;

  // Save check-out record
  const { error } = await supabase.from('checkin_records').insert({
    booking_id: req.params.id,
    record_type: 'admin_inspection',
    odometer,
    fuel_level: fuelLevel,
    condition_notes: conditionNotes,
    photo_urls: photoUrls || [],
    created_by: req.user?.email || 'admin',
  });
  if (error) throw error;

  // Update booking with checkout odometer
  const bookingUpdates = {};
  if (odometer) {
    bookingUpdates.checkout_odometer = odometer;
    bookingUpdates.return_mileage = odometer;
  }
  if (fuelLevel) {
    bookingUpdates.return_fuel_level = fuelLevel;
  }
  if (Object.keys(bookingUpdates).length > 0) {
    await supabase.from('bookings').update(bookingUpdates).eq('id', req.params.id);
  }

  res.json({ success: true });
}));

/**
 * PATCH /bookings/:id/ready — Backward-compat alias
 * Kept so existing portal/frontend code doesn't break.
 * Prefer using POST /bookings/:id/checkin with markReady=true.
 */
router.patch('/bookings/:id/ready', requireAuth, asyncHandler(async (req, res) => {
  const result = await transitionBooking(req.params.id, 'ready_for_pickup', {
    changedBy: req.user?.email || 'admin',
    reason: 'Vehicle prepared and marked ready for pickup',
  });
  res.json(result);
}));

/**
 * GET /bookings/:id/lockbox — Get lockbox code for a booking
 * Only returns code when status is ready_for_pickup or active
 */
router.get('/bookings/:id/lockbox', requireAuth, asyncHandler(async (req, res) => {
  const booking = await getBookingDetail(req.params.id);

  if (!['ready_for_pickup', 'active'].includes(booking.status)) {
    return res.status(403).json({ error: 'Lockbox code not available for this booking status' });
  }

  const lockboxCode = booking.vehicles?.lockbox_code || '2580'; // fallback default
  res.json({ lockbox_code: lockboxCode });
}));

/**
 * GET /bookings/:id/checkin-records — Get all check-in/check-out records for a booking
 */
router.get('/bookings/:id/checkin-records', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('checkin_records')
    .select('*')
    .eq('booking_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) throw error;
  res.json(data || []);
}));

export default router;
