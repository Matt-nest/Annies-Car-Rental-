import { supabase } from '../db/supabase.js';
import { sendViaResend } from '../utils/mailTransport.js';

const SITE_URL = process.env.SITE_URL || 'https://anniescarrental.com';
const LOGO_URL = `${SITE_URL}/logo.png`;

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }


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

  // Get deposit
  const { data: deposit } = await supabase
    .from('booking_deposits')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  // Get add-ons
  const { data: addons } = await supabase
    .from('booking_addons')
    .select('*')
    .eq('booking_id', bookingId);

  // Build line items
  const items = [];

  // Rental line item
  items.push({
    type: 'rental',
    description: `${booking.rental_days}-day rental — ${booking.vehicles?.year} ${booking.vehicles?.make} ${booking.vehicles?.model}`,
    amount: Math.round(Number(booking.subtotal) * 100),
  });

  // Add-ons
  for (const addon of (addons || [])) {
    const labels = {
      unlimited_miles: 'Unlimited Miles Add-On',
      unlimited_tolls: 'Unlimited Tolls Add-On',
      delivery: 'Vehicle Delivery',
    };
    items.push({
      type: 'addon',
      description: labels[addon.addon_type] || addon.addon_type,
      amount: addon.amount,
    });
  }

  // Delivery fee (if on booking but not in addons)
  if (Number(booking.delivery_fee) > 0 && !(addons || []).some(a => a.addon_type === 'delivery')) {
    items.push({
      type: 'delivery',
      description: 'Delivery Fee',
      amount: Math.round(Number(booking.delivery_fee) * 100),
    });
  }

  // Tax
  if (Number(booking.tax_amount) > 0) {
    items.push({
      type: 'tax',
      description: 'Florida Sales Tax (7%)',
      amount: Math.round(Number(booking.tax_amount) * 100),
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

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
  const depositApplied = deposit ? Math.min(deposit.amount, Math.max(0, subtotal - Math.round(Number(booking.total_cost) * 100))) : 0;
  const rentalPaid = Math.round(Number(booking.total_cost) * 100);

  // Amount due = incidentals total - deposit applied
  const incidentalTotal = (incidentals || []).filter(i => !i.waived).reduce((sum, i) => sum + i.amount, 0);
  const depositAmount = deposit?.amount || 0;
  const amountDue = Math.max(0, incidentalTotal - depositAmount);

  const invoiceData = {
    booking_id: bookingId,
    items,
    subtotal,
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
    const color = item.type === 'incidental' ? '#EF4444' : '#1c1917';
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;font-size:14px;color:#57534e;">${esc(item.description)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;font-size:14px;text-align:right;font-weight:600;color:${color};">$${(item.amount / 100).toFixed(2)}</td>
    </tr>`;
  }).join('');

  const depositLine = invoice.deposit_applied > 0
    ? `<tr><td style="padding:8px 0;font-size:14px;color:#10B981;">Security Deposit Applied</td><td style="padding:8px 0;font-size:14px;text-align:right;font-weight:600;color:#10B981;">-$${(invoice.deposit_applied / 100).toFixed(2)}</td></tr>`
    : '';

  const amountDue = Math.abs(invoice.amount_due || 0);
  const isRefund = (invoice.amount_due || 0) <= 0;
  const totalLabel = isRefund ? 'Refund Due to You' : 'Amount Due';
  const totalColor = isRefund ? '#10B981' : '#EF4444';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #e7e5e4;overflow:hidden;">
    <div style="height:4px;background:linear-gradient(90deg,#c8a97e 0%,#d4af37 50%,#c8a97e 100%);"></div>
    <div style="background:#1c1917;padding:28px 32px;">
      <img src="${LOGO_URL}" alt="Annie's Car Rental" width="140" style="display:block;max-width:140px;margin-bottom:16px;" />
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;">Rental Invoice</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;line-height:1.6;color:#57534e;margin:0 0 20px;">
        Hi ${esc(firstName)},<br><br>
        Here\u2019s your final invoice for booking <strong style="color:#1c1917;">${esc(booking.booking_code)}</strong>:
      </p>

      <div style="background:#fafaf9;border-radius:12px;padding:16px;border:1px solid #f5f5f4;margin-bottom:20px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:0 0 6px;">Vehicle</p>
        <p style="font-size:15px;font-weight:600;color:#1c1917;margin:0 0 6px;">${esc(vehicleName)}</p>
        <p style="font-size:12px;color:#a8a29e;margin:0;">
          Pickup: ${esc(booking.pickup_date)} &nbsp;·&nbsp; Return: ${esc(booking.return_date)}
        </p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${lineItemsHtml}
      </table>

      <table style="width:100%;border-collapse:collapse;border-top:2px solid #e7e5e4;">
        ${depositLine}
        <tr>
          <td style="padding:12px 0;font-size:16px;font-weight:700;color:#1c1917;">${totalLabel}</td>
          <td style="padding:12px 0;font-size:18px;font-weight:700;text-align:right;color:${totalColor};">$${(amountDue / 100).toFixed(2)}</td>
        </tr>
      </table>

      ${isRefund ? `
      <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;border:1px solid #bbf7d0;margin-top:16px;">
        <p style="font-size:14px;color:#16a34a;font-weight:600;margin:0 0 4px;">Refund on the Way</p>
        <p style="font-size:13px;color:#57534e;margin:0;">Your refund of $${(amountDue / 100).toFixed(2)} will be processed back to your original payment method within 5-10 business days.</p>
      </div>` : ''}

      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f5f5f4;text-align:center;">
        <p style="font-size:12px;color:#a8a29e;margin:0;">Annie\u2019s Car Rental · 586 NW Mercantile Pl, Port St. Lucie, FL 34986</p>
        <p style="font-size:12px;color:#a8a29e;margin:4px 0 0;">(772) 985-6667 · <a href="${SITE_URL}" style="color:#c8a97e;">anniescarrental.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

  // Send email
  await sendViaResend({
    to: customer.email,
    subject: `Your Invoice from Annie's Car Rental — ${booking.booking_code}`,
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
