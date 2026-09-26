export {};

const React = require('react');

// Mock browser globals for Node test environment
if (typeof (global as any).window === 'undefined') {
  (global as any).window = {};
}
if (typeof (global as any).document === 'undefined') {
  (global as any).document = {
    createElement: () => ({ style: {} }),
  };
}

const mockEffects: Array<{ fn: () => void | (() => void); deps?: any[] }> = [];

React.useState = (initial: any) => [initial, jest.fn()];
React.useRef = (initial: any) => ({ current: initial });
React.useCallback = (fn: any) => fn;
React.useEffect = (fn: () => void | (() => void), deps?: any[]) => {
  mockEffects.push({ fn, deps });
};

// Mock apiClient and networkApi so client module loading succeeds in ts-jest
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../../client/src/api/client', () => ({
  apiClient: mockApiClient,
}));
jest.mock(
  '../../../api/client',
  () => ({
    apiClient: mockApiClient,
  }),
  { virtual: true }
);

jest.mock('../../../client/src/api/networkApi', () => ({
  networkApi: {
    getNetworkByBssid: jest.fn().mockResolvedValue(null),
  },
}));
jest.mock(
  '../api/networkApi',
  () => ({
    networkApi: {
      getNetworkByBssid: jest.fn().mockResolvedValue(null),
    },
  }),
  { virtual: true }
);

import { useKeplerDeck } from '../../../client/src/hooks/useKeplerDeck';

describe('useKeplerDeck cleanup regression tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEffects.length = 0;
    (global as any).window.deck = {
      DeckGL: jest.fn(),
      FlyToInterpolator: jest.fn(),
    };
    (global as any).window.mapboxgl = {
      NavigationControl: jest.fn(),
    };
  });

  afterEach(() => {
    delete (global as any).window.deck;
    delete (global as any).window.mapboxgl;
  });

  it('calls finalize() on deck instance and nulls deckRef upon unmount', () => {
    const mockMap = {
      removeControl: jest.fn(),
      remove: jest.fn(),
    };
    const mockDeck = {
      setProps: jest.fn(),
      finalize: jest.fn(),
      getMapboxMap: jest.fn(() => mockMap),
    };

    const hookResult = useKeplerDeck({
      layerType: 'scatterplot',
      pointSize: 5,
      pitch: 0,
      height3d: 10,
    });

    // Verify unmount effect was registered with empty deps
    expect(mockEffects.length).toBeGreaterThan(0);
    const unmountEffect = mockEffects.find((e) => Array.isArray(e.deps) && e.deps.length === 0);
    expect(unmountEffect).toBeDefined();

    // Execute the effect to obtain its cleanup function
    const cleanup = unmountEffect!.fn();
    expect(typeof cleanup).toBe('function');

    // Attach active deck instance to deckRef
    hookResult.deckRef.current = mockDeck;
    expect(hookResult.deckRef.current).toBe(mockDeck);

    // Run cleanup (simulate unmount)
    (cleanup as () => void)();

    // Assert finalize() was called on deck.gl
    expect(mockDeck.finalize).toHaveBeenCalledTimes(1);
    // Assert deckRef was nulled out
    expect(hookResult.deckRef.current).toBeNull();
  });

  it('releases WebGL context via WEBGL_lose_context, destroys device, and stops canvasObserver upon unmount', () => {
    const mockLoseContext = jest.fn();
    const mockMapLoseContext = jest.fn();
    const mockGl = {
      getExtension: jest.fn((extName: string) => {
        if (extName === 'WEBGL_lose_context') {
          return { loseContext: mockLoseContext };
        }
        return null;
      }),
    };
    const mockMapGl = {
      getExtension: jest.fn((extName: string) => {
        if (extName === 'WEBGL_lose_context') {
          return { loseContext: mockMapLoseContext };
        }
        return null;
      }),
    };
    const mockCanvasObserver = {
      stop: jest.fn(),
    };
    const mockCanvasContext = {
      _canvasObserver: mockCanvasObserver,
      destroy: jest.fn(),
    };
    const mockDevice = {
      gl: mockGl,
      destroy: jest.fn(),
    };
    const mockMap = {
      painter: {
        context: {
          gl: mockMapGl,
        },
      },
      removeControl: jest.fn(),
      remove: jest.fn(),
    };
    const mockDeck = {
      _canvasContext: mockCanvasContext,
      device: mockDevice,
      finalize: jest.fn(),
      getMapboxMap: jest.fn(() => mockMap),
    };

    const hookResult = useKeplerDeck({
      layerType: 'scatterplot',
      pointSize: 5,
      pitch: 0,
      height3d: 10,
    });

    const unmountEffect = mockEffects.find((e) => Array.isArray(e.deps) && e.deps.length === 0);
    const cleanup = unmountEffect!.fn();

    hookResult.deckRef.current = mockDeck;

    (cleanup as () => void)();

    expect(mockCanvasObserver.stop).toHaveBeenCalledTimes(1);
    expect(mockCanvasContext.destroy).toHaveBeenCalledTimes(1);
    expect(mockLoseContext).toHaveBeenCalledTimes(1);
    expect(mockMapLoseContext).toHaveBeenCalledTimes(1);
    expect(mockDevice.destroy).toHaveBeenCalledTimes(1);
    expect(mockDeck.finalize).toHaveBeenCalledTimes(1);
    expect(hookResult.deckRef.current).toBeNull();
  });

  it('falls back to map.remove() and nulls deckRef when finalize() is not present', () => {
    const mockMap = {
      removeControl: jest.fn(),
      remove: jest.fn(),
    };
    // Instance lacking finalize()
    const mockDeck = {
      setProps: jest.fn(),
      getMapboxMap: jest.fn(() => mockMap),
    };

    const hookResult = useKeplerDeck({
      layerType: 'scatterplot',
      pointSize: 5,
      pitch: 0,
      height3d: 10,
    });

    const unmountEffect = mockEffects.find((e) => Array.isArray(e.deps) && e.deps.length === 0);
    const cleanup = unmountEffect!.fn();

    hookResult.deckRef.current = mockDeck;

    (cleanup as () => void)();

    // Fallback path removes underlying map
    expect(mockMap.remove).toHaveBeenCalledTimes(1);
    expect(hookResult.deckRef.current).toBeNull();
  });

  it('prevents post-unmount execution of initDeck if component unmounted', () => {
    const mockDeckConstructor = jest.fn();
    (global as any).window.deck.DeckGL = mockDeckConstructor;

    const hookResult = useKeplerDeck({
      layerType: 'scatterplot',
      pointSize: 5,
      pitch: 0,
      height3d: 10,
    });

    hookResult.mapRef.current = { clientWidth: 1000, clientHeight: 800, innerHTML: '' } as any;

    const unmountEffect = mockEffects.find((e) => Array.isArray(e.deps) && e.deps.length === 0);
    const cleanup = unmountEffect!.fn();

    // Unmount first
    (cleanup as () => void)();

    // Attempt initDeck after unmount
    hookResult.initDeck('test-token', []);

    // Constructor must not be called after unmount
    expect(mockDeckConstructor).not.toHaveBeenCalled();
    expect(hookResult.deckRef.current).toBeNull();
  });

  it('cleans up mapbox map when referenced via _map.map and stops animationLoop', () => {
    const mockMapLoseContext = jest.fn();
    const mockMap = {
      painter: {
        context: {
          gl: {
            getExtension: jest.fn((name: string) =>
              name === 'WEBGL_lose_context' ? { loseContext: mockMapLoseContext } : null
            ),
          },
        },
      },
      remove: jest.fn(),
    };
    const mockAnimationLoop = {
      stop: jest.fn(),
      destroy: jest.fn(),
    };
    const mockFinalizeMap = jest.fn(() => {
      mockMap.remove();
    });
    const mockDeck = {
      animationLoop: mockAnimationLoop,
      _map: {
        map: mockMap,
        finalize: mockFinalizeMap,
      },
      finalize: jest.fn(() => {
        mockFinalizeMap();
      }),
    };

    const hookResult = useKeplerDeck({
      layerType: 'scatterplot',
      pointSize: 5,
      pitch: 0,
      height3d: 10,
    });

    const unmountEffect = mockEffects.find((e) => Array.isArray(e.deps) && e.deps.length === 0);
    const cleanup = unmountEffect!.fn();

    hookResult.deckRef.current = mockDeck;

    (cleanup as () => void)();

    expect(mockAnimationLoop.stop).toHaveBeenCalledTimes(1);
    expect(mockAnimationLoop.destroy).toHaveBeenCalledTimes(1);
    expect(mockMapLoseContext).toHaveBeenCalledTimes(1);
    expect(mockMap.remove).toHaveBeenCalledTimes(1);
    expect(mockFinalizeMap).toHaveBeenCalledTimes(1);
    expect(mockDeck.finalize).toHaveBeenCalledTimes(1);
    expect(hookResult.deckRef.current).toBeNull();
  });
});
