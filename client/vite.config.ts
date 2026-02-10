import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, '.'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/agency-offices': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        manualChunks(id) {
          // Core vendor chunks - order matters to avoid circular deps
          if (id.includes('node_modules')) {
            // React must be separate to avoid circular deps
            if (id.includes('react-dom')) {
              return 'vendor-react-dom';
            }
            if (id.includes('react')) {
              return 'vendor-react';
            }
            // Mapbox is large, keep separate
            if (id.includes('mapbox-gl')) {
              return 'vendor-mapbox';
            }
            // Charts are large and only used in analytics
            if (id.includes('chart.js') || id.includes('react-chartjs')) {
              return 'vendor-charts';
            }
            // Everything else
            return 'vendor-libs';
          }

          // Split large page components
          if (id.includes('/components/GeospatialExplorer')) {
            return 'page-geospatial';
          }
          if (id.includes('/components/Analytics')) {
            return 'page-analytics';
          }
          if (id.includes('/components/Admin')) {
            return 'page-admin';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  define: {
    // Ensure environment variables are available
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['mapbox-gl'], // Exclude mapbox-gl from pre-bundling for code splitting
  },
});
