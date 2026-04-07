import { supabase } from '../db/supabase.js';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_TOKEN = process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

/**
 * Get headers for GHL API v2 requests.
 * Private Integration Tokens (PIT) require Version header.
 */
function ghlHeaders() {
  return {
    Authorization: `Bearer ${GHL_TOKEN}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

/**
 * Check if GHL integration is configured
 */
function isGHLConfigured() {
  if (!GHL_TOKEN || !GHL_LOCATION_ID) {
    if (!GHL_TOKEN) console.warn('[GHL] No GHL_PRIVATE_INTEGRATION_TOKEN configured');
    if (!GHL_LOCATION_ID) console.warn('[GHL] No GHL_LOCATION_ID configured');
    return false;
  }
  return true;
}

/**
 * Search GHL contacts by email or phone
 */
export async function searchContacts(query) {
  if (!isGHLConfigured()) return [];
  try {
    const url = new URL(`${GHL_BASE}/contacts/search/duplicate`);
    url.searchParams.set('locationId', GHL_LOCATION_ID);
    url.searchParams.set('email', query);

    const res = await fetch(url.toString(), { headers: ghlHeaders() });
    if (!res.ok) {
      console.error(`[GHL] searchContacts ${res.status}: ${await res.text()}`);
      return [];
    }
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
  if (!isGHLConfigured()) return null;
  try {
    // Search for existing conversation
    const url = new URL(`${GHL_BASE}/conversations/search`);
    url.searchParams.set('locationId', GHL_LOCATION_ID);
    url.searchParams.set('contactId', contactId);

    const res = await fetch(url.toString(), { headers: ghlHeaders() });
    if (!res.ok) {
      console.error(`[GHL] search conversations ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    if (data.conversations?.length > 0) {
      return data.conversations[0];
    }

    // Create new conversation if none exists
    const createRes = await fetch(`${GHL_BASE}/conversations/`, {
      method: 'POST',
      headers: ghlHeaders(),
      body: JSON.stringify({ locationId: GHL_LOCATION_ID, contactId }),
    });
    if (!createRes.ok) {
      console.error(`[GHL] create conversation ${createRes.status}: ${await createRes.text()}`);
      return null;
    }
    return await createRes.json();
  } catch (err) {
    console.error('[GHL] getOrCreateConversation error:', err.message);
    return null;
  }
}

/**
 * Send a message via GHL
 * First gets/creates a conversation, then sends the message within it
 */
export async function sendGHLMessage({ contactId, type = 'Email', message, subject, html }) {
  if (!isGHLConfigured()) {
    console.warn('[GHL] Not configured — message not sent via GHL');
    return null;
  }
  try {
    // Get or create conversation first
    const conversation = await getOrCreateConversation(contactId);
    if (!conversation?.id) {
      console.error('[GHL] Could not get/create conversation for contact:', contactId);
      return null;
    }

    const body = {
      type,
      contactId,
      message: message || html,
      conversationId: conversation.id,
    };
    if (subject) body.subject = subject;
    if (html) body.html = html;

    const res = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: 'POST',
      headers: ghlHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[GHL] sendMessage ${res.status}: ${errText}`);
      return { error: errText, status: res.status };
    }

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
  if (!isGHLConfigured() || !conversationId) return [];
  try {
    const res = await fetch(`${GHL_BASE}/conversations/${conversationId}/messages`, {
      headers: ghlHeaders(),
    });
    if (!res.ok) {
      console.error(`[GHL] getMessages ${res.status}: ${await res.text()}`);
      return [];
    }
    const data = await res.json();
    return data.messages || [];
  } catch (err) {
    console.error('[GHL] getMessages error:', err.message);
    return [];
  }
}

/**
 * Sync all GHL conversations into local database
 * Fetches conversations for the location and stores messages locally
 */
export async function syncGHLConversations() {
  if (!isGHLConfigured()) return { synced: 0, error: 'GHL not configured' };

  try {
    // Fetch conversations from GHL for this location
    const url = new URL(`${GHL_BASE}/conversations/search`);
    url.searchParams.set('locationId', GHL_LOCATION_ID);

    const res = await fetch(url.toString(), { headers: ghlHeaders() });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[GHL] sync conversations ${res.status}: ${errText}`);
      return { synced: 0, error: errText };
    }

    const data = await res.json();
    const conversations = data.conversations || [];
    let synced = 0;

    for (const conv of conversations) {
      if (!conv.contactId) continue;

      // Look up the local customer by ghl_contact_id
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('ghl_contact_id', conv.contactId)
        .single();

      if (!customer) continue;

      // Fetch messages for this conversation
      const messages = await getGHLMessages(conv.id);
      for (const msg of messages) {
        // Check if message already exists locally
        const { data: existing } = await supabase
          .from('messages')
          .select('id')
          .eq('external_id', msg.id)
          .single();

        if (!existing) {
          await storeLocalMessage({
            customerId: customer.id,
            direction: msg.direction === 1 ? 'inbound' : 'outbound',
            channel: (msg.type || 'email').toLowerCase() === 'sms' ? 'sms' : 'email',
            subject: msg.subject || null,
            body: msg.body || msg.message || '',
            externalId: msg.id,
            metadata: {
              ghl_conversation_id: conv.id,
              ghl_contact_id: conv.contactId,
              ghl_type: msg.type,
              ghl_date: msg.dateAdded,
            },
          });
          synced++;
        }
      }
    }

    return { synced, total: conversations.length };
  } catch (err) {
    console.error('[GHL] syncConversations error:', err.message);
    return { synced: 0, error: err.message };
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
