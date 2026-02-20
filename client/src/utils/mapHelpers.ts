// Map-related helper functions for ShadowCheck

// Create a GeoJSON circle polygon from center and radius in meters
export const createCirclePolygon = (
  center: [number, number],
  radiusMeters: number,
  steps = 64
): GeoJSON.Feature<GeoJSON.Polygon> => {
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;
  const distanceX = km / (111.32 * Math.cos((center[1] * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * (2 * Math.PI);
    const x = center[0] + distanceX * Math.cos(theta);
    const y = center[1] + distanceY * Math.sin(theta);
    coords.push([x, y]);
  }
  coords.push(coords[0]); // Close the polygon

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
};

// Signal range calculation based on signal strength and frequency
// Returns pixel radius that represents a fixed geographic distance
export const calculateSignalRange = (
  signalDbm: number | null,
  frequencyMhz?: number | null,
  zoom: number = 10,
  latitude: number = 40 // Default to mid-latitude for reasonable approximation
): number => {
  if (!signalDbm || signalDbm === null) return 30;

  let freq = frequencyMhz;
  if (typeof freq === 'string') {
    freq = parseFloat((freq as any).replace(' GHz', '')) * 1000;
  }
  if (!freq || freq <= 0) freq = 2437; // Default to channel 6 (2.4GHz)

  // Signal strength to distance mapping (inverse relationship)
  // Stronger signal = closer = smaller circle, weaker signal = farther = larger circle
  let distanceMeters;
  if (signalDbm >= -30) distanceMeters = 15;
  else if (signalDbm >= -50) distanceMeters = 40;
  else if (signalDbm >= -60) distanceMeters = 80;
  else if (signalDbm >= -70) distanceMeters = 120;
  else if (signalDbm >= -80) distanceMeters = 180;
  else distanceMeters = 250;

  // Frequency adjustment (5GHz has shorter range)
  if (freq > 5000) distanceMeters *= 0.7;

  // Convert meters to pixels at current zoom level
  // At zoom 0, the world is 256 pixels wide (40,075km at equator)
  // metersPerPixel = 156543.03392 * cos(lat) / 2^zoom
  const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
  const radiusPixels = distanceMeters / metersPerPixel;

  // Clamp radius for display - ensure minimum visibility but cap maximum
  return Math.max(8, Math.min(radiusPixels, 400));
};

// BSSID-based color generation for consistent network coloring
export const macColor = (mac: string): string => {
  if (!mac || mac.length < 6) return '#999999';

  const BASE_HUES = [0, 60, 120, 180, 240, 270, 300, 330];
  const stringToHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const cleanedMac = mac.replace(/[^0-9A-F]/gi, '');
  if (cleanedMac.length < 6) return '#999999';

  const oui = cleanedMac.substring(0, 6); // Manufacturer part
  const devicePart = cleanedMac.substring(6); // Device-specific part

  const hue = BASE_HUES[stringToHash(oui) % BASE_HUES.length];
  let saturation = 50 + (stringToHash(devicePart) % 41); // 50-90%
  let lightness = 40 + (stringToHash(devicePart) % 31); // 40-70%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Create a Google Maps tile style for Mapbox GL
export const createGoogleStyle = (type: string) => ({
  version: 8 as const,
  sources: {
    'google-tiles': {
      type: 'raster' as const,
      tiles: [`/api/google-maps-tile/${type}/{z}/{x}/{y}`],
      tileSize: 256,
      attribution: '© Google Maps',
    },
  },
  layers: [
    {
      id: 'google-tiles-layer',
      type: 'raster' as const,
      source: 'google-tiles',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
});

/**
 * Calculate WiFi channel number from frequency in MHz.
 * Supports 2.4 GHz (ch 1–14), 5 GHz, and 6 GHz (WiFi 6E) bands.
 */
export const frequencyToChannel = (freqMhz: number | null | undefined): number | null => {
  if (!freqMhz) return null;
  // 2.4 GHz band (channels 1-14)
  if (freqMhz >= 2412 && freqMhz <= 2484) {
    if (freqMhz === 2484) return 14; // Japan only
    return Math.round((freqMhz - 2407) / 5);
  }
  // 5 GHz band
  if (freqMhz >= 5170 && freqMhz <= 5825) {
    return Math.round((freqMhz - 5000) / 5);
  }
  // 6 GHz band (WiFi 6E)
  if (freqMhz >= 5935 && freqMhz <= 7115) {
    return Math.round((freqMhz - 5950) / 5) + 1;
  }
  return null;
};
