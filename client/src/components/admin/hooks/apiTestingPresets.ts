type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiInput {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'select';
  options?: string[];
}

export interface ApiPreset {
  group: string;
  label: string;
  path: string;
  method: HttpMethod;
  inputs?: ApiInput[];
  defaultBody?: string;
}

export { HttpMethod };

export const API_PRESETS: ApiPreset[] = [
  { group: 'Health & Core', label: 'Health', path: '/health', method: 'GET' },
  { group: 'Health & Core', label: 'API Health', path: '/api/health', method: 'GET' },
  { group: 'Health & Core', label: 'App Settings', path: '/api/settings', method: 'GET' },
  {
    group: 'Health & Core',
    label: 'Settings Inventory',
    path: '/api/settings/list',
    method: 'GET',
  },

  { group: 'Auth', label: 'Auth Me', path: '/api/auth/me', method: 'GET' },
  { group: 'Auth', label: 'Auth Logout', path: '/api/auth/logout', method: 'POST' },

  { group: 'Public Reference', label: 'Agency Offices', path: '/agency-offices', method: 'GET' },
  {
    group: 'Public Reference',
    label: 'Agency Offices Count',
    path: '/agency-offices/count',
    method: 'GET',
  },
  {
    group: 'Public Reference',
    label: 'Federal Courthouses',
    path: '/federal-courthouses',
    method: 'GET',
  },

  { group: 'Geospatial', label: 'Mapbox Token', path: '/api/mapbox-token', method: 'GET' },
  {
    group: 'Geospatial',
    label: 'Mapbox Style',
    path: '/api/mapbox-style',
    method: 'GET',
    inputs: [{ name: 'style', label: 'Style', defaultValue: 'satellite' }],
  },
  {
    group: 'Geospatial',
    label: 'Mapbox Proxy',
    path: '/api/mapbox-proxy',
    method: 'GET',
    inputs: [{ name: 'url', label: 'Mapbox URL', placeholder: 'mapbox://styles/...' }],
  },
  {
    group: 'Geospatial',
    label: 'Google Maps Token',
    path: '/api/google-maps-token',
    method: 'GET',
  },
  { group: 'Geospatial', label: 'Home Location', path: '/api/home-location', method: 'GET' },
  {
    group: 'Geospatial',
    label: 'Home Location Debug',
    path: '/api/home-location/debug',
    method: 'GET',
  },
  { group: 'Geospatial', label: 'Location Markers', path: '/api/location-markers', method: 'GET' },

  {
    group: 'Networks v2',
    label: 'Networks List (v2)',
    path: '/api/v2/networks',
    method: 'GET',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '10', type: 'number' },
      { name: 'offset', label: 'Offset', defaultValue: '0', type: 'number' },
      { name: 'search', label: 'Search', placeholder: 'SSID/BSSID' },
      {
        name: 'sort',
        label: 'Sort',
        defaultValue: 'observed_at',
        type: 'select',
        options: ['observed_at', 'signal', 'threat_score', 'observations'],
      },
    ],
  },
  {
    group: 'Networks v2',
    label: 'Network Details (v2)',
    path: '/api/v2/networks/:bssid',
    method: 'GET',
    inputs: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22:33:44:55' }],
  },
  {
    group: 'Networks v2',
    label: 'Dashboard Metrics (v2)',
    path: '/api/v2/dashboard/metrics',
    method: 'GET',
  },
  {
    group: 'Networks v2',
    label: 'Universal Filter: List',
    path: '/api/v2/networks/filtered',
    method: 'GET',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '10', type: 'number' },
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{"ssid":""}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{"ssid":false}' },
    ],
  },
  {
    group: 'Networks v2',
    label: 'Universal Filter: Geo',
    path: '/api/v2/networks/filtered/geospatial',
    method: 'GET',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '100', type: 'number' },
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{}' },
    ],
  },
  {
    group: 'Networks v2',
    label: 'Universal Filter: Observations',
    path: '/api/v2/networks/filtered/observations',
    method: 'GET',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '100', type: 'number' },
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{}' },
    ],
  },
  {
    group: 'Networks v2',
    label: 'Universal Filter: Debug',
    path: '/api/v2/networks/filtered/debug',
    method: 'GET',
    inputs: [
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{}' },
    ],
  },

  {
    group: 'Threats & Analytics',
    label: 'Threat Map (v2)',
    path: '/api/v2/threats/map',
    method: 'GET',
    inputs: [
      { name: 'days', label: 'Days', defaultValue: '30', type: 'number' },
      {
        name: 'severity',
        label: 'Severity',
        defaultValue: 'all',
        type: 'select',
        options: ['all', 'critical', 'high', 'med', 'low'],
      },
    ],
  },
  {
    group: 'Threats & Analytics',
    label: 'Threat Severity Counts',
    path: '/api/v2/threats/severity-counts',
    method: 'GET',
  },
  {
    group: 'Threats & Analytics',
    label: 'Threat Detection (v1)',
    path: '/api/threats/detect',
    method: 'GET',
  },
  {
    group: 'Threats & Analytics',
    label: 'Dashboard Metrics (v1)',
    path: '/api/dashboard/metrics',
    method: 'GET',
  },
  {
    group: 'Threats & Analytics',
    label: 'Dashboard Threats (v1)',
    path: '/api/dashboard/threats',
    method: 'GET',
  },
  {
    group: 'Threats & Analytics',
    label: 'Dashboard Summary (v1)',
    path: '/api/dashboard/summary',
    method: 'GET',
  },
  {
    group: 'Threats & Analytics',
    label: 'Set Network Tag',
    path: '/api/network-tags/:bssid/threat',
    method: 'POST',
    inputs: [
      { name: 'bssid', label: 'BSSID', placeholder: '00:11:22...' },
      {
        name: 'threat_tag',
        label: 'Tag',
        defaultValue: 'SUSPECT',
        type: 'select',
        options: ['THREAT', 'SUSPECT', 'FALSE_POSITIVE', 'INVESTIGATE'],
      },
    ],
    defaultBody: '{\n  "threat_tag": "SUSPECT",\n  "threat_confidence": 0.7\n}',
  },
  {
    group: 'Threats & Analytics',
    label: 'Analytics: Filtered',
    path: '/api/v2/networks/filtered/analytics',
    method: 'GET',
    inputs: [
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{}' },
    ],
  },
  {
    group: 'Threats & Analytics',
    label: 'Analytics: Legacy Dashboard',
    path: '/api/analytics/dashboard',
    method: 'GET',
  },
  {
    group: 'Threats & Analytics',
    label: 'Threat Report',
    path: '/api/threat-report',
    method: 'GET',
  },

  { group: 'WiGLE', label: 'WiGLE Status', path: '/api/wigle/api-status', method: 'GET' },
  {
    group: 'WiGLE',
    label: 'WiGLE Search',
    path: '/api/wigle/search',
    method: 'GET',
    inputs: [
      { name: 'ssid', label: 'SSID', placeholder: 'Network Name' },
      { name: 'bssid', label: 'BSSID', placeholder: '00:11:22...' },
    ],
  },
  {
    group: 'WiGLE',
    label: 'WiGLE Detail & Import',
    path: '/api/wigle/detail/:netid',
    method: 'POST',
    inputs: [
      { name: 'netid', label: 'Network ID', placeholder: '00:11:22:33:44:55' },
      {
        name: 'import',
        label: 'Import?',
        defaultValue: 'false',
        type: 'select',
        options: ['true', 'false'],
      },
    ],
    defaultBody: '{\n  "import": false\n}',
  },
  {
    group: 'WiGLE',
    label: 'WiGLE BT Detail & Import',
    path: '/api/wigle/detail/bt/:netid',
    method: 'POST',
    inputs: [
      { name: 'netid', label: 'BT Network ID', placeholder: 'EC:81:93:76:BD:CE' },
      {
        name: 'import',
        label: 'Import?',
        defaultValue: 'false',
        type: 'select',
        options: ['true', 'false'],
      },
    ],
    defaultBody: '{\n  "import": false\n}',
  },
  { group: 'WiGLE', label: 'WiGLE User Stats', path: '/api/wigle/user-stats', method: 'GET' },
  {
    group: 'WiGLE',
    label: 'WiGLE Import Runs',
    path: '/api/wigle/search-api/import-runs',
    method: 'GET',
  },
  {
    group: 'WiGLE',
    label: 'WiGLE Import Completeness',
    path: '/api/wigle/search-api/import-runs/completeness/summary',
    method: 'GET',
  },
  {
    group: 'WiGLE',
    label: 'WiGLE Resume Latest',
    path: '/api/wigle/search-api/import-runs/resume-latest',
    method: 'POST',
  },

  { group: 'Machine Learning', label: 'ML Status', path: '/api/ml/status', method: 'GET' },
  {
    group: 'Machine Learning',
    label: 'ML Score All',
    path: '/api/ml/score-all',
    method: 'POST',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '100', type: 'number' },
      {
        name: 'overwrite_final',
        label: 'Overwrite?',
        defaultValue: 'true',
        type: 'select',
        options: ['true', 'false'],
      },
    ],
    defaultBody: '{\n  "limit": 100,\n  "overwrite_final": true\n}',
  },
  {
    group: 'Machine Learning',
    label: 'ML Train',
    path: '/api/ml/train',
    method: 'POST',
    defaultBody: '{\n  "limit": 1000\n}',
  },
  {
    group: 'Machine Learning',
    label: 'ML Scores by BSSID',
    path: '/api/ml/scores/:bssid',
    method: 'GET',
    inputs: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22:33:44:55' }],
  },

  {
    group: 'Exports',
    label: 'Export CSV',
    path: '/api/csv',
    method: 'GET',
    inputs: [{ name: 'limit', label: 'Limit', defaultValue: '100' }],
  },
  { group: 'Exports', label: 'Export JSON', path: '/api/json', method: 'GET' },
  { group: 'Exports', label: 'Export Full JSON', path: '/api/json/full', method: 'GET' },
  { group: 'Exports', label: 'Export GeoJSON', path: '/api/geojson', method: 'GET' },
  { group: 'Exports', label: 'Export KML', path: '/api/kml', method: 'GET' },

  {
    group: 'Admin Import',
    label: 'Import History',
    path: '/api/admin/import-history',
    method: 'GET',
  },
  {
    group: 'Admin Import',
    label: 'Device Sources',
    path: '/api/admin/device-sources',
    method: 'GET',
  },
  {
    group: 'Admin Import',
    label: 'Orphan Networks',
    path: '/api/admin/orphan-networks',
    method: 'GET',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '100', type: 'number' },
      { name: 'offset', label: 'Offset', defaultValue: '0', type: 'number' },
      { name: 'search', label: 'Search', placeholder: 'SSID/BSSID' },
    ],
  },
  {
    group: 'Admin Import',
    label: 'Orphan Check WiGLE',
    path: '/api/admin/orphan-networks/:bssid/check-wigle',
    method: 'POST',
    inputs: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22:33:44:55' }],
  },

  { group: 'Admin System', label: 'Admin Test', path: '/api/admin/test', method: 'GET' },
  {
    group: 'Admin System',
    label: 'Admin Runtime Settings',
    path: '/api/admin/settings/runtime',
    method: 'GET',
  },
  {
    group: 'Admin System',
    label: 'Admin Jobs Status',
    path: '/api/admin/settings/jobs/status',
    method: 'GET',
  },
  { group: 'Admin System', label: 'Admin DB Stats', path: '/api/admin/db-stats', method: 'GET' },
  {
    group: 'Admin System',
    label: 'PgAdmin Status',
    path: '/api/admin/pgadmin/status',
    method: 'GET',
  },
  {
    group: 'Admin System',
    label: 'Geocoding Stats',
    path: '/api/admin/geocoding/stats',
    method: 'GET',
  },
  {
    group: 'Admin System',
    label: 'Geocoding Daemon',
    path: '/api/admin/geocoding/daemon',
    method: 'GET',
  },
  {
    group: 'Admin System',
    label: 'Backup Inventory (S3)',
    path: '/api/admin/backup/s3',
    method: 'GET',
  },
  { group: 'Admin System', label: 'AWS Overview', path: '/api/admin/aws/overview', method: 'GET' },
  { group: 'Admin System', label: 'Admin Users', path: '/api/admin/users', method: 'GET' },

  {
    group: 'Admin Analysis',
    label: 'Sibling Refresh Status',
    path: '/api/admin/siblings/refresh/status',
    method: 'GET',
  },
  {
    group: 'Admin Analysis',
    label: 'Sibling Stats',
    path: '/api/admin/siblings/stats',
    method: 'GET',
  },
  {
    group: 'Admin Analysis',
    label: 'Sibling Linked',
    path: '/api/admin/siblings/linked/:bssid',
    method: 'GET',
    inputs: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22:33:44:55' }],
  },
  { group: 'Admin Analysis', label: 'OUI Groups', path: '/api/admin/oui/groups', method: 'GET' },
  {
    group: 'Admin Analysis',
    label: 'OUI Details',
    path: '/api/admin/oui/:oui/details',
    method: 'GET',
    inputs: [{ name: 'oui', label: 'OUI', placeholder: 'AABBCC' }],
  },
  {
    group: 'Admin Analysis',
    label: 'Randomization Suspects',
    path: '/api/admin/oui/randomization/suspects',
    method: 'GET',
  },
];
