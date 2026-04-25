import type { Map, GeoJSONSource } from 'mapbox-gl';
import { EMPTY_FEATURE_COLLECTION } from '../../utils/wigle';

export const AGGREGATED_SOURCE = 'wigle-aggregated';
export const AGGREGATED_CIRCLES_LAYER = 'wigle-aggregated-circles';
export const AGGREGATED_LABELS_LAYER = 'wigle-aggregated-labels';

const COUNT_NUM = ['to-number', ['get', 'count']];

// k-suffix abbreviation: ≥1000 → "Nk", else raw integer string.
const ABBREVIATED_COUNT_EXPR = [
  'case',
  ['>=', COUNT_NUM, 1000],
  ['concat', ['to-string', ['floor', ['/', COUNT_NUM, 1000]]], 'k'],
  ['to-string', COUNT_NUM],
] as unknown as mapboxgl.Expression;

export function ensureAggregatedLayers(map: Map, aggregatedFCRef: any) {
  if (!map.getSource(AGGREGATED_SOURCE)) {
    map.addSource(AGGREGATED_SOURCE, {
      type: 'geojson',
      // Backend pre-aggregated — no client-side clustering.
      data: aggregatedFCRef.current || EMPTY_FEATURE_COLLECTION,
    });
  }

  if (!map.getLayer(AGGREGATED_CIRCLES_LAYER)) {
    map.addLayer({
      id: AGGREGATED_CIRCLES_LAYER,
      type: 'circle',
      source: AGGREGATED_SOURCE,
      paint: {
        'circle-color': [
          'match',
          ['get', 'source'],
          'field',
          '#06b6d4',
          'wigle-v2',
          '#3b82f6',
          'wigle-v3',
          '#8b5cf6',
          'kml',
          '#f97316',
          /* fallback */ '#94a3b8',
        ],
        'circle-radius': [
          'step',
          COUNT_NUM,
          5, // count < 10
          10,
          12, // 10 – 99
          100,
          20, // 100 – 749
          750,
          30, // ≥ 750
        ],
        'circle-opacity': ['case', ['==', COUNT_NUM, 1], 0.85, 0.75],
        'circle-stroke-width': ['case', ['==', COUNT_NUM, 1], 0.5, 2.5],
        'circle-stroke-color': ['match', ['get', 'source'], 'kml', '#7c2d12', /* else */ '#0f172a'],
      },
    });
  }

  if (!map.getLayer(AGGREGATED_LABELS_LAYER)) {
    map.addLayer({
      id: AGGREGATED_LABELS_LAYER,
      type: 'symbol',
      source: AGGREGATED_SOURCE,
      filter: ['>', COUNT_NUM, 1],
      layout: {
        'text-field': ABBREVIATED_COUNT_EXPR,
        'text-size': 12,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': '#0f172a',
      },
    });
  }
}

export function updateAggregatedSource(map: Map, data: unknown) {
  const src = map.getSource(AGGREGATED_SOURCE) as GeoJSONSource | undefined;
  if (!src) {
    console.warn('[Aggregated] updateAggregatedSource: source not found, data dropped');
    return;
  }
  src.setData(data as any);
}

export function removeAggregatedLayers(map: Map) {
  [AGGREGATED_LABELS_LAYER, AGGREGATED_CIRCLES_LAYER].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(AGGREGATED_SOURCE)) map.removeSource(AGGREGATED_SOURCE);
}

export function resetAggregatedLayers(map: Map, aggregatedFCRef: any) {
  removeAggregatedLayers(map);
  ensureAggregatedLayers(map, aggregatedFCRef);
}
