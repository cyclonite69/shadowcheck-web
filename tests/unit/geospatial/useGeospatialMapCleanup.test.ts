export {};

const React = require('react');

const mockEffects: Array<{ fn: () => void | (() => void); deps?: any[] }> = [];

React.useState = (initial: any) => [initial, jest.fn()];
React.useRef = (initial: any) => ({ current: initial });
React.useCallback = (fn: any) => fn;
React.useEffect = (fn: () => void | (() => void), deps?: any[]) => {
  mockEffects.push({ fn, deps });
};

// Mock sub-hooks
const mockInitMap = jest.fn();
jest.mock('../../../client/src/components/geospatial/hooks/useMapInitialization', () => ({
  useMapInitialization: () => ({ initMap: mockInitMap }),
}));

const mockPopupCleanup = jest.fn();
const mockAttachPopupHandlers = jest.fn(() => mockPopupCleanup);
jest.mock('../../../client/src/components/geospatial/hooks/useMapPopups', () => ({
  useMapPopups: () => ({ attachPopupHandlers: mockAttachPopupHandlers }),
}));

const mockHoverCleanup = jest.fn();
const mockAttachHoverHandlers = jest.fn(() => mockHoverCleanup);
const mockAddBaseSourcesAndLayers = jest.fn();
jest.mock('../../../client/src/components/geospatial/hooks/useMapLayers', () => ({
  useMapLayers: () => ({
    addBaseSourcesAndLayers: mockAddBaseSourcesAndLayers,
    attachHoverHandlers: mockAttachHoverHandlers,
  }),
}));

import { useGeospatialMap } from '../../../client/src/components/geospatial/hooks/useGeospatialMap';

describe('useGeospatialMap cleanup regression tests', () => {
  let mockMapRef: any;
  let mockMapboxRef: any;
  let mockMapContainerRef: any;
  let mockMapInitRef: any;
  let mockSetMapReady: jest.Mock;
  let mockSetMapError: jest.Mock;
  let mockLogError: jest.Mock;

  beforeEach(() => {
    mockEffects.length = 0;

    mockMapRef = { current: null };
    mockMapboxRef = { current: null };
    mockMapContainerRef = { current: { innerHTML: '' } };
    mockMapInitRef = { current: false };
    mockSetMapReady = jest.fn();
    mockSetMapError = jest.fn();
    mockLogError = jest.fn();

    mockPopupCleanup.mockClear();
    mockHoverCleanup.mockClear();
    mockAttachPopupHandlers.mockReturnValue(mockPopupCleanup);
    mockAttachHoverHandlers.mockReturnValue(mockHoverCleanup);
  });

  it('calls map.remove(), cleans up handlers, and resets mapReady on unmount', async () => {
    const mockMap = {
      isStyleLoaded: jest.fn(() => true),
      on: jest.fn(),
      off: jest.fn(),
      remove: jest.fn(),
    };

    mockInitMap.mockImplementation(async () => {
      mockMapRef.current = mockMap;
      return mockMap;
    });

    useGeospatialMap({
      mapStyle: 'mapbox://styles/mapbox/light-v11',
      homeLocation: { center: [-83.69, 43.02], radius: 100 },
      mapRef: mockMapRef,
      mapboxRef: mockMapboxRef,
      mapContainerRef: mockMapContainerRef,
      mapInitRef: mockMapInitRef,
      setMapReady: mockSetMapReady,
      setMapError: mockSetMapError,
      logError: mockLogError,
    });

    const unmountEffect = mockEffects.find((e) => Array.isArray(e.deps) && e.deps.length === 0);
    expect(unmountEffect).toBeDefined();

    const cleanup = unmountEffect!.fn();
    expect(typeof cleanup).toBe('function');

    // Allow all microtasks to drain so onMapLoad completes
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockAttachPopupHandlers).toHaveBeenCalledWith(mockMap);
    expect(mockSetMapReady).toHaveBeenCalledWith(true);

    // Now trigger unmount cleanup
    (cleanup as () => void)();

    // Verify map.remove() was called to release WebGL context
    expect(mockMap.remove).toHaveBeenCalledTimes(1);
    // Verify mapRef is cleared
    expect(mockMapRef.current).toBeNull();
    // Verify mapReady is reset to false
    expect(mockSetMapReady).toHaveBeenCalledWith(false);
    // Verify handlers cleaned up
    expect(mockPopupCleanup).toHaveBeenCalledTimes(1);
    expect(mockHoverCleanup).toHaveBeenCalledTimes(1);
  });

  it('respects cancelled flag on late-resolving init and immediately removes orphaned map', async () => {
    let resolveInit: (map: any) => void;
    const pendingInitPromise = new Promise((resolve) => {
      resolveInit = resolve;
    });

    mockInitMap.mockReturnValue(pendingInitPromise);

    useGeospatialMap({
      mapStyle: 'mapbox://styles/mapbox/light-v11',
      homeLocation: { center: [-83.69, 43.02], radius: 100 },
      mapRef: mockMapRef,
      mapboxRef: mockMapboxRef,
      mapContainerRef: mockMapContainerRef,
      mapInitRef: mockMapInitRef,
      setMapReady: mockSetMapReady,
      setMapError: mockSetMapError,
      logError: mockLogError,
    });

    const unmountEffect = mockEffects.find((e) => Array.isArray(e.deps) && e.deps.length === 0);
    const cleanup = unmountEffect!.fn();

    // Component unmounts BEFORE initMap promise resolves!
    (cleanup as () => void)();

    const lateMockMap = {
      isStyleLoaded: jest.fn(() => true),
      on: jest.fn(),
      off: jest.fn(),
      remove: jest.fn(),
    };

    // Now initMap resolves after unmount
    resolveInit!(lateMockMap);
    await Promise.resolve();
    await Promise.resolve();

    // The late map must be destroyed immediately because cancelled === true
    expect(lateMockMap.remove).toHaveBeenCalledTimes(1);
    // It must NOT attach interactive handlers or set mapReady
    expect(mockAttachPopupHandlers).not.toHaveBeenCalled();
    expect(mockAttachHoverHandlers).not.toHaveBeenCalled();
    expect(mockSetMapReady).not.toHaveBeenCalledWith(true);
    expect(mockMapRef.current).toBeNull();
  });
});
