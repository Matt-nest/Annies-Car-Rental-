import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
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
