import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_GEOSPATIAL_LAYER_ORDER,
  type GeospatialLayerControlKey,
} from '../layers/layerCatalog';

const STORAGE_KEY = 'shadowcheck_geospatial_layers';

type LayerVisibility = Record<GeospatialLayerControlKey, boolean>;
type LayerOpacity = Record<GeospatialLayerControlKey, number>;

interface StoredLayerPreferences {
  visibility: LayerVisibility;
  opacity: LayerOpacity;
  order: GeospatialLayerControlKey[];
}

const DEFAULT_VISIBILITY: LayerVisibility = {
  wigleV2: false,
  wigleV3: false,
  wigleKml: false,
  fieldObservations: false,
  agencies: false,
  agencyMatches: false,
  courthouses: false,
  alpr: false,
  deflock: false,
  shotspotterZones: false,
  shotspotterSensors: false,
};

const DEFAULT_OPACITY: LayerOpacity = {
  wigleV2: 1,
  wigleV3: 1,
  wigleKml: 1,
  fieldObservations: 1,
  agencies: 1,
  agencyMatches: 1,
  courthouses: 1,
  alpr: 1,
  deflock: 1,
  shotspotterZones: 1,
  shotspotterSensors: 1,
};

function readPreferences(): StoredLayerPreferences {
  if (typeof localStorage === 'undefined') {
    return {
      visibility: DEFAULT_VISIBILITY,
      opacity: DEFAULT_OPACITY,
      order: [...DEFAULT_GEOSPATIAL_LAYER_ORDER],
    };
  }
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || '{}'
    ) as Partial<StoredLayerPreferences>;
    const visibility = { ...DEFAULT_VISIBILITY };
    const opacity = { ...DEFAULT_OPACITY };
    const validKeys = Object.keys(DEFAULT_VISIBILITY) as GeospatialLayerControlKey[];

    validKeys.forEach((key) => {
      if (typeof parsed.visibility?.[key] === 'boolean') {
        visibility[key] = parsed.visibility[key]!;
      }
      const value = parsed.opacity?.[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        opacity[key] = Math.min(1, Math.max(0, value));
      }
    });

    const order = Array.isArray(parsed.order)
      ? parsed.order.filter((key): key is GeospatialLayerControlKey =>
          DEFAULT_GEOSPATIAL_LAYER_ORDER.includes(key as GeospatialLayerControlKey)
        )
      : [];
    const completeOrder = [
      ...order,
      ...DEFAULT_GEOSPATIAL_LAYER_ORDER.filter((key) => !order.includes(key)),
    ];
    return { visibility, opacity, order: completeOrder };
  } catch {
    return {
      visibility: DEFAULT_VISIBILITY,
      opacity: DEFAULT_OPACITY,
      order: [...DEFAULT_GEOSPATIAL_LAYER_ORDER],
    };
  }
}

export function useGeospatialLayerPreferences() {
  const [preferences, setPreferences] = useState(readPreferences);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }
  }, [preferences]);

  const toggleLayer = useCallback((key: keyof LayerVisibility) => {
    setPreferences((current) => ({
      ...current,
      visibility: { ...current.visibility, [key]: !current.visibility[key] },
    }));
  }, []);

  const setLayerOpacity = useCallback((key: keyof LayerOpacity, opacity: number) => {
    const normalizedOpacity = Math.min(1, Math.max(0, opacity));
    setPreferences((current) => ({
      ...current,
      opacity: { ...current.opacity, [key]: normalizedOpacity },
    }));
  }, []);

  const moveLayer = useCallback((key: GeospatialLayerControlKey, direction: -1 | 1) => {
    setPreferences((current) => {
      const index = current.order.indexOf(key);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.order.length) {
        return current;
      }
      const order = [...current.order];
      [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
      return { ...current, order };
    });
  }, []);

  return {
    visibility: preferences.visibility,
    opacity: preferences.opacity,
    order: preferences.order,
    toggleLayer,
    setLayerOpacity,
    moveLayer,
  };
}
