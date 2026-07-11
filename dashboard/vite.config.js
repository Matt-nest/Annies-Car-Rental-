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
      rollupOptions: {
        output: {
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
