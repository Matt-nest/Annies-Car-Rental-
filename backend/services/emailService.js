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

/**
 * Send booking request confirmation to the customer.
 */
export async function sendBookingConfirmation({ customer, booking, vehicle }) {
  const statusUrl = `${SITE_URL}/booking-status?code=${booking.booking_code}`;
  const confirmUrl = `${SITE_URL}/confirm?code=${booking.booking_code}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #e7e5e4;overflow:hidden;">

    <!-- Header -->
    <div style="background:#1c1917;padding:28px 32px;">
      <p style="margin:0;color:#d6d3d1;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">Annie's Car Rental</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:600;">Booking Request Received</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#44403c;font-size:15px;">Hi ${customer.first_name},</p>
      <p style="margin:0 0 24px;color:#44403c;font-size:15px;line-height:1.6;">
        We've received your rental request and will review it shortly. Here are your booking details:
      </p>

      <!-- Booking card -->
      <div style="background:#fafaf9;border-radius:12px;border:1px solid #e7e5e4;padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#78716c;font-size:13px;">Reference Code</span>
          <span style="font-family:monospace;font-size:16px;font-weight:700;letter-spacing:0.15em;color:#1c1917;">${booking.booking_code}</span>
        </div>
        ${vehicle ? `
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;border-top:1px solid #e7e5e4;padding-top:12px;">
          <span style="color:#78716c;font-size:13px;">Vehicle</span>
          <span style="color:#1c1917;font-size:13px;font-weight:500;">${vehicle}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span style="color:#78716c;font-size:13px;">Pickup</span>
          <span style="color:#1c1917;font-size:13px;font-weight:500;">${booking.pickup_date}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#78716c;font-size:13px;">Return</span>
          <span style="color:#1c1917;font-size:13px;font-weight:500;">${booking.return_date}</span>
        </div>
      </div>

      <!-- Status -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
        <p style="margin:0;color:#92400e;font-size:13px;">
          <strong>Status: Under Review</strong> — We'll call or text you within a few hours during business hours to confirm availability and next steps.
        </p>
      </div>

      <!-- CTA -->
      <a href="${statusUrl}" style="display:block;text-align:center;background:#1c1917;color:#fff;font-size:14px;font-weight:600;padding:14px 24px;border-radius:10px;text-decoration:none;margin-bottom:16px;">
        Check Booking Status
      </a>
      <p style="margin:0;text-align:center;font-size:12px;color:#a8a29e;">
        Or visit: <a href="${statusUrl}" style="color:#a8a29e;">${statusUrl}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #e7e5e4;background:#fafaf9;">
      <p style="margin:0;font-size:12px;color:#a8a29e;text-align:center;">
        Annie's Car Rental · Port St. Lucie, FL · (772) 985-6667
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: customer.email,
    subject: `Booking Request Received — ${booking.booking_code}`,
    html,
  });
}

/**
 * Notify the owner that a customer has signed the rental agreement.
 * Includes a direct link to the dashboard booking page for counter-signing.
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

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #e7e5e4;overflow:hidden;">

    <!-- Header -->
    <div style="background:#1c1917;padding:28px 32px;">
      <p style="margin:0;color:#d6d3d1;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">Annie's Car Rental</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:600;">⚡ Counter-Signature Needed</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#44403c;font-size:15px;">Hi Annie,</p>
      <p style="margin:0 0 24px;color:#44403c;font-size:15px;line-height:1.6;">
        <strong>${customerName}</strong> has signed the rental agreement for booking <strong>${booking.booking_code}</strong>. 
        Your counter-signature is needed to confirm this rental.
      </p>

      <!-- Booking card -->
      <div style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span style="color:#78716c;font-size:13px;">Booking</span>
          <span style="font-family:monospace;font-size:16px;font-weight:700;letter-spacing:0.15em;color:#1c1917;">${booking.booking_code}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span style="color:#78716c;font-size:13px;">Customer</span>
          <span style="color:#1c1917;font-size:13px;font-weight:500;">${customerName}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span style="color:#78716c;font-size:13px;">Vehicle</span>
          <span style="color:#1c1917;font-size:13px;font-weight:500;">${vehicleLabel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span style="color:#78716c;font-size:13px;">Pickup</span>
          <span style="color:#1c1917;font-size:13px;font-weight:500;">${booking.pickup_date}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#78716c;font-size:13px;">Return</span>
          <span style="color:#1c1917;font-size:13px;font-weight:500;">${booking.return_date}</span>
        </div>
      </div>

      <!-- CTA -->
      <a href="${bookingLink}" style="display:block;text-align:center;background:linear-gradient(135deg, #D4AF37 0%, #B8941E 100%);color:#fff;font-size:14px;font-weight:600;padding:14px 24px;border-radius:10px;text-decoration:none;margin-bottom:16px;box-shadow:0 4px 12px rgba(212,175,55,0.3);">
        Counter-Sign Now →
      </a>
      <p style="margin:0;text-align:center;font-size:12px;color:#a8a29e;">
        Or open the dashboard and navigate to the booking.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #e7e5e4;background:#fafaf9;">
      <p style="margin:0;font-size:12px;color:#a8a29e;text-align:center;">
        Annie's Car Rental · Port St. Lucie, FL · (772) 985-6667
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: ownerEmail,
    subject: `⚡ Counter-Sign Needed — ${booking.booking_code} — ${customerName}`,
    html,
  });
}
