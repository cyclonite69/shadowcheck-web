export {};

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
  pool: { query: jest.fn(), connect: jest.fn(), end: jest.fn() },
  CONFIG: {
    MIN_VALID_TIMESTAMP: 946684800000,
    MIN_OBSERVATIONS: 2,
    MAX_PAGE_SIZE: 1000,
    DEFAULT_PAGE_SIZE: 100,
  },
}));

jest.mock('../../../server/src/logging/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../server/src/services/v2Service', () => ({
  executeV2Query: jest.fn(),
}));

const mockBuildQueries = {
  networkTypes: { sql: 'SELECT 1', params: [] },
  signalStrength: { sql: 'SELECT 1', params: [] },
  security: { sql: 'SELECT 1', params: [] },
  threatDistribution: { sql: 'SELECT 1', params: [] },
  temporalActivity: { sql: 'SELECT 1', params: [] },
  radioTypeOverTime: { sql: 'SELECT 1', params: [] },
  threatTrends: { sql: 'SELECT 1', params: [] },
  topNetworks: { sql: 'SELECT 1', params: [] },
};

const mockBuilderInstance = {
  getValidationErrors: jest.fn().mockReturnValue([]),
  buildAnalyticsQueries: jest.fn().mockReturnValue(mockBuildQueries),
};

const MockUniversalFilterQueryBuilder = jest.fn().mockImplementation(() => mockBuilderInstance);

jest.mock('../../../server/src/services/filterQueryBuilder/index', () => ({
  UniversalFilterQueryBuilder: MockUniversalFilterQueryBuilder,
}));

import { getFilteredAnalytics } from '../../../server/src/services/filteredAnalyticsService';
const v2Service = require('../../../server/src/services/v2Service');
const logger = require('../../../server/src/logging/logger');

const emptyRows = { rows: [] };

function makeV2Mock(overrides: Record<string, any[]> = {}) {
  const defaults: Record<string, any[]> = {
    networkTypes: [],
    signalStrength: [],
    security: [],
    threatDistribution: [],
    temporalActivity: [],
    radioTypeOverTime: [],
    threatTrends: [],
    topNetworks: [],
  };
  const data = { ...defaults, ...overrides };
  let callCount = 0;
  const keys = [
    'networkTypes',
    'signalStrength',
    'security',
    'threatDistribution',
    'temporalActivity',
    'radioTypeOverTime',
    'threatTrends',
    'topNetworks',
  ];
  v2Service.executeV2Query.mockImplementation(() => {
    const key = keys[callCount++] || 'networkTypes';
    return Promise.resolve({ rows: data[key] });
  });
}

describe('getFilteredAnalytics', () => {
  beforeEach(() => {
    // resetMocks: true clears mock implementations — re-establish them
    mockBuilderInstance.getValidationErrors.mockReturnValue([]);
    mockBuilderInstance.buildAnalyticsQueries.mockReturnValue(mockBuildQueries);
    MockUniversalFilterQueryBuilder.mockImplementation(() => mockBuilderInstance);
  });

  test('returns shaped data with empty rows', async () => {
    makeV2Mock();
    const result = await getFilteredAnalytics({}, {});
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('queryDurationMs');
    expect(typeof result.queryDurationMs).toBe('number');
    const { data } = result;
    expect(data.networkTypes).toEqual([]);
    expect(data.signalStrength).toEqual([]);
    expect(data.security).toEqual([]);
    expect(data.threatDistribution).toEqual([]);
    expect(data.temporalActivity).toEqual([]);
    expect(data.radioTypeOverTime).toEqual([]);
    expect(data.threatTrends).toEqual([]);
    expect(data.topNetworks).toEqual([]);
  });

  test('maps networkTypes rows — uses network_type field', async () => {
    makeV2Mock({ networkTypes: [{ network_type: 'W', count: '42' }] });
    const result = await getFilteredAnalytics({}, {});
    expect(result.data.networkTypes).toEqual([{ type: 'W', count: 42 }]);
  });

  test('maps networkTypes rows — falls back to type field', async () => {
    makeV2Mock({ networkTypes: [{ type: 'E', count: 5 }] });
    const result = await getFilteredAnalytics({}, {});
    expect(result.data.networkTypes[0].type).toBe('E');
  });

  test('maps networkTypes rows — defaults to Other when both missing', async () => {
    makeV2Mock({ networkTypes: [{ count: 1 }] });
    const result = await getFilteredAnalytics({}, {});
    expect(result.data.networkTypes[0].type).toBe('Other');
  });

  test('maps signalStrength rows with dual field names', async () => {
    makeV2Mock({ signalStrength: [{ signal_range: '-70', count: '10' }] });
    const result = await getFilteredAnalytics({}, {});
    const row = result.data.signalStrength[0];
    expect(row.signal_range).toBe('-70');
    expect(row.range).toBe('-70');
    expect(row.count).toBe(10);
  });

  test('maps security rows with dual field names', async () => {
    makeV2Mock({ security: [{ security_type: 'WPA2', count: '7' }] });
    const result = await getFilteredAnalytics({}, {});
    const row = result.data.security[0];
    expect(row.security_type).toBe('WPA2');
    expect(row.type).toBe('WPA2');
    expect(row.count).toBe(7);
  });

  test('maps temporalActivity rows', async () => {
    makeV2Mock({ temporalActivity: [{ hour: '14', count: '99' }] });
    const result = await getFilteredAnalytics({}, {});
    expect(result.data.temporalActivity).toEqual([{ hour: 14, count: 99 }]);
  });

  test('maps radioTypeOverTime rows with dual field names', async () => {
    makeV2Mock({
      radioTypeOverTime: [{ date: '2025-01-01', network_type: 'W', count: '3' }],
    });
    const result = await getFilteredAnalytics({}, {});
    const row = result.data.radioTypeOverTime[0];
    expect(row.date).toBe('2025-01-01');
    expect(row.network_type).toBe('W');
    expect(row.type).toBe('W');
    expect(row.count).toBe(3);
  });

  test('maps threatTrends rows with all dual field names', async () => {
    makeV2Mock({
      threatTrends: [
        {
          date: '2025-01-01',
          avg_score: '55.5',
          critical_count: '2',
          high_count: '3',
          medium_count: '4',
          low_count: '5',
          network_count: '100',
        },
      ],
    });
    const result = await getFilteredAnalytics({}, {});
    const row = result.data.threatTrends[0];
    expect(row.date).toBe('2025-01-01');
    expect(row.avg_score).toBe(55.5);
    expect(row.avgScore).toBe(55.5);
    expect(row.critical_count).toBe(2);
    expect(row.criticalCount).toBe(2);
    expect(row.high_count).toBe(3);
    expect(row.highCount).toBe(3);
    expect(row.medium_count).toBe(4);
    expect(row.mediumCount).toBe(4);
    expect(row.low_count).toBe(5);
    expect(row.lowCount).toBe(5);
    expect(row.network_count).toBe(100);
    expect(row.networkCount).toBe(100);
  });

  test('maps topNetworks rows with dual field names', async () => {
    makeV2Mock({
      topNetworks: [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'TestNet',
          observation_count: '50',
          first_seen: '2024-01-01',
          last_seen: '2025-01-01',
        },
      ],
    });
    const result = await getFilteredAnalytics({}, {});
    const row = result.data.topNetworks[0];
    expect(row.bssid).toBe('AA:BB:CC:DD:EE:FF');
    expect(row.ssid).toBe('TestNet');
    expect(row.observation_count).toBe(50);
    expect(row.observations).toBe(50);
    expect(row.first_seen).toBe('2024-01-01');
    expect(row.firstSeen).toBe('2024-01-01');
    expect(row.last_seen).toBe('2025-01-01');
    expect(row.lastSeen).toBe('2025-01-01');
  });

  test('handles null first_seen/last_seen in topNetworks', async () => {
    makeV2Mock({
      topNetworks: [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'X',
          observation_count: 1,
          first_seen: null,
          last_seen: null,
        },
      ],
    });
    const result = await getFilteredAnalytics({}, {});
    const row = result.data.topNetworks[0];
    expect(row.first_seen).toBeNull();
    expect(row.firstSeen).toBeNull();
  });

  test('asNumber coerces non-finite values to 0', async () => {
    makeV2Mock({ networkTypes: [{ network_type: 'W', count: 'not-a-number' }] });
    const result = await getFilteredAnalytics({}, {});
    expect(result.data.networkTypes[0].count).toBe(0);
  });

  test('throws when builder returns validation errors', async () => {
    mockBuilderInstance.getValidationErrors.mockReturnValueOnce(['bad filter']);
    await expect(getFilteredAnalytics({ bad: 'data' }, {})).rejects.toThrow(
      'Invalid filter payload: bad filter'
    );
    expect(logger.error).toHaveBeenCalled();
  });

  test('passes pageType to builder', async () => {
    makeV2Mock();
    await getFilteredAnalytics({}, {}, 'wigle');
    expect(MockUniversalFilterQueryBuilder).toHaveBeenCalledWith({}, {}, { pageType: 'wigle' });
  });

  test('defaults pageType to geospatial', async () => {
    makeV2Mock();
    await getFilteredAnalytics({}, {});
    expect(MockUniversalFilterQueryBuilder).toHaveBeenCalledWith(
      {},
      {},
      { pageType: 'geospatial' }
    );
  });

  test('queryDurationMs is non-negative', async () => {
    makeV2Mock();
    const result = await getFilteredAnalytics({}, {});
    expect(result.queryDurationMs).toBeGreaterThanOrEqual(0);
  });
});
