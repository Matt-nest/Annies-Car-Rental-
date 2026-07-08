import type { Appearance } from '@stripe/stripe-js';
import { brand } from '../../../config/brand';

/**
 * Build a Stripe Elements `appearance` that mirrors the app's theme tokens so the
 * PaymentElement's inputs, tabs and labels match the brand in both light and dark
 * mode — no dark-on-light fields, no invisible placeholders.
 *
 * The theme CSS variables live on the ThemeProvider wrapper <div> (not <html>),
 * so they can't be read reliably off document.documentElement here. Instead we
 * resolve the small palette we need from the known brand tokens. Accent follows
 * the same source of truth as ThemeContext (brand.colors.accent / accentDark).
 */
export function buildStripeAppearance(theme: string): Appearance {
  const isDark = theme === 'dark';

  // Neutral surface/text/border tokens, mirrored from index.css (.dark / .light).
  const p = isDark
    ? {
        bg: '#13294B',                          // --bg-elevated (opaque field bg)
        text: '#EAF2FA',                        // --text-primary
        textSecondary: 'rgba(234,242,250,0.66)',// readable label / placeholder
        border: 'rgba(255,255,255,0.16)',       // ~--border-medium, nudged up
      }
    : {
        bg: '#FFFFFF',                          // --bg-elevated
        text: '#13294B',                        // --text-primary
        textSecondary: 'rgba(19,41,75,0.66)',
        border: 'rgba(19,41,75,0.20)',
      };

  const accent = isDark ? brand.colors.accent : brand.colors.accentDark;

  return {
    theme: isDark ? 'night' : 'stripe',
    variables: {
      colorPrimary: accent,
      colorBackground: p.bg,
      colorText: p.text,
      colorTextSecondary: p.textSecondary,
      colorTextPlaceholder: p.textSecondary,
      colorIcon: p.textSecondary,
      colorDanger: '#ef4444',
      borderRadius: '12px',
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSizeBase: '15px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': {
        backgroundColor: p.bg,
        border: `1px solid ${p.border}`,
        boxShadow: 'none',
        color: p.text,
      },
      '.Input::placeholder': { color: p.textSecondary },
      '.Input:focus': {
        border: `1px solid ${accent}`,
        boxShadow: `0 0 0 1px ${accent}`,
      },
      '.Input--invalid': { border: '1px solid #ef4444' },
      '.Label': { color: p.textSecondary, fontWeight: '500' },
      '.Tab, .Block': {
        backgroundColor: p.bg,
        border: `1px solid ${p.border}`,
      },
      '.Tab:hover': { color: p.text },
      '.Tab--selected': { borderColor: accent, color: p.text },
      '.TabLabel': { color: p.text },
      '.Error': { color: '#ef4444' },
    },
  };
}
