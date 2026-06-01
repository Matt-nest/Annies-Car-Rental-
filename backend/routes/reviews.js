import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const reviewRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many review submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** POST /reviews — public, rate-limited */
router.post('/', reviewRateLimit, asyncHandler(async (req, res) => {
  const { booking_code, reviewer_name, rating, comment, vehicle_name } = req.body;

  if (!reviewer_name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!comment?.trim())        return res.status(400).json({ error: 'Comment is required' });
  const stars = Number(rating);
  if (!stars || stars < 1 || stars > 5) return res.status(400).json({ error: 'Rating must be 1–5' });

  // Resolve booking UUID from booking_code if provided
  let booking_id = null;
  if (booking_code?.trim()) {
    const { data: bk } = await supabase
      .from('bookings')
      .select('id')
      .eq('booking_code', booking_code.trim().toUpperCase())
      .single();
    if (bk) booking_id = bk.id;
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      booking_id,
      booking_code: booking_code?.trim().toUpperCase() || null,
      reviewer_name: reviewer_name.trim(),
      rating: stars,
      comment: comment.trim(),
      vehicle_name: vehicle_name?.trim() || null,
      approved: false,
    })
    .select('id')
    .single();

  if (error) throw error;
  res.status(201).json({ success: true, id: data.id });
}));

/** GET /reviews — public, approved only */
router.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, reviewer_name, rating, comment, vehicle_name, created_at')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  res.json(data || []);
}));

/** GET /reviews/pending — admin */
router.get('/pending', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('approved', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json(data || []);
}));

/** PATCH /reviews/:id — admin approve/reject */
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { approved } = req.body;
  if (typeof approved !== 'boolean') {
    return res.status(400).json({ error: 'approved (boolean) is required' });
  }

  const { data, error } = await supabase
    .from('reviews')
    .update({ approved })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Review not found' });
  res.json(data);
}));

/** DELETE /reviews/:id — admin */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ success: true });
}));

export default router;
