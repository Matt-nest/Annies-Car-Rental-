import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { listMoneyActions, recordMoneyAction } from '../services/moneyActionAuditService.js';

const router = Router();

router.get('/money-actions', requireAuth, asyncHandler(async (req, res) => {
  const result = await listMoneyActions({
    bookingId: req.query.booking_id,
    customerId: req.query.customer_id,
    actionKey: req.query.action_key,
    limit: req.query.limit,
  });
  res.json(result);
}));

router.post('/money-actions', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const entry = await recordMoneyAction({
    req,
    actionKey: body.actionKey,
    title: body.title,
    detail: body.detail,
    status: body.status || 'completed',
    bookingId: body.bookingId,
    customerId: body.customerId,
    paymentId: body.paymentId,
    depositId: body.depositId,
    invoiceId: body.invoiceId,
    planId: body.planId,
    installmentId: body.installmentId,
    amountCents: body.amountCents,
    currency: body.currency || 'USD',
    metadata: body.metadata || {},
  });
  res.status(201).json({ data: entry });
}));

export default router;
