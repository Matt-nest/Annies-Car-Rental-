/**
 * Dashboard Brand Configuration
 *
 * Single source of truth for brand-specific values in the admin dashboard.
 * Reads from VITE_BRAND_* environment variables, falling back to defaults.
 *
 * For a new white-label deployment, set these env vars in the dashboard's
 * Vercel project (or .env.local) and rebuild.
 */

const brand = {
  // ── Identity ──────────────────────────────────────────────────────────
  name:        import.meta.env.VITE_BRAND_NAME        || "Annie's Car Rental",
  legalEntity: import.meta.env.VITE_BRAND_LEGAL_NAME  || "Aaron's Garage LLC",
  domain:      import.meta.env.VITE_BRAND_DOMAIN      || 'anniescarrental.com',
  siteUrl:     import.meta.env.VITE_BRAND_SITE_URL    || 'https://anniescarrental.com',

  // ── Contact ───────────────────────────────────────────────────────────
  phone:       import.meta.env.VITE_BRAND_PHONE       || '(772) 207-1655',
  email:       import.meta.env.VITE_BRAND_EMAIL       || 'info@anniescarrental.com',

  // ── Location ──────────────────────────────────────────────────────────
  location: {
    city:    import.meta.env.VITE_BRAND_CITY    || 'Port St. Lucie',
    state:   import.meta.env.VITE_BRAND_STATE   || 'FL',
    zip:     import.meta.env.VITE_BRAND_ZIP     || '34952',
    address: import.meta.env.VITE_BRAND_ADDRESS || '586 NW Mercantile Pl',
  },

  // ── Shorthand ─────────────────────────────────────────────────────────
  /** Full formatted address: "586 NW Mercantile Pl, Port St. Lucie, FL 34952" */
  get fullAddress() {
    return `${this.location.address}, ${this.location.city}, ${this.location.state} ${this.location.zip}`;
  },
};

export default brand;
