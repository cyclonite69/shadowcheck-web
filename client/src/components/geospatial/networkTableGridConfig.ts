export const NETWORK_TABLE_COLUMN_WIDTHS: Record<string, number> = {
  select: 40,
  type: 60,
  ssid: 150,
  bssid: 140,
  threat: 80,
  signal: 90,
  security: 100,
  observations: 110,
  distance: 100,
  maxDist: 100,
  threatScore: 110,
  frequency: 90,
  channel: 80,
  timespanDays: 100,
  manufacturer: 120,
  all_tags: 120,
  wigle_v3_observation_count: 90,
  wigle_v3_last_import_at: 140,
};

// Fine-tune header text alignment against body cells without breaking scroll sync.
export const NETWORK_TABLE_HEADER_X_OFFSET_PX = -8;

// Keep empty until we intentionally reintroduce sticky/frozen columns.
export const NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS: string[] = [];
