import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // 'prompt' = the SW updates only when our in-app prompt accepts.
        // We never silently swap caches mid-booking — critical for a payment flow.
        registerType: 'prompt',
        // Use the existing /public/site.webmanifest unchanged — we manage it
        // by hand so designers / SEO can review changes in source control.
        manifest: false,
        // Plugin generates `manifest.webmanifest`; we already serve `site.webmanifest`
        // from /public so disable plugin-side manifest emission.
        injectRegister: false,
        workbox: {
          // Precache ONLY the small static shell — JS / CSS / HTML / SVG / favicons.
          // Photos in /public (hero, fleet, drivers) are runtime-cached below
          // via StaleWhileRevalidate. Lazy route chunks are also runtime-cached
          // (not precached) so first-paint download stays under the mobile budget.
          globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
          globIgnores: [
            '**/{ConfirmBooking,CustomerPortal,VehicleDetailPage,RentalAgreementPage,BookingStatusPage,PrivacyPolicy,TermsOfService,MonthlyInquiryModal,vendor-vaul,vendor-stripe,vendor-signature}-*.js',
          ],
          // Always claim the page on activate so reloads pick up the new SW.
          clientsClaim: true,
          // Don't skip waiting — wait for the in-app "Update?" prompt.
          skipWaiting: false,
          // 5 MB cap per file to avoid accidentally precaching huge bundles.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // SPA fallback — serve index.html for unknown navigation requests
          // (Vercel rewrites do this server-side; this matches it offline).
          navigateFallback: '/index.html',
          // Don't intercept Stripe SDK loads or the backend API.
          navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
          runtimeCaching: [
            {
              // Google Fonts CSS — Stale While Revalidate so fonts update in background.
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-css',
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Google Fonts woff2 — Cache First with 1-year TTL.
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-files',
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              // Lazy route + vendor chunks — Cache First.
              urlPattern: ({ url }) =>
                url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // /public images (hero, fleet, logos) — Stale While Revalidate.
              urlPattern: ({ url, request }) =>
                url.origin === self.location.origin &&
                ['image'].includes(request.destination),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'images',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            // No rule for backend API: requests to VITE_API_URL go through
            // network unchanged. We intentionally never cache booking state.
          ],
        },
        // Show "Ready to work offline" once after first SW activation.
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
