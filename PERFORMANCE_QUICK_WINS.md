# Performance Quick Wins - ShadowCheck

## ✅ COMPLETED: Code Splitting (5 min)

**File:** `client/vite.config.ts`
**Impact:** 54% smaller initial bundle

```bash
cd client && npm run build
```

**Result:**

- Initial load: 277KB (was 600KB+)
- Mapbox: 464KB (lazy loaded)
- Pages: 20-165KB each (lazy loaded)

---

## 🚀 NEXT QUICK WINS

### 1. Virtualize Network List (15 min)

**Impact:** -2s TTI, 90% fewer DOM nodes

```bash
npm install react-window
```

```tsx
// In NetworkExplorerSection.tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList height={600} itemCount={networks.length} itemSize={50}>
  {Row}
</FixedSizeList>;
```

### 2. Defer Weather Effects (5 min)

**Impact:** -1s TTI

```tsx
// In GeospatialExplorer.tsx
const [showWeather, setShowWeather] = useState(false);

useEffect(() => {
  const timer = setTimeout(() => setShowWeather(true), 1000);
  return () => clearTimeout(timer);
}, []);

{
  showWeather && <WeatherEffects />;
}
```

### 3. Add Service Worker (10 min)

**Impact:** 80% faster repeat visits

```bash
npm install vite-plugin-pwa -D
```

```ts
// In vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

plugins: [
  react(),
  VitePWA({
    registerType: 'autoUpdate',
    workbox: {
      globPatterns: ['**/*.{js,css,html}'],
    },
  }),
];
```

---

## 📊 Expected Results

| Optimization      | Time   | TTI Improvement | TBT Improvement |
| ----------------- | ------ | --------------- | --------------- |
| ✅ Code Splitting | 5 min  | -8s             | -5s             |
| Virtualize List   | 15 min | -2s             | -1s             |
| Defer Weather     | 5 min  | -1s             | -500ms          |
| Service Worker    | 10 min | 0s\*            | 0s\*            |

\*Service worker improves repeat visits only

**Total Time:** 35 minutes
**Total Improvement:** ~11s TTI, ~6.5s TBT

---

## 🧪 Test After Each Change

```bash
# Build
npm run build

# Preview
npm run preview

# Test at http://localhost:4173/geospatial-explorer
# Run Lighthouse in Chrome DevTools
```

---

## 🎯 Target Scores

| Metric      | Current | Target | After Quick Wins |
| ----------- | ------- | ------ | ---------------- |
| TTI         | 25.7s   | <4s    | ~8-10s           |
| TBT         | 19.6s   | <500ms | ~2-3s            |
| Speed Index | 2.8s    | <2s    | ~2s              |
| Performance | ~20     | >70    | ~50-60           |

---

## 📝 Notes

- Code splitting is already done ✅
- Each additional optimization is independent
- Test after each change
- Prioritize by impact/time ratio

**Quick wins = 35 minutes for 60% improvement**
