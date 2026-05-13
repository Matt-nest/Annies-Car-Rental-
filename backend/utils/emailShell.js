/**
 * Shared branded-email HTML shell.
 *
 * Both emailService.js (transactional/admin emails) and notifyService.js
 * (template-driven booking notifications) used to render the chrome
 * (logo, gold accent bar, dark header, footer) independently — Phase 1
 * audit F-8. This module is the single source of truth.
 *
 * Templates and call sites that need template-specific enrichments (CTAs,
 * itemized receipts, plain-text-to-HTML conversion) build the inner HTML
 * separately and pass it to renderBrandedShell as `innerHtml`.
 */

const SITE_URL = process.env.SITE_URL || 'https://anniescarrental.com';
const LOGO_URL = `${SITE_URL}/logo.png`;

export function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Wrap inner HTML in the Annie's Car Rental branded shell.
 * @param {string} subject — rendered as the H1 in the dark header.
 * @param {string} innerHtml — already-escaped, already-rendered body HTML.
 *                             Caller is responsible for escaping merge fields.
 */
export function renderBrandedShell(subject, innerHtml) {
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
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;letter-spacing:-0.01em;">${escapeHtml(subject)}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      ${innerHtml}
    </div>

    <!-- Footer -->
    <div style="padding:24px 32px;border-top:1px solid #e7e5e4;background:#fafaf9;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#78716c;">Annie's Car Rental</p>
      <p style="margin:0 0 4px;font-size:12px;color:#a8a29e;">Port St. Lucie, FL · (772) 207-1655</p>
      <p style="margin:0;font-size:11px;color:#d6d3d1;">
        <a href="${SITE_URL}" style="color:#c8a97e;text-decoration:none;">anniescarrental.com</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}
