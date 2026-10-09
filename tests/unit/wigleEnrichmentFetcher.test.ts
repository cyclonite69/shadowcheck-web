/**
 * Unit tests for wigleEnrichmentFetcher
 */

import { fetchAndImportDetail } from '../../server/src/services/wigleEnrichmentFetcher';
import { fetchOrImportDetail } from '../../server/src/services/wigleDetailService';
import { inferWigleEndpoint } from '../../server/src/services/wigleDetailTransforms';

jest.mock('../../server/src/services/wigleDetailService', () => ({
  fetchOrImportDetail: jest.fn(),
}));

jest.mock('../../server/src/services/wigleDetailTransforms', () => ({
  inferWigleEndpoint: jest.fn(),
}));

describe('wigleEnrichmentFetcher', () => {
  const bssid = 'AA:BB:CC:DD:EE:FF';
  const type = 'W';

  beforeEach(() => {
    jest.clearAllMocks();
    (inferWigleEndpoint as jest.Mock).mockReturnValue('wifi');
  });

  it('returns null when fetchOrImportDetail reports 404', async () => {
    (fetchOrImportDetail as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      error: 'Network not found',
    });

    const result = await fetchAndImportDetail(bssid, type);
    expect(result).toBeNull();
    expect(fetchOrImportDetail).toHaveBeenCalledWith(bssid, 'wifi', true, 'enrichment');
  });

  it('throws when a successful detail response has no networkId', async () => {
    (fetchOrImportDetail as jest.Mock).mockResolvedValue({
      ok: true,
      data: { success: false },
      cached: false,
      deduplicated: false,
    });

    await expect(fetchAndImportDetail(bssid, type)).rejects.toThrow(
      `WiGLE detail response missing networkId for ${bssid}`
    );
  });

  it('throws on non-404 API failures', async () => {
    (fetchOrImportDetail as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      error: 'Internal Server Error',
    });

    await expect(fetchAndImportDetail(bssid, type)).rejects.toThrow('Internal Server Error');
  });

  it('delegates successful imports to fetchOrImportDetail', async () => {
    (fetchOrImportDetail as jest.Mock).mockResolvedValue({
      ok: true,
      data: { networkId: bssid },
      imported: true,
      cached: false,
      importedObservations: 3,
    });

    const result = await fetchAndImportDetail(bssid, type);
    expect(result).toEqual({ bssid, obsCount: 3 });
  });

  it('treats cached/deduplicated detail as success with zero new observations', async () => {
    (fetchOrImportDetail as jest.Mock).mockResolvedValue({
      ok: true,
      data: { networkId: bssid },
      imported: false,
      cached: true,
      deduplicated: true,
      importedObservations: 0,
    });

    const result = await fetchAndImportDetail(bssid, type);
    expect(result).toEqual({ bssid, obsCount: 0 });
  });
});
