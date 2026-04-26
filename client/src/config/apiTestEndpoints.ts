/**
 * Canonical API endpoint registry for the Admin API Testing tab.
 *
 * Every new backend route MUST get an entry here before the PR is merged.
 * The ApiTestingTab renders entirely from this config — there is no hardcoded markup.
 */

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiInput {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'select';
  options?: string[];
}

export interface ApiEndpointConfig {
  category: string;
  label: string;
  description?: string;
  method: HttpMethod;
  path: string;
  params?: ApiInput[];
  requiresAuth?: boolean;
  defaultBody?: string;
}

export type { HttpMethod };

export const API_ENDPOINTS: ApiEndpointConfig[] = [
  // ── Health & Core ─────────────────────────────────────────────────────────
  { category: 'Health & Core', label: 'Health', path: '/health', method: 'GET' },
  { category: 'Health & Core', label: 'API Health', path: '/api/health', method: 'GET' },
  { category: 'Health & Core', label: 'App Settings', path: '/api/settings', method: 'GET' },
  {
    category: 'Health & Core',
    label: 'Settings Inventory',
    path: '/api/settings/list',
    method: 'GET',
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  { category: 'Auth', label: 'Auth Me', path: '/api/auth/me', method: 'GET', requiresAuth: true },
  {
    category: 'Auth',
    label: 'Auth Logout',
    path: '/api/auth/logout',
    method: 'POST',
    requiresAuth: true,
  },

  // ── Public Reference ──────────────────────────────────────────────────────
  {
    category: 'Public Reference',
    label: 'Agency Offices',
    path: '/agency-offices',
    method: 'GET',
  },
  {
    category: 'Public Reference',
    label: 'Agency Offices Count',
    path: '/agency-offices/count',
    method: 'GET',
  },
  {
    category: 'Public Reference',
    label: 'Federal Courthouses',
    path: '/federal-courthouses',
    method: 'GET',
  },

  // ── Geospatial ────────────────────────────────────────────────────────────
  { category: 'Geospatial', label: 'Mapbox Token', path: '/api/mapbox-token', method: 'GET' },
  {
    category: 'Geospatial',
    label: 'Mapbox Style',
    path: '/api/mapbox-style',
    method: 'GET',
    params: [{ name: 'style', label: 'Style', defaultValue: 'satellite' }],
  },
  {
    category: 'Geospatial',
    label: 'Mapbox Proxy',
    path: '/api/mapbox-proxy',
    method: 'GET',
    params: [{ name: 'url', label: 'Mapbox URL', placeholder: 'mapbox://styles/...' }],
  },
  {
    category: 'Geospatial',
    label: 'Google Maps Token',
    path: '/api/google-maps-token',
    method: 'GET',
  },
  { category: 'Geospatial', label: 'Home Location', path: '/api/home-location', method: 'GET' },
  {
    category: 'Geospatial',
    label: 'Home Location Debug',
    path: '/api/home-location/debug',
    method: 'GET',
  },
  {
    category: 'Geospatial',
    label: 'Location Markers',
    path: '/api/location-markers',
    method: 'GET',
  },

  // ── Networks v2 ───────────────────────────────────────────────────────────
  {
    category: 'Networks v2',
    label: 'Networks List (v2)',
    path: '/api/v2/networks',
    method: 'GET',
    params: [
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
    category: 'Networks v2',
    label: 'Network Details (v2)',
    path: '/api/v2/networks/:bssid',
    method: 'GET',
    params: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22:33:44:55' }],
  },
  {
    category: 'Networks v2',
    label: 'Dashboard Metrics (v2)',
    path: '/api/v2/dashboard/metrics',
    method: 'GET',
  },
  {
    category: 'Networks v2',
    label: 'Universal Filter: List',
    path: '/api/v2/networks/filtered',
    method: 'GET',
    params: [
      { name: 'limit', label: 'Limit', defaultValue: '10', type: 'number' },
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{"ssid":""}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{"ssid":false}' },
    ],
  },
  {
    category: 'Networks v2',
    label: 'Universal Filter: Geo',
    path: '/api/v2/networks/filtered/geospatial',
    method: 'GET',
    params: [
      { name: 'limit', label: 'Limit', defaultValue: '100', type: 'number' },
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{}' },
    ],
  },
  {
    category: 'Networks v2',
    label: 'Universal Filter: Observations',
    path: '/api/v2/networks/filtered/observations',
    method: 'GET',
    params: [
      { name: 'limit', label: 'Limit', defaultValue: '100', type: 'number' },
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{}' },
    ],
  },
  {
    category: 'Networks v2',
    label: 'Universal Filter: Debug',
    path: '/api/v2/networks/filtered/debug',
    method: 'GET',
    params: [
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{}' },
    ],
  },

  // ── Threats & Analytics ───────────────────────────────────────────────────
  {
    category: 'Threats & Analytics',
    label: 'Threat Map (v2)',
    path: '/api/v2/threats/map',
    method: 'GET',
    params: [
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
    category: 'Threats & Analytics',
    label: 'Threat Severity Counts',
    path: '/api/v2/threats/severity-counts',
    method: 'GET',
  },
  {
    category: 'Threats & Analytics',
    label: 'Threat Detection (v1)',
    path: '/api/threats/detect',
    method: 'GET',
  },
  {
    category: 'Threats & Analytics',
    label: 'Dashboard Metrics (v1)',
    path: '/api/dashboard/metrics',
    method: 'GET',
  },
  {
    category: 'Threats & Analytics',
    label: 'Dashboard Threats (v1)',
    path: '/api/dashboard/threats',
    method: 'GET',
  },
  {
    category: 'Threats & Analytics',
    label: 'Dashboard Summary (v1)',
    path: '/api/dashboard/summary',
    method: 'GET',
  },
  {
    category: 'Threats & Analytics',
    label: 'Set Network Tag',
    path: '/api/network-tags/:bssid/threat',
    method: 'POST',
    requiresAuth: true,
    params: [
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
    category: 'Threats & Analytics',
    label: 'Analytics: Filtered',
    path: '/api/v2/networks/filtered/analytics',
    method: 'GET',
    params: [
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{}' },
    ],
  },
  {
    category: 'Threats & Analytics',
    label: 'Analytics: Legacy Dashboard',
    path: '/api/analytics/dashboard',
    method: 'GET',
  },
  {
    category: 'Threats & Analytics',
    label: 'Threat Report',
    path: '/api/threat-report',
    method: 'GET',
  },

  // ── WiGLE ─────────────────────────────────────────────────────────────────
  { category: 'WiGLE', label: 'WiGLE Status', path: '/api/wigle/api-status', method: 'GET' },
  {
    category: 'WiGLE',
    label: 'WiGLE Search',
    path: '/api/wigle/search',
    method: 'GET',
    params: [
      { name: 'ssid', label: 'SSID', placeholder: 'Network Name' },
      { name: 'bssid', label: 'BSSID', placeholder: '00:11:22...' },
    ],
  },
  {
    category: 'WiGLE',
    label: 'WiGLE Detail & Import',
    path: '/api/wigle/detail/:netid',
    method: 'POST',
    params: [
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
    category: 'WiGLE',
    label: 'WiGLE BT Detail & Import',
    path: '/api/wigle/detail/bt/:netid',
    method: 'POST',
    params: [
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
  {
    category: 'WiGLE',
    label: 'WiGLE User Stats',
    path: '/api/wigle/user-stats',
    method: 'GET',
  },
  {
    category: 'WiGLE',
    label: 'WiGLE Import Runs',
    path: '/api/wigle/search-api/import-runs',
    method: 'GET',
  },
  {
    category: 'WiGLE',
    label: 'WiGLE Import Completeness',
    path: '/api/wigle/search-api/import-runs/completeness/summary',
    method: 'GET',
  },
  {
    category: 'WiGLE',
    label: 'WiGLE Resume Latest',
    path: '/api/wigle/search-api/import-runs/resume-latest',
    method: 'POST',
  },
  {
    category: 'WiGLE',
    label: 'Aggregated Observations',
    description:
      'Zoom-aware spatial aggregation across active sources. Returns GeoJSON FeatureCollection of grid-cell centroids.',
    path: '/api/wigle/observations/aggregated',
    method: 'GET',
    params: [
      { name: 'west', label: 'West', defaultValue: '-125', type: 'number' },
      { name: 'south', label: 'South', defaultValue: '24', type: 'number' },
      { name: 'east', label: 'East', defaultValue: '-66', type: 'number' },
      { name: 'north', label: 'North', defaultValue: '50', type: 'number' },
      { name: 'zoom', label: 'Zoom', defaultValue: '5', type: 'number' },
      {
        name: 'sources',
        label: 'Sources',
        defaultValue: 'wigle-v2,wigle-v3,field,kml',
        placeholder: 'wigle-v2,wigle-v3,field,kml',
      },
    ],
  },
  {
    category: 'WiGLE',
    label: 'Observations Extent',
    description:
      'Returns ST_Extent bounding box across active sources. Used by the Fit Bounds button to fly the map to data.',
    path: '/api/wigle/observations/extent',
    method: 'GET',
    params: [
      {
        name: 'sources',
        label: 'Sources',
        defaultValue: 'wigle-v2,wigle-v3,field,kml',
        placeholder: 'wigle-v2,wigle-v3,field,kml',
      },
    ],
  },

  {
    category: 'WiGLE',
    label: 'KML BSSID Summary',
    description:
      'Aggregate kml_points stats for a single BSSID — observation count, first/last seen, timespan days.',
    path: '/api/wigle/kml-bssid-summary',
    method: 'GET',
    params: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22:33:44:55' }],
  },

  // ── Machine Learning ──────────────────────────────────────────────────────
  { category: 'Machine Learning', label: 'ML Status', path: '/api/ml/status', method: 'GET' },
  {
    category: 'Machine Learning',
    label: 'ML Score All',
    path: '/api/ml/score-all',
    method: 'POST',
    requiresAuth: true,
    params: [
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
    category: 'Machine Learning',
    label: 'ML Train',
    path: '/api/ml/train',
    method: 'POST',
    requiresAuth: true,
    defaultBody: '{\n  "limit": 1000\n}',
  },
  {
    category: 'Machine Learning',
    label: 'ML Scores by BSSID',
    path: '/api/ml/scores/:bssid',
    method: 'GET',
    params: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22:33:44:55' }],
  },

  // ── Exports ───────────────────────────────────────────────────────────────
  {
    category: 'Exports',
    label: 'Export CSV',
    path: '/api/csv',
    method: 'GET',
    params: [{ name: 'limit', label: 'Limit', defaultValue: '100' }],
  },
  { category: 'Exports', label: 'Export JSON', path: '/api/json', method: 'GET' },
  { category: 'Exports', label: 'Export Full JSON', path: '/api/json/full', method: 'GET' },
  { category: 'Exports', label: 'Export GeoJSON', path: '/api/geojson', method: 'GET' },
  { category: 'Exports', label: 'Export KML', path: '/api/kml', method: 'GET' },

  // ── Admin Import ──────────────────────────────────────────────────────────
  {
    category: 'Admin Import',
    label: 'Import History',
    path: '/api/admin/import-history',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin Import',
    label: 'Device Sources',
    path: '/api/admin/device-sources',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin Import',
    label: 'Orphan Networks',
    path: '/api/admin/orphan-networks',
    method: 'GET',
    requiresAuth: true,
    params: [
      { name: 'limit', label: 'Limit', defaultValue: '100', type: 'number' },
      { name: 'offset', label: 'Offset', defaultValue: '0', type: 'number' },
      { name: 'search', label: 'Search', placeholder: 'SSID/BSSID' },
    ],
  },
  {
    category: 'Admin Import',
    label: 'Orphan Check WiGLE',
    path: '/api/admin/orphan-networks/:bssid/check-wigle',
    method: 'POST',
    requiresAuth: true,
    params: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22:33:44:55' }],
  },

  // ── Admin System ──────────────────────────────────────────────────────────
  {
    category: 'Admin System',
    label: 'Admin Test',
    path: '/api/admin/test',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin System',
    label: 'Admin Runtime Settings',
    path: '/api/admin/settings/runtime',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin System',
    label: 'Admin Jobs Status',
    path: '/api/admin/settings/jobs/status',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin System',
    label: 'Admin DB Stats',
    path: '/api/admin/db-stats',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin System',
    label: 'PgAdmin Status',
    path: '/api/admin/pgadmin/status',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin System',
    label: 'Geocoding Stats',
    path: '/api/admin/geocoding/stats',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin System',
    label: 'Geocoding Daemon',
    path: '/api/admin/geocoding/daemon',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin System',
    label: 'Backup Inventory (S3)',
    path: '/api/admin/backup/s3',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin System',
    label: 'AWS Overview',
    path: '/api/admin/aws/overview',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin System',
    label: 'Admin Users',
    path: '/api/admin/users',
    method: 'GET',
    requiresAuth: true,
  },

  // ── Admin Analysis ────────────────────────────────────────────────────────
  {
    category: 'Admin Analysis',
    label: 'Sibling Refresh Status',
    path: '/api/admin/siblings/refresh/status',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin Analysis',
    label: 'Sibling Stats',
    path: '/api/admin/siblings/stats',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin Analysis',
    label: 'Sibling Linked',
    path: '/api/admin/siblings/linked/:bssid',
    method: 'GET',
    requiresAuth: true,
    params: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22:33:44:55' }],
  },
  {
    category: 'Admin Analysis',
    label: 'OUI Groups',
    path: '/api/admin/oui/groups',
    method: 'GET',
    requiresAuth: true,
  },
  {
    category: 'Admin Analysis',
    label: 'OUI Details',
    path: '/api/admin/oui/:oui/details',
    method: 'GET',
    requiresAuth: true,
    params: [{ name: 'oui', label: 'OUI', placeholder: 'AABBCC' }],
  },
  {
    category: 'Admin Analysis',
    label: 'Randomization Suspects',
    path: '/api/admin/oui/randomization/suspects',
    method: 'GET',
    requiresAuth: true,
  },
];
