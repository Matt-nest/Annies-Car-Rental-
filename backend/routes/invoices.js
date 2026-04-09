import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateInvoice, getInvoice, markInvoiceSent } from '../services/invoiceService.js';

const router = Router();

/**
 * POST /bookings/:id/invoice — Generate invoice for a booking
 */
router.post('/bookings/:id/invoice', requireAuth, async (req, res) => {
  try {
    const invoice = await generateInvoice(req.params.id);
    res.json(invoice);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /bookings/:id/invoice — Get invoice for a booking
 */
router.get('/bookings/:id/invoice', requireAuth, async (req, res) => {
  try {
    const invoice = await getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'No invoice found for this booking' });
    }
    res.json(invoice);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /invoices/:id/send — Mark invoice as sent (called after email dispatch)
 */
router.post('/invoices/:id/send', requireAuth, async (req, res) => {
  try {
    const result = await markInvoiceSent(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
