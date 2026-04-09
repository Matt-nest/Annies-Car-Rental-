import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';
import { transitionBooking, getBookingDetail } from '../services/bookingService.js';

const router = Router();

/**
 * POST /bookings/:id/checkin — Admin records vehicle check-in prep
 * Body: { odometer, fuelLevel, conditionNotes, photoUrls }
 */
router.post('/bookings/:id/checkin', requireAuth, async (req, res) => {
  try {
    const { odometer, fuelLevel, conditionNotes, photoUrls } = req.body;

    // Save check-in record
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

    // Update booking with checkin odometer
    if (odometer) {
      await supabase
        .from('bookings')
        .update({ checkin_odometer: odometer, pickup_mileage: odometer, pickup_fuel_level: fuelLevel })
        .eq('id', req.params.id);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /bookings/:id/checkout — Admin records vehicle check-out / return
 * Body: { odometer, fuelLevel, conditionNotes, photoUrls }
 */
router.post('/bookings/:id/checkout', requireAuth, async (req, res) => {
  try {
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
    if (odometer) {
      await supabase
        .from('bookings')
        .update({ checkout_odometer: odometer, return_mileage: odometer, return_fuel_level: fuelLevel })
        .eq('id', req.params.id);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * PATCH /bookings/:id/ready — Mark vehicle as ready for pickup
 * Transitions booking from confirmed → ready_for_pickup
 */
router.patch('/bookings/:id/ready', requireAuth, async (req, res) => {
  try {
    const result = await transitionBooking(req.params.id, 'ready_for_pickup', {
      changedBy: req.user?.email || 'admin',
      reason: 'Vehicle prepared and marked ready for pickup',
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /bookings/:id/inspection — Admin performs post-return inspection
 * Body: { checkoutOdometer, fuelLevel, conditionNotes, photoUrls, incidentals }
 */
router.post('/bookings/:id/inspection', requireAuth, async (req, res) => {
  try {
    // Lazy-import to avoid circular dependency
    const { performInspection } = await import('../services/inspectionService.js');
    const result = await performInspection(req.params.id, {
      ...req.body,
      inspectedBy: req.user?.email || 'admin',
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /bookings/:id/lockbox — Get lockbox code for a booking
 * Only returns code when status is ready_for_pickup or active
 */
router.get('/bookings/:id/lockbox', requireAuth, async (req, res) => {
  try {
    const booking = await getBookingDetail(req.params.id);

    if (!['ready_for_pickup', 'active'].includes(booking.status)) {
      return res.status(403).json({ error: 'Lockbox code not available for this booking status' });
    }

    const lockboxCode = booking.vehicles?.lockbox_code || '2580'; // fallback default

    res.json({ lockbox_code: lockboxCode });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /bookings/:id/checkin-records — Get all check-in/check-out records for a booking
 */
router.get('/bookings/:id/checkin-records', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('checkin_records')
      .select('*')
      .eq('booking_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
