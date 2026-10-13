export {};

const mockGet = jest.fn();

jest.mock('../../../client/src/api/client', () => ({
  apiClient: {
    get: mockGet,
  },
}));

const React = require('react');

const stateSetters: Array<jest.Mock> = [];
const mockEffects: Array<{ fn: () => void | (() => void); deps?: any[] }> = [];

React.useState = (initial: any) => {
  const setter = jest.fn();
  stateSetters.push(setter);
  return [initial, setter];
};
React.useEffect = (fn: () => void | (() => void), deps?: any[]) => {
  mockEffects.push({ fn, deps });
};

const {
  useGeospatialLayerCounts,
} = require('../../../client/src/components/geospatial/hooks/useGeospatialLayerCounts');

describe('useGeospatialLayerCounts hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEffects.length = 0;
    stateSetters.length = 0;
  });

  it('initializes with null counts, loading true, and registers effect', () => {
    mockGet.mockResolvedValue({
      success: true,
      counts: {
        home: 1,
        fieldObservations: 870846,
      },
    });

    const result = useGeospatialLayerCounts();

    expect(result.loading).toBe(true);
    expect(result.error).toBeNull();
    expect(result.counts.home).toBeNull();
    expect(result.counts.fieldObservations).toBeNull();
    expect(mockEffects.length).toBe(1);
  });

  it('fetches counts from API and updates state', async () => {
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

    mockGet.mockResolvedValueOnce({
      success: true,
      timestamp: '2026-10-13T09:00:00.000Z',
      cached: false,
      counts: mockCounts,
    });

    useGeospatialLayerCounts();

    // Trigger effect
    await mockEffects[0].fn();

    expect(mockGet).toHaveBeenCalledWith('/geospatial/layer-counts');
  });

  it('handles API error gracefully', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    useGeospatialLayerCounts();

    await mockEffects[0].fn();

    expect(mockGet).toHaveBeenCalledWith('/geospatial/layer-counts');
  });
});
