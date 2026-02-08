export interface WigleSearchParams {
  ssid: string;
  bssid: string;
  latrange1: string;
  latrange2: string;
  longrange1: string;
  longrange2: string;
  country: string;
  region: string;
  city: string;
}

export interface WigleApiStatus {
  configured: boolean;
  username?: string;
  error?: string;
}

export interface WigleNetworkResult {
  bssid: string;
  ssid: string;
  trilat: number;
  trilong: number;
  type: string;
  encryption: string;
  channel: number;
  firsttime: string;
  lasttime: string;
  country: string;
  region: string;
  city: string;
  road: string;
  housenumber: string;
  postalcode: string;
  freenet: string;
  paynet: string;
  userfound: boolean;
}

export interface WigleSearchResults {
  ok: boolean;
  totalResults: number;
  resultCount: number;
  searchAfter: string | null;
  hasMore: boolean;
  results?: WigleNetworkResult[];
  imported?: { count: number; errors: Array<{ bssid: string; error: string }> } | null;
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
  s3?: {
    bucket: string;
    key: string;
    url: string;
  };
  s3Error?: string;
}

export interface PgAdminStatus {
  enabled: boolean;
  dockerAvailable: boolean;
  composeFile: string;
  composeFileExists: boolean;
  serviceName: string;
  containerName: string;
  volumeName: string;
  port: number;
  url: string;
  container: {
    exists: boolean;
    running: boolean;
    status: string;
    ports: string;
    id: string;
    name: string;
  };
  error?: string;
}

export interface GeocodingStats {
  precision: number;
  observation_count: number;
  unique_blocks: number;
  cached_blocks: number;
  cached_with_address: number;
  cached_with_poi: number;
  distinct_addresses: number;
  missing_blocks: number;
  providers: Record<string, number>;
}

export interface GeocodingRunResult {
  precision: number;
  mode: string;
  provider: string;
  processed: number;
  successful: number;
  poiHits: number;
  rateLimited: number;
  durationMs: number;
}

export interface AwsInstanceSummary {
  instanceId: string | null;
  name: string | null;
  state: string | null;
  instanceType: string | null;
  availabilityZone: string | null;
  publicIp: string | null;
  privateIp: string | null;
  launchTime: string | null;
}

export interface AwsOverview {
  configured: boolean;
  region: string | null;
  identity: {
    account: string | null;
    arn: string | null;
    userId: string | null;
  } | null;
  counts: {
    total: number;
    states: Record<string, number>;
  };
  instances: AwsInstanceSummary[];
  error?: string;
}
