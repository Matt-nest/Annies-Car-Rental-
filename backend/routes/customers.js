import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

/** GET /customers — list with search */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  let query = supabase
    .from('customers')
    .select('*')
    .order(req.query.sort || 'created_at', { ascending: false });

  if (req.query.q) {
    const q = req.query.q;
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/** GET /customers/:id — detail with booking history */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (cErr) throw cErr;
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, vehicles(year, make, model)')
    .eq('customer_id', req.params.id)
    .order('created_at', { ascending: false });

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('customer_id', req.params.id)
    .order('created_at', { ascending: false });

  res.json({ ...customer, bookings: bookings || [], reviews: reviews || [] });
}));

/** GET /customers/:id/bookings */
router.get('/:id/bookings', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, vehicles(year, make, model, vehicle_code)')
    .eq('customer_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json(data);
}));

/** PUT /customers/:id */
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('customers')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

export default router;
