import { supabase } from '../db/supabase.js';

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
