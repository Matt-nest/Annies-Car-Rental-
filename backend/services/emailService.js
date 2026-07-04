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

/* ── Reusable Components ─────────────────────────────────────────────────── */

function detailRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;margin-bottom:10px;">
    <span style="color:#78716c;font-size:13px;">${label}</span>
    <span style="color:#1c1917;font-size:13px;font-weight:500;">${esc(String(value))}</span>
  </div>`;
}

function ctaButton(href, label, style = 'primary') {
  const bg = style === 'gold'
    ? 'background:linear-gradient(135deg,#D4AF37 0%,#B8941E 100%);color:#fff;box-shadow:0 4px 12px rgba(212,175,55,0.3);'
    : 'background:#1c1917;color:#fff;';
  return `<a href="${href}" style="display:block;text-align:center;${bg}font-size:14px;font-weight:600;padding:14px 24px;border-radius:10px;text-decoration:none;margin-bottom:16px;">
    ${label}
  </a>`;
}

function statusBanner(emoji, text, color = 'amber') {
  const colors = {
    amber: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    green: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    blue:  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
    red:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  };
  const c = colors[color] || colors.amber;
  return `<div style="background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:14px 16px;margin-bottom:24px;">
    <p style="margin:0;color:${c.text};font-size:13px;line-height:1.6;">${emoji} ${text}</p>
  </div>`;
}


/* ════════════════════════════════════════════════════════════════════════════
   CUSTOMER-FACING EMAILS
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Payment Declined — sent when an off-session charge against the saved card
 * fails (incidentals, overage settlement, etc). Asks the customer to update
 * their payment method in the portal so we can retry. Triggered from payment
 * webhook handlers (payment_intent.payment_failed) once card-on-file is wired.
 */
export async function sendPaymentDeclined({ customer, booking, amountCents, reason }) {
  const portalLink = `${SITE_URL}/portal?code=${booking.booking_code}`;
  const amount = `$${((amountCents || 0) / 100).toFixed(2)}`;

  const body = `
    <p style="margin:0 0 16px;color:#44403c;font-size:15px;line-height:1.7;">Hi ${esc(customer.first_name)},</p>
    <p style="margin:0 0 20px;color:#44403c;font-size:15px;line-height:1.7;">
      We tried to process a charge of <strong>${amount}</strong> on the card we have on file for booking
      <strong>${esc(booking.booking_code)}</strong>, but the payment was declined${reason ? ` (${esc(reason)})` : ''}.
    </p>

    ${statusBanner('💳', '<strong>Action needed:</strong> Update your payment method in the customer portal so we can retry the charge. No further action is taken until your card is updated.', 'red')}

    ${ctaButton(portalLink, 'Update Payment Method →', 'gold')}

    <p style="margin:0;text-align:center;font-size:12px;color:#a8a29e;">
      Questions? Call or text us at <strong>${esc(brand.phone)}</strong>
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
      Thanks for choosing ${esc(brand.name)}. We've received your request and will review it within a few hours during business hours.
    </p>

    <!-- Booking Details -->
    <div style="background:#fafaf9;border-radius:12px;border:1px solid #e7e5e4;padding:20px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#78716c;font-size:13px;">Booking Code</span>
        <span style="font-family:monospace;font-size:16px;font-weight:700;letter-spacing:0.15em;color:#1c1917;">${esc(booking.booking_code)}</span>
      </div>
      ${vehicle ? detailRow('Vehicle', vehicle) : ''}
      ${detailRow('Pickup', booking.pickup_date)}
      ${detailRow('Return', booking.return_date)}
    </div>

    ${statusBanner('<strong>What happens next?</strong><br>We\u2019ll confirm availability and send you a link to sign the rental agreement and complete payment.', 'blue')}

    ${ctaButton(statusUrl, 'Check Booking Status →')}

    <p style="margin:0;text-align:center;font-size:12px;color:#a8a29e;">
      Questions? Call or text us at <strong>${esc(brand.phone)}</strong>
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
      ${esc(brand.name)} has set up a booking for you${vehicle ? ` for the <strong>${esc(vehicle)}</strong>` : ''}.
      To finalize the rental, you'll need to add insurance, sign the rental agreement, and complete payment.
    </p>

    <div style="background:#fafaf9;border-radius:12px;border:1px solid #e7e5e4;padding:20px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#78716c;font-size:13px;">Booking Code</span>
        <span style="font-family:monospace;font-size:16px;font-weight:700;letter-spacing:0.15em;color:#1c1917;">${esc(booking.booking_code)}</span>
      </div>
      ${vehicle ? detailRow('Vehicle', vehicle) : ''}
      ${detailRow('Pickup', booking.pickup_date)}
      ${detailRow('Return', booking.return_date)}
    </div>

    ${statusBanner('✨', '<strong>Next step:</strong> Click the link below to add insurance, sign your agreement, and pay your deposit. The link does not expire.', 'blue')}

    ${ctaButton(continueUrl, 'Continue Your Booking →', 'gold')}

    <p style="margin:0;text-align:center;font-size:12px;color:#a8a29e;">
      Questions? Call or text us at <strong>${esc(brand.phone)}</strong>
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

    <!-- Details Card -->
    <div style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;padding:20px;margin-bottom:24px;">
      ${detailRow('Booking', booking.booking_code)}
      ${detailRow('Customer', customerName)}
      ${detailRow('Vehicle', vehicleLabel)}
      ${detailRow('Pickup', booking.pickup_date)}
      ${detailRow('Return', booking.return_date)}
    </div>

    ${ctaButton(bookingLink, 'Counter-Sign Now →', 'gold')}

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
