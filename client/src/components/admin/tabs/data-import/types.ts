export interface Metrics {
  networks?: number | null;
  observations?: number | null;
  in_explorer_mv?: number | null;
  kismet_devices?: number | null;
  kismet_packets?: number | null;
  kismet_alerts?: number | null;
  kml_files?: number | null;
  kml_points?: number | null;
}

export interface DataImportResult {
  ok: boolean;
  imported?: number;
  failed?: number;
  filesImported?: number;
  pointsImported?: number;
  batchId?: string;
  sourceType?: string;
  uploadedToS3?: boolean;
  message?: string;
  error?: string;
  output?: string;
  errorOutput?: string;
  backupTaken?: boolean;
  durationSec?: string | number;
  importType?: string;
  sourceTag?: string;
  source_tag?: string;
  metricsBefore?: Metrics | null;
  metricsAfter?: Metrics | null;
}

export interface OrphanNetworkRow {
  bssid: string;
  ssid: string;
  type: string | null;
  frequency: number | null;
  capabilities: string | null;
  source_device: string | null;
  lasttime_ms: number | null;
  lastlat: number | null;
  lastlon: number | null;
  bestlevel: number | null;
  bestlat: number | null;
  bestlon: number | null;
  unique_days: number | null;
  unique_locations: number | null;
  is_sentinel: boolean | null;
  wigle_v3_observation_count: number | null;
  wigle_v3_last_import_at: string | null;
  moved_at: string;
  move_reason: string;
}
