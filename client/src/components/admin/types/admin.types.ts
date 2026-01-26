export interface WigleSearchParams {
  ssid: string;
  bssid: string;
  latrange1: string;
  latrange2: string;
  longrange1: string;
  longrange2: string;
}

export interface WigleApiStatus {
  configured: boolean;
  username?: string;
  error?: string;
}

export interface WigleSearchResults {
  ok: boolean;
  resultCount: number;
  imported?: number;
  error?: string;
}

export interface MLStatus {
  modelTrained: boolean;
  taggedNetworks: Array<{
    tag_type: string;
    count: number;
  }>;
  modelInfo?: {
    updated_at: string;
  };
}

export interface ApiHealth {
  status: string;
  version: string;
}

export interface BackupResult {
  backupDir: string;
  fileName: string;
  filePath: string;
  bytes: number;
}
