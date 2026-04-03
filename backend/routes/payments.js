import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validatePaymentPayload } from '../utils/validators.js';

const router = Router();

/** GET /bookings/:bookingId/payments */
router.get('/bookings/:bookingId/payments', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', req.params.bookingId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json(data);
}));

/** POST /bookings/:bookingId/payments */
router.post('/bookings/:bookingId/payments', requireAuth, asyncHandler(async (req, res) => {
  const errors = validatePaymentPayload(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const { payment_type, amount, method, reference_id, notes, paid_at } = req.body;

  const { data, error } = await supabase
    .from('payments')
    .insert({
      booking_id: req.params.bookingId,
      payment_type,
      amount,
      method,
      reference_id,
      notes,
      paid_at: paid_at || new Date().toISOString(),
      status: 'completed',
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/** PATCH /payments/:id */
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

export default router;
