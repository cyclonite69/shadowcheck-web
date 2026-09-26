export {};

const React = require('react');

// Mock browser globals for Node test environment
if (typeof (global as any).window === 'undefined') {
  (global as any).window = { innerWidth: 1024 };
}

const mockUseKepler = jest.fn();
const mockUseKeplerDeck = jest.fn();
const mockInitDeck = jest.fn();
const mockLoadScript = jest.fn();
const mockLoadCss = jest.fn();

jest.mock('../../../client/src/hooks/useKepler', () => ({
  useKepler: (...args: any[]) => mockUseKepler(...args),
}));

jest.mock('../../../client/src/hooks/useKeplerDeck', () => ({
  useKeplerDeck: (...args: any[]) => mockUseKeplerDeck(...args),
}));

jest.mock('../../../client/src/hooks/usePageFilters', () => ({
  usePageFilters: jest.fn(),
}));

jest.mock('../../../client/src/hooks/useAdaptedFilters', () => ({
  useDebouncedAdaptedFilters: jest.fn(() => ({})),
}));

jest.mock('../../../client/src/hooks/useFilterURLSync', () => ({
  useFilterURLSync: jest.fn(),
}));

jest.mock('../../../client/src/utils/filterCapabilities', () => ({
  getPageCapabilities: jest.fn(() => ({})),
}));

jest.mock('../../../client/src/components/kepler/utils', () => ({
  loadScript: (...args: any[]) => mockLoadScript(...args),
  loadCss: (...args: any[]) => mockLoadCss(...args),
}));

jest.mock('../../../client/src/components/AppHeader', () => ({
  AppHeader: () => null,
}));

jest.mock('../../../client/src/components/kepler/KeplerVisualization', () => ({
  KeplerVisualization: () => null,
}));

jest.mock('../../../client/src/components/kepler/KeplerControls', () => ({
  KeplerControls: () => null,
}));

jest.mock('../../../client/src/components/kepler/KeplerFilters', () => ({
  KeplerFilters: () => null,
}));

jest.mock('../../../client/src/logging/clientLogger', () => ({
  logError: jest.fn(),
  logDebug: jest.fn(),
}));

const KeplerPage = require('../../../client/src/components/KeplerPage').default;

describe('KeplerPage initialization regression tests (scriptsLoaded race condition)', () => {
  let activeEffects: Array<{ effect: () => void | (() => void); deps?: any[] }>;
  let stateMap: Map<number, any>;
  let stateIndex: number;

  const originalUseState = React.useState;
  const originalUseEffect = React.useEffect;
  const originalUseRef = React.useRef;
  const originalUseMemo = React.useMemo;
  const originalUseCallback = React.useCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadScript.mockResolvedValue(undefined);
    mockLoadCss.mockResolvedValue(undefined);
    mockUseKeplerDeck.mockReturnValue({
      mapRef: { current: {} },
      deckRef: { current: null },
      zoom: 10,
      setZoom: jest.fn(),
      handleFitBounds: jest.fn(),
      initDeck: mockInitDeck,
      tooltipState: null,
      clearTooltip: jest.fn(),
    });

    activeEffects = [];
    stateMap = new Map<number, any>();
    stateIndex = 0;

    React.useRef = (init: any) => ({ current: init });
    React.useMemo = (fn: any) => fn();
    React.useCallback = (fn: any) => fn;

    React.useState = (init: any) => {
      const id = stateIndex++;
      if (!stateMap.has(id)) {
        stateMap.set(id, typeof init === 'function' ? init() : init);
      }
      const setter = (next: any) => {
        stateMap.set(id, typeof next === 'function' ? next(stateMap.get(id)) : next);
      };
      return [stateMap.get(id), setter];
    };

    React.useEffect = (effect: () => void | (() => void), deps?: any[]) => {
      activeEffects.push({ effect, deps });
    };
  });

  afterAll(() => {
    React.useState = originalUseState;
    React.useEffect = originalUseEffect;
    React.useRef = originalUseRef;
    React.useMemo = originalUseMemo;
    React.useCallback = originalUseCallback;
  });

  it('fires initDeck() when mapboxToken and networkData become ready after scriptsLoaded has already flipped to true', async () => {
    // 1. Initial render state: API in flight, mapboxToken empty, networkData empty
    let currentKeplerState: {
      loading: boolean;
      error: string;
      networkData: any[];
      mapboxToken: string;
      actualCounts: any;
    } = {
      loading: true,
      error: '',
      networkData: [],
      mapboxToken: '',
      actualCounts: null,
    };
    mockUseKepler.mockImplementation(() => currentKeplerState);

    // Render 1: Initial mount
    stateIndex = 0;
    activeEffects.length = 0;
    KeplerPage({});

    // Find the asset loading effect (deps: [scriptsLoaded])
    const assetLoadEffect = activeEffects.find(
      (e) => e.deps && e.deps.length === 1 && typeof e.deps[0] === 'boolean'
    );
    expect(assetLoadEffect).toBeDefined();

    // Trigger the asset load effect
    assetLoadEffect!.effect();
    // Allow async loadAssets Promise to settle
    await Promise.resolve();
    await Promise.resolve();

    // Asset load effect has now set scriptsLoaded = true in state.
    // Assert initDeck has NOT been called yet because data is still empty
    expect(mockInitDeck).not.toHaveBeenCalled();

    // Render 2: API returns data. Now scriptsLoaded is true, mapboxToken is populated, networkData has points
    currentKeplerState = {
      loading: false,
      error: '',
      networkData: [{ position: [-83.6968, 43.0234], point_count: 1 }],
      mapboxToken: 'pk.test-token-active',
      actualCounts: { observations: 1, networks: 1 },
    };

    stateIndex = 0;
    activeEffects.length = 0;
    KeplerPage({});

    // Locate the initialization effect: [scriptsLoaded, mapboxToken, networkData, initDeck]
    const initEffect = activeEffects.find(
      (e) =>
        e.deps &&
        e.deps.length === 4 &&
        e.deps[0] === true && // scriptsLoaded is true
        e.deps[1] === 'pk.test-token-active' // mapboxToken
    );

    expect(initEffect).toBeDefined();

    // Execute the initEffect
    initEffect!.effect();

    // Verified: initDeck MUST be called with the token and networkData!
    expect(mockInitDeck).toHaveBeenCalledTimes(1);
    expect(mockInitDeck).toHaveBeenCalledWith('pk.test-token-active', [
      expect.objectContaining({ position: [-83.6968, 43.0234] }),
    ]);
  });

  it('does not invoke initDeck() if scriptsLoaded is true but networkData is empty', () => {
    mockUseKepler.mockReturnValue({
      loading: false,
      error: '',
      networkData: [],
      mapboxToken: 'pk.test-token-active',
      actualCounts: null,
    });

    stateIndex = 0;
    activeEffects.length = 0;
    KeplerPage({});

    // scriptsLoaded is initially false, so find init effect and attempt execution
    const initEffect = activeEffects.find(
      (e) => e.deps && e.deps.length === 4 && e.deps[1] === 'pk.test-token-active'
    );
    if (initEffect) {
      initEffect.effect();
    }

    // networkData is empty, so initDeck must not be called
    expect(mockInitDeck).not.toHaveBeenCalled();
  });
});
