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

  // Send via GHL if configured
  let ghlResult = null;
  if (process.env.GHL_PRIVATE_INTEGRATION_TOKEN && customer.ghl_contact_id) {
    ghlResult = await sendGHLMessage({
      contactId: customer.ghl_contact_id,
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

/** POST /email-templates — create a template */
router.post('/email-templates', requireAuth, asyncHandler(async (req, res) => {
  const { name, stage, subject, body } = req.body;
  if (!name || !stage || !subject || !body) {
    return res.status(400).json({ error: 'name, stage, subject, body are required' });
  }
  const { data, error } = await supabase
    .from('email_templates')
    .insert({ name, stage, subject, body })
    .select()
    .single();
  if (error) throw error;
  res.json(data);
}));

/** PUT /email-templates/:id — update a template */
router.put('/email-templates/:id', requireAuth, asyncHandler(async (req, res) => {
  const { name, stage, subject, body, is_active } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (stage !== undefined) updates.stage = stage;
  if (subject !== undefined) updates.subject = subject;
  if (body !== undefined) updates.body = body;
  if (is_active !== undefined) updates.is_active = is_active;
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
