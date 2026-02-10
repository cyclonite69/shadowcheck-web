# Performance Optimization Plan for ShadowCheck

## Current Issues (from Lighthouse Report)

- **Total Blocking Time:** 19.6 seconds (Target: <300ms)
- **Time to Interactive:** 25.7 seconds (Target: <3.8s)
- **Speed Index:** 2.8 seconds (Target: <3.4s)
- **Main Bundle Size:** 25.4 seconds execution time

## Implemented Optimizations

### 1. ✅ Vite Build Configuration (vite.config.ts)

**Impact: High** - Reduces initial bundle size by 40-60%

```typescript
// Better code splitting strategy
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('react')) return 'vendor-react';
    if (id.includes('mapbox-gl')) return 'vendor-mapbox';
    if (id.includes('chart.js')) return 'vendor-charts';
    return 'vendor-other';
  }
  // Split large components
  if (id.includes('GeospatialExplorer')) return 'geospatial-explorer';
  if (id.includes('Analytics')) return 'analytics';
}
```

## Recommended Additional Optimizations

### 2. Defer Non-Critical Features

**Impact: High** - Reduces TTI by 5-10 seconds

```typescript
// In GeospatialExplorer.tsx
const [initialized, setInitialized] = useState(false);

useEffect(() => {
  // Defer non-critical features
  const timer = setTimeout(() => setInitialized(true), 100);
  return () => clearTimeout(timer);
}, []);

// Only initialize weather effects after critical render
{initialized && <WeatherEffects />}
```

### 3. Virtualize Network List

**Impact: Medium** - Reduces DOM nodes by 90%

```bash
npm install react-window
```

```typescript
import { FixedSizeList } from 'react-window';

// Replace large network list with virtualized version
<FixedSizeList
  height={600}
  itemCount={networks.length}
  itemSize={50}
  width="100%"
>
  {NetworkRow}
</FixedSizeList>
```

### 4. Optimize Mapbox Initialization

**Impact: Medium** - Reduces map load time by 2-3 seconds

```typescript
// Defer map initialization until container is visible
const mapContainerRef = useRef<HTMLDivElement>(null);
const [shouldInitMap, setShouldInitMap] = useState(false);

useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      setShouldInitMap(true);
      observer.disconnect();
    }
  });

  if (mapContainerRef.current) {
    observer.observe(mapContainerRef.current);
  }

  return () => observer.disconnect();
}, []);
```

### 5. Memoize Expensive Computations

**Impact: Medium** - Reduces re-renders

```typescript
// Memoize network filtering
const filteredNetworks = useMemo(() => {
  return networks.filter(/* ... */);
}, [networks, filters]); // Only recompute when dependencies change

// Memoize observation processing
const processedObservations = useMemo(() => {
  return observationsByBssid.map(/* ... */);
}, [observationsByBssid]);
```

### 6. Reduce Bundle Size

**Impact: High** - Removes 332 KiB unused code

```bash
# Analyze bundle
npm run build
npx vite-bundle-visualizer

# Tree-shake unused Mapbox features
# In vite.config.ts
resolve: {
  alias: {
    'mapbox-gl': 'mapbox-gl/dist/mapbox-gl.js'
  }
}
```

### 7. Add Service Worker for Caching

**Impact: Medium** - Improves repeat visits

```bash
npm install vite-plugin-pwa -D
```

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

plugins: [
  react(),
  VitePWA({
    registerType: 'autoUpdate',
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'mapbox-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
            },
          },
        },
      ],
    },
  }),
];
```

### 8. Optimize Images and Assets

**Impact: Low-Medium**

```bash
# Install image optimization
npm install vite-plugin-imagemin -D

# Add to vite.config.ts
import viteImagemin from 'vite-plugin-imagemin';

plugins: [
  viteImagemin({
    gifsicle: { optimizationLevel: 7 },
    optipng: { optimizationLevel: 7 },
    mozjpeg: { quality: 80 },
    pngquant: { quality: [0.8, 0.9], speed: 4 },
    svgo: {
      plugins: [
        { name: 'removeViewBox' },
        { name: 'removeEmptyAttrs', active: false }
      ]
    }
  })
]
```

## Implementation Priority

### Phase 1 (Immediate - 1 hour)

1. ✅ Update vite.config.ts with better code splitting
2. Rebuild and test: `npm run build && npm run preview`

### Phase 2 (High Priority - 2-3 hours)

3. Add deferred initialization to GeospatialExplorer
4. Virtualize network list with react-window
5. Optimize Mapbox initialization

### Phase 3 (Medium Priority - 2-3 hours)

6. Add memoization to expensive computations
7. Analyze and tree-shake unused code
8. Add service worker caching

### Phase 4 (Nice to Have - 1-2 hours)

9. Optimize images and assets
10. Add performance monitoring

## Expected Results

After all optimizations:

- **Total Blocking Time:** <500ms (from 19.6s) - **95% improvement**
- **Time to Interactive:** <4s (from 25.7s) - **84% improvement**
- **Speed Index:** <2s (from 2.8s) - **29% improvement**
- **Bundle Size:** Reduced by 40-50%

## Testing

```bash
# Build optimized version
npm run build

# Test with Lighthouse
npm run preview
# Then run Lighthouse on http://localhost:4173/geospatial-explorer

# Compare bundle sizes
npx vite-bundle-visualizer
```

## Monitoring

Add performance monitoring to track improvements:

```typescript
// Add to main.tsx
if ('performance' in window) {
  window.addEventListener('load', () => {
    const perfData = performance.getEntriesByType('navigation')[0];
    console.log('Page Load Time:', perfData.loadEventEnd - perfData.fetchStart);
    console.log('DOM Interactive:', perfData.domInteractive);
    console.log('DOM Complete:', perfData.domComplete);
  });
}
```
