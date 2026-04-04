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
