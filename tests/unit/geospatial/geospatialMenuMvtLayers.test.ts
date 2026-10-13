import type { Map as MapboxMap } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { getPopupAnchor } from '../../../client/src/utils/geospatial/popupAnchor';
import {
  cleanupPopupDrag,
  setupPopupDrag,
} from '../../../client/src/utils/geospatial/setupPopupDrag';
import {
  applyGeospatialLayerVisibility,
  ensureGeospatialAlprMvtLayer,
  ensureGeospatialFieldDataMvtLayer,
  ensureKmlMvtLayer,
  ensureShotspotterMvtLayers,
  ensureWigleV2MvtLayer,
  ensureWigleV3MvtLayer,
} from '../../../client/src/components/geospatial/layers/mapLayers';
import { attachGeospatialMvtInteractions } from '../../../client/src/components/geospatial/layers/useGeospatialMenuMvtLayers';

jest.mock('../../../client/src/api/agencyApi', () => ({
  agencyApi: { getAlprCameras: jest.fn() },
}));
jest.mock('../../../client/src/utils/geospatial/popupAnchor', () => ({
  getPopupAnchor: jest.fn(() => 'top'),
}));
jest.mock('../../../client/src/utils/geospatial/setupPopupDrag', () => ({
  cleanupPopupDrag: jest.fn(),
  setupPopupDrag: jest.fn(() => ({})),
}));

function createMapMock() {
  const sources = new Set<string>();
  const layers = new Map<string, Record<string, unknown>>();
  const handlers: Array<{
    event: string;
    layer: string;
    handler: (event: any) => void;
  }> = [];
  const canvas = { style: { cursor: '' } };
  const map = {
    addSource: jest.fn((id: string) => sources.add(id)),
    addLayer: jest.fn((layer: Record<string, unknown>) => {
      layers.set(String(layer.id), layer);
    }),
    getSource: jest.fn((id: string) => (sources.has(id) ? {} : undefined)),
    getLayer: jest.fn((id: string) => layers.get(id)),
    getLayoutProperty: jest.fn((id: string) => {
      const layer = layers.get(id);
      const layout = layer?.layout as Record<string, unknown> | undefined;
      return layout?.visibility;
    }),
    setLayoutProperty: jest.fn((id: string, property: string, value: unknown) => {
      const layer = layers.get(id);
      if (layer) {
        const layout = (layer.layout ?? {}) as Record<string, unknown>;
        layout[property] = value;
        layer.layout = layout;
      }
    }),
    setPaintProperty: jest.fn((id: string, property: string, value: unknown) => {
      const layer = layers.get(id);
      if (layer) {
        const paint = (layer.paint ?? {}) as Record<string, unknown>;
        paint[property] = value;
        layer.paint = paint;
      }
    }),
    on: jest.fn((event: string, layer: string, handler: (event: any) => void) => {
      handlers.push({ event, layer, handler });
    }),
    off: jest.fn(),
    getCanvas: jest.fn(() => canvas),
  };
  return { map: map as unknown as MapboxMap, sources, layers, handlers, canvas };
}

describe('Geospatial Explorer MVT layers', () => {
  it('constructs all menu tile sources and corresponding feature layers', () => {
    const { map, sources, layers } = createMapMock();
    [
      ensureGeospatialFieldDataMvtLayer,
      ensureGeospatialAlprMvtLayer,
      ensureKmlMvtLayer,
      ensureWigleV2MvtLayer,
      ensureWigleV3MvtLayer,
      ensureShotspotterMvtLayers,
    ].forEach((ensureLayer) => ensureLayer(map));

    expect(sources.size).toBe(6);
    expect(layers.size).toBe(9);
    expect(layers.get('geospatial-alpr-mvt-pulse')).toEqual(
      expect.objectContaining({
        type: 'circle',
        source: 'geospatial-alpr-mvt',
        'source-layer': 'alpr_cameras',
        layout: { visibility: 'none' },
        paint: expect.objectContaining({
          'circle-color': '#d946ef',
          'circle-radius': 4,
          'circle-opacity': 0.8,
          'circle-pitch-alignment': 'map',
        }),
      })
    );
    expect(layers.get('geospatial-alpr-mvt-points')).toEqual(
      expect.objectContaining({
        type: 'circle',
        source: 'geospatial-alpr-mvt',
        'source-layer': 'alpr_cameras',
        paint: expect.objectContaining({
          'circle-color': '#d946ef',
          'circle-radius': 4,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        }),
      })
    );
    expect(layers.get('geospatial-kml-mvt-points')).toEqual(
      expect.objectContaining({
        paint: expect.objectContaining({
          'circle-color': '#eab308',
          'circle-stroke-width': 0.75,
          'circle-stroke-color': '#0f172a',
        }),
      })
    );
    expect(layers.get('geospatial-wigle-v2-mvt-points')).toEqual(
      expect.objectContaining({
        paint: expect.objectContaining({
          'circle-color': '#3b82f6',
          'circle-stroke-width': 0.75,
          'circle-stroke-color': '#0f172a',
        }),
      })
    );
    expect(layers.get('geospatial-wigle-v3-mvt-points')).toEqual(
      expect.objectContaining({
        paint: expect.objectContaining({
          'circle-color': '#8b5cf6',
          'circle-stroke-width': 0.75,
          'circle-stroke-color': '#0f172a',
        }),
      })
    );
    expect(layers.get('geospatial-field-mvt-points')).toEqual(
      expect.objectContaining({
        paint: expect.objectContaining({
          'circle-color': '#06b6d4',
          'circle-stroke-width': 0.75,
          'circle-stroke-color': '#0f172a',
        }),
      })
    );
    expect(layers.has('geospatial-deflock-mvt-points')).toBe(false);
    expect(layers.get('geospatial-shotspotter-zone-fill')).toEqual(
      expect.objectContaining({
        type: 'fill',
        'source-layer': 'shotspotter_zones',
        paint: expect.objectContaining({ 'fill-color': '#7f1d1d', 'fill-opacity': 0.18 }),
      })
    );
    expect(layers.get('geospatial-shotspotter-sensor-points')).toEqual(
      expect.objectContaining({
        type: 'circle',
        'source-layer': 'shotspotter_sensors',
        paint: expect.objectContaining({ 'circle-color': '#fb7185' }),
      })
    );
    expect(map.addSource).toHaveBeenCalledWith(
      'geospatial-wigle-v2-mvt',
      expect.objectContaining({
        type: 'vector',
        tiles: [
          `${typeof window !== 'undefined' ? window.location.origin : ''}/api/geospatial/tiles/wigle-v2/{z}/{x}/{y}.pbf`,
        ],
      })
    );
  });

  it('keeps source and layer construction idempotent', () => {
    const { map, layers } = createMapMock();
    const ensureLayers = () => {
      ensureGeospatialFieldDataMvtLayer(map);
      ensureShotspotterMvtLayers(map);
    };

    ensureLayers();
    ensureLayers();

    expect(map.addSource).toHaveBeenCalledTimes(2);
    expect(map.addLayer).toHaveBeenCalledTimes(4);
    expect(layers.size).toBe(4);
  });

  it('applies each menu visibility only to its corresponding MVT layers', () => {
    const ids = [
      'geospatial-field-mvt-points',
      'geospatial-wigle-v2-mvt-points',
      'geospatial-wigle-v3-mvt-points',
      'geospatial-kml-mvt-points',
      'geospatial-alpr-mvt-pulse',
      'geospatial-alpr-mvt-points',
      'geospatial-shotspotter-zone-fill',
      'geospatial-shotspotter-zone-line',
      'geospatial-shotspotter-sensor-points',
    ];
    const map = {
      getLayer: jest.fn(() => ({})),
      setLayoutProperty: jest.fn(),
    } as unknown as MapboxMap;

    applyGeospatialLayerVisibility(map, {
      fieldObservations: true,
      wigleV2: false,
      wigleV3: true,
      kml: false,
      alpr: true,
      shotspotterZones: true,
      shotspotterSensors: false,
    });

    expect(map.setLayoutProperty).toHaveBeenCalledTimes(ids.length);
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'geospatial-alpr-mvt-pulse',
      'visibility',
      'visible'
    );
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'geospatial-field-mvt-points',
      'visibility',
      'visible'
    );
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'geospatial-wigle-v2-mvt-points',
      'visibility',
      'none'
    );
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'geospatial-shotspotter-zone-line',
      'visibility',
      'visible'
    );
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'geospatial-shotspotter-sensor-points',
      'visibility',
      'none'
    );
  });

  it('animates the Geospatial ALPR pulse when its visibility is enabled', () => {
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
    const { map } = createMapMock();
    ensureGeospatialAlprMvtLayer(map);
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(750);

    try {
      applyGeospatialLayerVisibility(map, {
        fieldObservations: false,
        wigleV2: false,
        wigleV3: false,
        kml: false,
        alpr: true,
        shotspotterZones: false,
        shotspotterSensors: false,
      });
      requestedFrames[0](0);

      expect(map.setPaintProperty).toHaveBeenCalledWith(
        'geospatial-alpr-mvt-pulse',
        'circle-radius',
        11
      );
      expect(map.setPaintProperty).toHaveBeenCalledWith(
        'geospatial-alpr-mvt-pulse',
        'circle-opacity',
        0.4
      );

      applyGeospatialLayerVisibility(map, {
        fieldObservations: false,
        wigleV2: false,
        wigleV3: false,
        kml: false,
        alpr: false,
        shotspotterZones: false,
        shotspotterSensors: false,
      });
      expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
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

  it('renders network cards in anchored, draggable HTML popups and detaches handlers', () => {
    const { map, handlers, canvas } = createMapMock();
    const dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      listeners: { mouseMove: () => {}, mouseUp: () => {} },
    };
    jest.mocked(getPopupAnchor).mockReturnValue('top-left');
    jest.mocked(setupPopupDrag).mockReturnValue(dragState);
    const popup = {
      setLngLat: jest.fn().mockReturnThis(),
      setHTML: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      remove: jest.fn().mockReturnThis(),
    };
    const mapboxgl = { Popup: jest.fn(() => popup) } as unknown as typeof mapboxglType;
    try {
      const detach = attachGeospatialMvtInteractions(map, mapboxgl);
      const enter = handlers.find(
        (handler) => handler.event === 'mouseenter' && handler.layer === 'geospatial-kml-mvt-points'
      );
      const leave = handlers.find(
        (handler) => handler.event === 'mouseleave' && handler.layer === 'geospatial-kml-mvt-points'
      );
      const click = handlers.find(
        (handler) => handler.event === 'click' && handler.layer === 'geospatial-kml-mvt-points'
      );
      enter?.handler({});
      expect(canvas.style.cursor).toBe('pointer');
      leave?.handler({});
      expect(canvas.style.cursor).toBe('');

      click?.handler({
        lngLat: { lng: -122, lat: 47 },
        features: [{ properties: { bssid: 'AA:BB:CC:DD:EE:FF', ssid: '<script>unsafe</script>' } }],
      });

      expect(getPopupAnchor).toHaveBeenCalledWith(map, { lng: -122, lat: 47 }, expect.any(String));
      expect(mapboxgl.Popup).toHaveBeenCalledWith({
        anchor: 'top-left',
        offset: 15,
        className: 'sc-popup',
        maxWidth: 'min(360px, 90vw)',
        focusAfterOpen: false,
        closeOnClick: true,
        closeButton: false,
      });
      const popupHtml = (popup.setHTML as jest.Mock).mock.calls[0][0] as string;
      expect(popupHtml).toContain('&lt;script&gt;unsafe&lt;/script&gt;');
      expect(popupHtml).toContain('<div style=');
      expect(setupPopupDrag).toHaveBeenCalledWith(popup, expect.any(Function));
      popup.remove();
      expect(cleanupPopupDrag).toHaveBeenCalledWith(popup, dragState);
      detach();
      expect(map.off).toHaveBeenCalledTimes(21);
      expect(handlers.some((handler) => handler.layer.includes('deflock'))).toBe(false);
    } finally {
      jest.clearAllMocks();
    }
  });

  it('routes ALPR and ShotSpotter features to their card renderers', () => {
    const { map, handlers } = createMapMock();
    const popup = {
      setLngLat: jest.fn().mockReturnThis(),
      setHTML: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      remove: jest.fn().mockReturnThis(),
    };
    const mapboxgl = { Popup: jest.fn(() => popup) } as unknown as typeof mapboxglType;
    const detach = attachGeospatialMvtInteractions(map, mapboxgl);
    const event = (properties: Record<string, unknown>) => ({
      lngLat: { lng: -122, lat: 47 },
      features: [{ properties }],
    });
    const click = (layerId: string, properties: Record<string, unknown>) => {
      handlers
        .find((handler) => handler.event === 'click' && handler.layer === layerId)
        ?.handler(event(properties));
      const calls = (popup.setHTML as jest.Mock).mock.calls;
      return calls[calls.length - 1]?.[0] as string;
    };

    try {
      expect(
        click('geospatial-alpr-mvt-points', {
          osm_id: '123',
          manufacturer: 'Flock Safety',
          operator: '<script>unsafe</script>',
          direction: '90',
        })
      ).toContain('Flock Safety');
      const alprHtml = (popup.setHTML as jest.Mock).mock.calls[
        (popup.setHTML as jest.Mock).mock.calls.length - 1
      ][0] as string;
      expect(alprHtml).not.toContain('<script>');

      expect(
        click('geospatial-wigle-v2-mvt-points', {
          ssid: 'Blue Network',
          name: 'Fallback Name',
          bssid: 'AA:BB:CC:DD:EE:FF',
          last_seen: '2026-10-10 12:34:56',
          encryption: 'WPA2',
          channel: 11,
          type: 'WiFi',
        })
      ).toContain('WiGLE v2 Network');
      const wigleV2Html = (popup.setHTML as jest.Mock).mock.calls[
        (popup.setHTML as jest.Mock).mock.calls.length - 1
      ][0] as string;
      expect(wigleV2Html).toContain('2026-10-10 12:34:56');
      expect(wigleV2Html).toContain('Blue Network');
      expect(wigleV2Html).not.toContain('Data Quality');
      expect(wigleV2Html).not.toContain('HOME');
      expect(wigleV2Html).not.toContain('<details');

      expect(
        click('geospatial-wigle-v3-mvt-points', {
          ssid: 'Purple Capture',
          netid: '11:22:33:44:55:66',
          observed_at: '2026-10-10 13:42:17',
          signal: -71,
          channel: 1,
          frequency: 2412,
        })
      ).toContain('WiGLE v3 Observation');
      const wigleV3Html = (popup.setHTML as jest.Mock).mock.calls[
        (popup.setHTML as jest.Mock).mock.calls.length - 1
      ][0] as string;
      expect(wigleV3Html).toContain('2026-10-10 13:42:17');
      expect(wigleV3Html).toContain('-71 dBm');
      expect(wigleV3Html).toContain('Ch 1 · 2412 MHz');
      expect(wigleV3Html).not.toContain('Data Quality');
      expect(wigleV3Html).not.toContain('HOME');
      expect(wigleV3Html).not.toContain('<details');
      expect(wigleV3Html).not.toContain('Observations');

      expect(
        click('geospatial-shotspotter-sensor-points', {
          sensor_id: '<sensor-1>',
          status: 'active',
        })
      ).toContain('SoundThinking · ShotSpotter');
      const shotspotterHtml = (popup.setHTML as jest.Mock).mock.calls[
        (popup.setHTML as jest.Mock).mock.calls.length - 1
      ][0] as string;
      expect(shotspotterHtml).toContain('&lt;sensor-1&gt;');
    } finally {
      detach();
    }
  });
});
