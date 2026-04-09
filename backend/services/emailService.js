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

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Annie\'s Car Rental <noreply@anniescarrental.com>';
const SITE_URL = process.env.SITE_URL || 'https://anniescarrental.com';
const LOGO_URL = `${SITE_URL}/logo.png`;

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`[Email] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return { skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[Email] Resend error for ${to}:`, err);
      return { error: err };
    }

    const data = await res.json();
    console.log(`[Email] Sent "${subject}" to ${to} — id: ${data.id}`);
    return data;
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return { error: err.message };
  }
}

/* ── Shared Email Shell ────────────────────────────────────────────────────── */

function emailShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #e7e5e4;overflow:hidden;">

    <!-- Gold accent bar -->
    <div style="height:4px;background:linear-gradient(90deg,#c8a97e 0%,#d4af37 50%,#c8a97e 100%);"></div>

    <!-- Header -->
    <div style="background:#1c1917;padding:28px 32px;">
      <div style="margin-bottom:16px;">
        <img src="${LOGO_URL}" alt="Annie's Car Rental" width="140" height="auto" style="display:block;max-width:140px;" />
      </div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;letter-spacing:-0.01em;">${esc(title)}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      ${bodyHtml}
    </div>

    <!-- Footer -->
    <div style="padding:24px 32px;border-top:1px solid #e7e5e4;background:#fafaf9;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#78716c;">Annie's Car Rental</p>
      <p style="margin:0 0 4px;font-size:12px;color:#a8a29e;">Port St. Lucie, FL · (772) 985-6667</p>
      <p style="margin:0;font-size:11px;color:#d6d3d1;">
        <a href="${SITE_URL}" style="color:#c8a97e;text-decoration:none;">anniescarrental.com</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
 * Booking Request Received — first touchpoint after customer submits a request.
 * Goal: Set expectations, provide booking reference, build confidence.
 */
export async function sendBookingConfirmation({ customer, booking, vehicle }) {
  const statusUrl = `${SITE_URL}/booking-status?code=${booking.booking_code}`;

  const body = `
    <p style="margin:0 0 16px;color:#44403c;font-size:15px;line-height:1.7;">Hi ${esc(customer.first_name)},</p>
    <p style="margin:0 0 24px;color:#44403c;font-size:15px;line-height:1.7;">
      Thanks for choosing Annie's Car Rental. We've received your request and will review it within a few hours during business hours.
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
      Questions? Call or text us at <strong>(772) 985-6667</strong>
    </p>
  `;

  return sendEmail({
    to: customer.email,
    subject: `Booking Received — ${booking.booking_code}`,
    html: emailShell('Booking Request Received', body),
  });
}

/**
 * Notify the owner that a customer has signed the rental agreement.
 * Goal: Prompt immediate counter-signature.
 */
export async function sendCounterSignNotification({ booking, customer, vehicle }) {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) {
    console.log('[Email] OWNER_EMAIL not set — skipping counter-sign notification');
    return { skipped: true };
  }

  const dashboardUrl = process.env.DASHBOARD_URL || 'https://admin.dashboard.anniescarrental.com';
  const bookingLink = `${dashboardUrl}/bookings/${booking.id}`;
  const customerName = `${customer.first_name} ${customer.last_name}`.trim();
  const vehicleLabel = vehicle || 'Vehicle';

  const body = `
    <p style="margin:0 0 16px;color:#44403c;font-size:15px;">Hi Annie,</p>
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
