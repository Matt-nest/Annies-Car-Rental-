import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  sendGHLMessage,
  getLocalMessages,
  storeLocalMessage,
  syncGHLConversations,
} from '../services/messagingService.js';

const router = Router();

/** GET /conversations — list customers with recent messages */
router.get('/conversations', requireAuth, asyncHandler(async (req, res) => {
  // Get distinct customers who have messages, ordered by most recent
  const { data, error } = await supabase
    .from('messages')
    .select('customer_id, created_at, body, direction, channel')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Group by customer_id, take most recent message per customer
  const conversations = {};
  for (const msg of data || []) {
    if (!conversations[msg.customer_id]) {
      conversations[msg.customer_id] = {
        customer_id: msg.customer_id,
        last_message: msg.body?.slice(0, 100),
        last_direction: msg.direction,
        last_channel: msg.channel,
        last_at: msg.created_at,
      };
    }
  }

  // Fetch customer details for each conversation
  const customerIds = Object.keys(conversations);
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone')
      .in('id', customerIds);

    for (const c of customers || []) {
      if (conversations[c.id]) {
        conversations[c.id].customer = c;
      }
    }
  }

  res.json(Object.values(conversations).sort((a, b) => new Date(b.last_at) - new Date(a.last_at)));
}));

/** GET /conversations/:customerId/messages — message history for a customer */
router.get('/conversations/:customerId/messages', requireAuth, asyncHandler(async (req, res) => {
  const messages = await getLocalMessages(req.params.customerId);
  res.json(messages);
}));

/** POST /conversations/:customerId/send — send a message */
router.post('/conversations/:customerId/send', requireAuth, asyncHandler(async (req, res) => {
  const { channel = 'email', subject, body, html } = req.body;
  const customerId = req.params.customerId;

  if (!body) {
    return res.status(400).json({ error: 'body is required' });
  }

  // Get customer info for GHL contact matching
  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone, ghl_contact_id')
    .eq('id', customerId)
    .single();

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  // Send via GHL — auto-links contact by email/phone if not already linked
  let ghlResult = null;
  if (process.env.GHL_PRIVATE_INTEGRATION_TOKEN) {
    ghlResult = await sendGHLMessage({
      customer,
      type: channel === 'sms' ? 'SMS' : 'Email',
      message: body,
      subject,
      html,
    });
  }

  // Store locally
  const stored = await storeLocalMessage({
    customerId,
    direction: 'outbound',
    channel,
    subject,
    body,
    externalId: ghlResult?.messageId || null,
    metadata: ghlResult ? { ghl_response: ghlResult } : {},
  });

  res.json({ success: true, message: stored, ghl: ghlResult });
}));

// ── GHL Sync ──────────────────────────────────────────────────────────────────

/** POST /sync — pull all GHL conversations into local database */
router.post('/sync', requireAuth, asyncHandler(async (req, res) => {
  const result = await syncGHLConversations();
  res.json(result);
}));

// ── GHL Inbound Webhook ──────────────────────────────────────────────────────

/**
 * POST /webhook/inbound — receive inbound messages from GHL
 * No auth required — GHL sends webhooks server-to-server
 */
router.post('/webhook/inbound', asyncHandler(async (req, res) => {
  const { type, contactId, body: msgBody, message, conversationId, direction, messageType } = req.body;

  console.log('[GHL Webhook] Inbound message received:', {
    type: type || messageType,
    contactId,
    conversationId,
    direction,
    bodyLength: (msgBody || message || '').length,
  });

  if (!contactId) {
    return res.status(400).json({ error: 'contactId is required' });
  }

  // Find local customer by ghl_contact_id
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('ghl_contact_id', contactId)
    .single();

  if (!customer) {
    console.warn(`[GHL Webhook] No local customer found for GHL contact ${contactId}`);
    // Still return 200 so GHL doesn't retry
    return res.json({ received: true, matched: false });
  }

  // Store the message locally
  const stored = await storeLocalMessage({
    customerId: customer.id,
    direction: direction === 'outbound' ? 'outbound' : 'inbound',
    channel: String(type || messageType || 'email').toLowerCase() === 'sms' || type === 1 ? 'sms' : 'email',
    subject: req.body.subject || null,
    body: msgBody || message || '',
    externalId: req.body.messageId || req.body.id || null,
    metadata: {
      ghl_conversation_id: conversationId,
      ghl_contact_id: contactId,
      webhook: true,
    },
  });

  res.json({ received: true, matched: true, stored: !!stored });
}));

// ── Email Templates ───────────────────────────────────────────────────────────

/** GET /email-templates — list all templates */
router.get('/email-templates', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('stage', { ascending: true });
  if (error) throw error;
  res.json(data);
}));

/** GET /email-templates/stage/:stage — get template by stage */
router.get('/email-templates/stage/:stage', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('stage', req.params.stage)
    .eq('is_active', true)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return res.status(404).json({ error: 'Template not found' });
  res.json(data);
}));

/** POST /email-templates — create a template */
router.post('/email-templates', requireAuth, asyncHandler(async (req, res) => {
  const { name, stage, subject, body, channel, sms_body, trigger_type, description } = req.body;
  if (!name || !stage) {
    return res.status(400).json({ error: 'name and stage are required' });
  }
  const { data, error } = await supabase
    .from('email_templates')
    .insert({ name, stage, subject: subject || '', body: body || '', channel, sms_body, trigger_type, description })
    .select()
    .single();
  if (error) throw error;
  res.json(data);
}));

/** PUT /email-templates/:id — update a template */
router.put('/email-templates/:id', requireAuth, asyncHandler(async (req, res) => {
  const { name, stage, subject, body, is_active, channel, sms_body, trigger_type, description } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (stage !== undefined) updates.stage = stage;
  if (subject !== undefined) updates.subject = subject;
  if (body !== undefined) updates.body = body;
  if (is_active !== undefined) updates.is_active = is_active;
  if (channel !== undefined) updates.channel = channel;
  if (sms_body !== undefined) updates.sms_body = sms_body;
  if (trigger_type !== undefined) updates.trigger_type = trigger_type;
  if (description !== undefined) updates.description = description;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw error;
  res.json(data);
}));

/** DELETE /email-templates/:id — delete a template */
router.delete('/email-templates/:id', requireAuth, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', req.params.id);
  if (error) throw error;
  res.json({ success: true });
}));

export default router;

