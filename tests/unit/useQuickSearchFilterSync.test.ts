import type { NetworkFilters } from '../../client/src/types/filters';

const React = require('react');

const mockEffects: any[] = [];

const originalUseEffect = React.useEffect;

React.useEffect = (effectFn: any, deps: any) => {
  mockEffects.push({ effectFn, deps });
};

const mockSetFilter = jest.fn();
const mockEnableFilter = jest.fn();

jest.mock('../../client/src/stores/filterStore', () => ({
  useFilterStore: (selector: any) => {
    return selector({
      setFilter: mockSetFilter,
      enableFilter: mockEnableFilter,
    });
  },
}));

jest.mock(
  '../../../stores/filterStore',
  () => ({
    useFilterStore: (selector: any) => {
      return selector({
        setFilter: mockSetFilter,
        enableFilter: mockEnableFilter,
      });
    },
  }),
  { virtual: true }
);

let useQuickSearchFilterSync: any;

describe('useQuickSearchFilterSync Hook', () => {
  beforeAll(() => {
    useQuickSearchFilterSync =
      require('../../client/src/components/geospatial/hooks/useQuickSearchFilterSync').useQuickSearchFilterSync;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEffects.length = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    React.useEffect = originalUseEffect;
  });

  it('sets up useEffect and runs nothing before 250ms', () => {
    useQuickSearchFilterSync({ quickSearch: 'test' });

    expect(mockEffects.length).toBe(1);
    const cleanup = mockEffects[0].effectFn();

    expect(mockSetFilter).not.toHaveBeenCalled();
    expect(mockEnableFilter).not.toHaveBeenCalled();

    jest.advanceTimersByTime(250);

    expect(mockSetFilter).toHaveBeenCalled();
    if (typeof cleanup === 'function') {
      cleanup();
    }
  });

  it('cancels stale timeout on cleanup', () => {
    useQuickSearchFilterSync({ quickSearch: 'test1' });
    const cleanup = mockEffects[0].effectFn();

    // Simulate re-render
    useQuickSearchFilterSync({ quickSearch: 'test2' });
    if (typeof cleanup === 'function') {
      cleanup();
    }

    jest.advanceTimersByTime(250);
    expect(mockSetFilter).not.toHaveBeenCalledWith('ssid', 'test1');
  });

  it('clears and disables all filters on empty input', () => {
    useQuickSearchFilterSync({ quickSearch: '   ' });
    mockEffects[0].effectFn();
    jest.advanceTimersByTime(250);

    expect(mockSetFilter).toHaveBeenCalledWith('ssid', '');
    expect(mockSetFilter).toHaveBeenCalledWith('bssid', '');
    expect(mockSetFilter).toHaveBeenCalledWith('manufacturer', '');
    expect(mockEnableFilter).toHaveBeenCalledWith('ssid', false);
    expect(mockEnableFilter).toHaveBeenCalledWith('bssid', false);
    expect(mockEnableFilter).toHaveBeenCalledWith('manufacturer', false);
  });

  it('routes s: prefix to ssid', () => {
    useQuickSearchFilterSync({ quickSearch: 's: test-ssid' });
    mockEffects[0].effectFn();
    jest.advanceTimersByTime(250);

    expect(mockSetFilter).toHaveBeenCalledWith('ssid', 'test-ssid');
    expect(mockSetFilter).toHaveBeenCalledWith('bssid', '');
    expect(mockSetFilter).toHaveBeenCalledWith('manufacturer', '');
    expect(mockEnableFilter).toHaveBeenCalledWith('ssid', true);
    expect(mockEnableFilter).toHaveBeenCalledWith('bssid', false);
    expect(mockEnableFilter).toHaveBeenCalledWith('manufacturer', false);
  });

  it('routes b: prefix to bssid', () => {
    useQuickSearchFilterSync({ quickSearch: 'b: test-bssid' });
    mockEffects[0].effectFn();
    jest.advanceTimersByTime(250);

    expect(mockSetFilter).toHaveBeenCalledWith('ssid', '');
    expect(mockSetFilter).toHaveBeenCalledWith('bssid', 'test-bssid');
    expect(mockSetFilter).toHaveBeenCalledWith('manufacturer', '');
    expect(mockEnableFilter).toHaveBeenCalledWith('ssid', false);
    expect(mockEnableFilter).toHaveBeenCalledWith('bssid', true);
    expect(mockEnableFilter).toHaveBeenCalledWith('manufacturer', false);
  });

  it('routes m: prefix to manufacturer', () => {
    useQuickSearchFilterSync({ quickSearch: 'm: test-mfg' });
    mockEffects[0].effectFn();
    jest.advanceTimersByTime(250);

    expect(mockSetFilter).toHaveBeenCalledWith('ssid', '');
    expect(mockSetFilter).toHaveBeenCalledWith('bssid', '');
    expect(mockSetFilter).toHaveBeenCalledWith('manufacturer', 'test-mfg');
    expect(mockEnableFilter).toHaveBeenCalledWith('ssid', false);
    expect(mockEnableFilter).toHaveBeenCalledWith('bssid', false);
    expect(mockEnableFilter).toHaveBeenCalledWith('manufacturer', true);
  });

  it('auto-detects colon-separated BSSID strings', () => {
    useQuickSearchFilterSync({ quickSearch: 'AA:BB:CC:DD:EE:FF' });
    mockEffects[0].effectFn();
    jest.advanceTimersByTime(250);

    expect(mockSetFilter).toHaveBeenCalledWith('bssid', 'AA:BB:CC:DD:EE:FF');
    expect(mockEnableFilter).toHaveBeenCalledWith('bssid', true);
  });

  it('auto-detects six-character OUI hex manufacturer', () => {
    useQuickSearchFilterSync({ quickSearch: '001122' });
    mockEffects[0].effectFn();
    jest.advanceTimersByTime(250);

    expect(mockSetFilter).toHaveBeenCalledWith('manufacturer', '001122');
    expect(mockEnableFilter).toHaveBeenCalledWith('manufacturer', true);
  });

  it('falls back plain text to ssid', () => {
    useQuickSearchFilterSync({ quickSearch: 'Just Plain Text' });
    mockEffects[0].effectFn();
    jest.advanceTimersByTime(250);

    expect(mockSetFilter).toHaveBeenCalledWith('ssid', 'Just Plain Text');
    expect(mockEnableFilter).toHaveBeenCalledWith('ssid', true);
  });
});
