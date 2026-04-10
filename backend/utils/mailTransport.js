const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * Single Resend transport — shared by notifyService and emailService
 * Returns { id } on success or { error } on failure.
 */
export async function sendViaResend({ to, subject, html, fromAddress }) {
  if (!RESEND_API_KEY) {
    console.log(`[MailTransport] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return { skipped: true };
  }
  if (!to) {
    console.warn('[MailTransport] No email address provided — skipping');
    return { skipped: true };
  }

  // Use provided from address or default
  const defaultFrom = process.env.EMAIL_FROM || "Annie's Car Rental <noreply@anniescarrental.com>";
  const from = fromAddress || defaultFrom;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[MailTransport] Resend error for ${to}:`, err);
      return { error: err };
    }

    const data = await res.json();
    console.log(`[MailTransport] Email sent "${subject}" → ${to} (id: ${data.id})`);
    return data;
  } catch (err) {
    console.error(`[MailTransport] Email failed to ${to}:`, err.message);
    return { error: err.message };
  }
}
