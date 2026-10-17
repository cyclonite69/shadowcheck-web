jest.mock('../../client/src/logging/clientLogger', () => ({
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logError: jest.fn(),
}));

export {};

const {
  useFilterStore,
  SURVEILLANCE_FLAG_KEYS,
  canonicalizeSurveillanceFlags,
  migrateFilterStore,
  FILTER_STORE_PERSIST_VERSION,
} = require('../../client/src/stores/filterStore');
const { isSurveillanceFlagActive } = require('../../client/src/utils/surveillanceFlags');
const {
  adaptFiltersToPage,
  PAGE_CAPABILITIES,
} = require('../../client/src/utils/filterCapabilities');

const EXPECTED_SURVEILLANCE_FLAG_KEYS: readonly string[] = [
  'surveillance',
  'shotspotter',
  'bwc',
  'dashcam',
  'residential_cam',
  'commercial_cam',
  'flock',
];

describe('filterStore - surveillance flag hygiene', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
  });

  describe('Pinned key list parity', () => {
    it('matches SURVEILLANCE_FLAG_KEYS independently', () => {
      expect([...SURVEILLANCE_FLAG_KEYS].sort()).toEqual(
        [...EXPECTED_SURVEILLANCE_FLAG_KEYS].sort()
      );
    });
  });

  describe('1 & 2. Flag keys setFilter true then false', () => {
    test.each(EXPECTED_SURVEILLANCE_FLAG_KEYS)(
      'key "%s": setFilter true sets both, setFilter false deletes from filters and disables',
      (key: string) => {
        const store = useFilterStore.getState();

        // 1. setFilter(k, true) -> filters[k] === true, enabled[k] === true
        store.setFilter(key, true);
        let filters = useFilterStore.getState().getCurrentFilters();
        let enabled = useFilterStore.getState().getCurrentEnabled();

        expect(filters[key]).toBe(true);
        expect(enabled[key]).toBe(true);

        // 2. setFilter(k, false) -> k NOT in filters, enabled[k] === false
        store.setFilter(key, false);
        filters = useFilterStore.getState().getCurrentFilters();
        enabled = useFilterStore.getState().getCurrentEnabled();

        expect(Object.prototype.hasOwnProperty.call(filters, key)).toBe(false);
        expect(key in filters).toBe(false);
        expect(enabled[key]).toBe(false);
      }
    );
  });

  describe('3. Scenario: toggle surveillance, set bwc true/false, set shotspotter true', () => {
    it('leaves {surveillance: true, shotspotter: true}, no bwc key, and activeFilterCount === 2', () => {
      const store = useFilterStore.getState();

      store.toggleFilter('surveillance');
      store.setFilter('bwc', true);
      store.setFilter('bwc', false);
      store.setFilter('shotspotter', true);

      const filters = useFilterStore.getState().getCurrentFilters();
      const enabled = useFilterStore.getState().getCurrentEnabled();

      expect(filters.surveillance).toBe(true);
      expect(filters.shotspotter).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(filters, 'bwc')).toBe(false);
      expect('bwc' in filters).toBe(false);

      const activeFilterCount = Object.values(enabled).filter(Boolean).length;
      expect(activeFilterCount).toBe(2);
    });
  });

  describe('4. adaptFiltersToPage output', () => {
    it('adapted output contains no bwc key after enable and disable', () => {
      const store = useFilterStore.getState();

      store.toggleFilter('surveillance');
      store.setFilter('bwc', true);
      store.setFilter('bwc', false);
      store.setFilter('shotspotter', true);

      const filters = useFilterStore.getState().getCurrentFilters();
      const enabled = useFilterStore.getState().getCurrentEnabled();

      const adapted = adaptFiltersToPage(filters, enabled, PAGE_CAPABILITIES.geospatial);

      expect(Object.prototype.hasOwnProperty.call(adapted.filtersForPage, 'bwc')).toBe(false);
      expect('bwc' in adapted.filtersForPage).toBe(false);
      expect(adapted.filtersForPage.bwc).toBeUndefined();
      expect(adapted.enabledForPage.bwc).toBeUndefined();
    });
  });

  describe('5. Characterization (must pass BEFORE and AFTER)', () => {
    it('preserves non-flag keys and toggleFilter behavior', () => {
      const store = useFilterStore.getState();

      // setFilter('rssiMin', -80) -> value set, enabled true
      store.setFilter('rssiMin', -80);
      let filters = useFilterStore.getState().getCurrentFilters();
      let enabled = useFilterStore.getState().getCurrentEnabled();
      expect(filters.rssiMin).toBe(-80);
      expect(enabled.rssiMin).toBe(true);

      // setFilter('ssid', 'x') -> value set, enabled true
      store.setFilter('ssid', 'x');
      filters = useFilterStore.getState().getCurrentFilters();
      enabled = useFilterStore.getState().getCurrentEnabled();
      expect(filters.ssid).toBe('x');
      expect(enabled.ssid).toBe(true);

      // toggleFilter('surveillance') seeds true
      store.resetFilters();
      store.toggleFilter('surveillance');
      filters = useFilterStore.getState().getCurrentFilters();
      enabled = useFilterStore.getState().getCurrentEnabled();
      expect(filters.surveillance).toBe(true);
      expect(enabled.surveillance).toBe(true);

      // toggling off leaves filters.surveillance true, enabled false
      store.toggleFilter('surveillance');
      filters = useFilterStore.getState().getCurrentFilters();
      enabled = useFilterStore.getState().getCurrentEnabled();
      expect(filters.surveillance).toBe(true);
      expect(enabled.surveillance).toBe(false);
    });
  });

  describe('canonicalizeSurveillanceFlags pure function', () => {
    it('cleans legacy {filters:{bwc:false}, enabled:{bwc:true}} to bwc absent and enabled false', () => {
      const dirty = {
        filters: { bwc: false, qualityFilter: 'all' },
        enabled: { bwc: true, qualityFilter: false },
      };
      const result = canonicalizeSurveillanceFlags(dirty as any);

      expect(Object.prototype.hasOwnProperty.call(result.filters, 'bwc')).toBe(false);
      expect('bwc' in result.filters).toBe(false);
      expect(result.enabled.bwc).toBe(false);
      expect(result.filters.qualityFilter).toBe('all');
    });

    it('leaves clean active state unchanged', () => {
      const cleanActive = {
        filters: { bwc: true, shotspotter: true },
        enabled: { bwc: true, shotspotter: true },
      };
      const result = canonicalizeSurveillanceFlags(cleanActive as any);

      expect(result.filters.bwc).toBe(true);
      expect(result.filters.shotspotter).toBe(true);
      expect(result.enabled.bwc).toBe(true);
      expect(result.enabled.shotspotter).toBe(true);
      expect(result).toBe(cleanActive);
    });

    it('preserves toggled-off umbrella {surveillance:true} with enabled false exactly', () => {
      const umbrella = {
        filters: { surveillance: true },
        enabled: { surveillance: false },
      };
      const result = canonicalizeSurveillanceFlags(umbrella as any);

      expect(result.filters.surveillance).toBe(true);
      expect(result.enabled.surveillance).toBe(false);
      expect(result).toBe(umbrella);
    });

    it('drops garbage ("x", 1, null) in filters', () => {
      const garbage = {
        filters: {
          bwc: 'x' as any,
          dashcam: 1 as any,
          flock: null as any,
        },
        enabled: {
          bwc: true,
          dashcam: true,
          flock: true,
        },
      };
      const result = canonicalizeSurveillanceFlags(garbage as any);

      expect(Object.prototype.hasOwnProperty.call(result.filters, 'bwc')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result.filters, 'dashcam')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result.filters, 'flock')).toBe(false);
      expect(result.enabled.bwc).toBe(false);
      expect(result.enabled.dashcam).toBe(false);
      expect(result.enabled.flock).toBe(false);
    });

    it('preserves object identity when already clean', () => {
      const clean = {
        filters: { timeframe: { type: 'relative', relativeWindow: '30d' } },
        enabled: { timeframe: true },
      };
      expect(canonicalizeSurveillanceFlags(clean as any)).toBe(clean);
    });

    it('never mutates input objects', () => {
      const frozenInput = Object.freeze({
        filters: Object.freeze({ bwc: false, qualityFilter: 'all' }),
        enabled: Object.freeze({ bwc: true, qualityFilter: false }),
      });

      expect(() => canonicalizeSurveillanceFlags(frozenInput as any)).not.toThrow();
      expect(frozenInput.filters.bwc).toBe(false);
      expect(frozenInput.enabled.bwc).toBe(true);
    });
  });

  describe('Ingress paths canonicalization', () => {
    it('loadPreset canonicalizes dirty presets on load', () => {
      useFilterStore.setState({
        presets: {
          dirtyPreset: {
            filters: { bwc: false, surveillance: true } as any,
            enabled: { bwc: true, surveillance: false } as any,
          },
        },
      });

      useFilterStore.getState().loadPreset('dirtyPreset');
      const filters = useFilterStore.getState().getCurrentFilters();
      const enabled = useFilterStore.getState().getCurrentEnabled();

      expect(Object.prototype.hasOwnProperty.call(filters, 'bwc')).toBe(false);
      expect('bwc' in filters).toBe(false);
      expect(enabled.bwc).toBe(false);
      expect(filters.surveillance).toBe(true);
      expect(enabled.surveillance).toBe(false);
    });

    it('setFromURLParams canonicalizes dirty URL filter params', () => {
      const params = new URLSearchParams();
      params.set('filters', JSON.stringify({ bwc: false, surveillance: true }));
      params.set('enabled', JSON.stringify({ bwc: true, surveillance: false }));

      useFilterStore.getState().setFromURLParams(params);
      const filters = useFilterStore.getState().getCurrentFilters();
      const enabled = useFilterStore.getState().getCurrentEnabled();

      expect(Object.prototype.hasOwnProperty.call(filters, 'bwc')).toBe(false);
      expect('bwc' in filters).toBe(false);
      expect(enabled.bwc).toBe(false);
      expect(filters.surveillance).toBe(true);
      expect(enabled.surveillance).toBe(false);
    });

    it('setFilterState canonicalizes dirty state input', () => {
      const dirtyState = {
        filters: { bwc: false, surveillance: true } as any,
        enabled: { bwc: true, surveillance: false } as any,
      };

      useFilterStore.getState().setFilterState(dirtyState);
      const filters = useFilterStore.getState().getCurrentFilters();
      const enabled = useFilterStore.getState().getCurrentEnabled();

      expect(Object.prototype.hasOwnProperty.call(filters, 'bwc')).toBe(false);
      expect('bwc' in filters).toBe(false);
      expect(enabled.bwc).toBe(false);
      expect(filters.surveillance).toBe(true);
      expect(enabled.surveillance).toBe(false);
    });
  });

  describe('Persistence migration to v4', () => {
    it('declares persist version 4', () => {
      expect(FILTER_STORE_PERSIST_VERSION).toBe(4);
    });

    it('migrates a v3 persisted payload with dirty pageStates and dirty presets to clean v4 state', () => {
      const dirtyStoredState = {
        currentPage: 'default',
        pageStates: {
          default: {
            filters: { bwc: false, surveillance: true },
            enabled: { bwc: true, surveillance: false },
          },
        },
        presets: {
          dirtyPreset: {
            filters: { bwc: false, surveillance: true },
            enabled: { bwc: true, surveillance: false },
          },
        },
      };

      const migrated = migrateFilterStore(dirtyStoredState, 3);

      expect(migrated.pageStates?.default).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(migrated.pageStates.default.filters, 'bwc')).toBe(
        false
      );
      expect('bwc' in migrated.pageStates.default.filters).toBe(false);
      expect(migrated.pageStates.default.enabled.bwc).toBe(false);
      expect(migrated.pageStates.default.filters.surveillance).toBe(true);
      expect(migrated.pageStates.default.enabled.surveillance).toBe(false);

      expect(migrated.presets?.dirtyPreset).toBeDefined();
      expect(
        Object.prototype.hasOwnProperty.call(migrated.presets.dirtyPreset.filters, 'bwc')
      ).toBe(false);
      expect('bwc' in migrated.presets.dirtyPreset.filters).toBe(false);
      expect(migrated.presets.dirtyPreset.enabled.bwc).toBe(false);
      expect(migrated.presets.dirtyPreset.filters.surveillance).toBe(true);
      expect(migrated.presets.dirtyPreset.enabled.surveillance).toBe(false);
    });
  });

  describe('Zustand persist wiring & hydration via localStorage shim', () => {
    const originalWindow = (globalThis as any).window;
    const originalLocalStorage = (globalThis as any).localStorage;

    afterEach(() => {
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
      if (originalLocalStorage === undefined) {
        delete (globalThis as any).localStorage;
      } else {
        (globalThis as any).localStorage = originalLocalStorage;
      }
    });

    const dirtyStoredState = {
      currentPage: 'default',
      pageStates: {
        default: {
          filters: { bwc: false, surveillance: true },
          enabled: { bwc: true, surveillance: false },
        },
      },
      presets: {
        dirtyPreset: {
          filters: { bwc: false, surveillance: true },
          enabled: { bwc: true, surveillance: false },
        },
      },
    };

    it('hydrates clean from a v3 persisted payload via zustand persist middleware', async () => {
      const storageMap = new Map<string, string>();
      storageMap.set(
        'shadowcheck-filters-v2',
        JSON.stringify({
          version: 3,
          state: dirtyStoredState,
        })
      );

      const localStorageShim = {
        getItem: (k: string) => storageMap.get(k) ?? null,
        setItem: (k: string, v: string) => storageMap.set(k, String(v)),
        removeItem: (k: string) => {
          storageMap.delete(k);
        },
        clear: () => {
          storageMap.clear();
        },
      };

      (globalThis as any).window = globalThis;
      (globalThis as any).localStorage = localStorageShim;

      let isolatedStore: any;
      jest.isolateModules(() => {
        isolatedStore = require('../../client/src/stores/filterStore');
      });

      expect(isolatedStore.useFilterStore.persist).toBeDefined();
      await isolatedStore.useFilterStore.persist.rehydrate();

      const filters = isolatedStore.useFilterStore.getState().getCurrentFilters();
      const enabled = isolatedStore.useFilterStore.getState().getCurrentEnabled();

      expect(Object.prototype.hasOwnProperty.call(filters, 'bwc')).toBe(false);
      expect('bwc' in filters).toBe(false);
      expect(enabled.bwc).toBe(false);
      expect(filters.surveillance).toBe(true);
      expect(enabled.surveillance).toBe(false);

      const presets = isolatedStore.useFilterStore.getState().presets;
      expect(presets.dirtyPreset).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(presets.dirtyPreset.filters, 'bwc')).toBe(false);
      expect('bwc' in presets.dirtyPreset.filters).toBe(false);
      expect(presets.dirtyPreset.enabled.bwc).toBe(false);
      expect(presets.dirtyPreset.filters.surveillance).toBe(true);
      expect(presets.dirtyPreset.enabled.surveillance).toBe(false);
    });

    it('control: does NOT migrate a v4 persisted payload (stays dirty proving the version gate)', async () => {
      const storageMap = new Map<string, string>();
      storageMap.set(
        'shadowcheck-filters-v2',
        JSON.stringify({
          version: 4,
          state: dirtyStoredState,
        })
      );

      const localStorageShim = {
        getItem: (k: string) => storageMap.get(k) ?? null,
        setItem: (k: string, v: string) => storageMap.set(k, String(v)),
        removeItem: (k: string) => {
          storageMap.delete(k);
        },
        clear: () => {
          storageMap.clear();
        },
      };

      (globalThis as any).window = globalThis;
      (globalThis as any).localStorage = localStorageShim;

      let isolatedStore: any;
      jest.isolateModules(() => {
        isolatedStore = require('../../client/src/stores/filterStore');
      });

      expect(isolatedStore.useFilterStore.persist).toBeDefined();
      await isolatedStore.useFilterStore.persist.rehydrate();

      const filters = isolatedStore.useFilterStore.getState().getCurrentFilters();
      const enabled = isolatedStore.useFilterStore.getState().getCurrentEnabled();

      // At version 4, migration did NOT run; dirty values remain as stored
      expect(filters.bwc).toBe(false);
      expect(enabled.bwc).toBe(true);

      const presets = isolatedStore.useFilterStore.getState().presets;
      expect(presets.dirtyPreset).toBeDefined();
      expect(presets.dirtyPreset.filters.bwc).toBe(false);
      expect(presets.dirtyPreset.enabled.bwc).toBe(true);
    });
  });

  describe('isSurveillanceFlagActive pure helper', () => {
    it('(true, true) -> true', () => {
      expect(isSurveillanceFlagActive({ bwc: true }, { bwc: true } as any, 'bwc')).toBe(true);
    });

    it('filters.bwc true & enabled false (the chip-dismissed state) -> false', () => {
      expect(isSurveillanceFlagActive({ bwc: true }, { bwc: false } as any, 'bwc')).toBe(false);
    });

    it('both absent -> false', () => {
      expect(isSurveillanceFlagActive({}, {} as any, 'bwc')).toBe(false);
    });

    it('legacy (filters false, enabled true) -> false', () => {
      expect(isSurveillanceFlagActive({ bwc: false }, { bwc: true } as any, 'bwc')).toBe(false);
    });
  });
});
