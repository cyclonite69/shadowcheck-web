# Free Address & POI Enrichment APIs

## Currently Implemented

### 1. **Overpass API (OpenStreetMap)** ✅

- **URL**: https://overpass-api.de/api/interpreter
- **Rate Limit**: ~10,000/day
- **Best For**: POI names, business types, amenities
- **Data**: Business names, categories, brands, operators
- **No API Key Required**

### 2. **Nominatim (OpenStreetMap)** ✅

- **URL**: https://nominatim.openstreetmap.org
- **Rate Limit**: 1 request/second
- **Best For**: Address details, building types
- **Data**: Building names, address components, place types
- **No API Key Required**

### 3. **Photon (Komoot)** ✅

- **URL**: https://photon.komoot.io
- **Rate Limit**: Generous (no hard limit)
- **Best For**: Fast geocoding, address parsing
- **Data**: Street names, cities, place types
- **No API Key Required**

## Additional Free Options

### 4. **OpenCage Geocoding**

- **URL**: https://opencagedata.com
- **Free Tier**: 2,500 requests/day
- **Requires**: Free API key
- **Data**: Comprehensive address data, timezone, currency

### 5. **LocationIQ**

- **URL**: https://locationiq.com
- **Free Tier**: 5,000 requests/day
- **Requires**: Free API key
- **Data**: Geocoding, reverse geocoding, POI

### 6. **Geoapify**

- **URL**: https://www.geoapify.com
- **Free Tier**: 3,000 requests/day
- **Requires**: Free API key
- **Data**: Places API, address autocomplete

### 7. **HERE Geocoding**

- **URL**: https://developer.here.com
- **Free Tier**: 250,000 transactions/month
- **Requires**: Free API key
- **Data**: Business names, categories, chains

### 8. **TomTom Search API**

- **URL**: https://developer.tomtom.com
- **Free Tier**: 2,500 requests/day
- **Requires**: Free API key
- **Data**: POI search, categories, brands

## Usage Strategy

### Current Implementation (No API Keys)

```bash
node enrich-addresses-multi.js 100
```

- Uses Overpass → Nominatim → Photon cascade
- ~1 second per address (rate limiting)
- 100% free, no registration

### With API Keys (Faster)

1. Sign up for free tiers
2. Add to `.env`:
   ```
   OPENCAGE_API_KEY=your_key
   LOCATIONIQ_API_KEY=your_key
   HERE_API_KEY=your_key
   ```
3. Process 10,000+ addresses/day

## Data Quality

**Best Results:**

- Overpass: Restaurants, shops, amenities
- HERE: Chain businesses (Starbucks, McDonald's)
- OpenCage: Residential addresses
- Nominatim: Government buildings, landmarks

**Coverage:**

- Urban areas: 70-90% POI match
- Suburban: 40-60% POI match
- Rural: 10-30% POI match

## Current Results

From 10 test addresses:

- ✓ Outback Steakhouse (restaurant)
- ✓ University Pavilion Parking Deck (parking)
- ✓ Street intersections (navigation)
- ✓ Building names

## Batch Processing

```bash
# Small batch (100 addresses, ~2 minutes)
node enrich-addresses-multi.js 100

# Medium batch (1000 addresses, ~20 minutes)
node enrich-addresses-multi.js 1000

# Large batch (10000 addresses, ~3 hours)
node enrich-addresses-multi.js 10000
```

## Database Schema

Enriched data stored in:

- `app.networks_legacy.venue_name`
- `app.networks_legacy.venue_category`
- `app.networks_legacy.name`
- `app.ap_locations.venue_name`
- `app.ap_locations.venue_category`
