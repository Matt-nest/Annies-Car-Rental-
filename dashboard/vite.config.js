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
        // Inert at runtime (injectRegister:false → our custom src/pwa/registerSW.js
        // drives registration), but kept accurate: registerSW auto-applies updates.
        registerType: 'autoUpdate',
        manifest: false,
        injectRegister: false,
        /* Sprint 18: switched from `generateSW` to `injectManifest` so the
           dashboard SW can include a custom push event handler. The full
           workbox runtime-cache + precache logic now lives in src/sw.js;
           this config only tells Vite where to find the SW source and what
           to include in the precache manifest that gets inlined as
           `self.__WB_MANIFEST` inside the SW. */
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
          globIgnores: [
            // Heavy auto-split vendor chunks (Vite names them after the lib).
            '**/mapbox-gl-*.js',
            '**/mapbox-gl-*.css',
            '**/generateCategoricalChart-*.js',
            '**/AreaChart-*.js',
            '**/sortable.esm-*.js',
            '**/@stripe-*.js',
            '**/signature_pad-*.js',
            // Heavy lazy pages.
            '**/{TelematicsPage,BookingDetailPage,MessagingPage,SettingsPage,RevenuePage,InsurancePage,PricingRulesPage}-*.js',
            // Lazy widget chunks (Sprint 6a).
            '**/KPICardsWidget-*.js',
            '**/RevenueTrendWidget-*.js',
          ],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
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
