/**
 * Universal filter parity integration tests (Phase 1).
 *
 * Requires:
 *   RUN_INTEGRATION_TESTS=true
 *   API + database available
 */

export {};

const { runIntegration } = require('../helpers/integrationEnv');
const describeIfIntegration = runIntegration ? describe : describe.skip;

let UniversalFilterQueryBuilder: any;
let v2Service: any;
let NetworkRepository: any;
let DashboardService: any;
let dbUnavailableReason: string | null = null;

if (runIntegration) {
  ({ UniversalFilterQueryBuilder } = require('../../server/src/services/filterQueryBuilder'));
  v2Service = require('../../server/src/services/v2Service');
  NetworkRepository = require('../../server/src/repositories/networkRepository');
  DashboardService = require('../../server/src/services/dashboardService');
}

const withInvariantContext = (
  name: string,
  payload: { filters: Record<string, unknown>; enabled: Record<string, boolean> },
  compared: string,
  expected: number,
  actual: number,
  sampleIds: string[]
) => {
  if (expected !== actual) {
    throw new Error(
      [
        `[Invariant Failed] ${name}`,
        `payload=${JSON.stringify(payload)}`,
        `endpoints=${compared}`,
        `expected=${expected}`,
        `actual=${actual}`,
        `sampleBssids=${JSON.stringify(sampleIds.slice(0, 8))}`,
      ].join('\n')
    );
  }
};

describeIfIntegration('Universal Filter Count Parity - Phase 1', () => {
  if (!runIntegration) {
    test.skip('requires RUN_INTEGRATION_TESTS=true', () => {});
    return;
  }

  beforeAll(async () => {
    try {
      await v2Service.executeV2Query('SELECT 1 as ok');
    } catch (error: any) {
      dbUnavailableReason = error?.message || 'unknown DB connection error';
    }
  });

  test('radioTypes=[W] parity: list/geospatial/dashboard totals agree', async () => {
    if (dbUnavailableReason) {
      console.warn(`[integration-skip] universal parity test skipped: ${dbUnavailableReason}`);
      return;
    }

    const payload = {
      filters: { radioTypes: ['W'] },
      enabled: { radioTypes: true },
    };

    const listBuilder = new UniversalFilterQueryBuilder(payload.filters, payload.enabled);
    const listQuery = listBuilder.buildNetworkListQuery({ limit: 5000, offset: 0 });
    const listResult = await v2Service.executeV2Query(listQuery.sql, listQuery.params);
    const listRows = listResult.rows || [];

    const listCountBuilder = new UniversalFilterQueryBuilder(payload.filters, payload.enabled);
    const listCountQuery = listCountBuilder.buildNetworkCountQuery();
    const listCountResult = await v2Service.executeV2Query(
      listCountQuery.sql,
      listCountQuery.params
    );
    const listTotal = Number(listCountResult.rows?.[0]?.total ?? 0);

    const wifiRows = listRows.filter((row: any) => row.type === 'W');
    const listBssids = wifiRows.map((row: any) => row.bssid).filter(Boolean);

    const geospatialBuilder = new UniversalFilterQueryBuilder(payload.filters, payload.enabled);
    const geospatialQuery = geospatialBuilder.buildGeospatialQuery({ limit: 500000 });
    const geospatialResult = await v2Service.executeV2Query(
      geospatialQuery.sql,
      geospatialQuery.params
    );
    const geospatialRows = geospatialResult.rows || [];
    const geoWifiRows = geospatialRows.filter((row: any) => row?.radio_type === 'W' && row?.bssid);
    const geoBssids = geoWifiRows.map((row: any) => row.bssid);

    const networkRepository = new NetworkRepository();
    const dashboardService = new DashboardService(networkRepository);
    const dashboardMetrics = await dashboardService.getMetrics(payload.filters, payload.enabled);
    const dashboardWifi = Number(dashboardMetrics?.wifiCount ?? 0);

    // Contract: with radioTypes=[W], list total should equal dashboard Wi-Fi total.
    withInvariantContext(
      'list-vs-dashboard Wi-Fi total parity',
      payload,
      '/api/v2/networks/filtered <-> /api/dashboard-metrics',
      listTotal,
      dashboardWifi,
      listBssids
    );

    // Real-data smoke assertion requested for geospatial/list length vs dashboard count.
    withInvariantContext(
      'geospatial-vs-dashboard Wi-Fi parity',
      payload,
      'UniversalFilterQueryBuilder.buildGeospatialQuery <-> DashboardService.getMetrics',
      geoWifiRows.length,
      dashboardWifi,
      geoBssids
    );

    // Sanity: when filtering Wi-Fi, returned list rows should be Wi-Fi only.
    const nonWifiRows = listRows.filter((row: any) => row.type !== 'W');
    expect(nonWifiRows.length).toBe(0);
  }, 60000);

  test('all radio types selected is neutral vs baseline for dashboard cards and severity counts', async () => {
    if (dbUnavailableReason) {
      console.warn(`[integration-skip] universal parity test skipped: ${dbUnavailableReason}`);
      return;
    }

    const baselinePayload = { filters: {}, enabled: {} };
    const allTypesPayload = {
      filters: { radioTypes: ['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?'] },
      enabled: { radioTypes: true },
    };

    const runBundle = async (payload: {
      filters: Record<string, unknown>;
      enabled: Record<string, boolean>;
    }) => {
      const listCountBuilder = new UniversalFilterQueryBuilder(payload.filters, payload.enabled);
      const listCountQuery = listCountBuilder.buildNetworkCountQuery();
      const listCountResult = await v2Service.executeV2Query(
        listCountQuery.sql,
        listCountQuery.params
      );
      const listTotal = Number(listCountResult.rows?.[0]?.total ?? 0);

      const networkRepository = new NetworkRepository();
      const dashboardService = new DashboardService(networkRepository);
      const dashboardMetrics = await dashboardService.getMetrics(payload.filters, payload.enabled);

      const severityCounts = await v2Service.getThreatSeverityCounts(
        payload.filters,
        payload.enabled
      );
      const severityTotal = Object.values(severityCounts || {}).reduce(
        (acc: number, level: any) => acc + Number(level?.unique_networks || 0),
        0
      );

      return {
        listTotal,
        dashboardNetworks: dashboardMetrics?.networks,
        severityCounts,
        severityTotal,
      };
    };

    const [baseline, allTypes] = await Promise.all([
      runBundle(baselinePayload),
      runBundle(allTypesPayload),
    ]);

    expect(allTypes.listTotal).toBe(baseline.listTotal);
    expect(allTypes.dashboardNetworks).toEqual(baseline.dashboardNetworks);
    expect(allTypes.severityCounts).toEqual(baseline.severityCounts);
    expect(allTypes.severityTotal).toBe(baseline.severityTotal);
  }, 60000);
});
