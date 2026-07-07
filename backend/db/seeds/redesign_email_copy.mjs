/**
 * Email-copy redesign generator (2026-06).
 *
 * Emits an IDEMPOTENT UPSERT SQL file that refreshes the customer-facing
 * `email_templates` rows with the revamped, concise copy — matching the design
 * system in utils/emailShell.js. It never DELETEs, so unrelated rows and any
 * owner-tuned templates outside this set are left untouched.
 *
 * Run once per brand (brand values are pulled from config/brand.js, which reads
 * env vars). The output SQL is per-brand because bodies bake in the brand name,
 * phone, and address (the notify merge-field map has no brand-contact fields):
 *
 *   # Annie's (defaults):
 *   node db/seeds/redesign_email_copy.mjs > db/seeds/redesign_email_copy.annies.sql
 *
 *   # JD Coastal (env override):
 *   BRAND_NAME="JD Coastal Cars" BRAND_PHONE="(908) 692-8492" \
 *   BRAND_CITY="Palm Bay" BRAND_STATE="FL" BRAND_ZIP="32905" \
 *   BRAND_ADDRESS="<street>" \
 *   node db/seeds/redesign_email_copy.mjs > db/seeds/redesign_email_copy.jdcoastal.sql
 *
 * Design choices baked into the copy:
 *   • No ASCII-divider walls, minimal emoji, sharp messaging.
 *   • One clean support line ({{phone}}) — not multiple staff cell numbers.
 *   • Primary action is a CTA button (added by notifyService STAGE_CTA), so
 *     email bodies don't repeat the link inline; SMS keeps inline links.
 *   • Brand-neutral: no hardcoded cities/prices beyond the brand's own address.
 */

import brand from '../../config/brand.js';

const B = brand;
const ADDR = `${B.location.address}, ${B.location.city}, ${B.location.state} ${B.location.zip}`;
const SIGN = `${B.name}\n${B.location.city}, ${B.location.state}`;

// Each entry: { name, channel, subject, body, sms, trigger, desc }.
// subject/body null for SMS-only stages. Money fields use \${{...}}; brand
// values interpolate via ${...}; merge fields stay literal {{...}}.
const T = {
  booking_submitted: {
    name: 'Booking Submitted', channel: 'both', trigger: 'automated',
    desc: 'Sent immediately when a customer submits a booking request.',
    subject: 'Request received — {{booking_code}}',
    body: `Hi {{first_name}},

Thanks for choosing ${B.name}. We've got your request and we're reviewing it now — you'll hear back within a few hours during business hours.

Reference: {{booking_code}}
Vehicle: {{vehicle}}
Pickup: {{pickup_date}} at {{pickup_time}}
Return: {{return_date}} at {{return_time}}
Total: \${{total_cost}}

Once we confirm availability, we'll send a link to sign your agreement and pay.

Questions? Call or text ${B.phone}.

${SIGN}`,
    sms: `Thanks {{first_name}} — we've got your request with ${B.name}.

{{vehicle}}
{{pickup_date}} – {{return_date}}
Ref {{booking_code}}

We'll confirm within a few hours. — ${B.name}`,
  },

  booking_approved: {
    name: 'Booking Approved', channel: 'both', trigger: 'automated',
    desc: 'Sent when the admin approves a booking request.',
    subject: 'You’re confirmed — {{vehicle}} ({{booking_code}})',
    body: `Hi {{first_name}},

You're confirmed. Sign your agreement and pay to lock it in — that's the only step left.

Reference: {{booking_code}}
Vehicle: {{vehicle}}
Pickup: {{pickup_date}} at {{pickup_time}}
Return: {{return_date}} at {{return_time}}
Mileage: {{mileage_policy}}
Total: \${{total_cost}}

We'll text your exact address, parking spot, and lockbox code 24 hours before pickup. Prefer delivery? Just reply and we'll set it up.

Questions? Call or text ${B.phone}.

${SIGN}`,
    sms: `You're confirmed, {{first_name}}!

{{vehicle}}
Pickup {{pickup_date}} at {{pickup_time}}
Ref {{booking_code}}

Sign & pay to lock it in: {{confirm_link}}

We'll text pickup details the day before. — ${B.name}`,
  },

  booking_declined: {
    name: 'Booking Declined', channel: 'both', trigger: 'automated',
    desc: 'Sent when the admin declines a booking request.',
    subject: 'About your booking request — {{booking_code}}',
    body: `Hi {{first_name}},

Unfortunately we can't confirm this booking.

Reference: {{booking_code}}
Vehicle: {{vehicle}}
Dates: {{pickup_date}} – {{return_date}}

Why: {{decline_reason}}

We may have another vehicle open for your dates. Call us at ${B.phone} and we'll find you something that works.

${SIGN}`,
    sms: `Hi {{first_name}}, we couldn't confirm the {{vehicle}} for {{pickup_date}}–{{return_date}}.

{{decline_reason}}

Call ${B.phone} and we'll find an alternative. — ${B.name}`,
  },

  payment_confirmed: {
    name: 'Payment Confirmed', channel: 'both', trigger: 'automated',
    desc: 'Sent when a payment succeeds. Itemized receipt + pickup steps are added automatically above this body.',
    subject: 'Payment received — you’re all set ({{booking_code}})',
    body: `Hi {{first_name}},

Payment received and your booking is confirmed. Your receipt and pickup steps are below.

Everything lives in your portal — receipt, check-in, messages, and extensions. {{#if deposit_amount}}Your \${{deposit_amount}} deposit is fully refundable and returns 3–5 business days after inspection.{{/if}}

Questions? Call or text ${B.phone}.

${SIGN}`,
    sms: `Payment confirmed, {{first_name}} — you're all set!

{{vehicle}}
Pickup {{pickup_date}} at {{pickup_time}}
Ref {{booking_code}}

Your portal: {{portal_link}}
We'll text pickup details the day before. — ${B.name}`,
  },

  payment_reminder: {
    name: 'Payment Reminder', channel: 'both', trigger: 'automated',
    desc: 'Sent 24 hours after approval when payment has not been completed.',
    subject: 'Complete your booking — {{booking_code}}',
    body: `Hi {{first_name}},

Your {{vehicle}} is reserved, but we still need your agreement and payment to lock it in.

Reference: {{booking_code}}
Vehicle: {{vehicle}}
Pickup: {{pickup_date}} at {{pickup_time}}
Total: \${{total_cost}}

Unpaid bookings expire 48 hours after approval. It only takes a few minutes to finish.

Questions? Call or text ${B.phone}.

${SIGN}`,
    sms: `Hi {{first_name}}, your {{vehicle}} is reserved — payment still needed.

Ref {{booking_code}}
Pickup {{pickup_date}} at {{pickup_time}}

Finish here: {{confirm_link}}
Unpaid bookings expire 48h after approval. — ${B.name}`,
  },

  insurance_approved: {
    name: 'Insurance Approved', channel: 'both', trigger: 'automated',
    desc: 'Sent when admin approves own-insurance documents.',
    subject: 'Insurance approved — you’re all set ({{booking_code}})',
    body: `Hi {{first_name}},

Your insurance documents are approved. You're cleared for pickup.

Reference: {{booking_code}}
Vehicle: {{vehicle}}
Pickup: {{pickup_date}} at {{pickup_time}}

We'll text your exact address and lockbox code 24 hours before pickup.

${SIGN}`,
    sms: `Hi {{first_name}}, your insurance is approved for {{booking_code}}. You're cleared for pickup {{pickup_date}}.

Details: {{portal_link}} — ${B.name}`,
  },

  insurance_rejected: {
    name: 'Insurance Rejected', channel: 'both', trigger: 'automated',
    desc: 'Sent when admin rejects own-insurance documents.',
    subject: 'Insurance needs attention — {{booking_code}}',
    body: `Hi {{first_name}},

We reviewed your insurance documents and need updated information before your rental.

Reference: {{booking_code}}
Vehicle: {{vehicle}}
Pickup: {{pickup_date}} at {{pickup_time}}

Please upload corrected documents in your portal, or call us at ${B.phone} and we'll help.

${SIGN}`,
    sms: `Hi {{first_name}}, we need updated insurance docs for {{booking_code}} before pickup.

Upload in your portal: {{portal_link}}
Or call ${B.phone}. — ${B.name}`,
  },

  ready_for_pickup: {
    name: 'Ready for Pickup', channel: 'both', trigger: 'automated',
    desc: 'Sent when admin marks a vehicle as ready for pickup.',
    subject: 'Your {{vehicle}} is ready — {{booking_code}}',
    body: `Hi {{first_name}},

Your vehicle is cleaned, prepped, and ready.

Vehicle: {{vehicle}}
Reference: {{booking_code}}
Pickup: {{pickup_date}} at {{pickup_time}}

Getting your keys
${ADDR} — park and walk to the back of the building. Your vehicle has a key lockbox on the window. Enter code {{lockbox_code}}, take the key, and remove the lockbox before driving.

A few house rules: return with the same fuel level, no smoking, no pets ($150 cleaning fee each). Text us when you arrive.

${SIGN}`,
    sms: `Hi {{first_name}}, your {{vehicle}} is ready for pickup.

${ADDR} (back of building)
Lockbox code {{lockbox_code}}

Check in: {{status_link}}
Have a great trip! — ${B.name}`,
  },

  pickup_reminder: {
    name: 'Pre-Pickup Reminder', channel: 'both', trigger: 'automated',
    desc: 'Sent automatically 24 hours before the pickup date.',
    subject: 'Pickup tomorrow — your {{vehicle}} is ready ({{booking_code}})',
    body: `Hi {{first_name}},

Your rental starts tomorrow. Here's everything you need.

Pickup: {{pickup_date}} at {{pickup_time}}
Vehicle: {{vehicle}}
Reference: {{booking_code}}
Mileage: {{mileage_policy}}

Getting your keys
${ADDR} — park and walk to the back of the building. Your vehicle has a key lockbox on the window. Enter code {{lockbox_code}}, take the key, and remove the lockbox before driving.

A few house rules: return with the same fuel level, no smoking, no pets ($150 cleaning fee each). Text us when you arrive.

Questions? Call or text ${B.phone}.

${SIGN}`,
    sms: `Hi {{first_name}}, your {{vehicle}} is ready for pickup tomorrow.

Mileage: {{mileage_policy}}
${ADDR}
Lockbox code {{lockbox_code}} (car parked in back)

1. Go to the back of the building
2. Find the car with the lockbox on the window
3. Enter {{lockbox_code}}, take the key, remove the lockbox

Check in: {{portal_link}}
Need help? ${B.phone} — ${B.name}`,
  },

  day_of_pickup: {
    name: 'Day-of Pickup', channel: 'sms', trigger: 'automated',
    desc: 'Sent the morning of the pickup date.',
    subject: null, body: null,
    sms: `Good morning, {{first_name}}! Your {{vehicle}} is ready for pickup today at {{pickup_time}}.

${ADDR} (back of building)
Lockbox code {{lockbox_code}}

Check in: {{portal_link}}
Drive safe — text us if anything comes up. — ${B.name}, ${B.phone}`,
  },

  mid_rental_checkin: {
    name: 'Mid-Rental Check-in', channel: 'sms', trigger: 'automated',
    desc: 'Sent partway through longer rentals.',
    subject: null, body: null,
    sms: `Hi {{first_name}}, just checking in — how's the {{vehicle}} treating you?

Your return is set for {{return_date}}. Want to keep it longer? Reply and we'll hold it for you, no rebooking needed.

— ${B.name}, ${B.phone}`,
  },

  return_reminder: {
    name: 'Pre-Return Reminder', channel: 'both', trigger: 'automated',
    desc: 'Sent automatically 24 hours before the return date.',
    subject: 'Return reminder — {{vehicle}} due {{return_date}}',
    body: `Hi {{first_name}},

Your rental is almost up. A quick checklist for a smooth return.

Return: {{return_date}} at {{return_time}}
Vehicle: {{vehicle}}
Reference: {{booking_code}}

Before you drop off: refill fuel to the level you received, park in the back near the dumpster, return the key to the lockbox (code {{lockbox_code}}), and snap a photo of where you parked.

Plans changed? Reply and we'll check on extending your rental.

${SIGN}`,
    sms: `Hi {{first_name}}, your {{vehicle}} is due back tomorrow by {{return_time}}.

${ADDR}

Before drop-off:
• Same fuel level as pickup
• Park in back, near the dumpster
• Key in lockbox (code {{lockbox_code}})
• Photo of where you parked

Want to extend? Reply and we'll check. — ${B.name}`,
  },

  day_of_return: {
    name: 'Day-of Return', channel: 'sms', trigger: 'automated',
    desc: 'Sent the morning of the return date.',
    subject: null, body: null,
    sms: `Good morning, {{first_name}}! Your {{vehicle}} is due back today by {{return_time}}.

${ADDR} (back of building, near the dumpster)
Key in lockbox (code {{lockbox_code}})

Quick checklist:
• Same fuel level as pickup
• Photo of where you parked
• Reply to extend if plans changed

Thanks again! — ${B.name}, ${B.phone}`,
  },

  return_confirmed: {
    name: 'Return Confirmed', channel: 'sms', trigger: 'manual',
    desc: 'Sent after the vehicle is returned and inspected.',
    subject: null, body: null,
    sms: `Hi {{first_name}}, we've got the {{vehicle}} back and everything looks great. Thanks for taking care of it.

Hope to see you again soon! — ${B.name}`,
  },

  rental_completed: {
    name: 'Rental Completed', channel: 'both', trigger: 'automated',
    desc: 'Sent the day after return — review request.',
    subject: 'How was your {{vehicle}}, {{first_name}}?',
    body: `Hi {{first_name}},

Thanks for renting with ${B.name} — we hope the {{vehicle}} made your trip easier.

If you have a moment, a quick review means a lot. As a thank-you, you'll get 5% off your next rental — just mention it when you book.

We'd love to have you back.

${SIGN}`,
    sms: `Hi {{first_name}}, hope you enjoyed your {{vehicle}}!

A quick review would mean a lot — and we'll take 5% off your next rental as thanks.

{{review_link}}
— ${B.name}`,
  },

  late_return_warning: {
    name: 'Late Return Warning', channel: 'sms', trigger: 'automated',
    desc: 'Sent on the first day after the scheduled return date.',
    subject: null, body: null,
    sms: `Hi {{first_name}}, your {{vehicle}} was due back at {{return_time}} today. On your way? Just send your ETA.

Need more time? Reply and we'll check on extending.

Return: ${ADDR}
— ${B.name}, ${B.phone}`,
  },

  late_return_escalation: {
    name: 'Late Return Escalation', channel: 'both', trigger: 'automated',
    desc: 'Sent 4 days after the scheduled return date.',
    subject: 'Your rental is overdue — {{booking_code}}',
    body: `{{first_name}},

Your {{vehicle}} was due back today at {{return_time}} and hasn't been returned. We've also been unable to reach you.

Reference: {{booking_code}}
Due: {{return_date}} at {{return_time}}
Status: Overdue

Please return the vehicle to ${ADDR} right away, or call us at ${B.phone}. Late fees apply to overdue rentals. If there's an emergency, let us know and we'll work with you.

${SIGN}`,
    sms: `{{first_name}}, your {{vehicle}} was due back at {{return_time}} today and hasn't been returned.

Please return it now or call ${B.phone}. Late fees apply to overdue rentals.

— ${B.name}`,
  },

  extension_offer: {
    name: 'Extension Offer', channel: 'sms', trigger: 'automated',
    desc: 'Sent before the return date for multi-day rentals.',
    subject: null, body: null,
    sms: `Hi {{first_name}}, your rental ends {{return_date}}. Enjoying the {{vehicle}}? We can extend it.

Reply with how many extra days you need and we'll confirm pricing and availability.

— ${B.name}`,
  },

  damage_notification: {
    name: 'Damage Notification', channel: 'email', trigger: 'manual',
    desc: 'Sent after inspection reveals damage.',
    subject: 'A note about your recent rental — {{booking_code}}',
    body: `Hi {{first_name}},

We wanted to reach out about your recent rental of the {{vehicle}} ({{booking_code}}). During our post-rental inspection we noted some damage we'll need to follow up on.

What we found: {{damage_description}}

We'll review the details and contact you within one business day to walk through what we found, whether anything is owed beyond your deposit, and answer any questions.

Want to get ahead of it? Reach us at ${B.phone}, or view your booking in the portal.

${SIGN}`,
    sms: null,
  },

  deposit_refunded: {
    name: 'Deposit Refunded', channel: 'both', trigger: 'automated',
    desc: 'Sent when a security deposit is fully refunded.',
    subject: 'Your ${{deposit_amount}} deposit is on its way back — {{booking_code}}',
    body: `Hi {{first_name}},

Good news — your security deposit has been fully refunded.

Reference: {{booking_code}}
Vehicle: {{vehicle}}
Deposit held: \${{deposit_amount}}
Refunded: \${{refund_amount}}

It'll appear on your original payment method within 5–10 business days. Thanks for taking great care of the vehicle — we hope to see you again.

${SIGN}`,
    sms: `Hi {{first_name}}, your \${{deposit_amount}} deposit for the {{vehicle}} has been fully refunded.

Ref {{booking_code}}
Expect it within 5–10 business days. — ${B.name}`,
  },

  deposit_settled: {
    name: 'Deposit Settled', channel: 'both', trigger: 'automated',
    desc: 'Sent when a deposit is settled against incidentals.',
    subject: 'Deposit settlement — {{booking_code}}',
    body: `Hi {{first_name}},

Your security deposit has been settled. Here's the breakdown.

Reference: {{booking_code}}
Vehicle: {{vehicle}}
Deposit held: \${{deposit_amount}}
Charges applied: \${{incidental_total}}
Refund: \${{refund_amount}}

{{#if refund_amount}}Your \${{refund_amount}} refund returns to your original payment method within 5–10 business days.{{/if}} Questions about a charge? Reach us at ${B.phone}, or review and dispute it in your portal.

${SIGN}`,
    sms: `Hi {{first_name}}, your deposit for the {{vehicle}} is settled.

Deposit \${{deposit_amount}} · Charges \${{incidental_total}} · Refund \${{refund_amount}}
Ref {{booking_code}}

Refund arrives in 5–10 business days. Questions? ${B.phone} — ${B.name}`,
  },

  repeat_customer: {
    name: 'Repeat Customer', channel: 'email', trigger: 'automated',
    desc: 'Sent a while after rental completion.',
    subject: '{{first_name}}, your next rental is 5% off',
    body: `Hi {{first_name}},

Thanks for renting with ${B.name}. As a returning guest, here's 5% off your next trip — just mention this email when you book.

We're always adding vehicles and sharpening the experience. Whenever you need a car next, we'd love to have you back.

${SIGN}`,
    sms: null,
  },

  booking_cancelled: {
    name: 'Booking Cancelled', channel: 'both', trigger: 'automated',
    desc: 'Sent when a booking is cancelled.',
    subject: 'Booking cancelled — {{booking_code}}',
    body: `Hi {{first_name}},

Your booking has been cancelled.

Reference: {{booking_code}}
Vehicle: {{vehicle}}
Dates: {{pickup_date}} – {{return_date}}

Any deposit collected is refunded to your original payment method within 3–5 business days. Want to rebook? We're here at ${B.phone}.

${SIGN}`,
    sms: `Hi {{first_name}}, your booking for the {{vehicle}} ({{pickup_date}}–{{return_date}}) is cancelled.

Ref {{booking_code}}
Any deposit is refunded within 3–5 business days.

Questions? ${B.phone} — ${B.name}`,
  },
};

export const TEMPLATES = T;

// ── SQL emitter ─────────────────────────────────────────────────────────────
function lit(s) {
  if (s == null) return 'NULL';
  const esc = s.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n');
  return `E'${esc}'`;
}

const rows = Object.entries(T).map(([stage, t]) => `-- ${t.name}
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  ${lit(t.name)}, ${lit(stage)}, ${lit(t.channel)},
  ${lit(t.subject)},
  ${lit(t.body)},
  ${lit(t.sms)},
  ${lit(t.trigger)}, ${lit(t.desc)}
)
ON CONFLICT (stage) DO UPDATE SET
  name = EXCLUDED.name, channel = EXCLUDED.channel, subject = EXCLUDED.subject,
  body = EXCLUDED.body, sms_body = EXCLUDED.sms_body,
  trigger_type = EXCLUDED.trigger_type, description = EXCLUDED.description;`).join('\n\n');

// Only emit SQL when run directly (so `import { TEMPLATES }` stays quiet).
const { pathToFileURL } = await import('url');
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) process.stdout.write(`-- Email-copy redesign (2026-06) — ${B.name}
-- Idempotent UPSERT. Does NOT delete; only refreshes the ${Object.keys(T).length} stages below.
-- Generated by db/seeds/redesign_email_copy.mjs. Review before running.
-- Apply against the brand's OWN Supabase project (verify SUPABASE_URL first).

BEGIN;

${rows}

COMMIT;

SELECT stage, channel FROM email_templates WHERE stage IN (${Object.keys(T).map(s => `'${s}'`).join(', ')}) ORDER BY stage;
`);
