# Kepler.gl Integration for ShadowCheck

## Overview

Added Kepler.gl visualization support to ShadowCheck for advanced geospatial analysis of wireless network data.

## What's Added

### 1. API Endpoint: `/api/kepler/data`

**Parameters:**

- `limit` (optional): Max number of networks to return (**no default limit**)
- `bbox` (optional): Bounding box filter as `minLng,minLat,maxLng,maxLat`

**Response:** GeoJSON FeatureCollection with network properties:

- `bssid`, `ssid`, `threat_score`, `observation_count`
- `first_seen`, `last_seen`
- Point geometry from PostGIS

### 2. Kepler Page: `/kepler`

2. Visit: `http://localhost:3001/kepler`
3. Kepler.gl will load with your network data

## Performance Notes

- **Default behavior:** No artificial limits; Kepler.gl can handle large datasets.
- **For larger datasets:** Use bbox or other filters instead of caps.
- **Kepler.gl advantages:** GPU acceleration, smooth interaction, advanced filtering UI

## Kepler Data Rules (Strict)

- Never add default limits to Kepler endpoints unless explicitly requested by the user.
- Endpoints: `/api/kepler/data`, `/api/kepler/observations`, `/api/kepler/networks`.

## Example API Calls

```bash
# Get all networks (up to 10K)
curl "http://localhost:3001/api/kepler/data"

# Get networks in specific area
curl "http://localhost:3001/api/kepler/data?bbox=-84,42,-83,43&limit=5000"

# Get small sample for testing
curl "http://localhost:3001/api/kepler/data?limit=100"
```

## Kepler.gl Features Available

- **Layer types:** Points, heatmaps, clusters, arcs
- **Filtering:** Interactive UI for all data properties
- **Time series:** Animation support (if time fields added)
- **Styling:** Color/size mapping to threat_score, observation_count
- **Export:** Data and map configurations

## Next Steps

1. **Add time-series support:** Include timestamp fields for animation
2. **Custom layer configs:** Pre-configure threat visualization layers
3. **Integration:** Add Kepler.gl as option in main geospatial page
4. **Performance:** Implement progressive loading for very large datasets

## Technical Details

- Uses existing PostGIS spatial queries
- Leverages ShadowCheck's Mapbox token management
- Minimal code addition (~40 lines server + HTML page)
- Compatible with existing threat detection and scoring
