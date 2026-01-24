// Network-related constants for ShadowCheck

import type { NetworkRow } from '../types/network';

// Column configuration for network tables
// Uses Partial because not all NetworkRow fields have column definitions
export const NETWORK_COLUMNS: Partial<
  Record<
    keyof NetworkRow | 'select',
    { label: string; width: number; sortable: boolean; default: boolean }
  >
> & { select: { label: string; width: number; sortable: boolean; default: boolean } } = {
  select: { label: '✓', width: 40, sortable: false, default: true },
  type: { label: 'Type', width: 60, sortable: true, default: true },
  ssid: { label: 'SSID', width: 150, sortable: true, default: true },
  bssid: { label: 'BSSID', width: 140, sortable: true, default: true },
  threat: { label: 'Threat', width: 75, sortable: true, default: true },
  threat_score: { label: 'Threat Score', width: 100, sortable: true, default: false },
  signal: { label: 'Signal (dBm)', width: 100, sortable: true, default: true },
  security: { label: 'Security', width: 80, sortable: true, default: true },
  frequency: { label: 'Frequency', width: 90, sortable: true, default: false },
  channel: { label: 'Channel', width: 70, sortable: true, default: false },
  observations: { label: 'Observations', width: 100, sortable: true, default: true },
  latitude: { label: 'Latitude', width: 100, sortable: true, default: false },
  longitude: { label: 'Longitude', width: 100, sortable: true, default: false },
  rawLatitude: { label: 'Raw Lat', width: 100, sortable: false, default: false },
  rawLongitude: { label: 'Raw Lon', width: 100, sortable: false, default: false },
  distanceFromHome: { label: 'Distance (km)', width: 100, sortable: true, default: true },
  accuracy: { label: 'Accuracy (m)', width: 90, sortable: true, default: false },
  stationaryConfidence: { label: 'Stationary Conf.', width: 110, sortable: true, default: false },
  firstSeen: { label: 'First Seen', width: 160, sortable: true, default: false },
  lastSeen: { label: 'Last Seen', width: 160, sortable: true, default: true },
  timespanDays: { label: 'Timespan (days)', width: 120, sortable: true, default: false },
  // Enrichment columns (networks-v2 API) - hidden by default
  manufacturer: { label: 'Manufacturer', width: 150, sortable: true, default: false },
  min_altitude_m: { label: 'Min Alt (m)', width: 90, sortable: true, default: false },
  max_altitude_m: { label: 'Max Alt (m)', width: 90, sortable: true, default: false },
  altitude_span_m: { label: 'Alt Span (m)', width: 100, sortable: true, default: false },
  max_distance_meters: { label: 'Max Dist (m)', width: 110, sortable: true, default: false },
  last_altitude_m: { label: 'Last Alt (m)', width: 90, sortable: true, default: false },
  is_sentinel: { label: 'Sentinel', width: 80, sortable: true, default: false },
};

// Maps frontend column names to API sort field names
export const API_SORT_MAP: Partial<Record<keyof NetworkRow, string>> = {
  lastSeen: 'last_seen',
  firstSeen: 'first_observed_at',
  observations: 'obs_count',
  signal: 'signal',
  threat: 'threat',
  threat_score: 'threat_score',
  distanceFromHome: 'distance_from_home_km',
  ssid: 'ssid',
  bssid: 'bssid',
  frequency: 'frequency',
  accuracy: 'accuracy_meters',
  type: 'type',
  security: 'security',
  channel: 'channel',
  latitude: 'lat',
  longitude: 'lon',
  manufacturer: 'manufacturer',
  min_altitude_m: 'min_altitude_m',
  max_altitude_m: 'max_altitude_m',
  altitude_span_m: 'altitude_span_m',
  max_distance_meters: 'max_distance_meters',
  last_altitude_m: 'last_altitude_m',
  is_sentinel: 'is_sentinel',
  timespanDays: 'timespan_days',
};

// Pagination limit for network queries
export const NETWORK_PAGE_LIMIT = 500;

// Default map view settings
export const DEFAULT_CENTER: [number, number] = [-83.69682688, 43.02345147];
export const DEFAULT_ZOOM = 12;
export const DEFAULT_HOME_RADIUS = 100; // meters

// Color palette for network markers
export const NETWORK_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

// Network type display configuration
export const NETWORK_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  W: { label: 'WiFi', color: '#3b82f6' },
  E: { label: 'BLE', color: '#8b5cf6' },
  B: { label: 'BT', color: '#06b6d4' },
  G: { label: 'GSM', color: '#f59e0b' },
  C: { label: 'CDMA', color: '#f97316' },
  D: { label: '3G', color: '#84cc16' },
  L: { label: 'LTE', color: '#10b981' },
  N: { label: '5G', color: '#ec4899' },
  F: { label: 'NFC', color: '#6366f1' },
  '?': { label: 'Unknown', color: '#6b7280' },
};

// Threat level display configuration
export const THREAT_LEVEL_CONFIG = {
  CRITICAL: { label: 'CRITICAL', color: '#dc2626', bg: '#dc262620' },
  HIGH: { label: 'HIGH', color: '#ef4444', bg: '#ef444420' },
  MED: { label: 'MED', color: '#f97316', bg: '#f9731620' },
  LOW: { label: 'LOW', color: '#eab308', bg: '#eab30820' },
  NONE: { label: '', color: '#6b7280', bg: '#6b728020' },
};

// Available map styles
export const MAP_STYLES = [
  {
    value: 'mapbox://styles/mapbox/standard',
    label: 'Standard (Day)',
    config: { lightPreset: 'day' },
  },
  {
    value: 'mapbox://styles/mapbox/standard-dawn',
    label: 'Standard (Dawn)',
    config: { lightPreset: 'dawn' },
  },
  {
    value: 'mapbox://styles/mapbox/standard-dusk',
    label: 'Standard (Dusk)',
    config: { lightPreset: 'dusk' },
  },
  {
    value: 'mapbox://styles/mapbox/standard-night',
    label: 'Standard (Night)',
    config: { lightPreset: 'night' },
  },
  { value: 'mapbox://styles/mapbox/streets-v12', label: 'Streets' },
  { value: 'mapbox://styles/mapbox/outdoors-v12', label: 'Outdoors' },
  { value: 'mapbox://styles/mapbox/light-v11', label: 'Light' },
  { value: 'mapbox://styles/mapbox/dark-v11', label: 'Dark' },
  { value: 'mapbox://styles/mapbox/satellite-v9', label: 'Satellite' },
  { value: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'Satellite Streets' },
  { value: 'mapbox://styles/mapbox/navigation-day-v1', label: 'Navigation Day' },
  { value: 'mapbox://styles/mapbox/navigation-night-v1', label: 'Navigation Night' },
  // Google Maps styles
  { value: 'google-roadmap', label: '🗺️ Google Roadmap', isGoogle: true },
  { value: 'google-satellite', label: '🛰️ Google Satellite', isGoogle: true },
  { value: 'google-hybrid', label: '🌐 Google Hybrid', isGoogle: true },
  { value: 'google-terrain', label: '⛰️ Google Terrain', isGoogle: true },
  // Google embedded views
  { value: 'google-street-view', label: '🚶 Google Street View', isGoogle: true },
  { value: 'google-earth', label: '🌍 Export to Google Earth', isGoogle: true },
] as const;
