import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateInvoice, getInvoice, markInvoiceSent, sendInvoiceEmail } from '../services/invoiceService.js';
import { getBookingDetail } from '../services/bookingService.js';
import { generateInvoicePdf, generateInvoiceNumber } from '../utils/invoicePdfGenerator.js';
import { supabase } from '../db/supabase.js';
import { safeRecordMoneyAction } from '../services/moneyActionAuditService.js';

const router = Router();

/**
 * POST /bookings/:id/invoice — Generate invoice for a booking
 */
router.post('/bookings/:id/invoice', requireAuth, async (req, res) => {
  try {
    const invoice = await generateInvoice(req.params.id);
    await safeRecordMoneyAction({
      req,
      actionKey: 'invoice_generated',
      title: 'Invoice generated',
      detail: 'Operator generated a booking settlement invoice.',
      bookingId: req.params.id,
      invoiceId: invoice?.id,
      amountCents: invoice?.amount_due,
      metadata: {
        invoice_number: invoice?.invoice_number || null,
        status: invoice?.status || null,
      },
    });
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
 * GET /bookings/:id/invoice/pdf — Generate and download invoice PDF
 *
 * Streams a professional PDF invoice for the booking. The invoice record
 * is upserted into the invoices table so every download is tracked.
 * Internal use only — not sent to customers.
 */
router.get('/bookings/:id/invoice/pdf', requireAuth, async (req, res) => {
  try {
    const booking = await getBookingDetail(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Generate or reuse invoice number
    let invoiceNumber;
    const { data: existing } = await supabase
      .from('invoices')
      .select('id, invoice_number')
      .eq('booking_id', req.params.id)
      .maybeSingle();

    if (existing?.invoice_number) {
      invoiceNumber = existing.invoice_number;
    } else {
      invoiceNumber = generateInvoiceNumber(booking);

      // Upsert the invoice record so it's tracked
      if (existing) {
        await supabase
          .from('invoices')
          .update({ invoice_number: invoiceNumber, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('invoices')
          .insert({
            booking_id: req.params.id,
            invoice_number: invoiceNumber,
            items: [],
            subtotal: 0,
            deposit_applied: 0,
            amount_due: 0,
            status: 'draft',
          })
          .select()
          .maybeSingle();
      }
    }

    // Set response headers for PDF download
    const filename = `Invoice-${booking.booking_code}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await generateInvoicePdf({ booking, invoiceNumber, stream: res });
  } catch (err) {
    console.error('[Invoice PDF] Error:', err);
    // Only send error if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
});

/**
 * POST /invoices/:id/send — Send invoice email to customer + mark as sent
 */
router.post('/invoices/:id/send', requireAuth, async (req, res) => {
  try {
    const { data: invoiceBefore } = await supabase
      .from('invoices')
      .select('id, booking_id, amount_due, invoice_number, status')
      .eq('id', req.params.id)
      .maybeSingle();
    const result = await sendInvoiceEmail(req.params.id);
    await safeRecordMoneyAction({
      req,
      actionKey: 'invoice_sent',
      title: 'Invoice sent',
      detail: `Invoice emailed to ${result?.sentTo || 'customer'}.`,
      bookingId: invoiceBefore?.booking_id,
      invoiceId: req.params.id,
      amountCents: invoiceBefore?.amount_due,
      metadata: {
        invoice_number: invoiceBefore?.invoice_number || null,
        sent_to: result?.sentTo || null,
        previous_status: invoiceBefore?.status || null,
      },
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
