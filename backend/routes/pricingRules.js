import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// GET /pricing-rules — list all, newest first
router.get('/', asyncHandler(async (_req, res) => {
  const { data, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .order('start_date', { ascending: true });
  if (error) throw error;
  res.json(data || []);
}));

// POST /pricing-rules — create
router.post('/', asyncHandler(async (req, res) => {
  const { name, start_date, end_date, multiplier, vehicle_ids, active } = req.body;
  if (!name || !start_date || !end_date || multiplier == null) {
    return res.status(400).json({ error: 'name, start_date, end_date, multiplier are required' });
  }
  if (start_date > end_date) {
    return res.status(400).json({ error: 'start_date must be before end_date' });
  }
  if (multiplier <= 0 || multiplier > 10) {
    return res.status(400).json({ error: 'multiplier must be between 0.01 and 10' });
  }
  const { data, error } = await supabase
    .from('pricing_rules')
    .insert({ name, start_date, end_date, multiplier, vehicle_ids: vehicle_ids || null, active: active !== false })
    .select()
    .single();
  if (error) throw error;
  res.status(201).json(data);
}));

// PATCH /pricing-rules/:id — update
router.patch('/:id', asyncHandler(async (req, res) => {
  const allowed = ['name', 'start_date', 'end_date', 'multiplier', 'vehicle_ids', 'active'];
  const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  const { data, error } = await supabase
    .from('pricing_rules')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Rule not found' });
  res.json(data);
}));

// DELETE /pricing-rules/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('pricing_rules')
    .delete()
    .eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

export default router;
