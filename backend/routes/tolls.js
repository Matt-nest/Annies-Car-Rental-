import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';

const router = Router();

/**
 * GET /vehicles/:id/tolls — List toll charges for a vehicle
 */
router.get('/vehicles/:id/tolls', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('toll_charges')
      .select('*, bookings(booking_code, customer_id, customers(first_name, last_name))')
      .eq('vehicle_id', req.params.id)
      .order('toll_date', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /vehicles/:id/tolls — Add a toll charge
 * Body: { amount, tollDate, description, bookingId }
 */
router.post('/vehicles/:id/tolls', requireAuth, async (req, res) => {
  try {
    const { amount, tollDate, description, bookingId } = req.body;

    if (!amount || !tollDate) {
      return res.status(400).json({ error: 'amount and tollDate are required' });
    }

    const { data, error } = await supabase
      .from('toll_charges')
      .insert({
        vehicle_id: req.params.id,
        booking_id: bookingId || null,
        amount,
        toll_date: tollDate,
        description,
        logged_by: req.user?.email || 'admin',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * PUT /tolls/:id — Update a toll charge
 * Body: { amount, tollDate, description, bookingId }
 */
router.put('/tolls/:id', requireAuth, async (req, res) => {
  try {
    const { amount, tollDate, description, bookingId } = req.body;

    const updateFields = {};
    if (amount !== undefined) updateFields.amount = amount;
    if (tollDate !== undefined) updateFields.toll_date = tollDate;
    if (description !== undefined) updateFields.description = description;
    if (bookingId !== undefined) updateFields.booking_id = bookingId;

    const { data, error } = await supabase
      .from('toll_charges')
      .update(updateFields)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * DELETE /tolls/:id — Delete a toll charge
 */
router.delete('/tolls/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('toll_charges')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
