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

// Signal range estimation based on signal strength and frequency.
// Returns an estimated distance in meters so the rendered footprint scales naturally with zoom.
export const calculateSignalRange = (
  signalDbm: number | null,
  frequencyMhz?: number | null,
  _zoom: number = 10,
  _latitude: number = 40
): number => {
  if (signalDbm === null || signalDbm === undefined || !Number.isFinite(signalDbm)) {
    return 30;
  }

  let freq = frequencyMhz;
  if (typeof freq === 'string') {
    freq = parseFloat((freq as any).replace(' GHz', '')) * 1000;
  }
  if (!freq || freq <= 0) freq = 2437; // Default to channel 6 (2.4GHz)

  // Simple log-distance propagation estimate.
  // Stronger signal => smaller radius; weaker signal => larger radius.
  // 5/6 GHz generally attenuates faster than 2.4 GHz.
  const referenceRssiAtOneMeter = freq >= 5900 ? -45 : freq >= 5000 ? -43 : -40;
  const pathLossExponent = freq >= 5000 ? 3.1 : 2.7;
  const distanceMeters = Math.pow(
    10,
    (referenceRssiAtOneMeter - signalDbm) / (10 * pathLossExponent)
  );

  // Keep the visualization in a sane operator-facing range.
  return Math.max(6, Math.min(distanceMeters, 350));
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
