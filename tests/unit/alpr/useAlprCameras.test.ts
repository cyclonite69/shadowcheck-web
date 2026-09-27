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

let rafHandleCount = 0;
const activeRafIds = new Set<number>();
let activeCallback: FrameRequestCallback | null = null;

const mockRaf = jest.fn((cb: FrameRequestCallback) => {
  activeCallback = cb;
  const id = ++rafHandleCount;
  activeRafIds.add(id);
  return id;
});

const mockCaf = jest.fn((id: number) => {
  activeRafIds.delete(id);
  if (activeCallback) {
    activeCallback = null;
  }
});

(global as any).window.requestAnimationFrame = mockRaf;
(global as any).window.cancelAnimationFrame = mockCaf;
(global as any).requestAnimationFrame = mockRaf;
(global as any).cancelAnimationFrame = mockCaf;

const mockEffects: Array<{ fn: () => void | (() => void); deps?: any[] }> = [];

React.useState = (initial: any) => [initial, jest.fn()];
React.useRef = (initial: any) => ({ current: initial });
React.useCallback = (fn: any) => fn;
React.useEffect = (fn: () => void | (() => void), deps?: any[]) => {
  mockEffects.push({ fn, deps });
};

// Mock agencyApi
const mockGeoJSON: AlprCamerasGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 1,
      geometry: {
        type: 'Point',
        coordinates: [-122.3321, 47.6062],
      },
      properties: {
        id: '1',
        osm_id: '1',
        camera_type: 'alpr',
        manufacturer: 'Flock Safety',
        operator: 'Seattle PD',
        direction: null,
        surveillance_zone: null,
        camera_mount: null,
        electricity: null,
      },
    },
  ],
};

jest.mock('../../../client/src/api/agencyApi', () => ({
  agencyApi: {
    getAlprCameras: jest.fn().mockResolvedValue(mockGeoJSON),
  },
}));

// Mock useAsyncData to return data synchronously in test
jest.mock('../../../client/src/hooks/useAsyncData', () => ({
  useAsyncData: (_fetcher: any) => {
    return {
      data: mockGeoJSON,
      loading: false,
      error: null,
    };
  },
}));

import type { Map } from 'mapbox-gl';
import type { AlprCamerasGeoJSON } from '../../../client/src/api/agencyApi';
import {
  useAlprCameras,
  ensureAlprLayers,
} from '../../../client/src/components/hooks/useAlprCameras';

describe('useAlprCameras and ensureAlprLayers', () => {
  let mockMap: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEffects.length = 0;
    rafHandleCount = 0;
    activeRafIds.clear();
    activeCallback = null;

    mockRaf.mockImplementation((cb: FrameRequestCallback) => {
      const id = ++rafHandleCount;
      activeRafIds.add(id);
      activeCallback = (timestamp: number) => {
        activeRafIds.delete(id);
        cb(timestamp);
      };
      return id;
    });

    mockCaf.mockImplementation((id: number) => {
      activeRafIds.delete(id);
      if (activeCallback) {
        activeCallback = null;
      }
    });

    mockMap = {
      sources: {} as Record<string, any>,
      layers: {} as Record<string, any>,
      layerOrder: [] as string[],
      layoutProperties: {} as Record<string, Record<string, any>>,
      paintProperties: {} as Record<string, Record<string, any>>,
      getSource: jest.fn((id: string) => mockMap.sources[id]),
      addSource: jest.fn((id: string, source: any) => {
        mockMap.sources[id] = source;
        return mockMap;
      }),
      getLayer: jest.fn((id: string) => mockMap.layers[id]),
      addLayer: jest.fn((layer: any, beforeId?: string) => {
        mockMap.layers[layer.id] = layer;
        if (beforeId && mockMap.layerOrder.includes(beforeId)) {
          const index = mockMap.layerOrder.indexOf(beforeId);
          mockMap.layerOrder.splice(index, 0, layer.id);
        } else {
          mockMap.layerOrder.push(layer.id);
        }
        return mockMap;
      }),
      removeLayer: jest.fn((id: string) => {
        delete mockMap.layers[id];
        mockMap.layerOrder = mockMap.layerOrder.filter((l: string) => l !== id);
        return mockMap;
      }),
      setLayoutProperty: jest.fn((layerId: string, name: string, value: any) => {
        if (!mockMap.layoutProperties[layerId]) {
          mockMap.layoutProperties[layerId] = {};
        }
        mockMap.layoutProperties[layerId][name] = value;
        return mockMap;
      }),
      setPaintProperty: jest.fn((layerId: string, name: string, value: any) => {
        if (!mockMap.paintProperties[layerId]) {
          mockMap.paintProperties[layerId] = {};
        }
        mockMap.paintProperties[layerId][name] = value;
        return mockMap;
      }),
      getStyle: jest.fn(() => ({ version: 8, sources: {}, layers: [] })),
      on: jest.fn(),
      off: jest.fn(),
      getCanvas: jest.fn(() => ({ style: {} })),
    };
  });

  describe('ensureAlprLayers layer order and configuration', () => {
    it('creates alpr-pulse with correct filter, paint properties, and places it below alpr-unclustered', () => {
      ensureAlprLayers(mockMap as unknown as Map, mockGeoJSON, true);

      expect(mockMap.layers['alpr-pulse']).toBeDefined();
      const pulseLayer = mockMap.layers['alpr-pulse'];

      expect(pulseLayer.id).toBe('alpr-pulse');
      expect(pulseLayer.type).toBe('circle');
      expect(pulseLayer.source).toBe('alpr-cameras');
      expect(pulseLayer.filter).toEqual(['!', ['has', 'point_count']]);
      expect(pulseLayer.paint['circle-color']).toBe('transparent');
      expect(pulseLayer.paint['circle-opacity']).toBe(0);
      expect(pulseLayer.paint['circle-stroke-color']).toBe('#d946ef');
      expect(pulseLayer.paint['circle-stroke-width']).toBe(2);
      expect(pulseLayer.paint['circle-radius']).toBe(4);
      expect(pulseLayer.paint['circle-stroke-opacity']).toBe(0.8);

      const pulseIndex = mockMap.layerOrder.indexOf('alpr-pulse');
      const unclusteredIndex = mockMap.layerOrder.indexOf('alpr-unclustered');
      expect(pulseIndex).toBeGreaterThanOrEqual(0);
      expect(unclusteredIndex).toBeGreaterThanOrEqual(0);
      expect(pulseIndex).toBeLessThan(unclusteredIndex);
    });

    it('inserts alpr-pulse before alpr-unclustered if alpr-unclustered already exists on map', () => {
      mockMap.addLayer({ id: 'alpr-unclustered', type: 'circle', source: 'alpr-cameras' });
      expect(mockMap.layerOrder).toEqual(['alpr-unclustered']);

      ensureAlprLayers(mockMap as unknown as Map, mockGeoJSON, true);

      const pulseIndex = mockMap.layerOrder.indexOf('alpr-pulse');
      const unclusteredIndex = mockMap.layerOrder.indexOf('alpr-unclustered');
      expect(pulseIndex).toBeLessThan(unclusteredIndex);
    });
  });

  describe('useAlprCameras rAF animation lifecycle and leak prevention', () => {
    function findAnimationEffect() {
      // Find the effect with 5 dependencies: [hasBeenVisible, isVisible, mapReady, data, mapRef]
      return mockEffects.find((e) => Array.isArray(e.deps) && e.deps.length === 5);
    }

    it('does NOT start rAF loop when isVisible is false (hasBeenVisible gate holds)', () => {
      const mapRef = { current: mockMap as unknown as Map };
      useAlprCameras(mapRef, true, false);

      const animEffect = findAnimationEffect();
      expect(animEffect).toBeDefined();

      const cleanup = animEffect!.fn();
      expect(mockRaf).not.toHaveBeenCalled();
      expect(activeRafIds.size).toBe(0);
      expect(cleanup).toBeUndefined();
    });

    it('starts rAF loop when isVisible is true and cancels immediately via cleanup', () => {
      const mapRef = { current: mockMap as unknown as Map };
      // Simulate state where hasBeenVisible is true and isVisible is true
      React.useState = () => [true, jest.fn()];

      useAlprCameras(mapRef, true, true);

      const animEffect = findAnimationEffect();
      expect(animEffect).toBeDefined();

      // Execute effect
      const cleanup = animEffect!.fn();
      expect(mockRaf).toHaveBeenCalledTimes(1);
      expect(activeRafIds.size).toBe(1);
      expect(typeof cleanup).toBe('function');

      // Execute cleanup (simulate toggling off or unmount)
      (cleanup as () => void)();
      expect(mockCaf).toHaveBeenCalledWith(1);
      expect(activeRafIds.size).toBe(0);
    });

    it('leaves NO orphaned rAF handles when toggling on and off repeatedly', () => {
      const mapRef = { current: mockMap as unknown as Map };
      React.useState = () => [true, jest.fn()];

      // Repeat toggle cycle 10 times
      for (let i = 0; i < 10; i++) {
        mockEffects.length = 0;
        useAlprCameras(mapRef, true, true);
        const onEffect = findAnimationEffect();
        const cleanup = onEffect!.fn();

        expect(typeof cleanup).toBe('function');
        expect(activeRafIds.size).toBe(1);

        // Toggle OFF (cleanup fires)
        (cleanup as () => void)();
        expect(activeRafIds.size).toBe(0);
      }

      // Assert exactly 0 orphaned handles remain
      expect(activeRafIds.size).toBe(0);
      expect(mockCaf).toHaveBeenCalledTimes(10);
      expect(mockRaf).toHaveBeenCalledTimes(10);
    });

    it('animates pulse radius and opacity smoothly via map.setPaintProperty', () => {
      const mapRef = { current: mockMap as unknown as Map };
      React.useState = () => [true, jest.fn()];

      useAlprCameras(mapRef, true, true);
      ensureAlprLayers(mockMap as unknown as Map, mockGeoJSON, true);

      const animEffect = findAnimationEffect();
      const cleanup = animEffect!.fn();

      expect(activeCallback).not.toBeNull();

      // Frame at t = 0ms (start of 1500ms cycle)
      activeCallback!(0);
      expect(mockMap.setPaintProperty).toHaveBeenCalledWith('alpr-pulse', 'circle-radius', 4);
      expect(mockMap.setPaintProperty).toHaveBeenCalledWith(
        'alpr-pulse',
        'circle-stroke-opacity',
        0.8
      );

      // Frame at t = 750ms (midpoint of 1500ms cycle)
      activeCallback!(750);
      expect(mockMap.setPaintProperty).toHaveBeenCalledWith('alpr-pulse', 'circle-radius', 11);
      expect(mockMap.setPaintProperty).toHaveBeenCalledWith(
        'alpr-pulse',
        'circle-stroke-opacity',
        0.4
      );

      // Frame at t = 1500ms (cycle loop back to start)
      activeCallback!(1500);
      expect(mockMap.setPaintProperty).toHaveBeenCalledWith('alpr-pulse', 'circle-radius', 4);
      expect(mockMap.setPaintProperty).toHaveBeenCalledWith(
        'alpr-pulse',
        'circle-stroke-opacity',
        0.8
      );

      // Cleanup
      (cleanup as () => void)();
      expect(activeRafIds.size).toBe(0);
    });
  });
});
