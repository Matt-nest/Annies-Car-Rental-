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
        registerType: 'autoUpdate',
        manifest: false,
        injectRegister: false,
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
          globIgnores: [
            '**/mapbox-gl-*.js',
            '**/mapbox-gl-*.css',
            '**/generateCategoricalChart-*.js',
            '**/AreaChart-*.js',
            '**/sortable.esm-*.js',
            '**/@stripe-*.js',
            '**/signature_pad-*.js',
            '**/{TelematicsPage,BookingDetailPage,MessagingPage,SettingsPage,RevenuePage,InsurancePage,PricingRulesPage}-*.js',
            '**/KPICardsWidget-*.js',
            '**/RevenueTrendWidget-*.js',
          ],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      sourcemap: false,
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
