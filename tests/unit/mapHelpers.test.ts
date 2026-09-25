import { ensureHomeLocationLayers } from '../../client/src/utils/mapHelpers';

describe('mapHelpers - ensureHomeLocationLayers', () => {
  let mockMap: any;
  let homeLocation: { center: [number, number]; radius: number };

  beforeEach(() => {
    const sources: Record<string, any> = {};
    const layers: Record<string, any> = {};

    mockMap = {
      getSource: jest.fn((id: string) => sources[id]),
      addSource: jest.fn((id: string, config: any) => {
        sources[id] = {
          setData: jest.fn(),
          ...config,
        };
      }),
      getLayer: jest.fn((id: string) => layers[id]),
      addLayer: jest.fn((config: any) => {
        layers[config.id] = config;
      }),
      setLayoutProperty: jest.fn((id: string, property: string, value: any) => {
        if (layers[id]) {
          if (!layers[id].layout) {
            layers[id].layout = {};
          }
          layers[id].layout[property] = value;
        }
      }),
    };

    homeLocation = {
      center: [-83.6968, 43.0234],
      radius: 100,
    };
  });

  it('adds sources and layers when they do not exist', () => {
    ensureHomeLocationLayers(mockMap, homeLocation, true);

    expect(mockMap.addSource).toHaveBeenCalledWith('home-location-point', expect.any(Object));
    expect(mockMap.addSource).toHaveBeenCalledWith('home-location-circle', expect.any(Object));
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'home-circle-fill' })
    );
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'home-circle-outline' })
    );
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'home-dot' }));
    expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'home-marker' }));
  });

  it('updates sources and sets visibility when they already exist', () => {
    // Call once to add them
    ensureHomeLocationLayers(mockMap, homeLocation, true);

    // Reset mock call counts
    mockMap.addSource.mockClear();
    mockMap.addLayer.mockClear();

    // Call again to update/toggle visibility to false
    ensureHomeLocationLayers(mockMap, homeLocation, false);

    expect(mockMap.addSource).not.toHaveBeenCalled();
    expect(mockMap.addLayer).not.toHaveBeenCalled();
    expect(mockMap.setLayoutProperty).toHaveBeenCalledWith(
      'home-circle-fill',
      'visibility',
      'none'
    );
    expect(mockMap.setLayoutProperty).toHaveBeenCalledWith(
      'home-circle-outline',
      'visibility',
      'none'
    );
    expect(mockMap.setLayoutProperty).toHaveBeenCalledWith('home-dot', 'visibility', 'none');
    expect(mockMap.setLayoutProperty).toHaveBeenCalledWith('home-marker', 'visibility', 'none');
  });
});
