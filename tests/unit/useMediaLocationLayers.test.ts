// Mock React's useEffect to capture/run the callback
let effectCallback: any = null;
const mockSetMediaStatus = jest.fn();
jest.mock('react', () => ({
  useEffect: (cb: any) => {
    effectCallback = cb;
  },
  useState: (initialValue: any) => [initialValue, mockSetMediaStatus],
  createElement: jest.fn().mockReturnValue({ type: 'div' }),
}));

// Mock react-dom/client createRoot
const mockRender = jest.fn();
const mockUnmount = jest.fn();
jest.mock('react-dom/client', () => ({
  createRoot: jest.fn().mockImplementation(() => ({
    render: mockRender,
    unmount: mockUnmount,
  })),
}));

// Mock global document object for node-only environment
(global as any).document = {
  createElement: () => {
    return {
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  },
};

import { useMediaLocationLayers } from '../../client/src/components/geospatial/hooks/useMediaLocationLayers';
import { networkApi } from '../../client/src/api/networkApi';
import { createRoot } from 'react-dom/client';

jest.mock('../../client/src/api/networkApi', () => ({
  networkApi: {
    getUnmatchedMediaGeoJson: jest.fn(),
    getMatchedMediaGeoJson: jest.fn(),
  },
}));

describe('useMediaLocationLayers', () => {
  let mockMap: any;
  let mockMapboxgl: any;
  let mockPopup: any;
  let popupElement: any;
  let mediaClickHandler: ((event: any) => void) | null = null;
  let matchedMediaClickHandler: ((event: any) => void) | null = null;
  let popupClickHandler: ((event: any) => void) | null = null;
  let mapRef: any;
  let mapboxRef: any;
  let popupOnCloseHandler: (() => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    effectCallback = null;
    mediaClickHandler = null;
    matchedMediaClickHandler = null;
    popupClickHandler = null;
    popupOnCloseHandler = null;

    (globalThis as any).window = { open: jest.fn() };

    popupElement = {
      addEventListener: jest.fn((event: string, handler: (event: any) => void) => {
        if (event === 'click') {
          popupClickHandler = handler;
        }
      }),
    };
    mockPopup = {
      setLngLat: jest.fn().mockReturnThis(),
      setHTML: jest.fn().mockReturnThis(),
      setDOMContent: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      getElement: jest.fn().mockReturnValue(popupElement),
      remove: jest.fn(),
      on: jest.fn((event: string, handler: () => void) => {
        if (event === 'close') {
          popupOnCloseHandler = handler;
        }
        return mockPopup;
      }),
    };

    mockMap = {
      addSource: jest.fn(),
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
      removeSource: jest.fn(),
      getSource: jest.fn(),
      getLayer: jest.fn(),
      on: jest.fn((event: string, layer: string, handler: (event: any) => void) => {
        if (event === 'click' && layer === 'media-location-markers') {
          mediaClickHandler = handler;
        } else if (event === 'click' && layer === 'matched-media-markers') {
          matchedMediaClickHandler = handler;
        }
      }),
      off: jest.fn(),
    };

    mockMapboxgl = {
      Popup: jest.fn().mockImplementation(() => mockPopup),
    };

    mapRef = { current: mockMap };
    mapboxRef = { current: mockMapboxgl };

    (createRoot as jest.Mock).mockImplementation(() => ({
      render: mockRender,
      unmount: mockUnmount,
    }));
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('does nothing when showMediaLocations is false and no layers exist', () => {
    mockMap.getSource.mockReturnValue(false);
    mockMap.getLayer.mockReturnValue(false);

    useMediaLocationLayers({
      mapReady: true,
      mapRef,
      mapboxRef,
      showMediaLocations: false,
    });

    if (effectCallback) {
      effectCallback();
    }

    expect(mockMap.removeSource).not.toHaveBeenCalled();
    expect(mockMap.removeLayer).not.toHaveBeenCalled();
    expect(mockSetMediaStatus).toHaveBeenCalledWith('idle');
  });

  it('removes existing sources/layers when showMediaLocations becomes false', () => {
    mockMap.getLayer.mockImplementation((id: string) => true);
    mockMap.getSource.mockImplementation((id: string) => true);

    useMediaLocationLayers({
      mapReady: true,
      mapRef,
      mapboxRef,
      showMediaLocations: false,
    });

    if (effectCallback) {
      effectCallback();
    }

    // Unmatched cleanup
    expect(mockMap.removeLayer).toHaveBeenCalledWith('media-location-icons');
    expect(mockMap.removeLayer).toHaveBeenCalledWith('media-location-markers');
    expect(mockMap.removeSource).toHaveBeenCalledWith('media-locations');

    // Matched cleanup
    expect(mockMap.removeLayer).toHaveBeenCalledWith('matched-media-count-labels');
    expect(mockMap.removeLayer).toHaveBeenCalledWith('matched-media-fallback-warnings');
    expect(mockMap.removeLayer).toHaveBeenCalledWith('matched-media-icons');
    expect(mockMap.removeLayer).toHaveBeenCalledWith('matched-media-markers');
    expect(mockMap.removeSource).toHaveBeenCalledWith('matched-media-locations');

    expect(mockSetMediaStatus).toHaveBeenCalledWith('idle');
  });

  it('adds GeoJSON sources and layers for both unmatched and matched endpoints', async () => {
    const mockEmptyGeoJson = {
      type: 'FeatureCollection',
      features: [],
    };
    (networkApi.getUnmatchedMediaGeoJson as jest.Mock).mockResolvedValue(mockEmptyGeoJson);
    (networkApi.getMatchedMediaGeoJson as jest.Mock).mockResolvedValue(mockEmptyGeoJson);

    useMediaLocationLayers({
      mapReady: true,
      mapRef,
      mapboxRef,
      showMediaLocations: true,
    });

    expect(effectCallback).toBeDefined();
    const cleanup = effectCallback();

    // Allow promise microtasks to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(networkApi.getUnmatchedMediaGeoJson).toHaveBeenCalled();
    expect(networkApi.getMatchedMediaGeoJson).toHaveBeenCalled();

    // Check unmatched setup
    expect(mockMap.addSource).toHaveBeenCalledWith('media-locations', {
      type: 'geojson',
      data: mockEmptyGeoJson,
    });
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'media-location-markers', type: 'circle' })
    );

    // Check matched setup
    expect(mockMap.addSource).toHaveBeenCalledWith('matched-media-locations', {
      type: 'geojson',
      data: mockEmptyGeoJson,
    });
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'matched-media-markers', type: 'circle' })
    );
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'matched-media-fallback-warnings', type: 'circle' })
    );
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'matched-media-count-labels', type: 'symbol' })
    );

    expect(mockMap.on).toHaveBeenCalledWith(
      'click',
      'media-location-markers',
      expect.any(Function)
    );
    expect(mockMap.on).toHaveBeenCalledWith('click', 'matched-media-markers', expect.any(Function));

    expect(mockSetMediaStatus).toHaveBeenNthCalledWith(1, 'loading');
    expect(mockSetMediaStatus).toHaveBeenNthCalledWith(2, 'empty');

    if (cleanup) {
      mockMap.getLayer.mockImplementation(() => true);
      mockMap.getSource.mockImplementation(() => true);
      cleanup();
      expect(mockMap.off).toHaveBeenCalledWith(
        'click',
        'media-location-markers',
        expect.any(Function)
      );
      expect(mockMap.off).toHaveBeenCalledWith(
        'click',
        'matched-media-markers',
        expect.any(Function)
      );
    }
  });

  it('triggers React carousel popup rendering on matched media marker click', async () => {
    const mockEmptyGeoJson = {
      type: 'FeatureCollection',
      features: [],
    };
    (networkApi.getUnmatchedMediaGeoJson as jest.Mock).mockResolvedValue(mockEmptyGeoJson);
    (networkApi.getMatchedMediaGeoJson as jest.Mock).mockResolvedValue({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-83.69, 43.02] },
          properties: {
            component_id: 'group_1',
            media_count: 2,
            media_ids: '[101, 102]',
            member_bssids: '["AA:BB:CC:DD:EE:FF", "AA:BB:CC:DD:EE:FE"]',
            marker_location_source: 'observation',
          },
        },
      ],
    });

    useMediaLocationLayers({
      mapReady: true,
      mapRef,
      mapboxRef,
      showMediaLocations: true,
    });

    effectCallback?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(matchedMediaClickHandler).not.toBeNull();
    matchedMediaClickHandler?.({
      features: [
        {
          properties: {
            component_id: 'group_1',
            media_count: 2,
            media_ids: '[101, 102]',
            member_bssids: '["AA:BB:CC:DD:EE:FF", "AA:BB:CC:DD:EE:FE"]',
            marker_location_source: 'observation',
          },
        },
      ],
      lngLat: { lng: -83.69, lat: 43.02 },
    });

    expect(mockPopup.setLngLat).toHaveBeenCalledWith({ lng: -83.69, lat: 43.02 });
    expect(mockPopup.setDOMContent).toHaveBeenCalledWith(expect.any(Object));
    expect(createRoot).toHaveBeenCalled();
    expect(mockRender).toHaveBeenCalled();

    // Verify root unmount triggers when popup is closed
    expect(popupOnCloseHandler).not.toBeNull();
    popupOnCloseHandler?.();
    expect(mockUnmount).toHaveBeenCalled();
  });
});
