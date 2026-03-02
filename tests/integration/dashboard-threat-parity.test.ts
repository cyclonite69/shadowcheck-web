/**
 * Integration test: parity checks across dashboard metrics, threat severity counts,
 * and v2 filtered network totals for identical {filters, enabled} payloads.
 *
 * Requires:
 *   RUN_INTEGRATION_TESTS=true
 *   API + database available
 */

export {};

const { runIntegration } = require('../helpers/integrationEnv');
const describeIfIntegration = runIntegration ? describe : describe.skip;

let request: any;
let express: any;
let app: any;
let v2Service: any;
let dashboardRoutesModule: any;
let filteredRoutes: any;
let threatsV2Routes: any;
let dbUnavailableReason: string | null = null;

if (runIntegration) {
  request = require('supertest');
  express = require('express');
  v2Service = require('../../server/src/services/v2Service');
  dashboardRoutesModule = require('../../server/src/api/routes/v1/dashboard');
  filteredRoutes = require('../../server/src/api/routes/v2/filtered');
  threatsV2Routes = require('../../server/src/api/routes/v2/threats');

  const NetworkRepository = require('../../server/src/repositories/networkRepository');
  const DashboardService = require('../../server/src/services/dashboardService');
  const networkRepository = new NetworkRepository();
  const dashboardService = new DashboardService(networkRepository);

  dashboardRoutesModule.initDashboardRoutes({ dashboardService });

  app = express();
  app.use('/api', dashboardRoutesModule.router);
  app.use('/api/v2/networks/filtered', filteredRoutes);
  app.use('/api/v2', threatsV2Routes);
}

const ALL_RADIO_TYPES = ['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?'];

const sumSeverityTotals = (
  counts: Record<string, { unique_networks: number; total_observations: number }>
) => {
  const values = Object.values(counts || {});
  return values.reduce(
    (acc, level) => {
      acc.unique += Number(level?.unique_networks || 0);
      acc.observations += Number(level?.total_observations || 0);
      return acc;
    },
    { unique: 0, observations: 0 }
  );
};

const failWithContext = (message: string, context: Record<string, unknown>): never => {
  throw new Error([message, JSON.stringify(context, null, 2)].join('\n'));
};

const fetchParityBundle = async (payload: {
  filters: Record<string, unknown>;
  enabled: Record<string, boolean>;
}) => {
  const query = {
    filters: JSON.stringify(payload.filters),
    enabled: JSON.stringify(payload.enabled),
  };

  const [dashboardRes, severityRes, filteredRes] = await Promise.all([
    request(app).get('/api/dashboard-metrics').query(query),
    request(app).get('/api/v2/threats/severity-counts').query(query),
    request(app)
      .get('/api/v2/networks/filtered')
      .query({ ...query, limit: 1, offset: 0, includeTotal: 1 }),
  ]);

  const raw = {
    payload,
    statusCodes: {
      dashboard: dashboardRes.status,
      severity: severityRes.status,
      filtered: filteredRes.status,
    },
    dashboardBody: dashboardRes.body,
    severityBody: severityRes.body,
    filteredBody: filteredRes.body,
  };

  if (dashboardRes.status !== 200 || severityRes.status !== 200 || filteredRes.status !== 200) {
    failWithContext('Parity endpoint returned non-200 response', raw);
  }

  const wifiCount = Number(dashboardRes.body?.networks?.wifi);
  const filteredTotal = Number(filteredRes.body?.pagination?.total);
  const counts = severityRes.body?.counts;

  if (!Number.isFinite(wifiCount) || wifiCount < 0) {
    failWithContext('Dashboard Wi-Fi count missing/invalid', raw);
  }

  if (!Number.isFinite(filteredTotal) || filteredTotal < 0) {
    failWithContext('Filtered pagination.total missing/invalid', raw);
  }

  if (!counts || typeof counts !== 'object') {
    failWithContext('Threat severity response shape invalid (missing counts object)', raw);
  }

  const severitySummary = sumSeverityTotals(counts);

  const allZero =
    wifiCount === 0 &&
    filteredTotal === 0 &&
    severitySummary.unique === 0 &&
    severitySummary.observations === 0;

  if (allZero) {
    failWithContext('All endpoints returned zeroed values; potential silent backend failure', raw);
  }

  return {
    payload,
    dashboard: dashboardRes.body,
    severity: severityRes.body,
    filtered: filteredRes.body,
    wifiCount,
    filteredTotal,
    severitySummary,
  };
};

describeIfIntegration('Dashboard/Threat parity for identical filter payloads', () => {
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

  const assertDbAvailable = () => {
    if (dbUnavailableReason) {
      throw new Error(
        `[integration-fail] dashboard-threat-parity requires DB connectivity: ${dbUnavailableReason}`
      );
    }
  };

  test('radioTypes=[W] stays consistent across dashboard, severity, and filtered totals', async () => {
    assertDbAvailable();

    const wifiPayload = {
      filters: { radioTypes: ['W'] },
      enabled: { radioTypes: true },
    };

    const wifiBundle = await fetchParityBundle(wifiPayload);

    expect(wifiBundle.dashboard).toHaveProperty('networks');
    expect(wifiBundle.dashboard.networks).toHaveProperty('wifi');
    expect(wifiBundle.severity).toHaveProperty('counts');
    expect(wifiBundle.filtered).toHaveProperty('ok', true);
    expect(wifiBundle.filtered).toHaveProperty('pagination.total');

    // Wi-Fi parity contract for identical payloads.
    if (wifiBundle.wifiCount !== wifiBundle.filteredTotal) {
      failWithContext('Wi-Fi dashboard count mismatched filtered total', {
        payload: wifiPayload,
        dashboardWifi: wifiBundle.wifiCount,
        filteredTotal: wifiBundle.filteredTotal,
        severitySummary: wifiBundle.severitySummary,
      });
    }

    // Threat counts should be scoped by filter and cannot exceed scoped network total.
    if (wifiBundle.severitySummary.unique > wifiBundle.filteredTotal) {
      failWithContext('Threat severity unique networks exceeded filtered network total', {
        payload: wifiPayload,
        severitySummary: wifiBundle.severitySummary,
        filteredTotal: wifiBundle.filteredTotal,
      });
    }
  }, 60000);

  test('all radio types selected is neutral vs unscoped baseline', async () => {
    assertDbAvailable();

    const baselinePayload = { filters: {}, enabled: {} };
    const allSelectedPayload = {
      filters: { radioTypes: ALL_RADIO_TYPES },
      enabled: { radioTypes: true },
    };

    const [baselineBundle, allSelectedBundle] = await Promise.all([
      fetchParityBundle(baselinePayload),
      fetchParityBundle(allSelectedPayload),
    ]);

    const context = {
      baselinePayload,
      allSelectedPayload,
      baseline: {
        wifi: baselineBundle.wifiCount,
        filteredTotal: baselineBundle.filteredTotal,
        severitySummary: baselineBundle.severitySummary,
      },
      allSelected: {
        wifi: allSelectedBundle.wifiCount,
        filteredTotal: allSelectedBundle.filteredTotal,
        severitySummary: allSelectedBundle.severitySummary,
      },
    };

    if (allSelectedBundle.filteredTotal !== baselineBundle.filteredTotal) {
      failWithContext(
        'All-radio filtered total diverged from baseline (non-neutral behavior)',
        context
      );
    }

    if (allSelectedBundle.wifiCount !== baselineBundle.wifiCount) {
      failWithContext(
        'All-radio dashboard Wi-Fi diverged from baseline (non-neutral behavior)',
        context
      );
    }

    if (
      JSON.stringify(allSelectedBundle.dashboard?.networks || {}) !==
      JSON.stringify(baselineBundle.dashboard?.networks || {})
    ) {
      failWithContext('All-radio dashboard network cards diverged from baseline', context);
    }

    if (
      JSON.stringify(allSelectedBundle.severity?.counts || {}) !==
      JSON.stringify(baselineBundle.severity?.counts || {})
    ) {
      failWithContext('All-radio severity breakdown diverged from baseline', context);
    }

    if (allSelectedBundle.severitySummary.unique !== baselineBundle.severitySummary.unique) {
      failWithContext('All-radio severity unique totals diverged from baseline', context);
    }

    if (
      allSelectedBundle.severitySummary.observations !== baselineBundle.severitySummary.observations
    ) {
      failWithContext('All-radio severity observation totals diverged from baseline', context);
    }
  }, 60000);
});
