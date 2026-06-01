import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';

const router = Router();

/**
 * GET /bookings/:id/addons — Get add-ons for a booking
 */
router.get('/bookings/:id/addons', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('booking_addons')
      .select('*')
      .eq('booking_id', req.params.id);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /bookings/:id/addons — Save add-ons for a booking
 * Body: { addons: [{ addon_type, amount }] }
 * Public — called during booking flow (no auth required)
 */
router.post('/bookings/:id/addons', async (req, res) => {
  try {
    const { addons } = req.body;
    if (!Array.isArray(addons)) {
      return res.status(400).json({ error: 'addons must be an array' });
    }

    const bookingId = req.params.id;

    // Verify booking exists
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('id, booking_code')
      .eq('id', bookingId)
      .maybeSingle();

    // Also try by booking_code
    let resolvedId = booking?.id;
    if (!booking) {
      const { data: byCode } = await supabase
        .from('bookings')
        .select('id')
        .eq('booking_code', bookingId)
        .maybeSingle();
      resolvedId = byCode?.id;
    }

    if (!resolvedId) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Delete existing add-ons and replace
    await supabase
      .from('booking_addons')
      .delete()
      .eq('booking_id', resolvedId);

    // Insert new add-ons
    if (addons.length > 0) {
      const rows = addons.map(a => ({
        booking_id: resolvedId,
        addon_type: a.addon_type,
        amount: a.amount,
      }));

      const { error: insertErr } = await supabase
        .from('booking_addons')
        .insert(rows);

      if (insertErr) throw insertErr;
    }

    // Update booking flags
    const flags = {
      has_unlimited_miles: addons.some(a => a.addon_type === 'unlimited_miles'),
      has_unlimited_tolls: addons.some(a => a.addon_type === 'unlimited_tolls'),
      has_delivery: addons.some(a => a.addon_type === 'delivery'),
    };

    await supabase
      .from('bookings')
      .update(flags)
      .eq('id', resolvedId);

    res.json({ success: true, addons: addons.length });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
