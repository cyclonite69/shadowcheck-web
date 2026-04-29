export type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MED' | 'LOW' | 'NONE';

export interface NetworkListItem {
  bssid: string;
  ssid: string;
  observed_at: Date | null;
  signal: number | null;
  lat: number | null;
  lon: number | null;
  observations: number;
  first_seen: Date | null;
  last_seen: Date | null;
  frequency: number | null;
  capabilities: string | null;
  accuracy_meters: number | null;
  threat_score: number;
  threat_level: ThreatLevel;
  model_version: string;
}

export interface NetworkListResult {
  total: number;
  rows: NetworkListItem[];
}

export interface NetworkDetailRow {
  bssid: string;
  ssid: string | null;
  lat: number | null;
  lon: number | null;
  signal: number | null;
  accuracy: number | null;
  observed_at: Date | null;
  frequency: number | null;
  capabilities: string | null;
  altitude: number | null;
}

export interface TimelineRow {
  bucket: Date;
  obs_count: string;
  avg_signal: number | null;
  min_signal: number | null;
  max_signal: number | null;
}

export interface ThreatDataRow {
  bssid: string;
  final_threat_score: number | null;
  final_threat_level: ThreatLevel | null;
  model_version: string | null;
  ml_threat_probability: number | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface NetworkDetail {
  latest: NetworkDetailRow | null;
  timeline: TimelineRow[];
  threat: ThreatDataRow | null;
  observation_count: number;
  first_seen: Date | null;
  last_seen: Date | null;
}

export interface DashboardMetrics {
  networks: { total: number; hidden: number; wifi: number };
  threats: { critical: number; high: number; medium: number; low: number };
  observations: number;
  ssid_history: number;
  enriched: null;
  surveillance: null;
}

export interface ThreatMapRow {
  bssid: string;
  ssid: string | null;
  severity: string | null;
  threat_score: number | null;
  first_seen: Date | null;
  last_seen: Date | null;
  lat: number | null;
  lon: number | null;
  observation_count: number;
}

export interface ObservationMapRow {
  bssid: string;
  lat: number | null;
  lon: number | null;
  observed_at: Date | null;
  rssi: number | null;
  severity: string | null;
}

export interface ThreatMapResult {
  threats: ThreatMapRow[];
  observations: ObservationMapRow[];
  meta: {
    severity: string;
    days: number;
    threat_count: number | null;
    observation_count: number | null;
    model_version: string;
  };
}

export interface SeverityCounts {
  critical: { unique_networks: number; total_observations: number };
  high: { unique_networks: number; total_observations: number };
  medium: { unique_networks: number; total_observations: number };
  low: { unique_networks: number; total_observations: number };
  none: { unique_networks: number; total_observations: number };
}
