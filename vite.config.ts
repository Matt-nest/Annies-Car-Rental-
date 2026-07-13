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
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        manifest: false,
        injectRegister: false,
        injectManifest: {
          // Precache only the small static shell. Fleet photos and other large
          // public assets load normally/runtime-cache instead of blocking mobile
          // installs with a massive precache.
          globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
          globIgnores: [
            '**/{ConfirmBooking,CustomerPortal,VehicleDetailPage,RentalAgreementPage,BookingStatusPage,PrivacyPolicy,TermsOfService,MonthlyInquiryModal,vendor-vaul,vendor-stripe,vendor-signature}-*.js',
          ],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
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
