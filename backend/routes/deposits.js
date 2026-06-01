import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';
import { getVehicleDepositAmount, releaseDeposit, settleDeposit } from '../services/depositService.js';

const router = Router();

/**
 * GET /vehicles/:id/deposit — Get deposit config for a vehicle
 */
router.get('/vehicles/:id/deposit', requireAuth, async (req, res) => {
  try {
    const amount = await getVehicleDepositAmount(req.params.id);
    res.json({ vehicle_id: req.params.id, amount, dollars: (amount / 100).toFixed(2) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /bookings/:id/deposit — Get deposit status for a booking
 */
router.get('/bookings/:id/deposit', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('booking_deposits')
      .select('*')
      .eq('booking_id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    res.json(data || { status: 'none' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /bookings/:id/deposit/release — Refund full deposit
 */
router.post('/bookings/:id/deposit/release', requireAuth, async (req, res) => {
  try {
    const result = await releaseDeposit(req.params.id, { refundedBy: req.user?.email || 'admin' });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /bookings/:id/deposit/settle — Settle deposit against incidentals
 */
router.post('/bookings/:id/deposit/settle', requireAuth, async (req, res) => {
  try {
    const { incidentalTotal } = req.body;
    const result = await settleDeposit(req.params.id, {
      incidentalTotal,
      refundedBy: req.user?.email || 'admin',
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
