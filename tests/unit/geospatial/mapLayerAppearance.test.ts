import type { Map as MapboxMap } from 'mapbox-gl';
import {
  GEOSPATIAL_LAYER_IDS,
  type GeospatialLayerControlKey,
} from '../../../client/src/components/geospatial/layers/layerCatalog';
import { applyMapLayerAppearance } from '../../../client/src/components/geospatial/hooks/useMapLayerAppearance';

describe('applyMapLayerAppearance', () => {
  it('applies opacity relative to original paint values and respects stack order', () => {
    const layers: Record<string, string> = {
      'wigle-v2-clusters': 'circle',
      'wigle-v2-unclustered': 'circle',
      'wigle-v2-cluster-count': 'symbol',
      'shotspotter-fill': 'fill',
    };
    const paint: Record<string, Record<string, number>> = {
      'wigle-v2-clusters': { 'circle-opacity': 0.75 },
      'wigle-v2-unclustered': { 'circle-opacity': 0.8 },
      'wigle-v2-cluster-count': {},
      'shotspotter-fill': { 'fill-opacity': 0.15 },
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

    expect(paint['wigle-v2-unclustered']['circle-opacity']).toBe(0.4);
    expect(paint['wigle-v2-clusters']['circle-opacity']).toBeCloseTo(0.375);
    expect(paint['wigle-v2-cluster-count']['text-opacity']).toBe(0.5);
    expect(paint['shotspotter-fill']['fill-opacity']).toBeCloseTo(0.06);
    expect(moved).toEqual([
      'wigle-v2-clusters',
      'wigle-v2-cluster-count',
      'wigle-v2-unclustered',
      'shotspotter-fill',
    ]);

    opacity.wigleV2 = 0.25;
    applyMapLayerAppearance(map, { opacity, order: ['wigleV2'] });
    expect(paint['wigle-v2-unclustered']['circle-opacity']).toBe(0.2);
  });
});
