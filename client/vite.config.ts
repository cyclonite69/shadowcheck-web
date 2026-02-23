import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        disableDevLogs: true,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  root: path.resolve(__dirname, '.'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      react: path.resolve(__dirname, '../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
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
            // Mapbox is large, keep separate
            if (id.includes('mapbox-gl')) {
              return 'vendor-mapbox';
            }
            // Bundle ALL React ecosystem together to prevent load order issues
            if (
              id.includes('recharts') ||
              id.includes('react-dom') ||
              id.includes('react') ||
              id.includes('zustand') ||
              id.includes('use-sync-external-store')
            ) {
              return 'vendor-react';
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
