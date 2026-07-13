import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyTwilioSignature } from '../middleware/twilioSignature.js';
import { verifyResendSignature } from '../middleware/resendSignature.js';
import { verifyCrispSignature } from '../middleware/crispSignature.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  sendDirectEmail,
  sendDirectSMS,
  getLocalMessages,
  storeLocalMessage,
} from '../services/messagingService.js';
import brand from '../config/brand.js';
import { safeRecordMoneyAction } from '../services/moneyActionAuditService.js';

const router = Router();

/** GET /conversations — list customers with recent messages.
 *
 * F-10: backed by v_conversation_summaries (one row per customer via
 * DISTINCT ON (customer_id) ORDER BY created_at DESC). Bounded by customer
 * count instead of message volume; the previous 1000-message scan would
 * silently drop older customers from the list as the table grew.
 */
router.get('/conversations', requireAuth, asyncHandler(async (req, res) => {
  const { data: summaries, error } = await supabase
    .from('v_conversation_summaries')
    .select('*')
    .order('last_at', { ascending: false });

  if (error) throw error;

  const customerIds = (summaries || []).map(s => s.customer_id);
  let customerMap = {};
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone')
      .in('id', customerIds);
    customerMap = Object.fromEntries((customers || []).map(c => [c.id, c]));
  }

  res.json((summaries || []).map(s => ({
    customer_id: s.customer_id,
    last_message: (s.last_message || '').slice(0, 100),
    last_direction: s.last_direction,
    last_channel: s.last_channel,
    last_at: s.last_at,
    customer: customerMap[s.customer_id] || null,
  })));
}));

/** GET /conversations/:customerId/messages — message history for a customer */
router.get('/conversations/:customerId/messages', requireAuth, asyncHandler(async (req, res) => {
  const messages = await getLocalMessages(req.params.customerId);
  res.json(messages);
}));

/** POST /conversations/:customerId/send — send a message */
router.post('/conversations/:customerId/send', requireAuth, asyncHandler(async (req, res) => {
  const { channel = 'email', subject, body, html, moneyAction } = req.body;
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

  if (moneyAction?.actionKey) {
    await safeRecordMoneyAction({
      req,
      actionKey: moneyAction.actionKey,
      title: moneyAction.title || 'Customer message sent',
      detail: moneyAction.detail || subject || 'Outbound customer message sent.',
      bookingId: moneyAction.bookingId,
      customerId,
      amountCents: moneyAction.amountCents,
      metadata: {
        channel,
        subject,
        message_id: stored?.id || null,
        external_id: sendResult?.id || sendResult?.sid || null,
        ...(moneyAction.metadata || {}),
      },
    });
  }

  // F-14: surface the storage gap to the frontend so the UI can flag
  // "sent but not in thread" instead of treating null as silent success.
  res.json({
    success: true,
    message: stored,
    stored: stored !== null,
    result: sendResult,
  });
}));

// ── Twilio Inbound Webhook ────────────────────────────────────────────────────

/**
 * POST /webhook/inbound — receive inbound SMS from Twilio
 * Twilio sends: From, Body, MessageSid, To, etc.
 *
 * Auth: HMAC-SHA1 X-Twilio-Signature against TWILIO_AUTH_TOKEN.
 * Bypass: X-Webhook-Secret matching INBOUND_WEBHOOK_SECRET (admin replay).
 * Dev: skipped if TWILIO_AUTH_TOKEN not set.
 */
router.post('/webhook/inbound', verifyTwilioSignature, asyncHandler(async (req, res) => {
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
  const inboundLast10 = normalized.slice(-10);

  // Find local customer by phone
  const { data: customers } = await supabase
    .from('customers')
    .select('id, phone')
    .not('phone', 'is', null);

  // F-20: exact last-10-digits match. The previous bidirectional substring
  // (localPhone.endsWith(normalized) || normalized.endsWith(localPhone)) would
  // wrongly match an inbound +44...9086928492 against a US customer with
  // 9086928492 because suffix-match is order-insensitive. Last-10 equality
  // handles US format variations (+1XXX, (XXX) XXX-XXXX, raw 10-digit) without
  // the international false-positive. Phones shorter than 10 digits don't match
  // — protects against degenerate stored data.
  const customer = (customers || []).find(c => {
    const localPhone = (c.phone || '').replace(/\D/g, '');
    return localPhone.length >= 10
      && inboundLast10.length === 10
      && localPhone.slice(-10) === inboundLast10;
  });

  if (!customer) {
    console.warn(`[Inbound] No customer matched phone ${senderPhone}`);
    // Return 200 so Twilio doesn't retry
    return res.status(200).type('text/xml').send('<Response></Response>');
  }

  // F-21: TCPA opt-out — if the customer texts STOP/UNSUB/CANCEL/END/QUIT,
  // flip the flag so future outbound SMS (from sendSMS) are short-circuited.
  // Twilio also honors this at the carrier level; this is the app-level mirror.
  const OPT_OUT_KEYWORDS = /^\s*(STOP|UNSUB|UNSUBSCRIBE|CANCEL|END|QUIT)\s*$/i;
  if (OPT_OUT_KEYWORDS.test(messageBody)) {
    await supabase
      .from('customers')
      .update({ sms_opt_out: true, sms_opt_out_at: new Date().toISOString() })
      .eq('id', customer.id);
    console.log(`[Inbound] Customer ${customer.id} opted out via "${messageBody.trim()}"`);
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

// ── Resend Inbound Email Webhook (2C) ────────────────────────────────────────

/**
 * Extract a bare email address from a "Name <addr@x.com>" or plain "addr@x.com" string.
 * Returns the email lowercased, or null if no email-shaped substring is found.
 */
function extractEmail(s) {
  if (!s) return null;
  const m = String(s).match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

/**
 * POST /webhook/inbound-email — receive customer email replies routed via
 * Resend inbound (replies.{brand.domain} → MX → Resend → POST here).
 *
 * Auth: Svix HMAC-SHA256 signature. Bypass via X-Webhook-Secret matching
 * INBOUND_EMAIL_SECRET. Dev: skipped if RESEND_WEBHOOK_SECRET unset.
 *
 * Resend payload shape (event type `email.received`):
 *   { type, created_at, data: { from, to, subject, text, html, headers, attachments } }
 *
 * Customer match: by lowercase email against customers.email. Unmatched
 * senders log a warn and return 200 (no retry, no thread).
 */
router.post('/webhook/inbound-email', verifyResendSignature, asyncHandler(async (req, res) => {
  const event = req.body || {};
  const data = event.data || event; // tolerate either envelope or flat shape

  const fromRaw = data.from || data.From || '';
  const fromEmail = extractEmail(fromRaw);
  const subject = data.subject || data.Subject || '';
  const text = data.text || data.Text || data.body || '';
  const messageId = data.message_id || data.id || event.id || `resend-${Date.now()}`;
  const toRaw = Array.isArray(data.to) ? data.to.join(', ') : (data.to || '');

  if (!fromEmail) {
    console.warn('[Inbound-Email] No usable From address — skipping');
    return res.status(200).json({ ok: false, reason: 'no_from' });
  }
  if (!text && !subject) {
    console.warn(`[Inbound-Email] Empty payload from ${fromEmail} — skipping`);
    return res.status(200).json({ ok: false, reason: 'empty' });
  }

  // Match customer by email (case-insensitive). Phones use last-10 (F-20);
  // email matching is exact-lowercase, simpler and unambiguous.
  const { data: customers } = await supabase
    .from('customers')
    .select('id, email')
    .ilike('email', fromEmail);

  const customer = (customers || []).find(c => (c.email || '').toLowerCase() === fromEmail);
  if (!customer) {
    console.warn(`[Inbound-Email] No customer matched ${fromEmail}`);
    return res.status(200).json({ ok: false, reason: 'no_customer_match' });
  }

  await storeLocalMessage({
    customerId: customer.id,
    direction: 'inbound',
    channel: 'email',
    subject,
    body: text,
    externalId: messageId,
    metadata: { from: fromRaw, to: toRaw, resend_event_id: event.id || null },
  });

  console.log(`[Inbound-Email] Stored reply from ${fromEmail} (${customer.id})`);
  res.status(200).json({ ok: true });
}));

// ── Crisp Inbound Webhook (2D — one-way ingestion) ──────────────────────────

/**
 * POST /webhook/crisp — receive Crisp chat events.
 *
 * One-way ingestion (Phase 2D): Crisp messages flow into our `messages` table
 * so the admin sees chat alongside email + SMS in `/messaging`. Admin replies
 * still go through Crisp's app — we do NOT push back to Crisp.
 *
 * Auth: HMAC-SHA256 X-Crisp-Signature against CRISP_WEBHOOK_SECRET.
 * Bypass via X-Webhook-Secret matching the same secret. Dev: skipped if unset.
 *
 * Crisp event shape (`message:send`):
 *   {
 *     website_id, event: "message:send",
 *     data: {
 *       session_id, type, from: "user" | "operator", origin,
 *       content,      // string for type='text'; object otherwise
 *       user: { user_id, nickname, email, ... },  // identification we set in CrispWidget
 *       fingerprint, timestamp
 *     },
 *     timestamp
 *   }
 *
 * Direction map:
 *   from='user'     → direction='inbound'  (customer → us)
 *   from='operator' → direction='outbound' (us → customer, sent via Crisp app)
 *
 * Anonymous chats (no user.email) are dropped on the floor — log warn,
 * return 200. A future enhancement could store them under a "ghost customer"
 * row, but Phase 2D scope is matched-customers only.
 */
router.post('/webhook/crisp', verifyCrispSignature, asyncHandler(async (req, res) => {
  const event = req.body || {};
  if (event.event !== 'message:send') {
    // Silently ack any other event type (session:set_email, message:received, etc.)
    return res.status(200).json({ ok: true, ignored: event.event });
  }

  const data = event.data || {};
  const fromKind = data.from; // 'user' or 'operator'
  const contentRaw = data.content;
  const content = typeof contentRaw === 'string'
    ? contentRaw
    : (contentRaw?.text || JSON.stringify(contentRaw || ''));

  if (!content) {
    return res.status(200).json({ ok: false, reason: 'empty_content' });
  }

  // Extract email — set when CrispWidget identifies the user
  const userEmail = (data.user?.email || '').toLowerCase();
  if (!userEmail) {
    console.warn('[Crisp] No user email — anonymous chat, skipping');
    return res.status(200).json({ ok: false, reason: 'anonymous' });
  }

  // Match customer
  const { data: customers } = await supabase
    .from('customers')
    .select('id, email')
    .ilike('email', userEmail);

  const customer = (customers || []).find(c => (c.email || '').toLowerCase() === userEmail);
  if (!customer) {
    console.warn(`[Crisp] No customer matched ${userEmail}`);
    return res.status(200).json({ ok: false, reason: 'no_customer_match' });
  }

  const direction = fromKind === 'operator' ? 'outbound' : 'inbound';
  const externalId = data.fingerprint
    ? `crisp-${data.session_id || ''}-${data.fingerprint}`
    : `crisp-${data.session_id || ''}-${Date.now()}`;

  await storeLocalMessage({
    customerId: customer.id,
    direction,
    channel: 'chat',
    subject: null,
    body: content,
    externalId,
    metadata: {
      crisp_session_id: data.session_id,
      crisp_user_id: data.user?.user_id,
      crisp_nickname: data.user?.nickname,
      crisp_origin: data.origin,
      crisp_event_id: event.timestamp,
    },
  });

  console.log(`[Crisp] ${direction} chat from ${userEmail} (${customer.id})`);
  res.status(200).json({ ok: true });
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
  const {
    name, stage, subject, body, is_active, channel, sms_body, trigger_type, description,
    // Phase 2 timing fields. Anchor/kind/filter are intentionally NOT accepted
    // here — they're system-defined per stage. Only the offset and visual order
    // are admin-editable (Option C). Migration 020 + cron rewrite (commit 2).
    visual_order, trigger_offset_minutes,
  } = req.body;
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
  if (visual_order !== undefined) updates.visual_order = visual_order;
  if (trigger_offset_minutes !== undefined) {
    // Mirror the DB CHECK constraint (-7d to +30d) with a clear 400 instead
    // of a Postgres error. Same bound the cron rewrite will use as its
    // sanity fallback trigger (commit 2).
    const n = Number(trigger_offset_minutes);
    if (!Number.isFinite(n) || n < -10080 || n > 43200) {
      return res.status(400).json({ error: 'trigger_offset_minutes must be between -10080 (-7d) and 43200 (+30d)' });
    }
    updates.trigger_offset_minutes = n;
  }
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

// ── Phase 2B: Templates UX additions ─────────────────────────────────────────

/**
 * POST /email-templates/test-send — render a template with sample data and
 * email it to the requesting admin (or an explicit `to` address).
 *
 * Accepts the draft directly so unsaved edits can be tested without committing.
 * Merge fields use a representative mock payload.
 */
router.post('/email-templates/test-send', requireAuth, asyncHandler(async (req, res) => {
  const { interpolateTemplate, buildMergeFields, sendEmail } = await import('../services/notifyService.js');
  const { renderBrandedShell } = await import('../utils/emailShell.js');

  const { subject, body, to } = req.body || {};
  if (!subject || !body) {
    return res.status(400).json({ error: 'subject and body are required' });
  }

  const recipient = to || req.user?.email;
  if (!recipient) {
    return res.status(400).json({ error: 'No recipient — pass `to` or sign in with an email' });
  }

  // Mock merge-field payload — covers every key buildMergeFields knows about.
  // Mirrors the test fixture in tests/merge-field-coverage.test.js.
  const mockPayload = {
    customer_id: 'test-customer',
    booking_code: 'BK-20260507-TEST',
    customer: { first_name: 'Test', last_name: 'Customer', email: recipient, phone: '+17725551234' },
    vehicle:  { year: 2024, make: 'Nissan', model: 'Altima', vin: '1N4TEST', color: 'Gray', license_plate: 'TST123', thumbnail_url: '' },
    pickup_date: '2026-05-15', return_date: '2026-05-20', pickup_time: '10:00', return_time: '10:00',
    pickup_location: 'Port St. Lucie', total_cost: 500, tax_amount: 35, rental_days: 5,
    deposit_amount: 150, lockbox_code: '2580',
    daily_rate: 100, subtotal: 500,
    bonzah_policy_no: 'POL-TEST', bonzah_tier_label: 'Standard',
    amount_owed: 42.5,
  };

  const fields = buildMergeFields(mockPayload);
  const renderedSubject = `[TEST] ${interpolateTemplate(subject, fields, false)}`;
  const renderedBody = interpolateTemplate(body, fields, true);

  const html = renderBrandedShell(renderedSubject,
    `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;margin:0 0 20px;color:#92400e;font-size:13px;">
      <strong>Template test send.</strong> This was triggered from the dashboard with mock data — no real customer was contacted.
    </div>
    ${renderedBody.split(/\n\n+/).map(p => p.trim() ? `<p style="margin:0 0 16px;color:#44403c;font-size:15px;line-height:1.7;">${p.replace(/\n/g, '<br>')}</p>` : '').join('')}`
  );

  const result = await sendEmail({ to: recipient, subject: renderedSubject, html });
  res.json({ ok: !result?.error, to: recipient, result });
}));

/**
 * POST /email-templates/preview-html — render an email through the SAME code
 * path as a real send (interpolate merge fields → wrap in branded shell) and
 * return the resulting HTML. The frontend drops the response into a sandboxed
 * iframe so the preview is byte-identical to what the customer would receive.
 *
 * Accepts a draft body (so unsaved edits can be previewed) plus an optional
 * `stage` to drive the CTA button (booking_approved gets the gold "Complete
 * Agreement & Pay" button, etc.). All merge fields use the same mock fixture
 * as /test-send so preview ↔ test-send ↔ real-send all stay in lockstep.
 *
 * Returns text/html. Phase 2 — backs the EmailPreview component.
 */
router.post('/email-templates/preview-html', requireAuth, asyncHandler(async (req, res) => {
  const { interpolateTemplate, buildMergeFields, wrapInBrandedHTML } = await import('../services/notifyService.js');

  const { subject, body, stage } = req.body || {};
  if (!subject || !body) {
    return res.status(400).json({ error: 'subject and body are required' });
  }

  // Same mock fixture as /test-send. Single source of truth would be nicer
  // but a tiny duplication beats an awkward shared import for ~25 lines.
  const mockPayload = {
    customer_id: 'preview',
    booking_code: 'BK-PREVIEW',
    customer: { first_name: 'Sarah', last_name: 'Preview', email: 'sarah@example.com', phone: '+17725551234' },
    vehicle:  { year: 2024, make: 'Nissan', model: 'Altima', vin: '1N4PREVIEW', color: 'Pearl White', license_plate: 'ABC1234', thumbnail_url: '' },
    pickup_date: '2026-05-15', return_date: '2026-05-20', pickup_time: '10:00', return_time: '10:00',
    pickup_location: 'Port St. Lucie', total_cost: 500, tax_amount: 35, rental_days: 5,
    deposit_amount: 150, lockbox_code: '2580',
    daily_rate: 100, subtotal: 500,
    bonzah_policy_no: 'POL-PREVIEW', bonzah_tier_label: 'Standard',
    amount_owed: 42.5,
  };

  const fields = buildMergeFields(mockPayload);
  const renderedSubject = interpolateTemplate(subject, fields, false);
  const renderedBody    = interpolateTemplate(body, fields, true);

  // CTA: if a stage is passed, build the same gold-or-dark button that real
  // sends would attach. Without a stage we skip the CTA — accurate preview of
  // a custom one-off template.
  let ctaHtml = '';
  if (stage) {
    // Inline mini-impl mirroring buildCtaHtml — that function isn't exported
    // and we want to avoid exporting more surface than necessary for preview.
    const STAGE_CTA_PREVIEW = {
      booking_submitted:   { label: 'Check Booking Status',           fieldKey: 'status_link' },
      booking_approved:    { label: 'Complete Agreement & Pay',         fieldKey: 'confirm_link',  style: 'gold' },
      payment_reminder:    { label: 'Complete Payment',                 fieldKey: 'confirm_link',  style: 'gold' },
      booking_declined:    { label: 'Browse Other Vehicles',          path: '/vehicles' },
      booking_cancelled:   { label: 'Browse Other Vehicles',          path: '/vehicles' },
      payment_confirmed:   { label: 'Go to My Customer Portal',       fieldKey: 'portal_link',   style: 'gold' },
      ready_for_pickup:    { label: 'View Pickup Details',            fieldKey: 'portal_link',   style: 'gold' },
      pickup_reminder:     { label: 'View Pickup Details',            fieldKey: 'portal_link',   style: 'gold' },
      day_of_pickup:       { label: 'View Pickup Details',            fieldKey: 'portal_link',   style: 'gold' },
      return_reminder:     { label: 'View Return Details',            fieldKey: 'portal_link' },
      rental_completed:    { label: 'Leave a Review',                 fieldKey: 'review_link',   style: 'gold' },
      insurance_approved:  { label: 'View My Booking',                fieldKey: 'portal_link',   style: 'gold' },
      insurance_rejected:  { label: 'Contact Us',                     path: '/#contact' },
    };
    const cta = STAGE_CTA_PREVIEW[stage];
    if (cta) {
      const siteUrl = brand.siteUrl;
      const href = cta.fieldKey ? (fields[cta.fieldKey] || `${siteUrl}/`) : `${siteUrl}${cta.path || '/'}`;
      const isAccent = cta.style === 'gold' || cta.style === 'accent';
      const bg = isAccent ? brand.colors.primary : brand.colors.secondary;
      const fg = isAccent ? brand.colors.secondary : '#ffffff';
      ctaHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;"><tr><td align="center"><a href="${href}" style="display:inline-block;background:${bg};color:${fg};font-size:15px;font-weight:700;padding:15px 36px;border-radius:10px;text-decoration:none;">${cta.label}</a></td></tr></table>`;
    }
  }

  const html = wrapInBrandedHTML(renderedSubject, renderedBody, ctaHtml, '');
  res.set('Content-Type', 'text/html; charset=utf-8').send(html);
}));

/**
 * POST /email-templates/test-send-sms — render an SMS body with mock data
 * and text it to the requesting admin (or an explicit `to` number).
 *
 * Mirrors /test-send but for SMS-channel templates. Uses source='manual' to
 * bypass quiet hours since the admin explicitly triggered the test.
 */
router.post('/email-templates/test-send-sms', requireAuth, asyncHandler(async (req, res) => {
  const { interpolateTemplate, buildMergeFields, sendSMS } = await import('../services/notifyService.js');

  const { sms_body, to } = req.body || {};
  if (!sms_body) {
    return res.status(400).json({ error: 'sms_body is required' });
  }

  // Resolve recipient — explicit body param, then admin's profile phone.
  const recipient = to || req.user?.profile?.phone;
  if (!recipient) {
    return res.status(400).json({ error: 'No recipient — pass `to`, or add a phone number to your profile' });
  }

  // Same mock fixture as /test-send so previews match real behavior.
  const mockPayload = {
    customer_id: 'test-customer',
    booking_code: 'BK-20260507-TEST',
    customer: { first_name: 'Test', last_name: 'Customer', email: recipient, phone: recipient },
    vehicle:  { year: 2024, make: 'Nissan', model: 'Altima', vin: '1N4TEST', color: 'Gray', license_plate: 'TST123', thumbnail_url: '' },
    pickup_date: '2026-05-15', return_date: '2026-05-20', pickup_time: '10:00', return_time: '10:00',
    pickup_location: 'Port St. Lucie', total_cost: 500, tax_amount: 35, rental_days: 5,
    deposit_amount: 150, lockbox_code: '2580',
    daily_rate: 100, subtotal: 500,
  };

  const fields = buildMergeFields(mockPayload);
  const rendered = `[TEST] ${interpolateTemplate(sms_body, fields, false)}`;

  const result = await sendSMS({ to: recipient, body: rendered, source: 'manual' });
  res.json({ ok: !result?.error && !result?.skipped, to: recipient, result });
}));

/**
 * GET /email-templates/status — per-stage status: which source does the
 * system actually use for each stage? Frontend uses this to show DB vs
 * Fallback indicators on the templates list.
 */
router.get('/email-templates/status', requireAuth, asyncHandler(async (req, res) => {
  const FALLBACK_TEMPLATES = (await import('../services/fallbackTemplates.js')).default;

  const { data: dbRows } = await supabase
    .from('email_templates')
    .select('stage, name, is_active');

  // Build a map of all known stages from both sources
  const stageMap = new Map();

  for (const row of dbRows || []) {
    const entry = stageMap.get(row.stage) || { stage: row.stage, has_db: false, has_active_db: false, has_fallback: false, db_template_name: null };
    entry.has_db = true;
    if (row.is_active) {
      entry.has_active_db = true;
      entry.db_template_name = row.name;
    }
    stageMap.set(row.stage, entry);
  }

  for (const stage of Object.keys(FALLBACK_TEMPLATES || {})) {
    const entry = stageMap.get(stage) || { stage, has_db: false, has_active_db: false, has_fallback: false, db_template_name: null };
    entry.has_fallback = true;
    stageMap.set(stage, entry);
  }

  const statuses = Array.from(stageMap.values()).map(e => ({
    stage: e.stage,
    source: e.has_active_db ? 'db' : (e.has_fallback ? 'fallback' : 'none'),
    db_template_name: e.db_template_name,
    has_fallback: e.has_fallback,
  }));

  res.json(statuses);
}));

export default router;
