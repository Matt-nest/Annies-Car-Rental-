import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// 3 submissions per IP per hour — prevents spam without blocking genuine interest
const inquiryRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many inquiry requests. Please call us directly at (772) 985-6667.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** POST /monthly-inquiries — public, rate-limited */
router.post('/', inquiryRateLimit, asyncHandler(async (req, res) => {
  const {
    vehicle_id, name, phone,
    email,
    pickup_date, start_date,        // accept both; start_date from customer site
    return_date,
    message, notes,                  // accept both; notes from customer site
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!phone?.trim()) return res.status(400).json({ error: 'Phone number is required' });
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const { data, error } = await supabase
    .from('monthly_inquiries')
    .insert({
      vehicle_id: vehicle_id || null,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      pickup_date: pickup_date || start_date || null,
      return_date: return_date || null,
      message: (message || notes)?.trim() || null,
    })
    .select('id')
    .single();

  if (error) throw error;

  res.status(201).json({ success: true, id: data.id });
}));

/** GET /monthly-inquiries — admin list with optional status filter */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  let query = supabase
    .from('monthly_inquiries')
    .select('*, vehicles(year, make, model, vehicle_code)')
    .order('created_at', { ascending: false });

  if (req.query.status) query = query.eq('status', req.query.status);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/** PATCH /monthly-inquiries/:id — admin updates status and/or notes */
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  const updates = {};

  if (status !== undefined) {
    const allowed = ['new', 'contacted', 'converted', 'closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    updates.status = status;
    if (status === 'contacted') updates.contacted_at = new Date().toISOString();
  }
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided (status, notes)' });
  }

  const { data, error } = await supabase
    .from('monthly_inquiries')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Inquiry not found' });
  res.json(data);
}));

export default router;
