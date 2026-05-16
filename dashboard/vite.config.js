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
            '**/vendor-mapbox-*.js',
            '**/vendor-mapbox-*.css',
            '**/vendor-charts-*.js',
            '**/vendor-stripe-*.js',
            '**/vendor-signature-*.js',
            '**/vendor-dnd-*.js',
            '**/{TelematicsPage,BookingDetailPage,MessagingPage,SettingsPage,RevenuePage,InsurancePage,PricingRulesPage}-*.js',
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
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('mapbox-gl') || id.includes('react-map-gl')) return 'vendor-mapbox';
              if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
              if (id.includes('@stripe')) return 'vendor-stripe';
              if (id.includes('signature_pad')) return 'vendor-signature';
              if (id.includes('@dnd-kit')) return 'vendor-dnd';
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
