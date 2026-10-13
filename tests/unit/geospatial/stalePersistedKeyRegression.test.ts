const stateMap: Record<number, any> = {};
let stateCallIndex = 0;

jest.mock('react', () => ({
  useState: (initial: any) => {
    const key = stateCallIndex++;
    if (!(key in stateMap)) {
      stateMap[key] = typeof initial === 'function' ? initial() : initial;
    }
    const setter = (val: any) => {
      stateMap[key] = typeof val === 'function' ? val(stateMap[key]) : val;
    };
    return [stateMap[key], setter];
  },
  useCallback: (callback: any) => callback,
  useEffect: (effect: any) => effect(),
  useMemo: (factory: any) => factory(),
}));

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, String(value));
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
  get length() {
    return storage.size;
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
});
(global as any).localStorage = localStorageMock;

import { useGeospatialLayerPreferences } from '../../../client/src/components/geospatial/hooks/useGeospatialLayerPreferences';
import { useExplorerPanels } from '../../../client/src/components/geospatial/hooks/useExplorerPanels';
import { GEOSPATIAL_LAYER_IDS } from '../../../client/src/components/geospatial/layers/layerCatalog';

const STORAGE_KEY = 'shadowcheck_geospatial_layers';

describe('Stale persisted key regression test (agencyMatches)', () => {
  beforeEach(() => {
    stateCallIndex = 0;
    for (const key of Object.keys(stateMap)) {
      delete stateMap[Number(key)];
    }
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('drops stale agencyMatches key from persisted localStorage and renders without error', () => {
    const staleStoredState = {
      visibility: {
        agencyMatches: true,
        wigleV2: true,
        courthouses: true,
      },
      opacity: {
        agencyMatches: 0.5,
        wigleV2: 0.8,
        courthouses: 1,
      },
      order: ['agencyMatches', 'courthouses', 'wigleV2'],
    };

    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(staleStoredState));

    const preferences = useGeospatialLayerPreferences();

    // Stale key must be dropped from visibility, opacity, and order
    expect(preferences.visibility).not.toHaveProperty('agencyMatches');
    expect(preferences.opacity).not.toHaveProperty('agencyMatches');
    expect(preferences.order).not.toContain('agencyMatches');

    // Valid keys must be preserved
    expect((preferences.visibility as any).wigleV2).toBe(true);
    expect((preferences.visibility as any).courthouses).toBe(true);

    // agencyMatches must not be present in layerCatalog ID mapping
    expect(GEOSPATIAL_LAYER_IDS).not.toHaveProperty('agencyMatches');
  });

  it('useExplorerPanels does not expose showAgenciesPanel or agencyMatches layer option', () => {
    const staleStoredState = {
      visibility: {
        agencyMatches: true,
      },
      opacity: {
        agencyMatches: 0.5,
      },
      order: ['agencyMatches', 'courthouses'],
    };

    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(staleStoredState));

    const panels = useExplorerPanels();

    expect(panels).not.toHaveProperty('showAgenciesPanel');
    expect(panels).not.toHaveProperty('toggleAgenciesPanel');

    const optionKeys = panels.mapLayerOptions.map((opt) => opt.key);
    expect(optionKeys).not.toContain('agencyMatches');
  });

  it('drops stale agencies key from persisted localStorage and restores valid fieldOffices/residentAgencies', () => {
    const staleStoredState = {
      visibility: {
        agencies: true,
        wigleV2: true,
        courthouses: true,
      },
      opacity: {
        agencies: 0.5,
        wigleV2: 0.8,
        courthouses: 1,
      },
      order: ['agencies', 'courthouses', 'wigleV2'],
    };

    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(staleStoredState));

    const preferences = useGeospatialLayerPreferences();

    // Stale key must be dropped from visibility, opacity, and order
    expect(preferences.visibility).not.toHaveProperty('agencies');
    expect(preferences.opacity).not.toHaveProperty('agencies');
    expect(preferences.order).not.toContain('agencies');

    // New keys must default to WiGLE defaults (true)
    expect((preferences.visibility as any).fieldOffices).toBe(true);
    expect((preferences.visibility as any).residentAgencies).toBe(true);
    expect((preferences.visibility as any).courthouses).toBe(true);

    // agencies must not be present in layerCatalog ID mapping
    expect(GEOSPATIAL_LAYER_IDS).not.toHaveProperty('agencies');
  });
});
