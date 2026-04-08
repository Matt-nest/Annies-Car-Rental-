/**
 * Local message storage service.
 * Stores all inbound/outbound messages in Supabase for the dashboard messaging portal.
 */

import { supabase } from '../db/supabase.js';

/**
 * Store a message locally in Supabase.
 * Deduplicates by external_id if provided.
 */
export async function storeLocalMessage({ customerId, direction, channel, subject, body, externalId, metadata }) {
  // Deduplicate by external_id
  if (externalId) {
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle();

    if (existing) {
      return existing;
    }
  }

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
    return null;
  }
  return data;
}

/**
 * Get local message history for a customer.
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
