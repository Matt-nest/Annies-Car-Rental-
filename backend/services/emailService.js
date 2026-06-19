/**
 * Lightweight email service via Resend (https://resend.com).
 * No extra npm packages — uses the Resend REST API directly.
 *
 * Required env var: RESEND_API_KEY
 * Optional env vars: EMAIL_FROM (default: onboarding@resend.dev for sandbox)
 *
 * To set up: create a free Resend account at resend.com, verify your domain,
 * then add RESEND_API_KEY to Vercel backend environment variables.
 */

import brand from '../config/brand.js';
const SITE_URL = brand.siteUrl;
import { sendViaResend } from '../utils/mailTransport.js';
import { renderBrandedShell, escapeHtml as esc } from '../utils/emailShell.js';

async function sendEmail({ to, subject, html }) {
  return sendViaResend({ to, subject, html });
}

// F-8: branded shell extracted to utils/emailShell.js — single source of
// truth shared with notifyService. emailShell is a thin alias here.
const emailShell = renderBrandedShell;

/* ── Reusable Components ───────────────────────────────────────────────────
   Email-client-safe: table-based rows (Outlook ignores flexbox) and CTA
   colors derived from brand tokens so every white-label deployment renders
   in its own palette. */

/** A single label/value row inside a detail card. Table-based for Outlook. */
function detailRow(label, value) {
  return `<tr>
    <td style="padding:7px 0;color:#78716c;font-size:13px;line-height:1.5;">${label}</td>
    <td style="padding:7px 0;color:#1c1917;font-size:13px;font-weight:600;line-height:1.5;text-align:right;">${esc(String(value))}</td>
  </tr>`;
}

/** Emphasised booking-reference row — monospace, letter-spaced. */
function codeRow(code) {
  return `<tr>
    <td style="padding:7px 0;color:#78716c;font-size:13px;line-height:1.5;">Booking Code</td>
    <td style="padding:7px 0;text-align:right;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:16px;font-weight:700;letter-spacing:0.14em;color:#1c1917;">${esc(String(code))}</td>
  </tr>`;
}

/** Wrap detail rows in a bordered card with an uppercase eyebrow label. */
function detailCard(eyebrow, rowsHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafaf9;border:1px solid #eceae7;border-radius:12px;margin:0 0 24px;">
    <tr><td style="padding:18px 20px;">
      ${eyebrow ? `<p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#a8a29e;">${eyebrow}</p>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>
    </td></tr>
  </table>`;
}

/**
 * CTA button.
 *   style 'accent' (alias 'gold') → brand accent fill + dark brand text
 *                                   (high emphasis, AA-contrast, on-brand).
 *   style 'primary' (default)     → dark brand fill + white text.
 * Centered, generous tap target (≈48px), button-shaped <a>.
 */
function ctaButton(href, label, style = 'primary') {
  const c = brand.colors;
  const isAccent = style === 'gold' || style === 'accent';
  const bg = isAccent ? c.primary : c.secondary;
  const fg = isAccent ? c.secondary : '#ffffff';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr>
    <td align="center">
      <a href="${href}" style="display:inline-block;background:${bg};color:${fg};font-size:15px;font-weight:700;letter-spacing:0.01em;padding:15px 36px;border-radius:10px;text-decoration:none;">${label}</a>
    </td>
  </tr></table>`;
}

/** Soft notice banner with a left accent rule. Color keys: amber/green/blue/red. */
function statusBanner(text, color = 'amber') {
  const colors = {
    amber: { bg: '#fffbeb', rule: '#f59e0b', text: '#92400e' },
    green: { bg: '#f0fdf4', rule: '#22c55e', text: '#166534' },
    blue:  { bg: '#f0f5ff', rule: '#3b82f6', text: '#1e40af' },
    red:   { bg: '#fef2f2', rule: '#ef4444', text: '#991b1b' },
  };
  const c = colors[color] || colors.amber;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.bg};border-left:3px solid ${c.rule};border-radius:8px;margin:0 0 24px;"><tr>
    <td style="padding:14px 16px;color:${c.text};font-size:13px;line-height:1.6;">${text}</td>
  </tr></table>`;
}


/* ════════════════════════════════════════════════════════════════════════════
   CUSTOMER-FACING EMAILS
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Payment Declined — sent when an off-session charge against the saved card
 * fails (incidentals, overage settlement, etc). Asks the customer to update
 * their payment method in the portal so we can retry. Triggered from Stripe
 * webhook handlers (payment_intent.payment_failed) once card-on-file is wired.
 */
export async function sendPaymentDeclined({ customer, booking, amountCents, reason }) {
  const portalLink = `${SITE_URL}/portal?code=${booking.booking_code}`;
  const amount = `$${((amountCents || 0) / 100).toFixed(2)}`;

  const body = `
    <p style="margin:0 0 16px;color:#44403c;font-size:15px;line-height:1.7;">Hi ${esc(customer.first_name)},</p>
    <p style="margin:0 0 22px;color:#44403c;font-size:15px;line-height:1.7;">
      A charge of <strong>${amount}</strong> on the card on file for booking <strong>${esc(booking.booking_code)}</strong> was declined${reason ? ` (${esc(reason)})` : ''}.
    </p>

    ${statusBanner('<strong>Action needed.</strong> Update your payment method so we can retry. Nothing else happens until your card is updated.', 'red')}

    ${ctaButton(portalLink, 'Update Payment Method', 'accent')}

    <p style="margin:0;text-align:center;font-size:12px;color:#a8a29e;">
      Questions? Call or text <strong>${esc(brand.phone)}</strong>.
    </p>
  `;

  return sendEmail({
    to: customer.email,
    subject: `Payment Declined — ${booking.booking_code} — Action Needed`,
    html: emailShell('Payment Declined', body),
  });
}

/**
 * Booking Request Received — first touchpoint after customer submits a request.
 * Goal: Set expectations, provide booking reference, build confidence.
 */
export async function sendBookingConfirmation({ customer, booking, vehicle }) {
  const statusUrl = `${SITE_URL}/booking-status?code=${booking.booking_code}`;

  const body = `
    <p style="margin:0 0 16px;color:#44403c;font-size:15px;line-height:1.7;">Hi ${esc(customer.first_name)},</p>
    <p style="margin:0 0 24px;color:#44403c;font-size:15px;line-height:1.7;">
      Thanks for choosing ${esc(brand.name)}. We've got your request and we're reviewing it now &mdash; you'll hear back within a few hours during business hours.
    </p>

    ${detailCard('Your Request', `
      ${codeRow(booking.booking_code)}
      ${vehicle ? detailRow('Vehicle', vehicle) : ''}
      ${detailRow('Pickup', booking.pickup_date)}
      ${detailRow('Return', booking.return_date)}
    `)}

    ${statusBanner('<strong>Next:</strong> once we confirm availability, we\u2019ll send a link to sign your agreement and pay.', 'blue')}

    ${ctaButton(statusUrl, 'Check Booking Status')}

    <p style="margin:0;text-align:center;font-size:12px;color:#a8a29e;">
      Questions? Call or text <strong>${esc(brand.phone)}</strong>.
    </p>
  `;

  return sendEmail({
    to: customer.email,
    subject: `Booking Received — ${booking.booking_code}`,
    html: emailShell('Booking Request Received', body),
  });
}

/**
 * Continue Your Booking — sent when an admin creates a booking on behalf of
 * the customer via the dashboard New Booking modal. The customer clicks the
 * link to add insurance, sign the agreement, and pay through the standard
 * customer wizard.
 */
export async function sendContinueBookingEmail({ customer, booking, vehicle }) {
  const continueUrl = `${SITE_URL}/confirm?code=${booking.booking_code}`;

  const body = `
    <p style="margin:0 0 16px;color:#44403c;font-size:15px;line-height:1.7;">Hi ${esc(customer.first_name)},</p>
    <p style="margin:0 0 24px;color:#44403c;font-size:15px;line-height:1.7;">
      ${esc(brand.name)} has set up a booking for you${vehicle ? ` for the <strong>${esc(vehicle)}</strong>` : ''}. Just add insurance, sign the agreement, and pay to lock it in.
    </p>

    ${detailCard('Your Booking', `
      ${codeRow(booking.booking_code)}
      ${vehicle ? detailRow('Vehicle', vehicle) : ''}
      ${detailRow('Pickup', booking.pickup_date)}
      ${detailRow('Return', booking.return_date)}
    `)}

    ${statusBanner('<strong>One link, three steps:</strong> insurance, signature, deposit. It doesn’t expire, so finish whenever you’re ready.', 'blue')}

    ${ctaButton(continueUrl, 'Continue Your Booking', 'accent')}

    <p style="margin:0;text-align:center;font-size:12px;color:#a8a29e;">
      Questions? Call or text <strong>${esc(brand.phone)}</strong>.
    </p>
  `;

  return sendEmail({
    to: customer.email,
    subject: `Finalize Your Booking — ${booking.booking_code}`,
    html: emailShell('Finalize Your Booking', body),
  });
}

/**
 * Notify the owner that a customer has signed the rental agreement.
 * Goal: Prompt immediate counter-signature.
 */
export async function sendCounterSignNotification({ booking, customer, vehicle }) {
  const ownerEmail = brand.ownerEmail;
  if (!ownerEmail) {
    console.log('[Email] OWNER_EMAIL not set — skipping counter-sign notification');
    return { skipped: true };
  }

  const dashboardUrl = brand.dashboardUrl;
  const bookingLink = `${dashboardUrl}/bookings/${booking.id}`;
  const customerName = `${customer.first_name} ${customer.last_name}`.trim();
  const vehicleLabel = vehicle || 'Vehicle';

  const body = `
    <p style="margin:0 0 16px;color:#44403c;font-size:15px;">Hello,</p>
    <p style="margin:0 0 24px;color:#44403c;font-size:15px;line-height:1.7;">
      <strong>${esc(customerName)}</strong> has signed the rental agreement for <strong>${esc(booking.booking_code)}</strong>. Your counter-signature is needed to confirm this rental.
    </p>

    ${detailCard('Awaiting Counter-Signature', `
      ${codeRow(booking.booking_code)}
      ${detailRow('Customer', customerName)}
      ${detailRow('Vehicle', vehicleLabel)}
      ${detailRow('Pickup', booking.pickup_date)}
      ${detailRow('Return', booking.return_date)}
    `)}

    ${ctaButton(bookingLink, 'Counter-Sign Now', 'accent')}

    <p style="margin:0;text-align:center;font-size:12px;color:#a8a29e;">
      Or open the dashboard and navigate to the booking.
    </p>
  `;

  return sendEmail({
    to: ownerEmail,
    subject: `⚡ Counter-Sign Needed — ${booking.booking_code} — ${customerName}`,
    html: emailShell('Counter-Signature Needed', body),
  });
}
