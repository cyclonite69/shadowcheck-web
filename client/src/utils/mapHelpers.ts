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

// Signal range estimation based on signal strength, frequency, and co-channel congestion.
// Returns an estimated distance in meters so the rendered footprint scales naturally with zoom.
//
// Model: log-distance path loss  d = 10 ^ ((RSSI_ref - RSSI) / (10 * n))
//   RSSI_ref  — expected received power at 1 m (empirical, indoors)
//   n         — path-loss exponent (higher = faster attenuation)
//               2.4 GHz: 2.7  (travels furthest, lower absorption)
//               5   GHz: 3.1  (moderate attenuation)
//               6   GHz: 3.5  (highest absorption, worst wall penetration)
//
/**
 * Reconcile WiGLE type field with capabilities to determine actual radio technology.
 * Capabilities is the source of truth — type is WiGLE's initial classification which
 * can be wrong (e.g. type=G with capabilities=LTE;310410).
 */
export type RadioTech =
  | 'wifi_2g'
  | 'wifi_5g'
  | 'wifi_6g'
  | 'bt_classic'
  | 'ble'
  | 'lte'
  | 'nr'
  | 'gsm'
  | 'iwlan'
  | 'stingray'
  | 'unknown';

export const resolveRadioTech = (
  type: string | null | undefined,
  capabilities: string | null | undefined,
  frequencyMhz?: number | null
): RadioTech => {
  const caps = (capabilities || '').toUpperCase();
  const t = (type || '').toUpperCase();

  // Special detection for SIGINT assets
  if (caps.includes('STINGRAY') || caps.includes('HAILSTORM') || t === 'S') return 'stingray';

  // Capabilities-first: check what the device actually advertised
  if (caps.startsWith('NR')) return 'nr';
  if (caps.startsWith('LTE')) return 'lte';
  if (caps.startsWith('GSM')) return 'gsm';
  if (caps.startsWith('IWLAN')) return 'iwlan';

  // WiFi capabilities (bracket format like [WPA2-PSK-CCMP])
  if (
    caps.startsWith('[') ||
    caps.includes('WPA') ||
    caps.includes('RSN') ||
    caps.includes('ESS')
  ) {
    const freq = frequencyMhz ?? 0;
    if (freq >= 5925) return 'wifi_6g';
    if (freq >= 5000) return 'wifi_5g';
    return 'wifi_2g';
  }

  // BT/BLE: capabilities contain device class (e.g. "Headphones;10", "Misc")
  if (t === 'E') return 'ble';
  if (t === 'B') return 'bt_classic';

  // Fall back to type field
  if (t === 'N') return 'nr';
  if (t === 'L') return 'lte';
  if (t === 'G') return 'gsm';
  if (t === 'C' || t === 'D' || t === 'F') return 'lte'; // CDMA/generic → treat as LTE-era
  if (t === 'W') {
    const freq = frequencyMhz ?? 0;
    // Detect BLE misclassified as WiFi: freq 7936 = CoD Uncategorized, or BT-style caps
    if (freq === 7936 || caps.includes('UNCATEGORIZED') || (caps === 'MISC' && freq === 0))
      return 'ble';
    if (freq >= 5925) return 'wifi_6g';
    if (freq >= 5000) return 'wifi_5g';
    return 'wifi_2g';
  }

  return 'unknown';
};

// Radio propagation parameters per technology
const RADIO_PARAMS: Record<RadioTech, { refRssi: number; pathLoss: number; maxRange: number }> = {
  wifi_2g: { refRssi: -40, pathLoss: 2.7, maxRange: 500 },
  wifi_5g: { refRssi: -43, pathLoss: 3.1, maxRange: 275 },
  wifi_6g: { refRssi: -46, pathLoss: 3.5, maxRange: 200 },
  bt_classic: { refRssi: -35, pathLoss: 2.5, maxRange: 100 },
  ble: { refRssi: -35, pathLoss: 2.0, maxRange: 200 },
  lte: { refRssi: -30, pathLoss: 2.0, maxRange: 35000 },
  nr: { refRssi: -35, pathLoss: 2.2, maxRange: 10000 },
  gsm: { refRssi: -30, pathLoss: 2.0, maxRange: 35000 },
  iwlan: { refRssi: -40, pathLoss: 2.7, maxRange: 500 }, // WiFi-based calling
  stingray: { refRssi: -25, pathLoss: 2.0, maxRange: 50000 }, // High-powered cell simulator
  unknown: { refRssi: -40, pathLoss: 2.7, maxRange: 500 },
};

export const calculateSignalRange = (
  signalDbm: number | null,
  frequencyMhz?: number | null,
  _zoom: number = 10,
  _latitude: number = 40,
  _congestionNeighbors: number = 0,
  radioType?: string | null,
  capabilities?: string | null
): number => {
  if (signalDbm === null || signalDbm === undefined || !Number.isFinite(signalDbm)) {
    return 30;
  }

  let freq = frequencyMhz;
  if (typeof freq === 'string') {
    freq = parseFloat((freq as any).replace(' GHz', '')) * 1000;
  }
  if (!freq || freq <= 0) freq = null;

  const tech = resolveRadioTech(radioType, capabilities, freq);
  const params = RADIO_PARAMS[tech];

  // For WiFi, still use frequency-specific params if we have freq but no type/caps
  let { refRssi, pathLoss, maxRange } = params;
  if (tech.startsWith('wifi') && freq) {
    if (freq >= 5925) {
      refRssi = -46;
      pathLoss = 3.5;
      maxRange = 200;
    } else if (freq >= 5000) {
      refRssi = -43;
      pathLoss = 3.1;
      maxRange = 275;
    }
  }

  const rawDistance = Math.pow(10, (refRssi - signalDbm) / (10 * pathLoss));
  return Math.max(6, Math.min(rawDistance, maxRange));
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
