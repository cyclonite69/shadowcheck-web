import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  fetchUpstream,
  importObservations,
  fetchOrImportDetail,
  importDetailFromJson,
  isLocallyAdministeredMac,
} from '../../../server/src/services/wigleDetailService';

// Mock dependencies
const secretsManager = require('../../../server/src/services/secretsManager');
const logger = require('../../../server/src/logging/logger');
const { wigleGatewayFetch } = require('../../../server/src/services/wigle/wigleGateway');
const {
  getEncodedWigleAuth,
  hashRecord,
} = require('../../../server/src/services/wigleRequestUtils');
const { logWigleAuditEvent } = require('../../../server/src/services/wigleAuditLogger');
const {
  getRecentWigleDetailImport,
  getWigleObservations,
} = require('../../../server/src/services/wigle/database');
const { getWigleDetail } = require('../../../server/src/services/wigle/detail');
const {
  importWigleV3NetworkDetail,
  importWigleV3ObservationRow,
} = require('../../../server/src/services/wigle/persistence');

jest.mock('../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../server/src/services/secretsManager', () => ({
  get: jest.fn(),
}));

jest.mock('../../../server/src/services/wigle/wigleGateway', () => ({
  wigleGatewayFetch: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleRequestUtils', () => ({
  getEncodedWigleAuth: jest.fn(),
  hashRecord: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleAuditLogger', () => ({
  logWigleAuditEvent: jest.fn(),
}));

jest.mock('../../../server/src/services/wigle/database', () => ({
  getRecentWigleDetailImport: jest.fn(),
  getWigleObservations: jest.fn(),
}));

jest.mock('../../../server/src/services/wigle/detail', () => ({
  getWigleDetail: jest.fn(),
}));

jest.mock('../../../server/src/services/wigle/persistence', () => ({
  importWigleV3NetworkDetail: jest.fn(),
  importWigleV3ObservationRow: jest.fn(),
}));

describe('wigleDetailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getEncodedWigleAuth.mockReturnValue('basic-auth-string');
  });

  describe('fetchUpstream', () => {
    it('returns 503 if credentials are not configured', async () => {
      secretsManager.get.mockImplementation((key: string) => {
        if (key === 'wigle_api_name') {
          return null;
        }
        if (key === 'wigle_api_token') {
          return 'some-token';
        }
        return null;
      });

      const result = await fetchUpstream('netid', 'wifi');
      expect(result).toEqual({
        ok: false,
        status: 503,
        error: 'WiGLE API credentials not configured',
      });
    });

    it('identifies locally administered (randomized) MAC addresses correctly', () => {
      expect(isLocallyAdministeredMac('0E:FE:7B:78:FC:79')).toBe(true);
      expect(isLocallyAdministeredMac('0EFE7B78FC79')).toBe(true);
      expect(isLocallyAdministeredMac('00:14:3E:4A:67:A0')).toBe(false);
      expect(isLocallyAdministeredMac('44:C7:00:56:49:FC')).toBe(false);
      expect(isLocallyAdministeredMac('a')).toBe(false);
    });

    it('returns 404 immediately without calling gateway for locally administered MACs', async () => {
      secretsManager.get.mockImplementation((key: string) => {
        if (key === 'wigle_api_name') {
          return 'some-name';
        }
        if (key === 'wigle_api_token') {
          return 'some-token';
        }
        return null;
      });

      const result = await fetchUpstream('0E:FE:7B:78:FC:79', 'wifi');
      expect(result).toEqual({
        ok: false,
        status: 404,
        error:
          'Network not found in WiGLE. This is expected for randomized or locally-administered MAC addresses.',
      });
      expect(wigleGatewayFetch).not.toHaveBeenCalled();
    });

    it('returns error if gateway fetch fails', async () => {
      secretsManager.get.mockImplementation((key: string) => {
        if (key === 'wigle_api_name') {
          return 'some-name';
        }
        if (key === 'wigle_api_token') {
          return 'some-token';
        }
        return null;
      });

      wigleGatewayFetch.mockResolvedValue({
        ok: false,
        status: 500,
        error: 'Network Timeout',
      });

      const result = await fetchUpstream('netid', 'wifi');
      expect(result).toEqual({
        ok: false,
        status: 500,
        error: 'Network Timeout',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns 404 if response status is 404 (network not found)', async () => {
      secretsManager.get.mockImplementation((key: string) => {
        if (key === 'wigle_api_name') {
          return 'some-name';
        }
        if (key === 'wigle_api_token') {
          return 'some-token';
        }
        return null;
      });

      const mockResponse: any = {
        ok: false,
        status: 404,
        text: (jest.fn() as any).mockResolvedValue('Not Found'),
      };

      wigleGatewayFetch.mockResolvedValue({
        ok: true,
        response: mockResponse,
      });

      const result = await fetchUpstream('netid', 'wifi');
      expect(result).toEqual({
        ok: false,
        status: 404,
        error:
          'Network not found in WiGLE. This is expected for randomized or locally-administered MAC addresses.',
      });
    });

    it('returns 400 with generic error if response is not ok and not 404', async () => {
      secretsManager.get.mockImplementation((key: string) => {
        if (key === 'wigle_api_name') {
          return 'some-name';
        }
        if (key === 'wigle_api_token') {
          return 'some-token';
        }
        return null;
      });

      const mockResponse: any = {
        ok: false,
        status: 400,
        text: (jest.fn() as any).mockResolvedValue('Bad Request payload'),
      };

      wigleGatewayFetch.mockResolvedValue({
        ok: true,
        response: mockResponse,
      });

      const result = await fetchUpstream('netid', 'wifi');
      expect(result).toEqual({
        ok: false,
        status: 400,
        error: 'WiGLE Detail API request failed',
        details: 'Bad Request payload',
      });
    });

    it('returns ok true and data on successful 200 OK', async () => {
      secretsManager.get.mockImplementation((key: string) => {
        if (key === 'wigle_api_name') {
          return 'some-name';
        }
        if (key === 'wigle_api_token') {
          return 'some-token';
        }
        return null;
      });

      const mockResponse: any = {
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockResolvedValue({ networkId: 'netid', locationClusters: [] }),
      };

      wigleGatewayFetch.mockResolvedValue({
        ok: true,
        response: mockResponse,
      });

      const result = await fetchUpstream('netid', 'wifi');
      expect(result).toEqual({
        ok: true,
        data: { networkId: 'netid', locationClusters: [] },
      });
    });
  });

  describe('importObservations', () => {
    it('returns zero counts if locationClusters is not an array', async () => {
      const result = await importObservations('netid', null as any);
      expect(result).toEqual({ newCount: 0, totalCount: 0, failedCount: 0 });
    });

    it('processes clusters and continues loop even if single row fails', async () => {
      const mockClusters = [
        {
          clusterSsid: 'ssid',
          locations: [{ latitude: 12.34, longitude: 56.78, time: '2020-01-01' }],
        },
        {
          clusterSsid: 'ssid',
          locations: [{ latitude: 12.35, longitude: 56.79, time: '2020-01-02' }],
        },
      ];

      importWigleV3ObservationRow
        .mockRejectedValueOnce(new Error('Insert unique violation'))
        .mockResolvedValueOnce(1);

      const result = await importObservations('netid', mockClusters);
      expect(result).toEqual({
        newCount: 1,
        totalCount: 2,
        failedCount: 1,
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('fetchOrImportDetail', () => {
    it('serves cached details on cache hit when shouldImport is false', async () => {
      const mockCached = {
        netid: 'netid',
        ssid: 'test-ssid',
        comment: null,
      };
      getWigleDetail.mockResolvedValue(mockCached);

      const result = await fetchOrImportDetail('netid', 'wifi', false);
      expect(result).toEqual({
        ok: true,
        data: expect.objectContaining({
          networkId: 'netid',
          ssid: 'test-ssid',
          comment: null,
        }),
        imported: false,
        cached: true,
        importedObservations: 0,
        totalObservations: 0,
        attemptedObservations: 0,
        failedObservations: 0,
      });
    });

    it('fetches upstream on cache miss when shouldImport is false', async () => {
      getWigleDetail.mockResolvedValue(null);
      secretsManager.get.mockReturnValue('some-val');

      const mockResponse: any = {
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockResolvedValue({ networkId: 'netid', locationClusters: [] }),
      };
      wigleGatewayFetch.mockResolvedValue({ ok: true, response: mockResponse });

      const result = await fetchOrImportDetail('netid', 'wifi', false);
      expect(result).toEqual({
        ok: true,
        data: { networkId: 'netid', locationClusters: [] },
        imported: false,
        cached: false,
        importedObservations: 0,
        totalObservations: 0,
        attemptedObservations: 0,
        failedObservations: 0,
      });
    });

    it('returns deduplicated cache hit if recent import exists within deduplication hours', async () => {
      const mockRecentImport = {
        netid: 'netid',
        ssid: 'test-ssid',
      };
      getRecentWigleDetailImport.mockResolvedValue(mockRecentImport);
      getWigleObservations.mockResolvedValue({ total: 42 });
      hashRecord.mockReturnValue('hash');

      const result = await fetchOrImportDetail('netid', 'wifi', true);
      expect(result).toEqual({
        ok: true,
        data: expect.objectContaining({
          networkId: 'netid',
          ssid: 'test-ssid',
        }),
        imported: false,
        cached: true,
        deduplicated: true,
        importedObservations: 0,
        totalObservations: 42,
        attemptedObservations: 0,
        failedObservations: 0,
      });
      expect(logWigleAuditEvent).toHaveBeenCalled();
    });

    it('returns upstream error if fetchUpstream fails', async () => {
      getRecentWigleDetailImport.mockResolvedValue(null);
      secretsManager.get.mockReturnValue(null); // triggers credential check failure

      const result = await fetchOrImportDetail('netid', 'wifi', true);
      expect(result.ok).toBe(false);
    });

    it('executes full import pipeline on happy path', async () => {
      getRecentWigleDetailImport.mockResolvedValue(null);
      secretsManager.get.mockReturnValue('some-val');

      const mockResponse: any = {
        ok: true,
        status: 200,
        json: (jest.fn() as any).mockResolvedValue({
          networkId: 'netid',
          ssid: 'test-ssid',
          locationClusters: [
            {
              clusterSsid: 'test-ssid',
              locations: [{ latitude: 12.34, longitude: 56.78, time: '2020-01-01' }],
            },
          ],
        }),
      };
      wigleGatewayFetch.mockResolvedValue({ ok: true, response: mockResponse });
      importWigleV3NetworkDetail.mockResolvedValue(undefined);
      importWigleV3ObservationRow.mockResolvedValue(1);
      getWigleObservations.mockResolvedValue({ total: 1 });

      const result = await fetchOrImportDetail('netid', 'wifi', true);
      expect(result).toEqual({
        ok: true,
        data: {
          networkId: 'netid',
          ssid: 'test-ssid',
          locationClusters: [
            {
              clusterSsid: 'test-ssid',
              locations: [{ latitude: 12.34, longitude: 56.78, time: '2020-01-01' }],
            },
          ],
        },
        imported: true,
        cached: false,
        importedObservations: 1,
        totalObservations: 1,
        attemptedObservations: 1,
        failedObservations: 0,
      });
      expect(importWigleV3NetworkDetail).toHaveBeenCalled();
    });
  });

  describe('importDetailFromJson', () => {
    it('successfully imports detail and observations from pre-parsed JSON structure', async () => {
      const mockJsonData = {
        networkId: 'netid',
        ssid: 'json-ssid',
        locationClusters: [
          {
            clusterSsid: 'json-ssid',
            locations: [{ latitude: 12.34, longitude: 56.78, time: '2020-01-01' }],
          },
        ],
      };

      importWigleV3NetworkDetail.mockResolvedValue(undefined);
      importWigleV3ObservationRow.mockResolvedValue(1);
      getWigleObservations.mockResolvedValue({ total: 5 });

      const result = await importDetailFromJson(mockJsonData);
      expect(result).toEqual({
        ok: true,
        data: mockJsonData,
        importedObservations: 1,
        totalObservations: 5,
        attemptedObservations: 1,
        failedObservations: 0,
      });
      expect(importWigleV3NetworkDetail).toHaveBeenCalled();
    });
  });
});
