import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateDamageReportPayload } from '../utils/validators.js';

const router = Router();

/** POST /bookings/:bookingId/damage */
router.post('/bookings/:bookingId/damage', requireAuth, asyncHandler(async (req, res) => {
  const errors = validateDamageReportPayload(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  // Get vehicle_id from booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('vehicle_id')
    .eq('id', req.params.bookingId)
    .single();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Whitelist allowed fields — prevent arbitrary column injection
  const { description, severity, location, photos, damage_type, estimated_cost } = req.body;

  const { data, error } = await supabase
    .from('damage_reports')
    .insert({
      booking_id: req.params.bookingId,
      vehicle_id: booking.vehicle_id,
      description,
      severity,
      location,
      photos,
      damage_type: damage_type || null,
      estimated_cost: estimated_cost || null,
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/** GET /damage-reports — list all (admin) */
router.get('/damage-reports', requireAuth, asyncHandler(async (req, res) => {
  let query = supabase
    .from('damage_reports')
    .select('*, bookings(booking_code), vehicles(year, make, model)')
    .order('reported_at', { ascending: false });

  if (req.query.severity) query = query.eq('severity', req.query.severity);
  if (req.query.vehicle_id) query = query.eq('vehicle_id', req.query.vehicle_id);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/** PUT /damage-reports/:id */
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('damage_reports')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/** DELETE /blocked-dates/:id */
router.delete('/blocked-dates/:id', requireAuth, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('blocked_dates')
    .delete()
    .eq('id', req.params.id);

  if (error) throw error;
  res.json({ success: true });
}));

export default router;
