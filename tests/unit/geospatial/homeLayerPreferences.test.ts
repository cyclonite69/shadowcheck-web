export {};

const stateMap: Record<number, any> = {};
let stateCallIndex = 0;
const registeredEffects: Array<{ fn: () => void | (() => void); deps?: any[] }> = [];

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
  useEffect: (effect: () => void | (() => void), deps?: any[]) => {
    registeredEffects.push({ fn: effect, deps });
    return effect();
  },
  useMemo: (factory: any) => factory(),
  useRef: (initial: any) => ({ current: initial }),
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

import {
  GEOSPATIAL_LAYER_IDS,
  GEOSPATIAL_LAYER_LABELS,
  GEOSPATIAL_LAYER_COLORS,
  DEFAULT_GEOSPATIAL_LAYER_ORDER,
} from '../../../client/src/components/geospatial/layers/layerCatalog';
import { useGeospatialLayerPreferences } from '../../../client/src/components/geospatial/hooks/useGeospatialLayerPreferences';
import { useExplorerPanels } from '../../../client/src/components/geospatial/hooks/useExplorerPanels';
import { useHomeLocationLayer } from '../../../client/src/components/geospatial/hooks/useHomeLocationLayer';

const STORAGE_KEY = 'shadowcheck_geospatial_layers';

describe('Home marker in geospatial Layers menu', () => {
  beforeEach(() => {
    stateCallIndex = 0;
    registeredEffects.length = 0;
    for (const key of Object.keys(stateMap)) {
      delete stateMap[Number(key)];
    }
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('layerCatalog configuration', () => {
    it('defines home layer IDs for all 4 home elements', () => {
      expect((GEOSPATIAL_LAYER_IDS as any).home).toEqual([
        'home-circle-fill',
        'home-circle-outline',
        'home-dot',
        'home-marker',
      ]);
    });

    it('defines Home marker label and green #10b981 color', () => {
      expect((GEOSPATIAL_LAYER_LABELS as any).home).toBe('Home marker');
      expect((GEOSPATIAL_LAYER_COLORS as any).home).toBe('#10b981');
    });

    it('includes home in default geospatial layer order', () => {
      expect(DEFAULT_GEOSPATIAL_LAYER_ORDER as any).toContain('home');
    });
  });

  describe('useGeospatialLayerPreferences defaults and persistence', () => {
    it('defaults home visibility to true while other layers default to false', () => {
      const { visibility, opacity } = useGeospatialLayerPreferences();
      expect((visibility as any).home).toBe(true);
      expect((opacity as any).home).toBe(1);
      expect(visibility.wigleV2).toBe(false);
      expect(visibility.fieldOffices).toBe(true);
      expect(visibility.residentAgencies).toBe(true);
      expect(visibility.courthouses).toBe(true);
    });

    it('toggles home visibility and persists to localStorage', () => {
      const { visibility, toggleLayer } = useGeospatialLayerPreferences();
      expect((visibility as any).home).toBe(true);

      toggleLayer('home' as any);

      stateCallIndex = 0;
      const updated = useGeospatialLayerPreferences();
      expect((updated.visibility as any).home).toBe(false);

      const persisted = JSON.parse(localStorageMock.getItem(STORAGE_KEY) || '{}');
      expect(persisted.visibility?.home).toBe(false);
    });

    it('restores persisted false home visibility from localStorage', () => {
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({
          visibility: { home: false, wigleV2: true },
          opacity: { home: 0.8 },
          order: ['home', 'wigleV2'],
        })
      );

      const { visibility, opacity } = useGeospatialLayerPreferences();
      expect((visibility as any).home).toBe(false);
      expect((opacity as any).home).toBe(0.8);
      expect(visibility.wigleV2).toBe(true);
    });
  });

  describe('useExplorerPanels integration', () => {
    it('exposes showHome and toggleHome in explorer panel controls', () => {
      const panels = useExplorerPanels();
      expect((panels as any).showHome).toBe(true);
      expect(typeof (panels as any).toggleHome).toBe('function');

      const homeOption = panels.mapLayerOptions.find((opt: any) => opt.key === 'home');
      expect(homeOption).toBeDefined();
      expect(homeOption?.label).toBe('Home marker');
      expect(homeOption?.color).toBe('#10b981');
      expect(homeOption?.visible).toBe(true);

      (panels as any).toggleHome();

      stateCallIndex = 0;
      const updated = useExplorerPanels();
      expect((updated as any).showHome).toBe(false);
    });
  });

  describe('useHomeLocationLayer behavior', () => {
    const mockMap = () => {
      const layers = new Map<string, { id: string; type: string; layout?: any }>();
      const sources = new Map<string, any>();
      const eventHandlers: Record<string, Array<() => void>> = {};

      return {
        isStyleLoaded: jest.fn(() => true),
        getStyle: jest.fn(() => ({ version: 8 })),
        getSource: jest.fn((id: string) => sources.get(id)),
        addSource: jest.fn((id: string, def: any) =>
          sources.set(id, { setData: jest.fn(), ...def })
        ),
        getLayer: jest.fn((id: string) => layers.get(id)),
        addLayer: jest.fn((def: any) => layers.set(def.id, def)),
        setLayoutProperty: jest.fn((id: string, prop: string, val: any) => {
          const l = layers.get(id);
          if (l) {
            l.layout = { ...l.layout, [prop]: val };
          }
        }),
        on: jest.fn((evt: string, fn: () => void) => {
          if (!eventHandlers[evt]) {
            eventHandlers[evt] = [];
          }
          eventHandlers[evt].push(fn);
        }),
        off: jest.fn((evt: string, fn: () => void) => {
          if (eventHandlers[evt]) {
            eventHandlers[evt] = eventHandlers[evt].filter((h) => h !== fn);
          }
        }),
        fire: (evt: string) => {
          eventHandlers[evt]?.forEach((fn) => fn());
        },
      };
    };

    it('controls all home layers together with a single visibility flag', () => {
      const map = mockMap();
      const mapRef = { current: map as any };
      const homeLocation = { center: [-84.5, 42.7] as [number, number], radius: 1000 };

      // Mount with visible = true
      useHomeLocationLayer({
        mapReady: true,
        mapRef,
        homeLocation,
        visible: true,
      });

      expect(map.addSource).toHaveBeenCalledWith('home-location-point', expect.any(Object));
      expect(map.addSource).toHaveBeenCalledWith('home-location-circle', expect.any(Object));
      expect(map.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'home-circle-fill', layout: { visibility: 'visible' } })
      );
      expect(map.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'home-circle-outline', layout: { visibility: 'visible' } })
      );
      expect(map.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'home-dot', layout: { visibility: 'visible' } })
      );
      expect(map.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'home-marker',
          layout: expect.objectContaining({ visibility: 'visible' }),
        })
      );

      // Now update with visible = false
      useHomeLocationLayer({
        mapReady: true,
        mapRef,
        homeLocation,
        visible: false,
      });

      expect(map.setLayoutProperty).toHaveBeenCalledWith('home-circle-fill', 'visibility', 'none');
      expect(map.setLayoutProperty).toHaveBeenCalledWith(
        'home-circle-outline',
        'visibility',
        'none'
      );
      expect(map.setLayoutProperty).toHaveBeenCalledWith('home-dot', 'visibility', 'none');
      expect(map.setLayoutProperty).toHaveBeenCalledWith('home-marker', 'visibility', 'none');
    });

    it('survives map style changes by registering style.load handler', () => {
      const map = mockMap();
      const mapRef = { current: map as any };
      const homeLocation = { center: [-84.5, 42.7] as [number, number], radius: 1000 };

      useHomeLocationLayer({
        mapReady: true,
        mapRef,
        homeLocation,
        visible: true,
      });

      expect(map.on).toHaveBeenCalledWith('style.load', expect.any(Function));

      // Simulate style change reloading layers
      map.addLayer.mockClear();
      map.fire('style.load');

      expect(map.setLayoutProperty).toHaveBeenCalled();
    });

    it('handles missing or invalid home location gracefully without throwing', () => {
      const map = mockMap();
      const mapRef = { current: map as any };

      expect(() => {
        useHomeLocationLayer({
          mapReady: true,
          mapRef,
          homeLocation: null as any,
          visible: true,
        });
      }).not.toThrow();

      expect(() => {
        useHomeLocationLayer({
          mapReady: true,
          mapRef,
          homeLocation: { center: [] as any, radius: 0 },
          visible: true,
        });
      }).not.toThrow();
    });
  });
});
