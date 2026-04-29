export interface SqliteLocationRow {
  _id: number;
  bssid: string;
  level: number;
  lat: number;
  lon: number;
  altitude: number;
  accuracy: number;
  time: number; // milliseconds since epoch
  external: number;
  mfgrid: number;
}

export interface SqliteNetworkRow {
  bssid: string;
  ssid: string;
  frequency: number;
  capabilities: string;
  lasttime: number;
  lastlat: number;
  lastlon: number;
  type: string;
  bestlevel: number;
  bestlat: number;
  bestlon: number;
  rcois: string;
  mfgrid: number;
  service: string;
}

export interface ValidatedObservation {
  source_pk: string;
  device_id: string;
  bssid: string;
  ssid: string | null;
  radio_type: string | null;
  radio_frequency: number | null;
  radio_capabilities: string | null;
  radio_service: string | null;
  radio_rcois: string | null;
  radio_lasttime_ms: number | null;
  level: number;
  lat: number;
  lon: number;
  altitude: number;
  accuracy: number;
  time: Date;
  time_ms: number;
  observed_at_ms: number;
  external: boolean;
  mfgrid: number;
  source_tag: string;
}

export interface BatchResult {
  inserted: number;
  failed: number;
  errors: string[];
}

export interface ImportSummary {
  imported: number;
  failed: number;
  durationS: number;
  speed: number;
  errors: string[];
}
