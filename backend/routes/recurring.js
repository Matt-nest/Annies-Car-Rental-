import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  createRecurringRental,
  listRecurringForCustomer,
  pauseRecurring,
  resumeRecurring,
  cancelRecurring,
  markChargePaid,
} from '../services/recurringRentalService.js';

const router = Router();

/** GET /recurring/customer/:customerId — all of a customer's plans + charges. */
router.get('/customer/:customerId', requireAuth, asyncHandler(async (req, res) => {
  res.json(await listRecurringForCustomer(req.params.customerId));
}));

/** GET /recurring/customer/:customerId/cards — the customer's saved cards (to
 *  pick which one an auto-charge plan bills). */
router.get('/customer/:customerId/cards', requireAuth, asyncHandler(async (req, res) => {
  const { listCards } = await import('../services/squarePortalCardsService.js');
  try {
    res.json(await listCards(req.params.customerId));
  } catch (err) {
    // Non-Square or no profile yet — return empty so the UI can fall back to send_link.
    res.json([]);
  }
}));

/**
 * POST /recurring — create a recurring rental plan.
 * Body: { customerId, amount, interval, intervalCount, collectionMethod,
 *         squareCardId?, vehicleId?, bookingId?, startDate?, billingAnchorDay?, notes? }
 */
router.post('/', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  try {
    const plan = await createRecurringRental({ ...req.body, createdBy: req.user?.id || null });
    res.status(201).json(plan);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}));

/** POST /recurring/:id/pause | /resume | /cancel — lifecycle actions. */
router.post('/:id/pause', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  res.json(await pauseRecurring(req.params.id));
}));
router.post('/:id/resume', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  res.json(await resumeRecurring(req.params.id));
}));
router.post('/:id/cancel', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  res.json(await cancelRecurring(req.params.id));
}));

/** POST /recurring/charges/:chargeId/mark-paid — manual reconciliation of a cycle. */
router.post('/charges/:chargeId/mark-paid', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  try {
    res.json(await markChargePaid(req.params.chargeId, { squarePaymentId: req.body?.squarePaymentId }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}));

export default router;
