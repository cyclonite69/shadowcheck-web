/**
 * Shared color palettes used across analytics, badges, and geospatial components.
 * Extracted from analytics to avoid pulling the analytics chunk into other pages.
 */

/** Color palette keyed by network type label (WiFi, BLE, BT, LTE, GSM, NR). */
export const NETWORK_TYPE_COLORS: Record<string, string> = {
  WiFi: '#3b82f6',
  BLE: '#8b5cf6',
  BT: '#06b6d4',
  LTE: '#ec4899',
  GSM: '#f59e0b',
  NR: '#10b981',
};

/**
 * Color palette keyed by canonical security label.
 */
export const SECURITY_TYPE_COLORS: Record<string, string> = {
  'WPA3-E': '#059669',
  'WPA3-P': '#34d399',
  WPA3: '#10b981',
  'WPA2-E': '#2563eb',
  'WPA2-P': '#60a5fa',
  WPA2: '#3b82f6',
  WPA: '#06b6d4',
  OWE: '#8b5cf6',
  WPS: '#f97316',
  WEP: '#ef4444',
  OPEN: '#f59e0b',
  UNKNOWN: '#64748b',
};
