import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { faqs } from './src/data/faq';
import { seoPages } from './src/config/seoPages';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // White-label: inject brand identity into the static index.html at build time.
  // Mirrors src/config/brand.ts fallbacks so Annie's build is unchanged when the
  // VITE_BRAND_* vars are absent. Clones set the env and the title/description/
  // app name rebrand with no HTML edits.
  const brandName = env.VITE_BRAND_NAME || "Annie's Car Rental";
  const brandCity = env.VITE_BRAND_CITY || 'Port St. Lucie';
  const brandState = env.VITE_BRAND_STATE || 'FL';
  const brandDomain = env.VITE_BRAND_DOMAIN || 'anniescarrental.com';
  const brandDescription = env.VITE_BRAND_META_DESCRIPTION ||
    'Premium, reliable, and family-friendly car rentals located directly in Port St. Lucie. Skip the long lines at the airport and enjoy top-tier vehicles right in your neighborhood.';
  const siteUrl = `https://${brandDomain}`;

  // Mirror the contact/location fallbacks in src/config/brand.ts so the JSON-LD
  // below describes Annie's when the VITE_BRAND_* vars are absent, and rebrands
  // for clones when they are set.
  const brandLegalName = env.VITE_BRAND_LEGAL_NAME || "Aaron's Garage LLC";
  const brandPhone = env.VITE_BRAND_PHONE || '(772) 207-1655';
  const brandEmail = env.VITE_BRAND_EMAIL || 'info@anniescarrental.com';
  const brandAddress = env.VITE_BRAND_ADDRESS || '586 NW Mercantile Pl';
  const brandZip = env.VITE_BRAND_ZIP || '34952';

  // Build-time structured data, injected into the static <head> so it is present
  // in the served HTML without waiting on the React (CSR) render — the only way
  // non-Google crawlers and social/AI scrapers see it. Two graphs:
  //   • AutoRental (a LocalBusiness subtype) — name/address/geo/contact for the
  //     local-pack and knowledge panel.
  //   • FAQPage — sourced from the same src/data/faq.ts the on-page accordion uses.
  const localBusinessLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    '@id': `${siteUrl}/#business`,
    name: brandName,
    legalName: brandLegalName,
    url: siteUrl,
    image: `${siteUrl}/hero-poster.jpg`,
    logo: `${siteUrl}/logo.png`,
    telephone: brandPhone,
    email: brandEmail,
    priceRange: '$$',
    description: brandDescription,
    address: {
      '@type': 'PostalAddress',
      streetAddress: brandAddress,
      addressLocality: brandCity,
      addressRegion: brandState,
      postalCode: brandZip,
      addressCountry: 'US',
    },
    areaServed: { '@type': 'City', name: `${brandCity}, ${brandState}` },
  };
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  // Escape "<" so a stray "</script>" or "<!--" inside any string can't break out
  // of the JSON-LD <script> block (standard safe-embed practice).
  const toLdScript = (obj) =>
    `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
  const jsonLd = `${toLdScript(localBusinessLd)}\n    ${toLdScript(faqLd)}\n  </head>`;

  // ── SEO landing-page prerender ────────────────────────────────────────────
  // For each entry in src/config/seoPages.ts we clone the built index.html and
  // emit dist/<slug>/index.html with (a) a page-specific <head>, (b) Service +
  // FAQPage + BreadcrumbList JSON-LD, and (c) the page copy rendered as real,
  // crawlable HTML inside #root. Vercel serves these static files directly (the
  // SPA catch-all rewrite only fires for paths with no matching file), and the
  // React bundle replaces #root on mount. Same data source as LandingPage.tsx,
  // so the crawlable copy never drifts from the interactive render.
  const brandPhoneDigits = brandPhone.replace(/[^\d+]/g, '');
  const escHtml = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => escHtml(s).replace(/"/g, '&quot;');

  const pageJsonLdScripts = (page) => {
    const url = `${siteUrl}/${page.slug}`;
    const graphs = [
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        serviceType: page.serviceName,
        name: `${page.serviceName} — ${page.city}`,
        url,
        provider: { '@type': 'AutoRental', '@id': `${siteUrl}/#business`, name: brandName },
        areaServed: { '@type': 'City', name: `${page.city}, ${brandState}` },
        description: page.metaDescription,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: page.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: page.serviceName, item: url },
        ],
      },
    ];
    return graphs.map(toLdScript).join('\n    ');
  };

  // Minimal, neutral inline styling: this markup is for crawlers and a ~100ms
  // pre-hydration paint before React (createRoot) replaces #root entirely.
  const prerenderBody = (page) => `<div style="max-width:860px;margin:0 auto;padding:96px 20px 64px;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.6;">
  <p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#888;margin:0 0 8px;">${escHtml(page.city)} &middot; ${escHtml(page.serviceName)}</p>
  <h1 style="font-size:2rem;font-weight:300;margin:0 0 16px;">${escHtml(page.h1)}</h1>
  <p style="font-size:1.1rem;color:#444;max-width:640px;">${escHtml(page.intro)}</p>
  ${page.body.map((p) => `<p style="color:#444;max-width:640px;">${escHtml(p)}</p>`).join('\n  ')}
  <ul style="max-width:640px;color:#444;">${page.highlights.map((h) => `<li><strong>${escHtml(h.label)}</strong> &mdash; ${escHtml(h.desc)}</li>`).join('')}</ul>
  <p><a href="tel:${escAttr(brandPhoneDigits)}">Call ${escHtml(brandPhone)}</a></p>
  <section><h2 style="font-weight:300;">Common Questions</h2>${page.faqs.map((f) => `<details><summary>${escHtml(f.q)}</summary><p>${escHtml(f.a)}</p></details>`).join('')}</section>
  ${
    seoPages.length > 1
      ? `<nav aria-label="More rentals"><h2 style="font-weight:300;">More rental options</h2><ul>${seoPages
          .filter((p) => p.slug !== page.slug)
          .map((p) => `<li><a href="/${p.slug}">${escHtml(`${p.serviceName} in ${p.city}`)}</a></li>`)
          .join('')}</ul></nav>`
      : ''
  }
</div>`;

  const setMetaContent = (html, attr, key, value) =>
    html.replace(
      new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`),
      (_m, a, b) => `${a}${escAttr(value)}${b}`,
    );

  const renderLandingHtml = (baseHtml, page) => {
    const title = `${page.title} | ${brandName}`;
    const url = `${siteUrl}/${page.slug}`;
    let html = baseHtml
      .replace(/<title>[^<]*<\/title>/, () => `<title>${escHtml(title)}</title>`)
      // Drop the homepage FAQPage graph from the clone (the landing page emits
      // its own); keep the AutoRental business graph. JSON-LD has no raw "<"
      // (we escape to <), so [^<] safely stops at the closing tag.
      .replace(/\s*<script type="application\/ld\+json">[^<]*?"@type":"FAQPage"[^<]*?<\/script>/, '')
      .replace(/(<link rel="canonical" href=")[^"]*(")/, (_m, a, b) => `${a}${url}${b}`);
    html = setMetaContent(html, 'name', 'description', page.metaDescription);
    html = setMetaContent(html, 'property', 'og:title', title);
    html = setMetaContent(html, 'property', 'og:description', page.metaDescription);
    html = setMetaContent(html, 'property', 'og:url', url);
    html = setMetaContent(html, 'name', 'twitter:title', title);
    html = setMetaContent(html, 'name', 'twitter:description', page.metaDescription);
    html = html
      .replace('</head>', () => `    ${pageJsonLdScripts(page)}\n  </head>`)
      .replace('<div id="root"></div>', () => `<div id="root">${prerenderBody(page)}</div>`);
    return html;
  };

  const brandHtmlPlugin = {
    name: 'brand-html-inject',
    transformIndexHtml(html) {
      return html
        .replace(/%BRAND_TITLE%/g, `${brandName} — ${brandCity}, ${brandState}`)
        .replace(/%BRAND_NAME%/g, brandName)
        .replace(/%BRAND_DOMAIN%/g, brandDomain)
        .replace(/%BRAND_DESCRIPTION%/g, brandDescription)
        // Function replacement so "$" sequences in the JSON-LD (e.g. priceRange
        // "$$", "$0.34/mile" in FAQ answers) aren't treated as String.replace
        // special patterns like $$ / $& / $`.
        .replace('</head>', () => jsonLd);
    },
    // Emit robots.txt + sitemap.xml at build with the brand's own domain so
    // clones get correct URLs without hand-maintaining static files. Only the
    // public, indexable routes are listed; transactional/portal routes are
    // disallowed (they all serve the same SPA shell via the vercel rewrite).
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source:
          `User-agent: *\n` +
          `Allow: /\n\n` +
          `# Transactional / customer-portal routes — keep out of the index\n` +
          `Disallow: /confirm\n` +
          `Disallow: /portal\n` +
          `Disallow: /booking-status\n` +
          `Disallow: /rental-agreement\n\n` +
          `Sitemap: ${siteUrl}/sitemap.xml\n`,
      });
      const urls = [
        { loc: `${siteUrl}/`, changefreq: 'weekly', priority: '1.0' },
        // High-intent SEO landing pages (prerendered in writeBundle from src/config/seoPages.ts).
        ...seoPages.map((p) => ({ loc: `${siteUrl}/${p.slug}`, changefreq: 'weekly', priority: '0.9' })),
        { loc: `${siteUrl}/privacy`, changefreq: 'yearly', priority: '0.3' },
        { loc: `${siteUrl}/terms`, changefreq: 'yearly', priority: '0.3' },
      ];
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls
            .map(
              (u) =>
                `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
            )
            .join('\n') +
          `\n</urlset>\n`,
      });
    },
    // Prerender landing pages AFTER the bundle is on disk, so the base index.html
    // already carries Vite's hashed <script>/<link> tags — the slug pages load
    // the same app. generateBundle's `bundle` doesn't reliably contain index.html
    // in this Vite version, so we read the written file instead.
    writeBundle(options) {
      const outDir = options.dir || path.resolve(__dirname, 'dist');
      const indexPath = path.join(outDir, 'index.html');
      if (!existsSync(indexPath)) return; // e.g. the separate service-worker build pass
      const baseHtml = readFileSync(indexPath, 'utf8');
      for (const page of seoPages) {
        const dir = path.join(outDir, page.slug);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, 'index.html'), renderLandingHtml(baseHtml, page));
      }
    },
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      brandHtmlPlugin,
      VitePWA({
        // Sprint 12b: switched to `injectManifest` so we can add a push event
        // handler in our own SW source. All runtime caching that used to live
        // here now lives in src/sw.ts via workbox-routing.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        manifest: false,
        injectRegister: false,
        injectManifest: {
          // Precache ONLY the small static shell — JS / CSS / HTML / SVG / favicons.
          // Photos in /public and lazy route chunks are runtime-cached in sw.ts.
          globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
          globIgnores: [
            '**/{ConfirmBooking,CustomerPortal,VehicleDetailPage,RentalAgreementPage,BookingStatusPage,PrivacyPolicy,TermsOfService,MonthlyInquiryModal,vendor-vaul,vendor-stripe,vendor-signature}-*.js',
          ],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        devOptions: { enabled: false }, // never run SW in dev — kills HMR
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Default Rollup chunking — Vite splits vendor + per-route via React.lazy().
      // Previous `vite-plugin-singlefile` + `inlineDynamicImports` was bundling the
      // entire app (Stripe + signature_pad + every page) into one ~900 kB HTML.
      // That defeated the React.lazy boundaries we now use in App.tsx.
      rollupOptions: {
        output: {
          // Hand-tuned vendor chunks to keep large libs out of the route chunks.
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('@stripe')) return 'vendor-stripe';
              if (id.includes('signature_pad')) return 'vendor-signature';
              if (id.includes('vaul')) return 'vendor-vaul';
              if (id.includes('motion')) return 'vendor-motion';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
