import { useEffect, useState, type MutableRefObject } from 'react';
import type { Map } from 'mapbox-gl';
import { wigleApi } from '../../api/wigleApi';
import { EMPTY_FEATURE_COLLECTION } from '../../utils/wigle';
import type { WigleLayerState } from './useWigleLayers';
import { ensureAggregatedLayers, updateAggregatedSource } from './aggregatedLayers';

// Minimum zoom before raw-point mode is allowed (cluster toggle guard).
const RAW_POINT_MIN_ZOOM = 12;

interface UseWigleObservationsProps {
  mapRef: MutableRefObject<Map | null>;
  mapReady: boolean;
  layers: WigleLayerState;
  clusteringEnabled: boolean;
  aggregatedFCRef: MutableRefObject<any>;
}

export interface UseWigleObservationsResult {
  loading: boolean;
  error: string | null;
}

function buildSources(layers: WigleLayerState): string[] {
  const sources: string[] = [];
  if (layers.v2) sources.push('wigle-v2');
  if (layers.v3) sources.push('wigle-v3');
  if (layers.kml) sources.push('kml');
  if (layers.showFieldData) sources.push('field');
  return sources;
}

export const useWigleObservations = ({
  mapRef,
  mapReady,
  layers,
  clusteringEnabled,
  aggregatedFCRef,
}: UseWigleObservationsProps): UseWigleObservationsResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const syncToMap = (fc: any) => {
      aggregatedFCRef.current = fc;
      ensureAggregatedLayers(map, aggregatedFCRef);
      updateAggregatedSource(map, fc);
    };

    const sources = buildSources(layers);

    if (sources.length === 0) {
      syncToMap(EMPTY_FEATURE_COLLECTION);
      return;
    }

    let cancelled = false;
    let requestId = 0;

    const fetchAggregated = async () => {
      const bounds = map.getBounds();
      if (!bounds) return;

      const currentRequestId = ++requestId;
      const actualZoom = Math.floor(map.getZoom());

      // When clustering is off, force raw-point zoom — but only if map is
      // zoomed in enough to avoid a catastrophic point count.
      const zoom = !clusteringEnabled && actualZoom >= RAW_POINT_MIN_ZOOM ? 14 : actualZoom;

      setLoading(true);
      setError(null);

      try {
        const result = await wigleApi.getAggregatedObservations({
          west: Math.max(-180, bounds.getWest()),
          south: Math.max(-90, bounds.getSouth()),
          east: Math.min(180, bounds.getEast()),
          north: Math.min(90, bounds.getNorth()),
          zoom,
          sources,
        });

        if (cancelled || currentRequestId !== requestId) return;

        if (result?.type === 'FeatureCollection') {
          syncToMap(result);
        } else {
          syncToMap(EMPTY_FEATURE_COLLECTION);
        }
      } catch (err: any) {
        if (cancelled || currentRequestId !== requestId) return;
        setError(err?.message ?? 'Failed to fetch aggregated observations');
        syncToMap(EMPTY_FEATURE_COLLECTION);
      } finally {
        if (!cancelled && currentRequestId === requestId) {
          setLoading(false);
        }
      }
    };

    void fetchAggregated();

    const handleMoveEnd = () => {
      void fetchAggregated();
    };
    map.on('moveend', handleMoveEnd);

    return () => {
      cancelled = true;
      map.off('moveend', handleMoveEnd);
    };
  }, [
    aggregatedFCRef,
    clusteringEnabled,
    layers.kml,
    layers.showFieldData,
    layers.v2,
    layers.v3,
    mapReady,
    mapRef,
  ]);

  return { loading, error };
};
