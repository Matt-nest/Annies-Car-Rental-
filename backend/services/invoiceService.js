import { supabase } from '../db/supabase.js';
import { sendViaResend } from '../utils/mailTransport.js';

import brand from '../config/brand.js';

const SITE_URL = brand.siteUrl;
const LOGO_URL = brand.logoUrl || `${SITE_URL}/logo.png`;

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export function hasCollectedDeposit(deposit) {
  if (!deposit || Number(deposit.amount || 0) <= 0) return false;
  return ['held', 'partial_refund'].includes(String(deposit.status || '').toLowerCase());
}

export function resolveCollectedDepositCents(deposit) {
  if (!hasCollectedDeposit(deposit)) return 0;
  return Math.max(
    0,
    Number(deposit.amount || 0) - Number(deposit.refund_amount || 0)
  );
}

function formatBrandAddress() {
  const loc = brand.location || {};
  const street = loc.address && loc.address !== loc.city ? loc.address : null;
  return [
    street,
    loc.city,
    [loc.state, loc.zip].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');
}


/**
 * Generate an invoice from a booking's incidentals and deposit.
 * Creates a detailed line-item breakdown.
 */
export async function generateInvoice(bookingId) {
  // Check for existing invoice
  const { data: existing } = await supabase
    .from('invoices')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (existing && existing.status !== 'draft') {
    return existing;
  }

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .eq('id', bookingId)
    .single();

  if (bErr || !booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  // Get incidentals
  const { data: incidentals } = await supabase
    .from('incidentals')
    .select('*')
    .eq('booking_id', bookingId);

  // Get deposit. Expected booking.deposit_amount is not money held; only an
  // actual held booking_deposits row can be applied/refunded at checkout.
  const { data: deposit } = await supabase
    .from('booking_deposits')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  // Build line items — checkout invoice is a SETTLEMENT statement,
  // not a repeat of the booking receipt. Only show deposit vs. incidentals.
  const items = [];

  const depositAmount = resolveCollectedDepositCents(deposit);
  if (depositAmount > 0) {
    items.push({
      type: 'deposit',
      description: 'Security Deposit Held',
      amount: depositAmount,
    });
  }

  // Incidentals (only non-waived)
  for (const inc of (incidentals || []).filter(i => !i.waived)) {
    const typeLabels = {
      cleaning: 'Cleaning Fee',
      gas: 'Gas Discrepancy',
      smoking: 'Smoking Fee',
      damage: 'Damage Charge',
      late_return: 'Late Return Fee',
      mileage_overage: 'Mileage Overage',
      toll_violation: 'Toll Violation',
      other: 'Other Charge',
    };
    items.push({
      type: 'incidental',
      description: inc.description || typeLabels[inc.type] || inc.type,
      amount: inc.amount,
    });
  }

  // Amount due: positive = customer owes more, negative = customer gets refund
  const incidentalTotal = (incidentals || []).filter(i => !i.waived).reduce((sum, i) => sum + i.amount, 0);
  const amountDue = incidentalTotal - depositAmount;

  const invoiceData = {
    booking_id: bookingId,
    items,
    subtotal: incidentalTotal,
    deposit_applied: depositAmount,
    amount_due: amountDue,
    status: 'draft',
  };

  if (existing) {
    const { data: updated, error } = await supabase
      .from('invoices')
      .update(invoiceData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  }

  const { data: created, error: createErr } = await supabase
    .from('invoices')
    .insert(invoiceData)
    .select()
    .single();

  if (createErr) throw createErr;
  return created;
}

/**
 * Get invoice for a booking.
 */
export async function getInvoice(bookingId) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Mark invoice as sent after emailing to customer.
 */
export async function markInvoiceSent(invoiceId) {
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invoiceId);

  if (error) throw error;
  return { success: true };
}

/**
 * Send the invoice email to the customer and mark it as sent.
 */
export async function sendInvoiceEmail(invoiceId) {
  // Get invoice
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (invErr || !invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });

  // Get booking + customer
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*)')
    .eq('id', invoice.booking_id)
    .single();

  if (bErr || !booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  const customer = booking.customers;
  if (!customer?.email) throw Object.assign(new Error('Customer email not found'), { status: 400 });

  const firstName = customer.first_name || 'Customer';
  const vehicleName = booking.vehicles ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}` : 'Vehicle';
  const items = invoice.items || [];

  // Build line items HTML
  const lineItemsHtml = items.map(item => {
    const isDeposit = item.type === 'deposit';
    const isIncidental = item.type === 'incidental';
    const color = isDeposit ? '#10B981' : isIncidental ? '#EF4444' : '#1c1917';
    const prefix = isDeposit ? '' : '';
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;font-size:14px;color:#57534e;">${esc(item.description)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;font-size:14px;text-align:right;font-weight:600;color:${color};">${prefix}$${(item.amount / 100).toFixed(2)}</td>
    </tr>`;
  }).join('');

  const rawAmountDue = Number(invoice.amount_due || 0);
  const amountDue = Math.abs(rawAmountDue);
  const hasDepositApplied = Number(invoice.deposit_applied || 0) > 0;
  const isRefund = rawAmountDue < 0;
  const isClean = rawAmountDue === 0 && hasDepositApplied;
  const isNoBalance = rawAmountDue === 0 && !hasDepositApplied;
  const totalLabel = isRefund ? 'Refund Due to You' : rawAmountDue > 0 ? 'Balance Due' : 'No Balance Due';
  const totalColor = isRefund ? '#10B981' : rawAmountDue > 0 ? '#EF4444' : '#57534e';

  const subjectLine = isRefund
    ? `Your $${(amountDue / 100).toFixed(2)} deposit refund — ${booking.booking_code}`
    : rawAmountDue > 0
      ? `Post-rental settlement — ${booking.booking_code}`
      : `Rental complete — ${booking.booking_code}`;

  const introText = isRefund
    ? `Your rental is complete and your vehicle passed inspection. Here&#8217;s your deposit settlement:`
    : rawAmountDue > 0
      ? `Your rental is complete. During our post-return inspection, we found a few items that need to be settled:`
      : isClean
        ? `Your rental is complete and your vehicle passed inspection. Here&#8217;s your deposit settlement:`
        : `Your rental is complete. No post-return balance is due.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #e7e5e4;overflow:hidden;">
    <div style="height:4px;background:linear-gradient(90deg,#c8a97e 0%,#d4af37 50%,#c8a97e 100%);"></div>
    <div style="background:#1c1917;padding:28px 32px;">
      <img src="${LOGO_URL}" alt="${esc(brand.name)}" width="140" style="display:block;max-width:140px;margin-bottom:16px;" />
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;">Deposit Settlement</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;line-height:1.6;color:#57534e;margin:0 0 20px;">
        Hi ${esc(firstName)},<br><br>
        ${introText}
      </p>

      <div style="background:#fafaf9;border-radius:12px;padding:16px;border:1px solid #f5f5f4;margin-bottom:20px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:0 0 6px;">Booking</p>
        <p style="font-size:15px;font-weight:600;color:#1c1917;margin:0 0 6px;">${esc(vehicleName)} — ${esc(booking.booking_code)}</p>
        <p style="font-size:12px;color:#a8a29e;margin:0;">
          ${esc(booking.pickup_date)} &nbsp;→&nbsp; ${esc(booking.return_date)}
        </p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${lineItemsHtml}
      </table>

      <table style="width:100%;border-collapse:collapse;border-top:2px solid #e7e5e4;">
        <tr>
          <td style="padding:12px 0;font-size:16px;font-weight:700;color:#1c1917;">${totalLabel}</td>
          <td style="padding:12px 0;font-size:18px;font-weight:700;text-align:right;color:${totalColor};">$${(amountDue / 100).toFixed(2)}</td>
        </tr>
      </table>

      ${isRefund && amountDue > 0 ? `
      <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;border:1px solid #bbf7d0;margin-top:16px;">
        <p style="font-size:14px;color:#16a34a;font-weight:600;margin:0 0 4px;">Refund on the Way</p>
        <p style="font-size:13px;color:#57534e;margin:0;">Your refund of $${(amountDue / 100).toFixed(2)} will be processed back to your original payment method within 5–10 business days.</p>
      </div>` : ''}

      ${!isRefund && amountDue > 0 ? `
      <div style="background:#fef2f2;border-radius:12px;padding:14px 16px;border:1px solid #fecaca;margin-top:16px;">
        <p style="font-size:14px;color:#dc2626;font-weight:600;margin:0 0 4px;">Balance Due</p>
        <p style="font-size:13px;color:#57534e;margin:0;">Charges exceeded your security deposit. Please contact us to arrange payment of the remaining $${(amountDue / 100).toFixed(2)}.</p>
      </div>` : ''}

      ${isClean ? `
      <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;border:1px solid #bbf7d0;margin-top:16px;">
        <p style="font-size:14px;color:#16a34a;font-weight:600;margin:0 0 4px;">All Clear ✓</p>
        <p style="font-size:13px;color:#57534e;margin:0;">No charges were applied. Your full deposit of $${(invoice.deposit_applied / 100).toFixed(2)} is being refunded.</p>
      </div>` : ''}

      ${isNoBalance ? `
      <div style="background:#f8fafc;border-radius:12px;padding:14px 16px;border:1px solid #e2e8f0;margin-top:16px;">
        <p style="font-size:14px;color:#334155;font-weight:600;margin:0 0 4px;">No Balance Due</p>
        <p style="font-size:13px;color:#57534e;margin:0;">No post-return charges or refunds are due on this booking.</p>
      </div>` : ''}

      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f5f5f4;text-align:center;">
        <p style="font-size:13px;color:#57534e;margin:0 0 12px;">Questions about your settlement? We're here to help.</p>
        <p style="font-size:12px;color:#a8a29e;margin:0;">${esc(brand.name)} · ${esc(formatBrandAddress())}</p>
        <p style="font-size:12px;color:#a8a29e;margin:4px 0 0;">${esc(brand.phone)} · <a href="${SITE_URL}" style="color:#c8a97e;">${esc(brand.domain)}</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

  // Send email
  await sendViaResend({
    to: customer.email,
    subject: subjectLine,
    html,
  });

  // Mark as sent
  await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invoiceId);

  console.log(`[Invoice] Sent invoice ${invoiceId} to ${customer.email}`);
  return { success: true, sentTo: customer.email };
}
