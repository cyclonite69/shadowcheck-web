import type { Map } from 'mapbox-gl';
import {
  applyLayerVisibility,
  ensureAlprMvtLayer,
  ensureFieldDataMvtLayer,
  startAlprMvtPulse,
} from '../../../client/src/components/geospatial/layers/mapLayers';
import { attachAlprMvtHandlers } from '../../../client/src/components/geospatial/layers/alprMvtHandlers';
import { DEFAULT_LAYERS } from '../../../client/src/utils/wigle/constants';

jest.mock('../../../client/src/components/hooks/useAlprCameras', () => ({
  renderAlprPopupCard: jest.fn(),
}));
jest.mock('../../../client/src/utils/geospatial/popupAnchor', () => ({
  getPopupAnchor: jest.fn(() => 'top-left'),
}));
jest.mock('../../../client/src/utils/geospatial/setupPopupDrag', () => ({
  setupPopupDrag: jest.fn(() => ({})),
  cleanupPopupDrag: jest.fn(),
}));
jest.mock('../../../client/src/utils/geospatial/setupPopupPin', () => ({
  setupPopupPin: jest.fn(() => jest.fn()),
}));

import { renderAlprPopupCard } from '../../../client/src/components/hooks/useAlprCameras';

describe('experimental ALPR MVT layer', () => {
  it('is opt-in by default', () => {
    expect(DEFAULT_LAYERS.mvtAlprCameras).toBe(false);
  });

  it('adds the field-observation MVT source and point layer', () => {
    const map = {
      getSource: jest.fn().mockReturnValue(undefined),
      getLayer: jest.fn().mockReturnValue(undefined),
      addSource: jest.fn(),
      addLayer: jest.fn(),
    } as unknown as Map;

    ensureFieldDataMvtLayer(map);

    expect(map.addSource).toHaveBeenCalledWith('wigle-field-data-mvt', {
      type: 'vector',
      tiles: [
        `${typeof window !== 'undefined' ? window.location.origin : ''}/api/wigle/tiles/observations/{z}/{x}/{y}.pbf`,
      ],
      minzoom: 0,
      maxzoom: 22,
    });
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'wigle-field-mvt-points',
        type: 'circle',
        source: 'wigle-field-data-mvt',
        'source-layer': 'observations',
        paint: {
          'circle-color': '#06b6d4',
          'circle-radius': 3.5,
          'circle-opacity': 0.85,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#083344',
        },
      })
    );
  });

  it('toggles field-observation MVT visibility from the Field Data setting', () => {
    const map = {
      getLayer: jest.fn().mockReturnValue({}),
      setLayoutProperty: jest.fn(),
    } as unknown as Map;

    applyLayerVisibility(map, {
      v2: false,
      v3: false,
      kml: false,
      showFieldData: true,
    });
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'wigle-field-mvt-points',
      'visibility',
      'visible'
    );

    jest.clearAllMocks();
    applyLayerVisibility(map, {
      v2: false,
      v3: false,
      kml: false,
      showFieldData: false,
    });
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'wigle-field-mvt-points',
      'visibility',
      'none'
    );
  });

  it('adds a vector source and circle layer for the ALPR MVT endpoint', () => {
    const addLayer = jest.fn();
    const map = {
      getSource: jest.fn().mockReturnValue(undefined),
      getLayer: jest.fn().mockReturnValue(undefined),
      addSource: jest.fn(),
      addLayer,
    } as unknown as Map;

    ensureAlprMvtLayer(map);

    expect(map.addSource).toHaveBeenCalledWith('alpr-cameras-mvt', {
      type: 'vector',
      tiles: [
        `${typeof window !== 'undefined' ? window.location.origin : ''}/api/wigle/tiles/alpr/{z}/{x}/{y}.pbf`,
      ],
      minzoom: 0,
      maxzoom: 22,
    });
    expect(map.addLayer).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'alpr-cameras-mvt-pulse',
        type: 'circle',
        source: 'alpr-cameras-mvt',
        'source-layer': 'alpr_cameras',
        paint: {
          'circle-color': '#d946ef',
          'circle-radius': 4,
          'circle-opacity': 0.8,
          'circle-pitch-alignment': 'map',
        },
      })
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'alpr-cameras-mvt-points',
        type: 'circle',
        source: 'alpr-cameras-mvt',
        'source-layer': 'alpr_cameras',
        paint: {
          'circle-color': '#d946ef',
          'circle-opacity': 0.95,
          'circle-radius': 3.5,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#2e0238',
        },
      })
    );
    expect(addLayer.mock.invocationCallOrder[0]).toBeLessThan(addLayer.mock.invocationCallOrder[1]);
  });

  it('toggles MVT layer visibility without changing other layer visibility', () => {
    const map = {
      getLayer: jest.fn().mockReturnValue({}),
      setLayoutProperty: jest.fn(),
    } as unknown as Map;

    applyLayerVisibility(map, { v2: true, v3: false, kml: false, mvtAlprCameras: true });
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'alpr-cameras-mvt-pulse',
      'visibility',
      'visible'
    );
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'alpr-cameras-mvt-points',
      'visibility',
      'visible'
    );

    jest.clearAllMocks();
    applyLayerVisibility(map, { v2: true, v3: false, kml: false, mvtAlprCameras: false });
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'alpr-cameras-mvt-pulse',
      'visibility',
      'none'
    );
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'alpr-cameras-mvt-points',
      'visibility',
      'none'
    );
  });

  it('updates paint properties while visible and stops requesting frames when hidden', () => {
    const originalWindow = globalThis.window;
    const requestedFrames: FrameRequestCallback[] = [];
    const requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      requestedFrames.push(callback);
      return requestedFrames.length;
    });
    const cancelAnimationFrame = jest.fn();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { requestAnimationFrame, cancelAnimationFrame },
    });
    const map = {
      getLayer: jest.fn().mockReturnValue({}),
      getLayoutProperty: jest.fn().mockReturnValue('visible'),
      setPaintProperty: jest.fn(),
    } as unknown as Map;
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(750);

    try {
      const cleanup = startAlprMvtPulse(map);
      requestedFrames[0](0);

      expect(map.setPaintProperty).toHaveBeenNthCalledWith(
        1,
        'alpr-cameras-mvt-pulse',
        'circle-radius',
        11
      );
      expect(map.setPaintProperty).toHaveBeenNthCalledWith(
        2,
        'alpr-cameras-mvt-pulse',
        'circle-opacity',
        0.4
      );
      expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
      cleanup();
      expect(cancelAnimationFrame).toHaveBeenCalledWith(2);

      const hiddenMap = {
        getLayer: jest.fn().mockReturnValue({}),
        getLayoutProperty: jest.fn().mockReturnValue('visible'),
        setPaintProperty: jest.fn(),
      } as unknown as Map;
      const hiddenCleanup = startAlprMvtPulse(hiddenMap);
      const hiddenFrame = requestedFrames[2];
      expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
      (hiddenMap.getLayoutProperty as jest.Mock).mockReturnValue('none');
      hiddenFrame(1);
      expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
      expect(hiddenMap.setPaintProperty).not.toHaveBeenCalled();
      hiddenCleanup();
    } finally {
      dateNow.mockRestore();
      if (typeof originalWindow === 'undefined') {
        Reflect.deleteProperty(globalThis, 'window');
      } else {
        Object.defineProperty(globalThis, 'window', {
          configurable: true,
          value: originalWindow,
        });
      }
    }
  });

  it('attaches hover and click handlers and renders a popup from tile properties', () => {
    jest.mocked(renderAlprPopupCard).mockReturnValue('<div>ALPR Camera (OSM)</div>');
    const handlers: Record<string, (...args: any[]) => void> = {};
    const canvas = { style: { cursor: '' } };
    const popup = {
      setLngLat: jest.fn().mockReturnThis(),
      setHTML: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      getElement: jest.fn().mockReturnValue(null),
      remove: jest.fn(),
    };
    const Popup = jest.fn().mockReturnValue(popup);
    const mapboxgl = { Popup };
    const map = {
      on: jest.fn((event: string, layer: string, handler: (...args: any[]) => void) => {
        handlers[`${event}:${layer}`] = handler;
      }),
      off: jest.fn(),
      getCanvas: jest.fn(() => canvas),
      project: jest.fn(),
      getContainer: jest.fn(),
    } as unknown as Map;

    const cleanup = attachAlprMvtHandlers(map, mapboxgl as any);
    handlers['mouseenter:alpr-cameras-mvt-points']();
    expect(canvas.style.cursor).toBe('pointer');
    handlers['mouseleave:alpr-cameras-mvt-points']();
    expect(canvas.style.cursor).toBe('');

    handlers['click:alpr-cameras-mvt-points']({
      features: [
        {
          properties: {
            osm_id: '42',
            manufacturer: 'Flock',
            camera_type: 'fixed',
            operator: 'City',
            direction: '90',
            camera_mount: 'pole',
            surveillance_zone: 'traffic',
          },
        },
      ],
      lngLat: { lng: -122.4, lat: 37.7 },
    });

    expect(renderAlprPopupCard).toHaveBeenCalledWith(
      expect.objectContaining({
        osm_id: '42',
        manufacturer: 'Flock',
        camera_type: 'fixed',
        operator: 'City',
        direction: '90',
        camera_mount: 'pole',
        surveillance_zone: 'traffic',
      }),
      [-122.4, 37.7]
    );
    expect(mapboxgl.Popup).toHaveBeenCalledTimes(1);
    expect(Popup.mock.calls[0][0]).toMatchObject({ className: 'sc-popup', maxWidth: '320px' });
    expect(popup.setHTML).toHaveBeenCalledWith(expect.stringContaining('ALPR Camera (OSM)'));
    expect(popup.addTo).toHaveBeenCalledWith(map);

    cleanup();
    expect(map.off).toHaveBeenCalledTimes(3);
  });
});
