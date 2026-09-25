/**
 * Unit tests for wigleDetailService
 */

import {
  fetchUpstream,
  importObservations,
  fetchOrImportDetail,
  importDetailFromJson,
} from '../../server/src/services/wigleDetailService';
import secretsManager from '../../server/src/services/secretsManager';
import { wigleGatewayFetch } from '../../server/src/services/wigle/wigleGateway';
import { getEncodedWigleAuth } from '../../server/src/services/wigleRequestUtils';
import {
  stripNullBytes,
  stripNullBytesDeep,
  mapCachedDetailToApiShape,
} from '../../server/src/services/wigleDetailTransforms';
import {
  getRecentWigleDetailImport,
  getWigleObservations,
} from '../../server/src/services/wigle/database';
import { getWigleDetail } from '../../server/src/services/wigle/detail';
import {
  importWigleV3NetworkDetail,
  importWigleV3ObservationRow,
} from '../../server/src/services/wigle/persistence';

jest.mock('../../server/src/logging/logger');
jest.mock('../../server/src/services/secretsManager');
jest.mock('../../server/src/services/wigle/wigleGateway');
jest.mock('../../server/src/services/wigleRequestUtils');
jest.mock('../../server/src/services/wigleAuditLogger');
jest.mock('../../server/src/services/wigleDetailTransforms');
jest.mock('../../server/src/services/wigle/database');
jest.mock('../../server/src/services/wigle/detail');
jest.mock('../../server/src/services/wigle/persistence');

describe('wigleDetailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchUpstream', () => {
    const netid = '00:11:22:33:44:55';
    const endpoint = 'wifi';

    it('returns 503 if credentials are not configured', async () => {
      (secretsManager.get as jest.Mock).mockReturnValue(null);

      const result = await fetchUpstream(netid, endpoint);

      expect(result).toEqual({
        ok: false,
        status: 503,
        error: 'WiGLE API credentials not configured',
      });
    });

    it('returns 404 if WiGLE returns 404', async () => {
      (secretsManager.get as jest.Mock).mockReturnValue('some-val');
      (getEncodedWigleAuth as jest.Mock).mockReturnValue('encoded-auth');
      (wigleGatewayFetch as jest.Mock).mockResolvedValue({
        ok: true,
        response: {
          ok: false,
          status: 404,
          text: async () => 'Not Found',
        },
      });

      const result = await fetchUpstream(netid, endpoint);

      expect(result).toEqual({
        ok: false,
        status: 404,
        error:
          'Network not found in WiGLE. This is expected for randomized or locally-administered MAC addresses.',
      });
    });

    it('returns error if gateway fetch fails', async () => {
      (secretsManager.get as jest.Mock).mockReturnValue('some-val');
      (wigleGatewayFetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        error: 'Gateway Timeout',
      });

      const result = await fetchUpstream(netid, endpoint);

      expect(result).toEqual({
        ok: false,
        status: 500,
        error: 'Gateway Timeout',
      });
    });

    it('returns success and data on 200 OK', async () => {
      const mockData = { networkId: netid, name: 'Test' };
      (secretsManager.get as jest.Mock).mockReturnValue('some-val');
      (wigleGatewayFetch as jest.Mock).mockResolvedValue({
        ok: true,
        response: {
          ok: true,
          status: 200,
          json: async () => mockData,
        },
      });

      const result = await fetchUpstream(netid, endpoint);

      expect(result).toEqual({
        ok: true,
        data: mockData,
      });
    });
  });

  describe('importObservations', () => {
    const netid = '00:11:22:33:44:55';

    it('returns zeroes for non-array input', async () => {
      const result = await importObservations(netid, null as any);
      expect(result).toEqual({ newCount: 0, totalCount: 0, failedCount: 0 });
    });

    it('imports observations and returns counts', async () => {
      const locationClusters = [
        {
          clusterSsid: 'SSID1',
          locations: [
            { latitude: '1', longitude: '2', time: '2026-01-01T00:00:00Z' },
            { latitude: '3', longitude: '4', time: '2026-01-02T00:00:00Z' },
          ],
        },
      ];
      (importWigleV3ObservationRow as jest.Mock).mockResolvedValue(1);

      const result = await importObservations(netid, locationClusters);

      expect(result).toEqual({ newCount: 2, totalCount: 2, failedCount: 0 });
      expect(importWigleV3ObservationRow).toHaveBeenCalledTimes(2);
    });

    it('handles partial failures', async () => {
      const locationClusters = [
        {
          locations: [
            { ssid: 'S1', latitude: '1', longitude: '2', time: '2026-01-01T00:00:00Z' },
            { ssid: 'S2', latitude: '3', longitude: '4', time: '2026-01-02T00:00:00Z' },
          ],
        },
      ];
      (importWigleV3ObservationRow as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockRejectedValueOnce(new Error('DB Error'));

      const result = await importObservations(netid, locationClusters);

      expect(result).toEqual({ newCount: 1, totalCount: 2, failedCount: 1 });
    });
  });

  describe('fetchOrImportDetail', () => {
    const netid = '00:11:22:33:44:55';
    const endpoint = 'wifi';

    it('serves from cache if shouldImport is false and cached data exists', async () => {
      const mockCached = { netid, ssid: 'Cached' };
      (getWigleDetail as jest.Mock).mockResolvedValue(mockCached);
      (stripNullBytesDeep as jest.Mock).mockImplementation((d) => d);
      (mapCachedDetailToApiShape as jest.Mock).mockReturnValue(mockCached);

      const result = await fetchOrImportDetail(netid, endpoint, false);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.cached).toBe(true);
        expect(result.data).toEqual(mockCached);
      }
    });

    it('deduplicates if shouldImport is true and recent import exists', async () => {
      const mockRecent = { netid, ssid: 'Recent' };
      (getRecentWigleDetailImport as jest.Mock).mockResolvedValue(mockRecent);
      (getWigleObservations as jest.Mock).mockResolvedValue({ total: 50 });
      (stripNullBytesDeep as jest.Mock).mockImplementation((d) => d);
      (mapCachedDetailToApiShape as jest.Mock).mockReturnValue(mockRecent);

      const result = await fetchOrImportDetail(netid, endpoint, true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.deduplicated).toBe(true);
        expect(result.totalObservations).toBe(50);
      }
    });

    it('fetches from upstream and imports if cache miss', async () => {
      const mockData = { networkId: netid, name: 'New' };
      (getWigleDetail as jest.Mock).mockResolvedValue(null);
      (getRecentWigleDetailImport as jest.Mock).mockResolvedValue(null);

      // Mock fetchUpstream internally by mocking dependencies
      (secretsManager.get as jest.Mock).mockReturnValue('some-val');
      (wigleGatewayFetch as jest.Mock).mockResolvedValue({
        ok: true,
        response: {
          ok: true,
          status: 200,
          json: async () => mockData,
        },
      });

      (importWigleV3NetworkDetail as jest.Mock).mockResolvedValue(undefined);
      (stripNullBytes as jest.Mock).mockImplementation((s) => s);
      (stripNullBytesDeep as jest.Mock).mockImplementation((d) => d);
      (getWigleObservations as jest.Mock).mockResolvedValue({ total: 0 });

      const result = await fetchOrImportDetail(netid, endpoint, true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.imported).toBe(true);
        expect(result.cached).toBe(false);
      }
      expect(importWigleV3NetworkDetail).toHaveBeenCalled();
    });
  });

  describe('importDetailFromJson', () => {
    it('imports from json and returns result', async () => {
      const mockData = { networkId: 'AA:BB', name: 'JsonImport' };
      (importWigleV3NetworkDetail as jest.Mock).mockResolvedValue(undefined);
      (getWigleObservations as jest.Mock).mockResolvedValue({ total: 10 });
      (stripNullBytes as jest.Mock).mockImplementation((s) => s);
      (stripNullBytesDeep as jest.Mock).mockImplementation((d) => d);

      const result = await importDetailFromJson(mockData);

      expect(result.ok).toBe(true);
      expect(result.totalObservations).toBe(10);
      expect(importWigleV3NetworkDetail).toHaveBeenCalled();
    });
  });
});
