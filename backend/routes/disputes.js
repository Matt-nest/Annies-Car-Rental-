import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';

const router = Router();

/**
 * GET /disputes — List all disputes (admin)
 * Query: ?status=open (optional filter)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = supabase
      .from('customer_disputes')
      .select('*, invoices(*), bookings(booking_code, customer_id, customers(first_name, last_name, email))')
      .order('created_at', { ascending: false });

    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * PUT /disputes/:id — Resolve or reject a dispute
 * Body: { status, admin_response }
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { status, admin_response } = req.body;

    if (!['resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "resolved" or "rejected"' });
    }

    const { data, error } = await supabase
      .from('customer_disputes')
      .update({
        status,
        admin_response,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // If resolved, update the invoice status
    if (status === 'resolved' && data.invoice_id) {
      await supabase
        .from('invoices')
        .update({ status: 'disputed' })
        .eq('id', data.invoice_id);
    }

    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
