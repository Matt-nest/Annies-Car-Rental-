/**
 * Shared application configuration.
 * Single source of truth for API URLs and environment variables.
 */
export const API_URL =
  import.meta.env.VITE_API_URL || 'https://admin.dashboard.anniescarrental.com/api/v1';

export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

export const CRISP_WEBSITE_ID = import.meta.env.VITE_CRISP_WEBSITE_ID || '';
