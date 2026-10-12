import type { Map as MapboxMap } from 'mapbox-gl';
import {
  GEOSPATIAL_LAYER_COLORS,
  GEOSPATIAL_LAYER_IDS,
  type GeospatialLayerControlKey,
} from '../../../client/src/components/geospatial/layers/layerCatalog';
import { applyMapLayerAppearance } from '../../../client/src/components/geospatial/hooks/useMapLayerAppearance';

describe('applyMapLayerAppearance', () => {
  it('defines a distinct semantic color for each intelligence category', () => {
    expect(GEOSPATIAL_LAYER_COLORS).toMatchObject({
      fieldObservations: '#06b6d4',
      wigleV2: '#3b82f6',
      wigleV3: '#8b5cf6',
      wigleKml: '#eab308',
      alpr: '#d946ef',
      agencies: '#dc2626',
      courthouses: '#6366f1',
      shotspotterZones: '#7f1d1d',
      shotspotterSensors: '#fb7185',
    });
    expect(GEOSPATIAL_LAYER_IDS).not.toHaveProperty('agencyMatches');
    expect(GEOSPATIAL_LAYER_COLORS).not.toHaveProperty('agencyMatches');
    expect(GEOSPATIAL_LAYER_IDS).not.toHaveProperty('deflock');
    expect(GEOSPATIAL_LAYER_COLORS).not.toHaveProperty('deflock');
  });

  it('applies opacity relative to original paint values and respects stack order', () => {
    const layers: Record<string, string> = {
      'geospatial-wigle-v2-mvt-points': 'circle',
      'geospatial-shotspotter-zone-fill': 'fill',
    };
    const paint: Record<string, Record<string, number>> = {
      'geospatial-wigle-v2-mvt-points': { 'circle-opacity': 0.8 },
      'geospatial-shotspotter-zone-fill': { 'fill-opacity': 0.15 },
    };
    const moved: string[] = [];
    const map = {
      isStyleLoaded: () => true,
      getLayer: (id: string) => (layers[id] ? { type: layers[id] } : undefined),
      getPaintProperty: (id: string, property: string) => paint[id]?.[property],
      setPaintProperty: (id: string, property: string, value: number) => {
        paint[id][property] = value;
      },
      moveLayer: (id: string) => moved.push(id),
    } as unknown as MapboxMap;
    const opacity = Object.fromEntries(
      Object.keys(GEOSPATIAL_LAYER_IDS).map((key) => [key, 1])
    ) as Record<GeospatialLayerControlKey, number>;
    opacity.wigleV2 = 0.5;
    opacity.shotspotterZones = 0.4;

    applyMapLayerAppearance(map, {
      opacity,
      order: ['wigleV2', 'shotspotterZones'],
    });

    expect(paint['geospatial-wigle-v2-mvt-points']['circle-opacity']).toBe(0.4);
    expect(paint['geospatial-shotspotter-zone-fill']['fill-opacity']).toBeCloseTo(0.06);
    expect(moved).toEqual(['geospatial-wigle-v2-mvt-points', 'geospatial-shotspotter-zone-fill']);

    opacity.wigleV2 = 0.25;
    applyMapLayerAppearance(map, { opacity, order: ['wigleV2'] });
    expect(paint['geospatial-wigle-v2-mvt-points']['circle-opacity']).toBe(0.2);
  });
});
