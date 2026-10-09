import { useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { GEOSPATIAL_LAYER_IDS, type GeospatialLayerControlKey } from '../layers/layerCatalog';

type LayerOpacity = Record<GeospatialLayerControlKey, number>;
type LayerOrder = GeospatialLayerControlKey[];
type OpacityPaintProperty = 'circle-opacity' | 'fill-opacity' | 'line-opacity' | 'text-opacity';

const basePaintValues = new WeakMap<
  MapboxMap,
  Map<string, { property: OpacityPaintProperty; value: number }>
>();

function opacityProperty(type: string): OpacityPaintProperty | null {
  if (type === 'circle') {
    return 'circle-opacity';
  }
  if (type === 'fill') {
    return 'fill-opacity';
  }
  if (type === 'line') {
    return 'line-opacity';
  }
  if (type === 'symbol') {
    return 'text-opacity';
  }
  return null;
}

export function applyMapLayerAppearance(
  map: MapboxMap,
  {
    opacity,
    order,
  }: {
    opacity: LayerOpacity;
    order: LayerOrder;
  }
) {
  if (!map.isStyleLoaded()) {
    return;
  }

  let originals = basePaintValues.get(map);
  if (!originals) {
    originals = new Map();
    basePaintValues.set(map, originals);
  }

  (Object.keys(GEOSPATIAL_LAYER_IDS) as GeospatialLayerControlKey[]).forEach((key) => {
    GEOSPATIAL_LAYER_IDS[key].forEach((layerId) => {
      const layer = map.getLayer(layerId);
      if (!layer) {
        return;
      }
      const property = opacityProperty(layer.type);
      if (!property) {
        return;
      }
      const currentValue = map.getPaintProperty(layerId, property);
      if (!originals.has(layerId)) {
        originals.set(layerId, {
          property,
          value: typeof currentValue === 'number' ? currentValue : 1,
        });
      }
      const original = originals.get(layerId);
      if (original) {
        map.setPaintProperty(layerId, property, original.value * opacity[key]);
      }
    });
  });

  order.forEach((key) => {
    GEOSPATIAL_LAYER_IDS[key].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    });
  });
}

export function useMapLayerAppearance({
  mapRef,
  mapReady,
  opacity,
  order,
  revision,
}: {
  mapRef: React.MutableRefObject<MapboxMap | null>;
  mapReady: boolean;
  opacity: LayerOpacity;
  order: LayerOrder;
  revision?: unknown;
}) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const applyAppearance = () => applyMapLayerAppearance(map, { opacity, order });

    applyAppearance();
    map.on('style.load', applyAppearance);
    return () => {
      map.off('style.load', applyAppearance);
    };
  }, [mapReady, mapRef, opacity, order, revision]);
}
