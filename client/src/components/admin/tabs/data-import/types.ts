export interface Metrics {
  networks: number;
  observations: number;
  in_explorer_mv: number;
  kismet_devices?: number;
  kismet_packets?: number;
  kismet_alerts?: number;
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
