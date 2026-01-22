import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Enable production sourcemaps via: VITE_SOURCEMAP=true npm run build
const enableProdSourcemap = process.env.VITE_SOURCEMAP === 'true';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Source maps: enabled in dev, disabled in prod (unless VITE_SOURCEMAP=true)
    sourcemap: mode === 'development' ? true : enableProdSourcemap,
    // Target modern browsers for smaller bundles (no legacy polyfills)
    target: 'es2020',
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: true,
      },
      mangle: true,
    },
    // CSS optimization
    cssMinify: true,
    cssCodeSplit: true,
    // Improved code splitting
    rollupOptions: {
      output: {
        // Manual chunks for better caching and loading
        manualChunks: (id) => {
          // React ecosystem - rarely changes
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router')
          ) {
            return 'react-vendor';
          }
          // Mapbox GL - large, loaded only on map pages
          if (id.includes('node_modules/mapbox-gl')) {
            return 'mapbox-gl';
          }
          // Recharts - loaded only on analytics pages
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-')
          ) {
            return 'recharts';
          }
          // Deck.gl - loaded only on Kepler page
          if (id.includes('node_modules/@deck.gl') || id.includes('node_modules/deck.gl')) {
            return 'deckgl';
          }
          // State management
          if (id.includes('node_modules/zustand')) {
            return 'state-management';
          }
        },
        // Ensure consistent chunk naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
      // Tree-shaking optimization
      treeshake: {
        moduleSideEffects: 'no-external',
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
    },
    // Report compressed sizes
    reportCompressedSize: true,
    // Warn on chunks larger than 1MB
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'mapbox-gl'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  // Preview server (npm run preview) - matches production behavior
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  // Resolve aliases for cleaner imports
  resolve: {
    alias: [
      // Ensure mapbox-gl uses the production build (avoid catching subpaths like CSS).
      { find: /^mapbox-gl$/, replacement: 'mapbox-gl/dist/mapbox-gl.js' },
    ],
  },
}));
