import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  cancelPlan,
  chargeInstallment,
  createPlan,
  getPlan,
} from '../services/installmentService.js';
import { safeRecordMoneyAction } from '../services/moneyActionAuditService.js';

const router = Router();

router.get('/bookings/:bookingId/payment-plan', requireAuth, asyncHandler(async (req, res) => {
  const plan = await getPlan(req.params.bookingId);
  res.json(plan);
}));

router.post('/bookings/:bookingId/payment-plan', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const plan = await createPlan(req.params.bookingId, {
    interval: req.body?.interval,
    installmentCount: req.body?.installmentCount,
    startDate: req.body?.startDate,
    actor: req.user?.email || 'admin',
  });
  await safeRecordMoneyAction({
    req,
    actionKey: 'payment_plan_created',
    title: 'Payment plan created',
    detail: `${req.body?.installmentCount || plan?.summary?.count || ''} ${req.body?.interval || plan?.plan?.interval || ''} installments`.trim(),
    bookingId: req.params.bookingId,
    planId: plan?.plan?.id,
    amountCents: plan?.summary?.totalCents || plan?.plan?.total_cents,
    metadata: {
      interval: req.body?.interval,
      installment_count: req.body?.installmentCount,
      start_date: req.body?.startDate,
      summary: plan?.summary || null,
    },
  });
  res.status(201).json(plan);
}));

router.post('/installments/:installmentId/charge', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const result = await chargeInstallment(req.params.installmentId, {
    actor: req.user?.email || 'admin',
  });
  await safeRecordMoneyAction({
    req,
    actionKey: 'installment_charge_submitted',
    title: result?.status === 'paid' ? 'Installment charged' : 'Installment charge attempted',
    detail: result?.reason || 'Operator submitted an installment charge.',
    status: result?.status === 'paid' ? 'completed' : 'failed',
    installmentId: req.params.installmentId,
    metadata: { result },
  });
  res.json(result);
}));

router.post('/payment-plans/:planId/cancel', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const result = await cancelPlan(req.params.planId, req.user?.email || 'admin');
  await safeRecordMoneyAction({
    req,
    actionKey: 'payment_plan_cancelled',
    title: 'Payment plan cancelled',
    detail: 'Remaining scheduled installments were cancelled.',
    status: result?.status === 'cancelled' ? 'completed' : 'skipped',
    bookingId: result?.booking_id,
    planId: req.params.planId,
    metadata: { result },
  });
  res.json(result);
}));

export default router;
