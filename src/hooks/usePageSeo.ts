/**
 * usePageSeo — keeps <title>, meta description, and the canonical link in sync
 * with the current SPA "page".
 *
 * The static index.html ships one title/description/canonical for the homepage
 * (injected at build by the brand plugin). Because routing here is in-memory
 * (App.tsx switches on window.location.pathname rather than reloading), those
 * tags would otherwise stay frozen on the homepage values for /privacy, /terms,
 * the booking wizard, etc. This hook updates them on navigation so each view has
 * correct tab text and correct tags for social/AI scrapers that re-fetch on
 * client-side route changes.
 *
 * All copy derives from src/config/brand.ts, so clones rebrand automatically.
 */
import { useEffect } from 'react';
import { brand } from '../config/brand';

export type SeoPage =
  | 'home'
  | 'landing'
  | 'detail'
  | 'confirm'
  | 'rental-agreement'
  | 'booking-status'
  | 'portal'
  | 'privacy'
  | 'terms';

const { city, state } = brand.location;

const PAGE_SEO: Record<SeoPage, { title: string; description: string; path: string }> = {
  // Home title mirrors the build-time %BRAND_TITLE% so the JS update is a no-op
  // for crawlers that already read the static tag — no divergence.
  home:               { title: `${brand.name} — ${city}, ${state}`, description: brand.metaDescription, path: '/' },
  // Landing pages always pass a full override (title/description/path from the
  // SeoPage), so this entry is just a defensive fallback.
  landing:            { title: brand.name, description: brand.metaDescription, path: '/' },
  detail:             { title: `Our Fleet — ${brand.name}`, description: `Browse available rental vehicles from ${brand.name} in ${city}, ${state}.`, path: '/detail' },
  confirm:            { title: `Complete Your Booking — ${brand.name}`, description: brand.metaDescription, path: '/confirm' },
  'rental-agreement': { title: `Rental Agreement — ${brand.name}`, description: brand.metaDescription, path: '/rental-agreement' },
  'booking-status':   { title: `Booking Status — ${brand.name}`, description: brand.metaDescription, path: '/booking-status' },
  portal:             { title: `Customer Portal — ${brand.name}`, description: brand.metaDescription, path: '/portal' },
  privacy:            { title: `Privacy Policy — ${brand.name}`, description: `Privacy policy for ${brand.name}, ${city}, ${state}.`, path: '/privacy' },
  terms:              { title: `Terms of Service — ${brand.name}`, description: `Terms of service for ${brand.name}, ${city}, ${state}.`, path: '/terms' },
};

function upsertMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export interface PageSeoOverride {
  title?: string;
  description?: string;
  canonicalPath?: string;
}

export function usePageSeo(page: SeoPage, override?: PageSeoOverride) {
  const { title, description, canonicalPath } = override ?? {};
  useEffect(() => {
    const seo = PAGE_SEO[page] ?? PAGE_SEO.home;
    document.title = title ?? seo.title;
    upsertMeta('description', description ?? seo.description);
    // The detail view is a single SPA path differentiated by ?vin=, so include
    // the query string to keep each vehicle's canonical distinct.
    const path = canonicalPath ?? (page === 'detail' ? `${seo.path}${window.location.search}` : seo.path);
    setCanonical(`https://${brand.domain}${path}`);
  }, [page, title, description, canonicalPath]);
}
