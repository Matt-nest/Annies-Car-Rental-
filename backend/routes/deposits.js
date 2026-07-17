import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';
import { getVehicleDepositAmount, releaseDeposit, settleDeposit, listDeposits, recordManualDeposit } from '../services/depositService.js';
import { safeRecordMoneyAction } from '../services/moneyActionAuditService.js';

const router = Router();

/**
 * GET /deposits — List deposits for dashboard reporting
 * Query: ?status=held|all|refunded|applied
 */
router.get('/deposits', requireAuth, async (req, res) => {
  try {
    const status = req.query.status || 'held';
    const rows = await listDeposits({ status });
    const totalHeldCents = rows.reduce((sum, row) => {
      const refundable = Math.max(0, Number(row.amount || 0) - Number(row.refund_amount || 0) - Number(row.applied_amount || 0));
      return sum + refundable;
    }, 0);
    res.json({
      data: rows,
      summary: {
        count: rows.length,
        total_held_cents: totalHeldCents,
        total_held_dollars: (totalHeldCents / 100).toFixed(2),
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

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

    if (data) return res.json(data);

    // Expected bookings.deposit_amount is not money held. If the dedicated
    // deposit row is missing, return the expected amount for display only.
    const { data: booking } = await supabase
      .from('bookings')
      .select('deposit_amount, deposit_status')
      .eq('id', req.params.id)
      .maybeSingle();

    if (booking && Number(booking.deposit_amount) > 0) {
      return res.json({
        status: 'none',
        amount: 0,
        expected_amount: Math.round(Number(booking.deposit_amount) * 100),
        expected_status: booking.deposit_status || null,
        source: 'booking_expected',
      });
    }

    res.json({ status: 'none' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /bookings/:id/deposit/release — Refund full deposit
 */
router.post('/bookings/:id/deposit/release', requireAuth, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const result = await releaseDeposit(req.params.id, { refundedBy: req.user?.email || 'admin' });
    await safeRecordMoneyAction({
      req,
      actionKey: 'deposit_released',
      title: result?.alreadyRefunded ? 'Deposit already released' : 'Deposit release submitted',
      detail: 'Full refundable security deposit release was submitted from the dashboard.',
      status: result?.alreadyRefunded ? 'skipped' : 'completed',
      bookingId: req.params.id,
      amountCents: result?.refundedAmount,
      metadata: { result },
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /bookings/:id/deposit/settle — Settle deposit against incidentals
 */
router.post('/bookings/:id/deposit/settle', requireAuth, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { incidentalTotal } = req.body;
    const result = await settleDeposit(req.params.id, {
      incidentalTotal,
      refundedBy: req.user?.email || 'admin',
    });
    await safeRecordMoneyAction({
      req,
      actionKey: 'deposit_settled',
      title: 'Deposit settled',
      detail: 'Security deposit was settled against inspection charges.',
      status: result?.noDeposit ? 'skipped' : 'completed',
      bookingId: req.params.id,
      amountCents: Math.round(Number(incidentalTotal || 0) * 100),
      metadata: { result },
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /bookings/:id/deposit/record — Record a manually-collected deposit
 * Body: { amountCents?, method?, referenceId?, notes? }
 */
router.post('/bookings/:id/deposit/record', requireAuth, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { amountCents, method, referenceId, notes } = req.body || {};
    const result = await recordManualDeposit(req.params.id, {
      amountCents,
      method,
      referenceId,
      notes,
      recordedBy: req.user?.email || 'admin',
    });
    await safeRecordMoneyAction({
      req,
      actionKey: 'deposit_recorded',
      title: `Manual deposit recorded via ${result?.method_label || 'payment method'}`,
      detail: notes || `Manual security deposit was recorded via ${result?.method_label || 'the selected payment method'}.`,
      bookingId: req.params.id,
      amountCents: result?.amount || amountCents,
      metadata: {
        method: result?.method || method,
        method_label: result?.method_label,
        referenceId,
        result,
      },
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
