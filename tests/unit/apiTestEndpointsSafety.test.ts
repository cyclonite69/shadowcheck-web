import { API_ENDPOINTS } from '../../client/src/config/apiTestEndpoints';
import {
  AUTOMATED_API_PRESETS,
  MANUAL_API_PRESETS,
} from '../../client/src/components/admin/hooks/apiTestingPresets';

const MANUAL_ONLY_ROUTE_KEYS = [
  'GET /api/admin/aws/overview',
  'GET /api/admin/backup/s3',
  'GET /api/admin/db-stats',
  'GET /api/admin/device-sources',
  'GET /api/admin/geocoding/daemon',
  'GET /api/admin/geocoding/stats',
  'POST /api/admin/geocoding/test',
  'GET /api/admin/import-history',
  'GET /api/admin/kml-imports',
  'POST /api/admin/network-notations/add',
  'GET /api/admin/orphan-networks',
  'GET /api/admin/pgadmin/status',
  'GET /api/admin/secrets',
  'GET /api/admin/settings',
  'GET /api/admin/settings/:key',
  'GET /api/admin/settings/jobs/status',
  'GET /api/admin/settings/runtime',
  'GET /api/admin/siblings/refresh/status',
  'GET /api/admin/wigle-kml-sync/status',
  'GET /api/admin/wigle-kml-sync/transactions',
  'POST /api/auth/change-password',
  'POST /api/claude/analyze-networks',
  'PATCH /api/claude/insights/:id/useful',
  'GET /api/claude/test',
  'POST /api/geocode',
  'GET /api/google-maps-tile/:type/:z/:x/:y',
  'POST /api/import/wigle',
  'GET /api/mapbox-proxy',
  'GET /api/mapbox-style',
  'GET /api/settings/aws',
  'GET /api/settings/list',
  'GET /api/settings/mapbox',
  'GET /api/settings/smarty',
  'GET /api/settings/wigle',
  'GET /api/settings/wigle/test',
  'GET /api/wigle/live/:bssid',
  'DELETE /api/wigle/search-api/import-runs/:id',
  'DELETE /api/wigle/search-api/import-runs/cluster-cleanup',
  'POST /api/wigle/search-api/saved-ssid-terms',
  'DELETE /api/wigle/search-api/saved-ssid-terms/:id',
  'GET /api/wigle/user-stats',
  'GET /api/backup',
  'GET /api/geojson/full',
  'POST /api/networks/tag-threats',
  'POST /api/restore',
  'GET /api/settings/geocodio',
  'POST /api/settings/geocodio',
  'GET /api/settings/google-maps',
  'POST /api/settings/google-maps',
  'GET /api/settings/locationiq',
  'POST /api/settings/locationiq',
  'GET /api/settings/mapbox-unlimited',
  'POST /api/settings/mapbox-unlimited',
  'GET /api/settings/opencage',
  'POST /api/settings/opencage',
  'POST /api/tag-network',
  'DELETE /api/tag-network/:bssid',
  'GET /api/wigle/search-api',
  'POST /api/wigle/search-api',
  'POST /v1/ingest/complete',
  'POST /v1/ingest/request-upload',
] as const;

const normalizePath = (path: string): string =>
  path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

const routeKeyFor = (endpoint: (typeof API_ENDPOINTS)[number]): string =>
  `${endpoint.method} ${normalizePath(endpoint.path)}`;

describe('API test endpoint safety registry', () => {
  test.each(MANUAL_ONLY_ROUTE_KEYS)('%s is registered exactly once as manual-only', (routeKey) => {
    const separator = routeKey.indexOf(' ');
    const method = routeKey.slice(0, separator);
    const path = routeKey.slice(separator + 1);
    const matches = API_ENDPOINTS.filter(
      (endpoint) => endpoint.method === method && normalizePath(endpoint.path) === path
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual(expect.objectContaining({ manualOnly: true }));
  });

  test.each(MANUAL_ONLY_ROUTE_KEYS)(
    '%s is visible in the manual bucket and excluded from bulk inputs',
    (routeKey) => {
      expect(MANUAL_API_PRESETS.map(routeKeyFor)).toContain(routeKey);
      expect(AUTOMATED_API_PRESETS.map(routeKeyFor)).not.toContain(routeKey);
    }
  );

  test('partitions every registry preset into exactly one API Test Page bucket', () => {
    expect(AUTOMATED_API_PRESETS).not.toContainEqual(expect.objectContaining({ manualOnly: true }));
    expect(AUTOMATED_API_PRESETS).not.toContainEqual(
      expect.objectContaining({ isDestructive: true })
    );
    expect(MANUAL_API_PRESETS.length + AUTOMATED_API_PRESETS.length).toBe(API_ENDPOINTS.length);
    expect(new Set([...MANUAL_API_PRESETS, ...AUTOMATED_API_PRESETS]).size).toBe(
      API_ENDPOINTS.length
    );
  });

  test('stale/obsolete entries are explicitly removed from the registry', () => {
    const staleEntries = [
      { method: 'POST', path: '/api/location-markers' },
      { method: 'DELETE', path: '/api/location-markers/:id' },
      { method: 'GET', path: '/api/wigle/observations/aggregated' },
      { method: 'GET', path: '/api/wigle/observations/extent' },
      { method: 'GET', path: '/api/demo/oui-grouping' },
      { method: 'GET', path: '/api/test-location' },
      { method: 'GET', path: '/api/admin/notes-test' },
      { method: 'GET', path: '/api/admin/simple-test' },
      // Removed: legacy duplicate alias; canonical route is /api/dashboard/metrics
      { method: 'GET', path: '/api/dashboard-metrics' },
    ];

    staleEntries.forEach((stale) => {
      const match = API_ENDPOINTS.find(
        (endpoint) =>
          endpoint.method === stale.method && normalizePath(endpoint.path) === stale.path
      );
      expect(match).toBeUndefined();
    });
  });
});
