/**
 * Shared branded-email HTML shell.
 *
 * Both emailService.js (transactional/admin emails) and notifyService.js
 * (template-driven booking notifications) render the chrome (logo, accent
 * bar, dark header, footer) through this single source of truth — Phase 1
 * audit F-8.
 *
 * The shell is fully driven by `brand.colors` so each white-label deployment
 * renders in its own palette automatically:
 *   secondary → header background  (Annie's stone / JD navy)
 *   primary   → accent + CTA accent (Annie's gold / JD sunset orange)
 *   accent    → gradient end-stop   (Annie's amber / JD burnt orange)
 *
 * Design notes (email-client-safe):
 *   • Table-based layout (Outlook ignores flexbox/grid).
 *   • Inline styles only (no <style> blocks survive Gmail reliably).
 *   • System font stacks (web fonts don't load in Gmail/Outlook).
 *   • A hidden preheader controls the inbox preview line.
 *
 * Templates that need template-specific enrichments (CTAs, itemized receipts,
 * plain-text-to-HTML conversion) build the inner HTML separately and pass it
 * to renderBrandedShell as `innerHtml`.
 */

import brand from '../config/brand.js';

export function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// System font stacks — render consistently across every major email client.
const SANS  = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',Cambria,serif";

/**
 * Wrap inner HTML in the branded shell.
 * @param {string} subject — rendered as the headline in the dark header.
 * @param {string} innerHtml — already-escaped, already-rendered body HTML.
 *                             Caller is responsible for escaping merge fields.
 * @param {string} [preheader] — hidden inbox-preview line. Falls back to the
 *                               subject so the preview never shows raw HTML.
 */
export function renderBrandedShell(subject, innerHtml, preheader) {
  const c = brand.colors;
  const previewText = escapeHtml(preheader || subject || '');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background:#f4f4f2;font-family:${SANS};color:#1c1917;-webkit-font-smoothing:antialiased;">

  <!-- Hidden preheader (controls inbox preview line) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f4f2;opacity:0;">
    ${previewText}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f2;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(28,25,23,0.04),0 12px 32px rgba(28,25,23,0.08);">

          <!-- Accent hairline -->
          <tr>
            <td style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,${c.primary} 0%,${c.accent} 100%);">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background:${c.secondary};padding:32px 36px 30px;">
              <img src="${brand.logoUrl}" alt="${escapeHtml(brand.name)}" width="132" style="display:block;max-width:132px;height:auto;border:0;margin-bottom:22px;" />
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${c.primary};">${escapeHtml(brand.name)}</p>
              <h1 style="margin:0;font-family:${SERIF};color:#ffffff;font-size:25px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;">${escapeHtml(subject)}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px 36px;">
              ${innerHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:26px 36px 30px;border-top:1px solid #eceae7;background:#fafaf9;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.01em;color:#57534e;">${escapeHtml(brand.name)}</p>
              <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#a8a29e;">
                ${escapeHtml(brand.location.city)}, ${escapeHtml(brand.location.state)}<br />
                <a href="tel:${escapeHtml((brand.phone || '').replace(/[^\d+]/g, ''))}" style="color:#a8a29e;text-decoration:none;">${escapeHtml(brand.phone)}</a>
              </p>
              <a href="${brand.siteUrl}" style="display:inline-block;font-size:12px;font-weight:600;letter-spacing:0.04em;color:${c.accent};text-decoration:none;">${escapeHtml(brand.domain)}</a>
            </td>
          </tr>

        </table>

        <!-- Sub-footer -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">
          <tr>
            <td style="padding:18px 36px 0;text-align:center;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#c4c0bb;">
                This message was sent regarding your reservation with ${escapeHtml(brand.name)}.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
