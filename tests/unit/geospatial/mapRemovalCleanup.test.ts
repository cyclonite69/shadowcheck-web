// This test hand-orders same-fiber unmount cleanups: the map owner removes the
// map before later hooks clean up. Real React DOM ordering was verified with
// react-dom/client and jsdom: ["owner map.remove","federal courthouse"].
export {};

const React = require('react');

const mockEffects: Array<{ fn: () => void | (() => void); deps?: any[] }> = [];
const mockGetUnmatchedMediaGeoJson = jest.fn();
const mockGetMatchedMediaGeoJson = jest.fn();

React.useState = (initial: any) => [initial, jest.fn()];
React.useRef = (initial: any) => ({ current: initial });
React.useCallback = (fn: any) => fn;
React.useEffect = (fn: () => void | (() => void), deps?: any[]) => {
  mockEffects.push({ fn, deps });
};

jest.mock('../../../client/src/hooks/useAsyncData', () => ({
  useAsyncData: () => ({
    data: { type: 'FeatureCollection', features: [] },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../../client/src/api/agencyApi', () => ({
  agencyApi: {
    getFederalCourthouses: jest.fn(),
  },
}));

jest.mock('../../../client/src/api/networkApi', () => ({
  networkApi: {
    getUnmatchedMediaGeoJson: (...args: any[]) => mockGetUnmatchedMediaGeoJson(...args),
    getMatchedMediaGeoJson: (...args: any[]) => mockGetMatchedMediaGeoJson(...args),
  },
}));

jest.mock('../../../client/src/components/geospatial/media/MatchedMediaCarouselPopup', () => ({
  MatchedMediaCarouselPopup: () => null,
}));

import { useFederalCourthouses } from '../../../client/src/components/hooks/useFederalCourthouses';
import { useMediaLocationLayers } from '../../../client/src/components/geospatial/hooks/useMediaLocationLayers';

type CleanupCase = {
  name: string;
  cleanupCondition: string;
  mount: (mapRef: { current: any }, fakeMap: any) => (() => Promise<void>) | void;
};

const cleanupCases: CleanupCase[] = [
  {
    name: 'federal courthouses',
    cleanupCondition: 'mapReady=true and mapRef.current is the map',
    mount: (mapRef, fakeMap) => {
      React.useEffect(() => {
        return () => {
          fakeMap.remove();
          mapRef.current = null;
        };
      }, []);

      useFederalCourthouses(mapRef, true, false, { current: null }, false, []);
    },
  },
  {
    name: 'media locations',
    cleanupCondition: 'mapReady=true and showMediaLocations=true',
    mount: (mapRef) => {
      let resolveUnmatched!: (data: { features: any[] }) => void;
      let resolveMatched!: (data: { features: any[] }) => void;
      const unmatchedLoad = new Promise<{ features: any[] }>((resolve) => {
        resolveUnmatched = resolve;
      });
      const matchedLoad = new Promise<{ features: any[] }>((resolve) => {
        resolveMatched = resolve;
      });
      mockGetUnmatchedMediaGeoJson.mockReturnValue(unmatchedLoad);
      mockGetMatchedMediaGeoJson.mockReturnValue(matchedLoad);

      React.useEffect(() => {
        return () => {
          mapRef.current?.remove();
          mapRef.current = null;
        };
      }, []);

      useMediaLocationLayers({
        mapReady: true,
        mapRef,
        mapboxRef: { current: null },
        showMediaLocations: true,
      });

      return async () => {
        resolveUnmatched({ features: [] });
        resolveMatched({ features: [] });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      };
    },
  },
];

describe('Map removal cleanup regression tests', () => {
  beforeEach(() => {
    mockEffects.length = 0;
  });

  it.each(cleanupCases)(
    '$name cleanup ($cleanupCondition) does not access map layers after the owner removes the map',
    async ({ mount }) => {
      let removed = false;
      const removedMapError = () =>
        new TypeError("Cannot read properties of undefined (reading 'getOwnLayer')");
      const fakeMap = {
        getStyle: jest.fn(() => (removed ? undefined : { version: 8 })),
        getLayer: jest.fn(() => {
          if (removed) {
            throw removedMapError();
          }
          return undefined;
        }),
        getSource: jest.fn(() => {
          if (removed) {
            throw removedMapError();
          }
          return undefined;
        }),
        removeLayer: jest.fn(() => {
          if (removed) {
            throw removedMapError();
          }
        }),
        removeSource: jest.fn(() => {
          if (removed) {
            throw removedMapError();
          }
        }),
        on: jest.fn(),
        off: jest.fn(),
        addSource: jest.fn(),
        addLayer: jest.fn(),
        remove: jest.fn(() => {
          removed = true;
        }),
      };
      const mapRef = { current: fakeMap };

      const resolvePendingLoad = mount(mapRef, fakeMap);

      const cleanups = mockEffects
        .map((effect) => effect.fn())
        .filter((cleanup): cleanup is () => void => typeof cleanup === 'function');

      fakeMap.getLayer.mockClear();
      fakeMap.getSource.mockClear();
      fakeMap.removeLayer.mockClear();
      fakeMap.removeSource.mockClear();

      let cleanupError: unknown;
      try {
        cleanups.forEach((cleanup) => cleanup());
      } catch (error) {
        cleanupError = error;
      }
      expect(cleanupError).toBeUndefined();
      expect(fakeMap.remove).toHaveBeenCalledTimes(1);
      expect(fakeMap.getLayer).not.toHaveBeenCalled();
      expect(fakeMap.getSource).not.toHaveBeenCalled();
      expect(fakeMap.removeLayer).not.toHaveBeenCalled();
      expect(fakeMap.removeSource).not.toHaveBeenCalled();

      fakeMap.addSource.mockClear();
      fakeMap.addLayer.mockClear();
      fakeMap.getLayer.mockClear();
      fakeMap.getSource.mockClear();
      fakeMap.removeLayer.mockClear();
      fakeMap.removeSource.mockClear();
      fakeMap.on.mockClear();
      fakeMap.off.mockClear();

      await resolvePendingLoad?.();

      expect(fakeMap.addSource).not.toHaveBeenCalled();
      expect(fakeMap.addLayer).not.toHaveBeenCalled();
      expect(fakeMap.getLayer).not.toHaveBeenCalled();
      expect(fakeMap.getSource).not.toHaveBeenCalled();
      expect(fakeMap.removeLayer).not.toHaveBeenCalled();
      expect(fakeMap.removeSource).not.toHaveBeenCalled();
      expect(fakeMap.on).not.toHaveBeenCalled();
      expect(fakeMap.off).not.toHaveBeenCalled();
    }
  );
});
