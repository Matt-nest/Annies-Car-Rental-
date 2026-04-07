import { supabase } from '../db/supabase.js';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_TOKEN = process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

/**
 * Get headers for GHL API v2 requests.
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

// ── GHL Contact Operations ─────────────────────────────────────────────────────

/**
 * Search GHL contacts by email or phone
 */
export async function searchGHLContacts(query) {
  if (!isGHLConfigured()) return [];
  try {
    const url = new URL(`${GHL_BASE}/contacts/search/duplicate`);
    url.searchParams.set('locationId', GHL_LOCATION_ID);
    // Try email first
    if (query.includes('@')) {
      url.searchParams.set('email', query);
    } else {
      url.searchParams.set('phone', query.replace(/\D/g, ''));
    }

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
 * Get all GHL contacts for this location (paginated)
 */
export async function getAllGHLContacts() {
  if (!isGHLConfigured()) return [];
  const allContacts = [];
  let page = 1;
  const limit = 100;

  try {
    while (true) {
      const url = new URL(`${GHL_BASE}/contacts/`);
      url.searchParams.set('locationId', GHL_LOCATION_ID);
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('query', '');

      const res = await fetch(url.toString(), { headers: ghlHeaders() });
      if (!res.ok) {
        console.error(`[GHL] getAllContacts ${res.status}: ${await res.text()}`);
        break;
      }
      const data = await res.json();
      const contacts = data.contacts || [];
      allContacts.push(...contacts);

      // If we got fewer than limit, we're done
      if (contacts.length < limit) break;
      page++;
      // Safety: don't paginate beyond 10 pages (1000 contacts)
      if (page > 10) break;
    }
  } catch (err) {
    console.error('[GHL] getAllContacts error:', err.message);
  }

  return allContacts;
}

/**
 * Find a GHL contact ID for a customer, by matching email or phone.
 * If found, saves the ghl_contact_id to the customer record.
 */
export async function findAndLinkGHLContact(customer) {
  if (!isGHLConfigured()) return null;

  // Already linked?
  if (customer.ghl_contact_id) return customer.ghl_contact_id;

  let ghlContactId = null;

  // Try email match first
  if (customer.email) {
    const contacts = await searchGHLContacts(customer.email);
    if (contacts.length > 0) {
      ghlContactId = contacts[0].id;
    }
  }

  // Try phone match if email didn't work
  if (!ghlContactId && customer.phone) {
    const contacts = await searchGHLContacts(customer.phone);
    if (contacts.length > 0) {
      ghlContactId = contacts[0].id;
    }
  }

  // Save the link if found
  if (ghlContactId) {
    await supabase
      .from('customers')
      .update({ ghl_contact_id: ghlContactId })
      .eq('id', customer.id);
    console.log(`[GHL] Linked customer ${customer.id} → GHL contact ${ghlContactId}`);
  }

  return ghlContactId;
}

// ── GHL Conversation Operations ────────────────────────────────────────────────

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

    // Create new conversation
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
 * Send a message via GHL.
 * Automatically finds/links GHL contact, gets/creates conversation, then sends.
 */
export async function sendGHLMessage({ customer, type = 'Email', message, subject, html }) {
  if (!isGHLConfigured()) {
    console.warn('[GHL] Not configured — message not sent via GHL');
    return null;
  }

  try {
    // Step 1: Find or link the GHL contact
    const contactId = await findAndLinkGHLContact(customer);
    if (!contactId) {
      console.warn(`[GHL] No GHL contact found for customer ${customer.id} (${customer.email})`);
      return null;
    }

    // Step 2: Get or create conversation
    const conversation = await getOrCreateConversation(contactId);
    if (!conversation?.id) {
      console.error('[GHL] Could not get/create conversation for contact:', contactId);
      return null;
    }

    // Step 3: Send the message
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
    console.log(`[GHL] Message sent to ${customer.email || customer.phone} via ${type}`);
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
    // GHL can return { messages: [...] } or { messages: { messages: [...] } }
    const msgs = data?.messages?.messages || data?.messages;
    return Array.isArray(msgs) ? msgs : [];
  } catch (err) {
    console.error('[GHL] getMessages error:', err.message);
    return [];
  }
}

// ── Sync Operations ────────────────────────────────────────────────────────────

/**
 * Sync GHL contacts with local customers.
 * Matches by email or phone, saves ghl_contact_id,
 * then pulls any conversation messages.
 */
export async function syncGHLConversations() {
  if (!isGHLConfigured()) return { synced: 0, linked: 0, error: 'GHL not configured' };

  try {
    // Step 1: Get all GHL contacts
    const ghlContacts = await getAllGHLContacts();
    console.log(`[GHL Sync] Found ${ghlContacts.length} GHL contacts`);

    // Step 2: Get all local customers
    const { data: customers } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone, ghl_contact_id');

    if (!customers?.length) {
      return { synced: 0, linked: 0, error: 'No local customers found' };
    }

    let linked = 0;
    let synced = 0;

    // Step 3: Match GHL contacts to local customers
    for (const ghlContact of ghlContacts) {
      const ghlEmail = (ghlContact.email || '').toLowerCase().trim();
      const ghlPhone = (ghlContact.phone || '').replace(/\D/g, '');

      // Find matching local customer by email or phone
      const customer = customers.find(c => {
        if (ghlEmail && c.email && c.email.toLowerCase().trim() === ghlEmail) return true;
        if (ghlPhone && c.phone) {
          const localPhone = c.phone.replace(/\D/g, '');
          return localPhone === ghlPhone || localPhone.endsWith(ghlPhone) || ghlPhone.endsWith(localPhone);
        }
        return false;
      });

      if (!customer) continue;

      // Link the GHL contact ID if not already linked
      if (!customer.ghl_contact_id || customer.ghl_contact_id !== ghlContact.id) {
        await supabase
          .from('customers')
          .update({ ghl_contact_id: ghlContact.id })
          .eq('id', customer.id);
        customer.ghl_contact_id = ghlContact.id;
        linked++;
        console.log(`[GHL Sync] Linked ${customer.first_name} ${customer.last_name} → ${ghlContact.id}`);
      }

      // Step 4: Pull conversation messages for this contact
      const convUrl = new URL(`${GHL_BASE}/conversations/search`);
      convUrl.searchParams.set('locationId', GHL_LOCATION_ID);
      convUrl.searchParams.set('contactId', ghlContact.id);

      const convRes = await fetch(convUrl.toString(), { headers: ghlHeaders() });
      if (!convRes.ok) continue;

      const convData = await convRes.json();
      const conversations = convData.conversations || [];

      for (const conv of conversations) {
        const messages = await getGHLMessages(conv.id);
        if (!Array.isArray(messages) || messages.length === 0) continue;
        for (const msg of messages) {
          // Check if already stored
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
                ghl_contact_id: ghlContact.id,
                ghl_date: msg.dateAdded,
              },
            });
            synced++;
          }
        }
      }
    }

    return {
      synced,
      linked,
      totalGHLContacts: ghlContacts.length,
      totalLocalCustomers: customers.length,
    };
  } catch (err) {
    console.error('[GHL Sync] error:', err.message);
    return { synced: 0, linked: 0, error: err.message };
  }
}

// ── Local Storage ──────────────────────────────────────────────────────────────

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
