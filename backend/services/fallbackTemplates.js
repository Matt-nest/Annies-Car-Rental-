/**
 * Fallback email/SMS templates for critical booking stages.
 *
 * These fire ONLY when the `email_templates` DB table has no active row
 * for a given stage. DB templates always take priority.
 *
 * Design intent: concise, sharp, "$50M brand" messaging. The branded shell
 * (utils/emailShell.js) supplies the chrome and CTA button; bodies stay lean.
 * The primary action for each stage is rendered automatically as a CTA button
 * via notifyService STAGE_CTA — so bodies do NOT repeat the link inline.
 *
 * All brand-specific values (name, phone, address, palette) are injected from
 * `brand.js`, so templates work for any white-label deployment. No hardcoded
 * cities, prices, or colors.
 *
 * Covers Tier 1 (business-critical) and Tier 2 (revenue/protection):
 *   booking_approved, booking_declined, booking_cancelled,
 *   payment_confirmed, pickup_reminder, return_reminder,
 *   late_return_warning, rental_completed, deposit_*, inspection_charges,
 *   insurance_*, damage_notification, day_of_pickup, day_of_return.
 */

import brand from '../config/brand.js';

const B = brand;
const ADDR = `${B.location.address}, ${B.location.city}, ${B.location.state} ${B.location.zip}`;

// ── Email body building blocks (rendered inline; preserved by wrapInBrandedHTML) ──
// Single, flat tables only — wrapInBrandedHTML's HTML-block extractor matches to
// the first </table>, so nested tables would break. Values may contain {{merge}}
// fields and a literal "$"; single-quoted args never trigger JS interpolation.

/** One label/value row. */
function r(label, value) {
  return `<tr>
      <td style="padding:7px 18px;color:#78716c;font-size:13px;line-height:1.5;">${label}</td>
      <td style="padding:7px 18px;color:#1c1917;font-size:13px;font-weight:600;text-align:right;line-height:1.5;">${value}</td>
    </tr>`;
}

/** Wrap rows in a soft, bordered details card. */
function details(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafaf9;border:1px solid #eceae7;border-radius:12px;border-collapse:separate;margin:4px 0 6px;">
    <tr><td colspan="2" style="height:9px;line-height:9px;font-size:0;">&nbsp;</td></tr>
    ${rows}
    <tr><td colspan="2" style="height:9px;line-height:9px;font-size:0;">&nbsp;</td></tr>
  </table>`;
}

/** Vehicle hero image — only rendered when a photo URL is present. */
const VEHICLE_PHOTO = `{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:100%;border-radius:12px;margin:4px 0 8px;" />{{/if}}`;

const FALLBACK_TEMPLATES = {

  // ── TIER 1: Business breaks without these ────────────────────────────────

  booking_approved: {
    channel: 'both',
    subject: 'You’re confirmed — {{vehicle}} ({{booking_code}})',
    body: `Hi {{first_name}},

You're confirmed. Sign your agreement and pay to lock it in — that's the only step left.

${details(
  r('Reference', '{{booking_code}}') +
  r('Vehicle', '{{vehicle}}') +
  r('Pickup', '{{pickup_date}} · {{pickup_time}}') +
  r('Return', '{{return_date}} · {{return_time}}') +
  r('Mileage', '{{mileage_policy}}') +
  r('Total', '${{total_cost}}')
)}
${VEHICLE_PHOTO}
We'll text your exact address, parking spot, and lockbox code 24 hours before pickup. Prefer delivery? Just reply and we'll set it up.`,
    sms_body: `You're confirmed, {{first_name}}!

{{vehicle}}
Pickup {{pickup_date}} at {{pickup_time}}
Ref {{booking_code}}

Sign & pay to lock it in: {{confirm_link}}

We'll text pickup details the day before. — ${B.name}`,
  },

  booking_declined: {
    channel: 'both',
    subject: 'About your booking request — {{booking_code}}',
    body: `Hi {{first_name}},

Unfortunately we can't confirm this booking.

${details(
  r('Reference', '{{booking_code}}') +
  r('Vehicle', '{{vehicle}}') +
  r('Dates', '{{pickup_date}} – {{return_date}}')
)}
Why: {{decline_reason}}

We may have another vehicle open for your dates. Call us at ${B.phone} and we'll find you something that works.`,
    sms_body: `Hi {{first_name}}, we couldn't confirm the {{vehicle}} for {{pickup_date}}–{{return_date}}.

{{decline_reason}}

Call ${B.phone} and we'll find an alternative. — ${B.name}`,
  },

  payment_confirmed: {
    channel: 'both',
    subject: 'Payment received — you’re all set ({{booking_code}})',
    // Itemized receipt, welcome banner, and pickup next-steps are injected
    // above this body by notifyService (renderPrepWelcomeHtml +
    // renderItemizedReceiptHtml + renderPickupNextStepsHtml). Body stays short.
    body: `Hi {{first_name}},

Payment received and your booking is confirmed. Your receipt and pickup steps are below.
${VEHICLE_PHOTO}
Everything lives in your portal — receipt, check-in, messages, and extensions. {{#if deposit_amount}}Your \${{deposit_amount}} deposit is fully refundable and returns 3–5 business days after inspection.{{/if}}`,
    sms_body: `Payment confirmed, {{first_name}} — you're all set!

{{vehicle}}
Pickup {{pickup_date}} at {{pickup_time}}
Ref {{booking_code}}

Your portal: {{portal_link}}
We'll text pickup details the day before. — ${B.name}`,
  },

  pickup_reminder: {
    channel: 'both',
    subject: 'Pickup tomorrow — your {{vehicle}} is ready ({{booking_code}})',
    body: `Hi {{first_name}},

Your rental starts tomorrow. Here's everything you need.

${details(
  r('Pickup', '{{pickup_date}} · {{pickup_time}}') +
  r('Vehicle', '{{vehicle}}') +
  r('Reference', '{{booking_code}}') +
  r('Mileage', '{{mileage_policy}}')
)}
${VEHICLE_PHOTO}
Getting your keys
${ADDR} — park and walk to the back of the building. Your vehicle has a key lockbox on the window. Enter code {{lockbox_code}}, take the key, and remove the lockbox before driving.

{{#if handoff_fuel_level}}At handoff: fuel {{handoff_fuel_level}}{{#if handoff_odometer}}, odometer {{handoff_odometer}} mi{{/if}}.
{{/if}}A few house rules: return with the same fuel level, no smoking, no pets ($150 cleaning fee each). Text us when you arrive.`,
    sms_body: `Hi {{first_name}}, your {{vehicle}} is ready for pickup tomorrow.

Mileage: {{mileage_policy}}
${ADDR}
Lockbox code {{lockbox_code}} (car parked in back)

1. Go to the back of the building
2. Find the car with the lockbox on the window
3. Enter {{lockbox_code}}, take the key, remove the lockbox

Check in: {{portal_link}}
Need help? ${B.phone} — ${B.name}`,
  },

  return_reminder: {
    channel: 'both',
    subject: 'Return reminder — {{vehicle}} due {{return_date}}',
    body: `Hi {{first_name}},

Your rental is almost up. A quick checklist for a smooth return.

${details(
  r('Return', '{{return_date}} · {{return_time}}') +
  r('Vehicle', '{{vehicle}}') +
  r('Reference', '{{booking_code}}')
)}
Before you drop off: refill fuel to the level you received, park in the back near the dumpster, return the key to the lockbox (code {{lockbox_code}}), and snap a photo of where you parked.

Plans changed? Reply and we'll check on extending your rental.`,
    sms_body: `Hi {{first_name}}, your {{vehicle}} is due back tomorrow by {{return_time}}.

${ADDR}

Before drop-off:
• Same fuel level as pickup
• Park in back, near the dumpster
• Key in lockbox (code {{lockbox_code}})
• Photo of where you parked

Want to extend? Reply and we'll check. — ${B.name}`,
  },

  // ── TIER 2: Revenue & protection ─────────────────────────────────────────

  late_return_warning: {
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Hi {{first_name}}, your {{vehicle}} was due back at {{return_time}} today. On your way? Just send your ETA.

Need more time? Reply and we'll check on extending.

Return: ${ADDR}
— ${B.name}, ${B.phone}`,
  },

  rental_completed: {
    channel: 'both',
    subject: 'How was your {{vehicle}}, {{first_name}}?',
    body: `Hi {{first_name}},

Thanks for renting with ${B.name} — we hope the {{vehicle}} made your trip easier.

If you have a moment, a quick review means a lot. As a thank-you, you'll get 5% off your next rental — just mention it when you book.

We'd love to have you back.`,
    sms_body: `Hi {{first_name}}, hope you enjoyed your {{vehicle}}!

A quick review would mean a lot — and we'll take 5% off your next rental as thanks.

{{review_link}}
— ${B.name}`,
  },

  booking_cancelled: {
    channel: 'both',
    subject: 'Booking cancelled — {{booking_code}}',
    body: `Hi {{first_name}},

Your booking has been cancelled.

${details(
  r('Reference', '{{booking_code}}') +
  r('Vehicle', '{{vehicle}}') +
  r('Dates', '{{pickup_date}} – {{return_date}}')
)}
Any deposit collected is refunded to your original payment method within 3–5 business days. Want to rebook? We're here at ${B.phone}.`,
    sms_body: `Hi {{first_name}}, your booking for the {{vehicle}} ({{pickup_date}}–{{return_date}}) is cancelled.

Ref {{booking_code}}
Any deposit is refunded within 3–5 business days.

Questions? ${B.phone} — ${B.name}`,
  },

  // ── TIER 2 (continued): Deposit Notifications ────────────────────────────

  deposit_refunded: {
    channel: 'both',
    subject: 'Your ${{deposit_amount}} deposit is on its way back — {{booking_code}}',
    body: `Hi {{first_name}},

Good news — your security deposit has been fully refunded.

${details(
  r('Reference', '{{booking_code}}') +
  r('Vehicle', '{{vehicle}}') +
  r('Deposit held', '${{deposit_amount}}') +
  r('Refunded', '${{refund_amount}}')
)}
It'll appear on your original payment method within 5–10 business days. Thanks for taking great care of the vehicle — we hope to see you again.`,
    sms_body: `Hi {{first_name}}, your \${{deposit_amount}} deposit for the {{vehicle}} has been fully refunded.

Ref {{booking_code}}
Expect it within 5–10 business days. — ${B.name}`,
  },

  deposit_settled: {
    channel: 'both',
    subject: 'Deposit settlement — {{booking_code}}',
    body: `Hi {{first_name}},

Your security deposit has been settled. Here's the breakdown.

${details(
  r('Reference', '{{booking_code}}') +
  r('Vehicle', '{{vehicle}}') +
  r('Deposit held', '${{deposit_amount}}') +
  r('Charges applied', '${{incidental_total}}') +
  r('Refund', '${{refund_amount}}')
)}
{{#if refund_amount}}Your \${{refund_amount}} refund returns to your original payment method within 5–10 business days.
{{/if}}Questions about a charge? Reach us at ${B.phone}, or review and dispute it in your portal.`,
    sms_body: `Hi {{first_name}}, your deposit for the {{vehicle}} is settled.

Deposit \${{deposit_amount}} · Charges \${{incidental_total}} · Refund \${{refund_amount}}
Ref {{booking_code}}

Refund arrives in 5–10 business days. Questions? ${B.phone} — ${B.name}`,
  },

  inspection_charges_scheduled: {
    channel: 'email',
    subject: 'Inspection charges scheduled — {{booking_code}}',
    body: `Hi {{first_name}},

Your post-rental inspection is complete. Charges came in above your deposit, and the difference is scheduled to the card on file.

${details(
  r('Reference', '{{booking_code}}') +
  r('Vehicle', '{{vehicle}}') +
  r('Charges total', '${{incidental_total}}') +
  r('Amount owed', '${{amount_owed}}')
)}
This processes automatically in 48 hours. To dispute any part before then, open your portal — disputed charges are paused for review. Questions? ${B.phone}.`,
  },

  // ── Bonzah insurance lifecycle ───────────────────────────────────────────

  insurance_policy_issued: {
    channel: 'email',
    subject: 'Your insurance is active — {{booking_code}}',
    body: `Hi {{first_name}},

Your Bonzah rental insurance is active for this trip.

${details(
  r('Reference', '{{booking_code}}') +
  r('Vehicle', '{{vehicle}}') +
  r('Coverage', '{{bonzah_tier_label}}') +
  r('Policy #', '{{bonzah_policy_no}}') +
  r('Total paid', '${{bonzah_total_charged}}') +
  r('Effective', '{{pickup_date}} – {{return_date}}')
)}
The policy is held with Bonzah (Insillion) — keep this email for your records. For a claim during your rental, contact Bonzah directly using the policy number above.`,
  },

  insurance_bind_failed: {
    channel: 'email',
    subject: '⚠️ Bonzah bind FAILED — manual reconciliation needed for {{booking_code}}',
    body: `Bonzah policy could NOT be issued for booking {{booking_code}} after Stripe successfully charged the customer.

${details(
  r('Reference', '{{booking_code}}') +
  r('Customer', '{{first_name}} {{last_name}}') +
  r('Email', '{{email}}') +
  r('Vehicle', '{{vehicle}}') +
  r('Pickup', '{{pickup_date}} · {{pickup_time}}') +
  r('Tier', '{{bonzah_tier_label}}') +
  r('Quote #', '{{bonzah_quote_id}}') +
  r('Premium', '${{bonzah_premium}}')
)}
What to do:
1. Open the booking: {{dashboard_link}}
2. Inspect the latest bonzah_events row for the underlying error.
3. Retry the bind, OR refund the insurance portion and switch insurance_provider to 'own'.

The customer's Stripe charge HAS gone through. They are not aware of this failure.

— ${B.name} Internal Alert`,
  },

  // ── Phase 1 audit F-4: orphan stages now wired ───────────────────────────

  damage_notification: {
    channel: 'email',
    subject: 'A note about your recent rental — {{booking_code}}',
    body: `Hi {{first_name}},

We wanted to reach out about your recent rental of the {{vehicle}} ({{booking_code}}). During our post-rental inspection we noted some damage we'll need to follow up on.

What we found: {{damage_description}}

We'll review the details and contact you within one business day to walk through what we found, whether anything is owed beyond your deposit, and answer any questions.

Want to get ahead of it? Reach us at ${B.phone}, or view your booking in the portal.`,
  },

  day_of_pickup: {
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Good morning, {{first_name}}! Your {{vehicle}} is ready for pickup today at {{pickup_time}}.

${ADDR} (back of building)
Lockbox code {{lockbox_code}}

Check in: {{portal_link}}
Drive safe — text us if anything comes up. — ${B.name}, ${B.phone}`,
  },

  day_of_return: {
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Good morning, {{first_name}}! Your {{vehicle}} is due back today by {{return_time}}.

${ADDR} (back of building, near the dumpster)
Key in lockbox (code {{lockbox_code}})

Quick checklist:
• Same fuel level as pickup
• Photo of where you parked
• Reply to extend if plans changed

Thanks again! — ${B.name}, ${B.phone}`,
  },
};

export default FALLBACK_TEMPLATES;
