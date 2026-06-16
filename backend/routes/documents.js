import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { listDocuments, getDocumentDownloadUrl } from '../services/documentService.js';

const router = Router();

/** GET /customers/:id/documents — the customer's contract + invoice folder */
router.get('/customers/:id/documents', requireAuth, asyncHandler(async (req, res) => {
  res.json(await listDocuments({ customerId: req.params.id }));
}));

/** GET /bookings/:id/documents — documents generated for one booking */
router.get('/bookings/:id/documents', requireAuth, asyncHandler(async (req, res) => {
  res.json(await listDocuments({ bookingId: req.params.id }));
}));

/** GET /documents/:id/download — short-lived signed URL for one archived PDF */
router.get('/documents/:id/download', requireAuth, asyncHandler(async (req, res) => {
  res.json(await getDocumentDownloadUrl(req.params.id));
}));

export default router;
