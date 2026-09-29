// This test hand-orders same-fiber unmount cleanups: the map owner removes the
// map before later hooks clean up. Real React DOM ordering was verified with
// react-dom/client and jsdom: ["owner map.remove","federal courthouse"].
export {};

const React = require('react');

const mockEffects: Array<{ fn: () => void | (() => void); deps?: any[] }> = [];

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

import { useFederalCourthouses } from '../../../client/src/components/hooks/useFederalCourthouses';

type CleanupCase = {
  name: string;
  cleanupCondition: string;
  mount: (mapRef: { current: any }, fakeMap: any) => void;
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
];

describe('Map removal cleanup regression tests', () => {
  beforeEach(() => {
    mockEffects.length = 0;
  });

  it.each(cleanupCases)(
    '$name cleanup ($cleanupCondition) does not access map layers after the owner removes the map',
    ({ mount }) => {
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
        remove: jest.fn(() => {
          removed = true;
        }),
      };
      const mapRef = { current: fakeMap };

      mount(mapRef, fakeMap);

      const cleanups = mockEffects
        .map((effect) => effect.fn())
        .filter((cleanup): cleanup is () => void => typeof cleanup === 'function');

      fakeMap.getLayer.mockClear();
      fakeMap.getSource.mockClear();
      fakeMap.removeLayer.mockClear();
      fakeMap.removeSource.mockClear();

      expect(() => {
        cleanups.forEach((cleanup) => cleanup());
      }).not.toThrow();
      expect(fakeMap.remove).toHaveBeenCalledTimes(1);
      expect(fakeMap.getLayer).not.toHaveBeenCalled();
      expect(fakeMap.getSource).not.toHaveBeenCalled();
      expect(fakeMap.removeLayer).not.toHaveBeenCalled();
      expect(fakeMap.removeSource).not.toHaveBeenCalled();
    }
  );
});
