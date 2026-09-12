import vendorManifest from '../components/vendor-intel/vendor_intel_manifest.json';
import type { VendorEntry as ManifestEntry } from '../components/vendor-intel/types';

// ─── Label map ────────────────────────────────────────────────────────────────

const DEVICE_CLASS_LABELS: Record<string, string> = {
  FLOCK_SAFETY_CAMERA: 'Flock Safety Camera',
  FS_EXT_BATTERY: 'Flock External Battery',
  SHOTSPOTTER_SENSOR: 'ShotSpotter Sensor',
  AXON_BODY_CAMERA: 'Axon Body Camera',
  MOTOROLA_BWC: 'Motorola Body Camera',
  AXON_SIGNAL_PERIPHERAL: 'Axon Signal Peripheral',
  DEI_BWC: 'Body Worn Camera (DEI)',
  BT_IMAGING_DEVICE: 'BT Imaging Device',
  DASHCAM: 'Dashcam',
  RESIDENTIAL_CAMERA: 'Residential Camera',
  RAVEN_GUNSHOT_DETECTOR: 'Raven Gunshot Detector',
  L3HARRIS_STINGRAY: 'L3Harris StingRay',
  RAYTHEON_ESYSTEMS: 'Raytheon E-Systems',
  VERINT_INTERCEPT: 'Verint Intercept',
  VERINT_LORONIX: 'Verint Loronix',
  SEPTIER_WIFICATCHER: 'Septier WiFi Catcher',
  ABILITY_INTERCEPT: 'Ability Intercept',
  ROHDE_SCHWARZ_WLAN: 'Rohde & Schwarz WLAN',
  COBHAM_SIGINT: 'Cobham SIGINT',
  NORSAT_SATCOM: 'Norsat Satcom',
  GENERAL_DYNAMICS_C4ISR: 'General Dynamics C4ISR',
  NORTHROP_GRUMMAN_ISR: 'Northrop Grumman ISR',
  LEONARDO_DRS_TACTICAL: 'Leonardo DRS Tactical',
  TADIRAN_COMMS: 'Tadiran Communications',
  PRIVATE_OUI_REGISTERED: 'Private OUI Registered',
  UBIQUITI_MESH: 'Ubiquiti Mesh',
  CAMBIUM_BACKHAUL: 'Cambium Backhaul',
  PROXIM_SURVEILLANCE: 'Proxim Surveillance',
  PEPLINK_MOBILEPOST: 'Peplink Mobile Post',
  // Priority 2 — routers
  CRADLEPOINT_ROUTER: 'Cradlepoint Router',
  SIERRA_AIRLINK: 'Sierra Wireless AirLink',
  // Priority 3 — pentest / RF research
  HAK5_WIFI_PINEAPPLE: 'Hak5 WiFi Pineapple',
  FLIPPER_ZERO: 'Flipper Zero',
  UBERTOOTH_ONE: 'Ubertooth One',
  PROXMARK3: 'Proxmark3',
};

// ─── Manifest index (built once at module load) ───────────────────────────────

const MANIFEST_BY_CLASS = new Map<string, ManifestEntry>();

for (const entry of vendorManifest.vendors as ManifestEntry[]) {
  // Index by surveillance_type and device_class — both must resolve to the same entry.
  // surveillance_type is the DB join key; device_class is the canonical display key.
  // We index both so lookups work regardless of which key a caller uses.
  for (const k of [entry.surveillance_type, entry.device_class]) {
    if (k) {
      const normalized = k.trim().toUpperCase();
      if (normalized) MANIFEST_BY_CLASS.set(normalized, entry);
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const prettifyEnum = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export function normalizeDeviceClass(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function formatDeviceType(raw: string | null | undefined): string {
  const deviceClass = normalizeDeviceClass(raw);
  if (!deviceClass) return '';
  return DEVICE_CLASS_LABELS[deviceClass] ?? prettifyEnum(deviceClass);
}

/** Returns the full manifest entry for a device class, or null if not indexed. */
export function getDeviceIntelEntry(raw: string | null | undefined): ManifestEntry | null {
  const key = normalizeDeviceClass(raw);
  return key ? (MANIFEST_BY_CLASS.get(key) ?? null) : null;
}

/** True if the manifest has an entry for this device class. */
export function hasDeviceIntel(raw: string | null | undefined): boolean {
  return getDeviceIntelEntry(raw) !== null;
}

/** Returns the category string (e.g. 'BODY_CAMERA') for a device class, or null. */
export function getDeviceIntelCategory(raw: string | null | undefined): string | null {
  return getDeviceIntelEntry(raw)?.category ?? null;
}

// Kept for backward compat — delegates to hasDeviceIntel
export function hasVendorIntelForDeviceClass(deviceClass: string | null | undefined): boolean {
  return hasDeviceIntel(deviceClass);
}
