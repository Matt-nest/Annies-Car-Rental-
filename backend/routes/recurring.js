import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  createRecurringRental,
  listRecurringForCustomer,
  pauseRecurring,
  resumeRecurring,
  cancelRecurring,
} from '../services/recurringRentalService.js';

const router = Router();

/** GET /recurring/customer/:customerId — all of a customer's plans + charges. */
router.get('/customer/:customerId', requireAuth, asyncHandler(async (req, res) => {
  res.json(await listRecurringForCustomer(req.params.customerId));
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

export default router;
