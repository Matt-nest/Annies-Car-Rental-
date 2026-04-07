import { supabase } from '../db/supabase.js';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_TOKEN = process.env.GHL_PRIVATE_INTEGRATION_TOKEN;

/**
 * Get headers for GHL API requests.
 */
function ghlHeaders() {
  return {
    Authorization: `Bearer ${GHL_TOKEN}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

/**
 * Search GHL contacts by email
 */
export async function searchContacts(query) {
  if (!GHL_TOKEN) return [];
  try {
    const res = await fetch(`${GHL_BASE}/contacts/search/duplicate?email=${encodeURIComponent(query)}`, {
      headers: ghlHeaders(),
    });
    const data = await res.json();
    return data.contacts || [];
  } catch (err) {
    console.error('[GHL] searchContacts error:', err.message);
    return [];
  }
}

/**
 * Get or create a GHL conversation for a contact
 */
export async function getOrCreateConversation(contactId) {
  if (!GHL_TOKEN) return null;
  try {
    // Search for existing conversation
    const res = await fetch(`${GHL_BASE}/conversations/search?contactId=${contactId}`, {
      headers: ghlHeaders(),
    });
    const data = await res.json();
    if (data.conversations?.length > 0) {
      return data.conversations[0];
    }
    // Create new conversation
    const createRes = await fetch(`${GHL_BASE}/conversations/`, {
      method: 'POST',
      headers: ghlHeaders(),
      body: JSON.stringify({ contactId }),
    });
    return await createRes.json();
  } catch (err) {
    console.error('[GHL] getOrCreateConversation error:', err.message);
    return null;
  }
}

/**
 * Send a message via GHL
 */
export async function sendGHLMessage({ conversationId, contactId, type = 'Email', message, subject, html }) {
  if (!GHL_TOKEN) {
    console.warn('[GHL] No token configured — message not sent');
    return null;
  }
  try {
    const body = {
      type,
      contactId,
      message: message || html,
    };
    if (subject) body.subject = subject;
    if (html) body.html = html;

    const res = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: 'POST',
      headers: ghlHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[GHL] sendMessage error:', err.message);
    return null;
  }
}

/**
 * Get messages from a GHL conversation
 */
export async function getGHLMessages(conversationId) {
  if (!GHL_TOKEN || !conversationId) return [];
  try {
    const res = await fetch(`${GHL_BASE}/conversations/${conversationId}/messages`, {
      headers: ghlHeaders(),
    });
    const data = await res.json();
    return data.messages || [];
  } catch (err) {
    console.error('[GHL] getMessages error:', err.message);
    return [];
  }
}

/**
 * Store a message locally in Supabase
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
