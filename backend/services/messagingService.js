/**
 * Messaging Service — handles direct customer messaging from the dashboard.
 * 
 * Email: Resend REST API
 * SMS: Twilio REST API
 * Storage: Supabase `messages` table
 */

import { supabase } from '../db/supabase.js';
import { sendEmail, sendSMS } from './notifyService.js';
import { createNotification } from './notificationService.js';

// ── Direct Messaging (from dashboard "Compose" UI) ─────────────────────────

/**
 * Send an email directly to a customer and store it locally.
 */
export async function sendDirectEmail({ customer, subject, body, html }) {
  const result = await sendEmail({
    to: customer.email,
    subject,
    html: html || body,
  });

  return result;
}

/**
 * Send an SMS directly to a customer and store it locally.
 */
export async function sendDirectSMS({ customer, message }) {
  if (!customer.phone) {
    console.warn('[Messaging] No phone number for customer — cannot send SMS');
    return { error: 'No phone number on file' };
  }

  const result = await sendSMS({
    to: customer.phone,
    body: message,
  });

  return result;
}

// ── Local Storage ──────────────────────────────────────────────────────────

/**
 * Store a message locally in Supabase.
 *
 * F-14: on insert failure, emits a dashboard notification so the admin sees
 * the gap (previously the error was swallowed to console only). The send
 * itself has already happened by the time we get here, so a failure means
 * "customer received the message, but it's not in the conversation thread".
 *
 * Return: row object on success, null on failure (unchanged).
 */
export async function storeLocalMessage({ customerId, direction, channel, subject, body, externalId, metadata }) {
  const { data, error } = await supabase.from('messages').insert({
    customer_id: customerId,
    direction,
    channel,
    subject,
    body,
    external_id: externalId,
    metadata,
  }).select().single();
  if (error) {
    console.error('[Messages] Failed to store:', error.message);
    // F-14: surface to admin via dashboard notification. Fire-and-forget so a
    // notification-side failure doesn't cascade.
    createNotification(
      'message_store_failed',
      'Message logged but not in inbox',
      `${direction || 'outbound'} ${channel || ''} message for customer ${customerId} sent successfully but couldn't be persisted to the conversation thread. Reason: ${error.message}`,
      customerId ? `/customers/${customerId}` : null,
      { customer_id: customerId, channel, direction, error: error.message },
    ).catch(() => { /* ignore secondary failure */ });
    return null;
  }
  return data;
}

/**
 * Get local message history for a customer
 */
export async function getLocalMessages(customerId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[Messages] Failed to fetch:', error.message);
    return [];
  }
  return data || [];
}
