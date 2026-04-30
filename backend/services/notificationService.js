import { supabase } from '../db/supabase.js';
import { sendPaymentDeclined } from './emailService.js';

/**
 * Create a notification for the dashboard.
 * Called from various services when events occur.
 */
export async function createNotification(type, title, message, link = null, metadata = {}) {
  try {
    const { error } = await supabase.from('notifications').insert({
      type,
      title,
      message,
      link,
      metadata,
    });

    if (error) {
      console.error('[Notification] Insert failed:', error.message, error.details, error.hint);
      return null;
    }

    console.log(`[Notification] Created: ${type} — ${title}`);
    return { success: true };
  } catch (e) {
    console.error('[Notification] Exception:', e.message);
    return null;
  }
}

/**
 * Notification types and their configurations
 */
export const NOTIFICATION_TYPES = {
  new_booking: { icon: 'BookOpen', color: '#818cf8' },
  status_change: { icon: 'RefreshCw', color: '#63b3ed' },
  payment_received: { icon: 'DollarSign', color: '#22c55e' },
  agreement_pending: { icon: 'FileText', color: '#f59e0b' },
  overdue_return: { icon: 'AlertTriangle', color: '#ef4444' },
  damage_report: { icon: 'AlertOctagon', color: '#ef4444' },
  webhook_failure: { icon: 'Zap', color: '#f97316' },
  payment_declined: { icon: 'CreditCard', color: '#ef4444' },
};

/**
 * Fire both surfaces when an off-session card charge fails:
 *  (a) email the customer with a portal CTA to update their payment method
 *  (b) create an admin dashboard notification linked to the booking
 *
 * Call this from Stripe webhook handlers (e.g. payment_intent.payment_failed)
 * once card-on-file is wired up.
 *
 * @param {object} ctx
 * @param {object} ctx.customer       — { first_name, email }
 * @param {object} ctx.booking        — { id, booking_code }
 * @param {number} ctx.amountCents    — declined charge amount in cents
 * @param {string} [ctx.reason]       — Stripe decline_code or message
 */
export async function notifyPaymentDeclined({ customer, booking, amountCents, reason }) {
  // Customer email — fire-and-forget; logged on failure
  if (customer?.email) {
    sendPaymentDeclined({ customer, booking, amountCents, reason })
      .catch(e => console.error('[Notify] Payment-declined email failed:', e.message));
  }

  // Admin dashboard notification — surfaces in NotificationDropdown
  const amount = `$${((amountCents || 0) / 100).toFixed(2)}`;
  const customerName = `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || customer?.email || 'Customer';
  return createNotification(
    'payment_declined',
    `Payment declined — ${booking.booking_code}`,
    `${customerName}'s card was declined for ${amount}${reason ? ` (${reason})` : ''}. Customer was emailed a link to update their card.`,
    `/bookings/${booking.id}`,
    { booking_id: booking.id, booking_code: booking.booking_code, amount_cents: amountCents, reason }
  );
}
