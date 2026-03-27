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
  version?: 'v2' | 'v3';
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
  loadedCount?: number;
  pagesProcessed?: number;
  results?: WigleNetworkResult[];
  importedCount?: number;
  importErrors?: Array<{ bssid: string; error: string }>;
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
  source?: {
    environment: string;
    hostname?: string;
    instanceId?: string;
  };
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
  dockerHost?: string;
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
  resolved_address_rows: number;
  cached_with_address: number;
  cached_with_poi: number;
  distinct_addresses: number;
  missing_blocks: number;
  pending_address_queue: number;
  attempted_without_address: number;
  recent_activity: number;
  last_activity_at?: string | null;
  providers: Record<string, number>;
  daemon?: GeocodingDaemonStatus | null;
  current_run?: GeocodingRunSnapshot | null;
  last_run?: GeocodingRunSnapshot | null;
  recent_runs?: GeocodingRunSnapshot[];
}

export interface GeocodingDaemonProviderConfig {
  provider: 'mapbox' | 'nominatim' | 'overpass' | 'opencage' | 'geocodio' | 'locationiq';
  mode?: 'address-only' | 'poi-only' | 'both';
  limit?: number;
  perMinute?: number;
  permanent?: boolean;
  enabled?: boolean;
}

export interface GeocodingDaemonConfig {
  provider: 'mapbox' | 'nominatim' | 'overpass' | 'opencage' | 'geocodio' | 'locationiq';
  mode: 'address-only' | 'poi-only' | 'both';
  limit: number;
  precision: number;
  perMinute: number;
  permanent?: boolean;
  loopDelayMs: number;
  idleSleepMs: number;
  errorSleepMs: number;
  providerCursor?: number;
  providers?: GeocodingDaemonProviderConfig[];
}

export interface GeocodingDaemonStatus {
  running: boolean;
  stopRequested: boolean;
  config: GeocodingDaemonConfig | null;
  startedAt?: string;
  lastTickAt?: string;
  lastResult?: GeocodingRunResult;
  lastError?: string;
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

export interface GeocodingRunSnapshot {
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  provider: string;
  mode: 'address-only' | 'poi-only' | 'both';
  precision: number;
  limit: number;
  perMinute: number;
  permanent?: boolean;
  result?: GeocodingRunResult;
  error?: string;
}

export interface GeocodingProviderProbeResult {
  sample: {
    lat: number;
    lon: number;
  };
  provider: string;
  mode: 'address-only' | 'poi-only' | 'both';
  permanent: boolean;
  result: {
    ok: boolean;
    address?: string | null;
    poiName?: string | null;
    poiCategory?: string | null;
    featureType?: string | null;
    city?: string | null;
    state?: string | null;
    postal?: string | null;
    country?: string | null;
    confidence?: number | null;
    error?: string | null;
    raw?: unknown;
  };
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
  warning?: string;
  error?: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  is_active: boolean;
  force_password_change: boolean;
  created_at: string | null;
  last_login: string | null;
}
