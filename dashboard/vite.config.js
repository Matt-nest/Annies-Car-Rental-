import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
    plugins: [react()],
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
