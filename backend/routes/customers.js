import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// SMS opt-out admin routes (Phase 1 — migration 018 audit log)
// Placed BEFORE /:id routes so the literal path matches first.
// ────────────────────────────────────────────────────────────────────────────

/** GET /customers/sms-opt-outs — list opted-out customers, newest first. */
router.get('/sms-opt-outs', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone, sms_opt_out_at')
    .eq('sms_opt_out', true)
    .order('sms_opt_out_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  res.json(data || []);
}));

/** POST /customers/:id/sms-opt-in — clear the opt-out flag + write audit row. */
router.post('/:id/sms-opt-in', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { note } = req.body || {};

  // Verify the customer is actually opted out (no-op otherwise)
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('id, sms_opt_out')
    .eq('id', req.params.id)
    .single();
  if (cErr) throw cErr;
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (!customer.sms_opt_out) return res.status(409).json({ error: 'Customer is not opted out' });

  // Clear the flag
  const { error: updateErr } = await supabase
    .from('customers')
    .update({ sms_opt_out: false, sms_opt_out_at: null })
    .eq('id', req.params.id);
  if (updateErr) throw updateErr;

  // Audit log row — captures who/why for TCPA defensibility
  await supabase.from('sms_opt_out_log').insert({
    customer_id: req.params.id,
    action: 'opt_in',
    source: 'admin',
    actor_id: req.user?.id || null,
    note: note || null,
  });

  res.json({ success: true });
}));

/** PATCH /customers/:id/trust — toggle is_trusted (auto-approve future bookings). */
router.patch('/:id/trust', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { is_trusted, note } = req.body || {};
  if (typeof is_trusted !== 'boolean') {
    return res.status(400).json({ error: 'is_trusted (boolean) is required' });
  }

  const updates = {
    is_trusted,
    trusted_at: is_trusted ? new Date().toISOString() : null,
    trusted_by: is_trusted ? (req.user?.id || null) : null,
    trusted_note: is_trusted ? (note || null) : null,
  };

  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, is_trusted, trusted_at, trusted_by, trusted_note')
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Customer not found' });
  res.json(data);
}));

/** GET /customers — list with search, includes booking stats */
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

  // Fetch booking stats for each customer via explicit query (not join)
  const customerIds = (data || []).map(c => c.id);

  let bookingsByCustomer = {};
  if (customerIds.length > 0) {
    const { data: allBookings } = await supabase
      .from('bookings')
      .select('id, customer_id, status, total_cost')
      .in('customer_id', customerIds);

    for (const b of (allBookings || [])) {
      if (!bookingsByCustomer[b.customer_id]) bookingsByCustomer[b.customer_id] = [];
      bookingsByCustomer[b.customer_id].push(b);
    }
  }

  const revenueStatuses = ['completed', 'active', 'returned', 'confirmed', 'approved'];

  const enriched = (data || []).map(c => {
    const bks = bookingsByCustomer[c.id] || [];
    const revBookings = bks.filter(b => revenueStatuses.includes(b.status));
    return {
      ...c,
      total_rentals: bks.length,
      total_revenue: revBookings.reduce((sum, b) => sum + Number(b.total_cost || 0), 0),
    };
  });

  res.json(enriched);
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
    .select('*, vehicles(year, make, model), rental_agreements(*)')
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
