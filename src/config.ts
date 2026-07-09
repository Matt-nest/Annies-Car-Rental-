/**
 * Shared application configuration.
 * Single source of truth for API URLs and environment variables.
 */
export const API_URL =
  (typeof window !== 'undefined' &&
    (window.location.hostname === 'www.anniescarrental.com' || window.location.hostname === 'anniescarrental.com')
    ? 'https://admin.dashboard.anniescarrental.com/api/v1'
    : '') ||
  import.meta.env.VITE_API_URL || '';

export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

export const CRISP_WEBSITE_ID = import.meta.env.VITE_CRISP_WEBSITE_ID || '';
