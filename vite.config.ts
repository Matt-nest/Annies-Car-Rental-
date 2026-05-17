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
