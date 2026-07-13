import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  cancelPlan,
  chargeInstallment,
  createPlan,
  getPlan,
} from '../services/installmentService.js';

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
  res.status(201).json(plan);
}));

router.post('/installments/:installmentId/charge', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const result = await chargeInstallment(req.params.installmentId, {
    actor: req.user?.email || 'admin',
  });
  res.json(result);
}));

router.post('/payment-plans/:planId/cancel', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const result = await cancelPlan(req.params.planId, req.user?.email || 'admin');
  res.json(result);
}));

export default router;
