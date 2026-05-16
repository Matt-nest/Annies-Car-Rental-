import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  if (!env.VITE_API_URL) {
    throw new Error(
      '\n[FATAL] VITE_API_URL is not set.\n' +
      'Create dashboard/.env with:\n' +
      '  VITE_API_URL=https://backend-fawn-phi-13.vercel.app/api/v1\n'
    );
  }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        manifest: false,
        injectRegister: false,
        workbox: {
          // Precache the small admin shell — JS / CSS / HTML / SVG / favicons.
          // Mapbox-gl (498 kB gzip), Recharts, Stripe, signature_pad — all
          // runtime-cached on demand via the rules below.
          globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
          globIgnores: [
            // Heavy auto-split vendor chunks (Vite names them after the lib).
            '**/mapbox-gl-*.js',
            '**/mapbox-gl-*.css',
            '**/generateCategoricalChart-*.js',  // Recharts main
            '**/AreaChart-*.js',                  // Recharts AreaChart
            '**/sortable.esm-*.js',               // @dnd-kit sortable
            '**/@stripe-*.js',
            '**/signature_pad-*.js',
            // Heavy lazy pages.
            '**/{TelematicsPage,BookingDetailPage,MessagingPage,SettingsPage,RevenuePage,InsurancePage,PricingRulesPage}-*.js',
            // Lazy widget chunks (Sprint 6a).
            '**/KPICardsWidget-*.js',
            '**/RevenueTrendWidget-*.js',
          ],
          clientsClaim: true,
          skipWaiting: false,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/login/, /^\/oauth/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-css', cacheableResponse: { statuses: [0, 200] } },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-files',
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'admin-static-assets',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Vehicle thumbnails + Supabase Storage rental-photos.
              urlPattern: ({ url, request }) =>
                ['image'].includes(request.destination) &&
                (url.origin === self.location.origin ||
                  url.hostname.endsWith('.supabase.co')),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'admin-images',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            // No /api rule — admin API calls always go straight to the backend.
            // Booking state, payments, telematics — never cached.
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      // Hand-tuned vendor chunks so heavy libs don't ship with the dashboard home.
      // Pairs with route-level React.lazy() in src/App.jsx.
      rollupOptions: {
        output: {
          // NOTE: do NOT manualChunk libs that are only used by a single lazy
          // route (mapbox-gl, recharts, @stripe, signature_pad, @dnd-kit). Vite
          // injects modulepreload tags for every manualChunk reachable from the
          // entry — which preloads them even when only a lazy route uses them.
          // Letting Vite auto-split those libs co-locates them with the lazy
          // chunk that imports them, so they're only fetched on navigation.
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'vendor-motion';
              if (id.includes('react-router')) return 'vendor-router';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
