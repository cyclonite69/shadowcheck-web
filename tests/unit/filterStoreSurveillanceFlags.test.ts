jest.mock('../../client/src/logging/clientLogger', () => ({
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logError: jest.fn(),
}));

export {};

const { useFilterStore, SURVEILLANCE_FLAG_KEYS } = require('../../client/src/stores/filterStore');
const {
  adaptFiltersToPage,
  PAGE_CAPABILITIES,
} = require('../../client/src/utils/filterCapabilities');

describe('filterStore - surveillance flag hygiene', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
  });

  describe('1 & 2. Flag keys setFilter true then false', () => {
    test.each(SURVEILLANCE_FLAG_KEYS as readonly string[])(
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
});
