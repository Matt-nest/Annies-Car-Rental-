import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      viteSingleFile(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        manifest: false,
        injectRegister: false,
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,ico,png,woff2}'],
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
          // Single chunk — no code splitting
          manualChunks: undefined,
          inlineDynamicImports: true,
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
