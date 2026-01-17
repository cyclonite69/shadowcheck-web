# Mapbox Caching & Offline Tiles Guide

## Features Implemented

### 1. Multiple Mapbox Tokens

Store and manage multiple Mapbox access tokens with labels:

- **default**: Standard token for daily use
- **download**: Token with download permissions for offline tiles
- **production**: High-rate-limit token for production

### 2. Browser Tile Caching

Service worker automatically caches map tiles for offline use:

- Caches up to 500 tiles
- Works offline after first visit
- Automatically manages cache size

### 3. Tile Download Capability

With a download-enabled token, you can pre-cache tiles for offline use.

## Setup

### Step 1: Create Mapbox Tokens

1. Go to https://account.mapbox.com/access-tokens/
2. Create tokens with different scopes:

**Default Token** (read-only):

- Scopes: `styles:read`, `fonts:read`, `datasets:read`
- Use: Daily browsing

**Download Token** (with downloads):

- Scopes: `styles:read`, `styles:download`, `fonts:read`, `fonts:download`, `datasets:read`
- Use: Offline tile downloads

### Step 2: Add Tokens to ShadowCheck

1. Navigate to Admin page
2. Scroll to "🗺️ Mapbox Tokens" section
3. Add each token:
   ```
   Label: default
   Token: pk.eyJ1...
   ```
4. Click "Save Token"
5. Set one as primary (used by default)

### Step 3: Enable Tile Caching

Tile caching is automatic! The service worker (`/sw-map-cache.js`) handles:

- Caching tiles as you browse
- Serving cached tiles when offline
- Managing cache size (500 tile limit)

## Using Offline Maps

### Automatic Caching

Just browse the map normally. Tiles are cached automatically:

1. Open Geospatial page
2. Pan/zoom around your area
3. Tiles are cached in background
4. Works offline on next visit

### Check Cache Status

Open browser console:

```javascript
// Get cache size
navigator.serviceWorker.controller.postMessage({ action: 'getCacheSize' });

// Clear cache
navigator.serviceWorker.controller.postMessage({ action: 'clearCache' });
```

### Pre-Download Tiles

To pre-cache a specific area:

1. Set zoom level to desired detail (13-16 recommended)
2. Pan slowly across entire area
3. Wait for tiles to load
4. Tiles are now cached

## Downloading Dark Earth Tiles

Mapbox doesn't provide bulk tile downloads, but you can:

### Option 1: Use Mapbox Tiling Service (MTS)

With a download-enabled token:

```bash
# Download style JSON
curl "https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=YOUR_TOKEN" > dark-style.json

# Download vector tiles (requires MTS access)
# Contact Mapbox sales for bulk download options
```

### Option 2: Self-Host with OpenMapTiles

For true offline capability:

1. Download OpenMapTiles planet file
2. Host with TileServer GL
3. Update map style to use local tiles

```javascript
map = new mapboxgl.Map({
  container: 'map',
  style: 'http://localhost:8080/styles/dark-matter/style.json', // Local tiles
  center: [-83.6968, 43.0234],
  zoom: 13,
});
```

### Option 3: Cache Tiles via Service Worker (Current Implementation)

- Browse map to cache tiles
- Limited to 500 tiles (~50 MB)
- Good for small areas
- No bulk download needed

## Performance Optimizations

### Current Features

✅ Service worker tile caching (500 tiles)
✅ Browser HTTP cache headers
✅ Mapbox GL JS clustering
✅ PostGIS spatial indexing
✅ Lazy loading (infinite scroll)

### Additional Optimizations

#### 1. Increase Cache Size

Edit `/public/sw-map-cache.js`:

```javascript
const TILE_CACHE_SIZE = 2000; // Increase from 500
```

#### 2. Pre-Cache Critical Tiles

Add to service worker install event:

```javascript
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        'https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/...',
        // Add critical tiles
      ]);
    })
  );
});
```

#### 3. Use Vector Tiles Locally

Download and serve vector tiles:

```bash
# Install tileserver-gl
npm install -g tileserver-gl-light

# Download mbtiles
wget https://data.maptiler.com/downloads/planet/

# Serve locally
tileserver-gl-light planet.mbtiles
```

## API Endpoints

### List Tokens

```bash
GET /api/settings/mapbox
Authorization: Bearer YOUR_API_KEY
```

Response:

```json
{
  "tokens": [
    {
      "label": "default",
      "isPrimary": true,
      "token": "pk.eyJ1...abc"
    },
    {
      "label": "download",
      "isPrimary": false,
      "token": "pk.eyJ1...xyz"
    }
  ]
}
```

### Add Token

```bash
POST /api/settings/mapbox
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "token": "pk.eyJ1...",
  "label": "download"
}
```

### Set Primary Token

```bash
POST /api/settings/mapbox/primary
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "label": "download"
}
```

### Delete Token

```bash
DELETE /api/settings/mapbox/download
Authorization: Bearer YOUR_API_KEY
```

## Limitations

### Browser Cache

- **Size**: ~50-100 MB (browser dependent)
- **Persistence**: Can be cleared by browser
- **Scope**: Per-origin (only ShadowCheck)

### Service Worker

- **HTTPS Required**: Service workers require HTTPS (or localhost)
- **Tile Limit**: 500 tiles = ~10 km² at zoom 15
- **No Bulk Download**: Must browse to cache

### Mapbox API

- **Rate Limits**: 50,000 requests/month (free tier)
- **Download Restrictions**: Bulk downloads require enterprise plan
- **Terms of Service**: Check Mapbox TOS for offline usage

## Troubleshooting

### Tiles Not Caching

1. Check service worker registration:
   ```javascript
   navigator.serviceWorker.getRegistrations().then(console.log);
   ```
2. Verify HTTPS or localhost
3. Check browser console for errors
4. Clear cache and reload

### Cache Full

```javascript
// Clear old cache
caches.delete('shadowcheck-map-tiles-v1');
```

### Offline Not Working

1. Ensure tiles were cached while online
2. Check service worker is active
3. Verify cache contains tiles:
   ```javascript
   caches.open('shadowcheck-map-tiles-v1').then((cache) => {
     cache.keys().then((keys) => console.log(keys.length + ' tiles cached'));
   });
   ```

## Best Practices

1. **Use Multiple Tokens**: Separate tokens for dev/prod
2. **Monitor Rate Limits**: Track API usage in Mapbox dashboard
3. **Cache Strategically**: Pre-cache only needed areas
4. **Update Regularly**: Refresh cache periodically for updated tiles
5. **Test Offline**: Disable network to verify offline functionality

## Future Enhancements

- [ ] Bulk tile downloader script
- [ ] Cache management UI
- [ ] Offline map style switcher
- [ ] Pre-cache specific bounding boxes
- [ ] IndexedDB for larger cache
- [ ] Progressive Web App (PWA) manifest
- [ ] Background sync for tile updates

## Resources

- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [OpenMapTiles](https://openmaptiles.org/)
- [TileServer GL](https://github.com/maptiler/tileserver-gl)
