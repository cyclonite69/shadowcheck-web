export {};
const layerCountsService = require('../../../server/src/services/layerCountsService');
const layerCountsRepository = require('../../../server/src/repositories/layerCountsRepository');
const { cacheService } = require('../../../server/src/services/cacheService');

jest.mock('../../../server/src/repositories/layerCountsRepository', () => ({
  fetchAuthoritativeLayerCounts: jest.fn(),
}));

jest.mock('../../../server/src/services/cacheService', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
  },
}));

const mockCounts = {
  home: 1,
  fieldObservations: 870846,
  wigleKml: 420764,
  wigleV2: 232007,
  wigleV3: 217667,
  courthouses: 357,
  fieldOffices: 56,
  residentAgencies: 334,
  alpr: 187308,
  shotspotterZones: 11,
  shotspotterSensors: 20280,
};

describe('layerCountsService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await layerCountsService.invalidateLayerCountsCache();
  });

  it('fetches fresh counts from repository on cold cache and saves to cache', async () => {
    (cacheService.get as jest.Mock).mockResolvedValue(null);
    (layerCountsRepository.fetchAuthoritativeLayerCounts as jest.Mock).mockResolvedValue(
      mockCounts
    );

    const result = await layerCountsService.getLayerCounts();

    expect(result.cached).toBe(false);
    expect(result.counts).toEqual(mockCounts);
    expect(layerCountsRepository.fetchAuthoritativeLayerCounts).toHaveBeenCalledTimes(1);
    expect(cacheService.set).toHaveBeenCalledWith(
      'geospatial:layer_counts',
      expect.objectContaining({ counts: mockCounts }),
      900
    );
  });

  it('returns cached result from memory on subsequent calls without querying repository or Redis', async () => {
    (cacheService.get as jest.Mock).mockResolvedValue(null);
    (layerCountsRepository.fetchAuthoritativeLayerCounts as jest.Mock).mockResolvedValue(
      mockCounts
    );

    // Cold call
    const first = await layerCountsService.getLayerCounts();
    expect(first.cached).toBe(false);

    // Warm call
    const second = await layerCountsService.getLayerCounts();
    expect(second.cached).toBe(true);
    expect(second.counts).toEqual(mockCounts);
    expect(layerCountsRepository.fetchAuthoritativeLayerCounts).toHaveBeenCalledTimes(1);
    expect(cacheService.get).toHaveBeenCalledTimes(1); // Only checked on cold call
  });

  it('returns cached result from Redis if in-memory cache is cold', async () => {
    const timestamp = '2026-10-13T09:00:00.000Z';
    (cacheService.get as jest.Mock).mockResolvedValue({ counts: mockCounts, timestamp });

    const result = await layerCountsService.getLayerCounts();

    expect(result.cached).toBe(true);
    expect(result.counts).toEqual(mockCounts);
    expect(result.timestamp).toBe(timestamp);
    expect(layerCountsRepository.fetchAuthoritativeLayerCounts).not.toHaveBeenCalled();
  });

  it('shares in-flight promise across concurrent requests (stampede protection)', async () => {
    (cacheService.get as jest.Mock).mockResolvedValue(null);
    let resolveQuery: (val: any) => void;
    const delayedPromise = new Promise((resolve) => {
      resolveQuery = resolve;
    });
    (layerCountsRepository.fetchAuthoritativeLayerCounts as jest.Mock).mockReturnValue(
      delayedPromise
    );

    // Fire two concurrent requests
    const call1 = layerCountsService.getLayerCounts();
    const call2 = layerCountsService.getLayerCounts();

    resolveQuery!(mockCounts);
    const [res1, res2] = await Promise.all([call1, call2]);

    expect(res1.counts).toEqual(mockCounts);
    expect(res2.counts).toEqual(mockCounts);
    expect(layerCountsRepository.fetchAuthoritativeLayerCounts).toHaveBeenCalledTimes(1);
  });

  it('invalidates both memory and Redis cache', async () => {
    (cacheService.get as jest.Mock).mockResolvedValue(null);
    (layerCountsRepository.fetchAuthoritativeLayerCounts as jest.Mock).mockResolvedValue(
      mockCounts
    );

    await layerCountsService.getLayerCounts();
    expect(layerCountsRepository.fetchAuthoritativeLayerCounts).toHaveBeenCalledTimes(1);

    await layerCountsService.invalidateLayerCountsCache();
    expect(cacheService.del).toHaveBeenCalledWith('geospatial:layer_counts');

    // Next getLayerCounts must re-fetch from repo
    await layerCountsService.getLayerCounts();
    expect(layerCountsRepository.fetchAuthoritativeLayerCounts).toHaveBeenCalledTimes(2);
  });
});
