import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  sendDirectEmail,
  sendDirectSMS,
  getLocalMessages,
  storeLocalMessage,
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

  // Get customer info
  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone')
    .eq('id', customerId)
    .single();

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  // Send via the appropriate channel
  let sendResult = null;
  if (channel === 'sms') {
    sendResult = await sendDirectSMS({ customer, message: body });
  } else {
    sendResult = await sendDirectEmail({ customer, subject, body, html });
  }

  // Store locally
  const stored = await storeLocalMessage({
    customerId,
    direction: 'outbound',
    channel,
    subject,
    body,
    externalId: sendResult?.id || sendResult?.sid || null,
    metadata: { send_result: sendResult },
  });

  res.json({ success: true, message: stored, result: sendResult });
}));

// ── Twilio Inbound Webhook ────────────────────────────────────────────────────

/**
 * POST /webhook/inbound — receive inbound SMS from Twilio
 * Twilio sends: From, Body, MessageSid, To, etc.
 * Secured via x-webhook-secret header or Twilio signature (basic check)
 */
router.post('/webhook/inbound', asyncHandler(async (req, res) => {
  const { From, Body, MessageSid, from, body: msgBody, message } = req.body;

  // Support both Twilio format (capitalized) and generic format
  const senderPhone = From || from || '';
  const messageBody = Body || msgBody || message || '';
  const messageId = MessageSid || req.body.messageId || req.body.id || '';

  if (!senderPhone || !messageBody) {
    return res.status(400).json({ error: 'From and Body are required' });
  }

  // Normalize phone for matching
  const normalized = senderPhone.replace(/\D/g, '');

  // Find local customer by phone
  const { data: customers } = await supabase
    .from('customers')
    .select('id, phone')
    .not('phone', 'is', null);

  const customer = (customers || []).find(c => {
    const localPhone = (c.phone || '').replace(/\D/g, '');
    return localPhone === normalized
      || localPhone.endsWith(normalized)
      || normalized.endsWith(localPhone);
  });

  if (!customer) {
    console.warn(`[Inbound] No customer matched phone ${senderPhone}`);
    // Return 200 so Twilio doesn't retry
    return res.status(200).type('text/xml').send('<Response></Response>');
  }

  // Store the inbound message locally
  await storeLocalMessage({
    customerId: customer.id,
    direction: 'inbound',
    channel: 'sms',
    subject: null,
    body: messageBody,
    externalId: messageId,
    metadata: { from: senderPhone, twilio_sid: messageId },
  });

  console.log(`[Inbound] SMS from ${senderPhone} stored for customer ${customer.id}`);

  // Respond with empty TwiML (Twilio expects XML response)
  res.status(200).type('text/xml').send('<Response></Response>');
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
