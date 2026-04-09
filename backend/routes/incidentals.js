import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';

const router = Router();

/**
 * GET /bookings/:id/incidentals — List incidentals for a booking
 */
router.get('/bookings/:id/incidentals', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('incidentals')
      .select('*')
      .eq('booking_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /bookings/:id/incidentals — Add an incidental charge
 * Body: { type, amount, description, photoUrls, waived }
 */
router.post('/bookings/:id/incidentals', requireAuth, async (req, res) => {
  try {
    const { type, amount, description, photoUrls, waived } = req.body;

    if (!type || amount === undefined) {
      return res.status(400).json({ error: 'type and amount are required' });
    }

    const { data, error } = await supabase
      .from('incidentals')
      .insert({
        booking_id: req.params.id,
        type,
        amount,
        description,
        photo_urls: photoUrls || [],
        waived: waived || false,
        created_by: req.user?.email || 'admin',
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
 * PUT /incidentals/:id — Update an incidental
 * Body: { amount, description, waived }
 */
router.put('/incidentals/:id', requireAuth, async (req, res) => {
  try {
    const { amount, description, waived } = req.body;

    const updateFields = {};
    if (amount !== undefined) updateFields.amount = amount;
    if (description !== undefined) updateFields.description = description;
    if (waived !== undefined) updateFields.waived = waived;

    const { data, error } = await supabase
      .from('incidentals')
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
 * DELETE /incidentals/:id — Delete an incidental
 */
router.delete('/incidentals/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('incidentals')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
