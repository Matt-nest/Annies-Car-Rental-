/**
 * Frontend Brand Configuration — Single source of truth for all brand-specific values.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ WHITE-LABEL GUIDE                                                       │
 * │ All values are injected via VITE_BRAND_* environment variables at       │
 * │ build time. The fallback values are Annie's Car Rental defaults.        │
 * │                                                                         │
 * │ For a new client deployment, set the env vars and rebuild.              │
 * │ See: /white_label_setup_guide.md                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export const brand = {
  // ── Identity ──────────────────────────────────────────────────────────────
  name:        import.meta.env.VITE_BRAND_NAME        || "Annie's Car Rental",
  legalEntity: import.meta.env.VITE_BRAND_LEGAL_NAME  || "Aaron's Garage LLC",
  domain:      import.meta.env.VITE_BRAND_DOMAIN      || "anniescarrental.com",

  // ── Contact ───────────────────────────────────────────────────────────────
  phone:       import.meta.env.VITE_BRAND_PHONE       || "(772) 207-1655",
  email:       import.meta.env.VITE_BRAND_EMAIL       || "info@anniescarrental.com",

  // ── Location ──────────────────────────────────────────────────────────────
  location: {
    city:    import.meta.env.VITE_BRAND_CITY    || "Port St. Lucie",
    state:   import.meta.env.VITE_BRAND_STATE   || "FL",
    address: import.meta.env.VITE_BRAND_ADDRESS || "586 NW Mercantile Pl",
    zip:     import.meta.env.VITE_BRAND_ZIP     || "34952",
  },

  // ── SEO / Meta ────────────────────────────────────────────────────────────
  metaDescription: import.meta.env.VITE_BRAND_META_DESCRIPTION ||
    "Premium, reliable, and family-friendly car rentals located directly in Port St. Lucie. Skip the long lines at the airport and enjoy top-tier vehicles right in your neighborhood.",

  // ── Visual Identity ───────────────────────────────────────────────────────
  colors: {
    /** Primary brand accent — used for highlights, links, selections */
    accent:     import.meta.env.VITE_BRAND_COLOR_ACCENT  || "#D4AF37",
    /** Darker variant for light-mode contexts */
    accentDark: import.meta.env.VITE_BRAND_COLOR_ACCENT_DARK || "#B8941E",
  },

  // ── External Links ────────────────────────────────────────────────────────
  reviewLink:  import.meta.env.VITE_BRAND_REVIEW_LINK || "https://g.page/annies-car-rental/review",

  // ── Chat Widget (optional — leave empty to disable) ───────────────────────
  chatWidgetId: import.meta.env.VITE_CHAT_WIDGET_ID || "",
};

/** Sanitized phone number for tel: and sms: links */
export const brandPhoneDigits = brand.phone.replace(/[^\d+]/g, '');
