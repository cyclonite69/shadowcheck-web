export {};

const React = require('react');

React.useCallback = (fn: any) => fn;

// Mock mapboxApi token service
const mockGetMapboxToken = jest.fn();
jest.mock('../../../client/src/api/mapboxApi', () => ({
  mapboxApi: {
    getMapboxToken: () => mockGetMapboxToken(),
  },
}));

// Mock CSS import
jest.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}), { virtual: true });

// Mock orientation controls
jest.mock('../../../client/src/utils/mapOrientationControls', () => ({
  attachMapOrientationControls: jest.fn().mockResolvedValue(jest.fn()),
}));

import { useMapInitialization } from '../../../client/src/components/geospatial/hooks/useMapInitialization';

describe('useMapInitialization cleanup regression tests', () => {
  let mockMapRef: any;
  let mockMapboxRef: any;
  let mockMapContainerRef: any;
  let mockSetMapReady: jest.Mock;
  let mockSetMapError: jest.Mock;
  let mockLogError: jest.Mock;
  let mockNewMap: any;
  let mockMapboxGl: any;

  beforeEach(() => {
    mockGetMapboxToken.mockReset();
    mockGetMapboxToken.mockResolvedValue({ token: 'pk.test-token-123' });

    mockNewMap = {
      addControl: jest.fn(),
      on: jest.fn(),
      remove: jest.fn(),
      setConfigProperty: jest.fn(),
    };

    mockMapboxGl = {
      accessToken: '',
      Map: jest.fn().mockImplementation(() => mockNewMap),
      NavigationControl: jest.fn().mockImplementation(() => ({})),
    };

    mockMapRef = { current: null };
    mockMapboxRef = { current: mockMapboxGl };
    mockMapContainerRef = { current: { innerHTML: '<div>existing-canvas</div>' } };
    mockSetMapReady = jest.fn();
    mockSetMapError = jest.fn();
    mockLogError = jest.fn();
  });

  it('removes prior map instance before re-initializing a new map', async () => {
    const priorMap = {
      remove: jest.fn(),
    };

    // Simulate mapRef already holding an active prior map
    mockMapRef.current = priorMap;

    const { initMap } = useMapInitialization({
      mapStyle: 'mapbox://styles/mapbox/dark-v11',
      homeLocation: { center: [-83.69, 43.02], radius: 100 },
      mapRef: mockMapRef,
      mapboxRef: mockMapboxRef,
      mapContainerRef: mockMapContainerRef,
      setMapReady: mockSetMapReady,
      setMapError: mockSetMapError,
      logError: mockLogError,
    });

    const returnedMap = await initMap();

    // Verify prior map had remove() called to destroy its WebGL context
    expect(priorMap.remove).toHaveBeenCalledTimes(1);

    // Verify container innerHTML was cleared
    expect(mockMapContainerRef.current.innerHTML).toBe('');

    // Verify new map instance was created and assigned to mapRef
    expect(mockMapboxGl.Map).toHaveBeenCalledTimes(1);
    expect(returnedMap).toBe(mockNewMap);
    expect(mockMapRef.current).toBe(mockNewMap);
  });

  it('safely handles exception during prior map.remove() and still creates new map', async () => {
    const failingPriorMap = {
      remove: jest.fn().mockImplementation(() => {
        throw new Error('WebGL context already lost');
      }),
    };

    mockMapRef.current = failingPriorMap;

    const { initMap } = useMapInitialization({
      mapStyle: 'mapbox://styles/mapbox/dark-v11',
      homeLocation: { center: [-83.69, 43.02], radius: 100 },
      mapRef: mockMapRef,
      mapboxRef: mockMapboxRef,
      mapContainerRef: mockMapContainerRef,
      setMapReady: mockSetMapReady,
      setMapError: mockSetMapError,
      logError: mockLogError,
    });

    const returnedMap = await initMap();

    // Attempted to remove prior map
    expect(failingPriorMap.remove).toHaveBeenCalledTimes(1);

    // Despite error during remove, new map must still be created
    expect(mockMapboxGl.Map).toHaveBeenCalledTimes(1);
    expect(returnedMap).toBe(mockNewMap);
    expect(mockMapRef.current).toBe(mockNewMap);
  });
});
