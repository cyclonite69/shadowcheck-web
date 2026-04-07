import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import type { NetworkRow, Observation } from '../../types/network';
import { macColor, frequencyToChannel } from '../../utils/mapHelpers';
import { buildObservationTooltipProps } from '../../utils/geospatial/observationTooltipProps';
import { fitBoundsWithZoomInset } from '../../utils/geospatial/mapViewUtils';

// Format time difference as human-readable string
const formatTimeSince = (ms: number): string => {
  if (ms < 0) return '';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ${hours % 24}h`;
  const months = Math.floor(days / 30);
  return `${months}mo ${days % 30}d`;
};

type ObservationSet = {
  bssid: string;
  observations: Observation[];
};

type CoreObservationLayerProps = {
  mapReady: boolean;
  mapRef: MutableRefObject<MapboxMap | null>;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  mapStyle?: string;
  activeObservationSets: ObservationSet[];
  networkLookup: Map<string, NetworkRow>;
  isViewportLocked?: boolean;
};

export const useCoreObservationLayers = ({
  mapReady,
  mapRef,
  mapboxRef,
  mapStyle,
  activeObservationSets,
  networkLookup,
  isViewportLocked = false,
}: CoreObservationLayerProps) => {
  const networkLookupRef = useRef(networkLookup);

  useEffect(() => {
    networkLookupRef.current = networkLookup;
  }, [networkLookup]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!mapboxgl) return;

    // Assign colors to each selected network using BSSID-based algorithm
    const bssidColors: Record<string, string> = {};
    activeObservationSets.forEach((set) => {
      bssidColors[set.bssid] = macColor(set.bssid);
    });

    // Build per-BSSID co-channel neighbor count.
    const bssidChannel: Map<string, number | null> = new Map();
    activeObservationSets.forEach((set) => {
      const freq = set.observations[0]?.frequency ?? null;
      bssidChannel.set(set.bssid, frequencyToChannel(freq));
    });
    const channelNeighborCount: Map<string, number> = new Map();
    activeObservationSets.forEach((set) => {
      const ch = bssidChannel.get(set.bssid);
      if (ch === null || ch === undefined) {
        channelNeighborCount.set(set.bssid, 0);
        return;
      }
      let count = 0;
      bssidChannel.forEach((otherCh, otherBssid) => {
        if (otherBssid !== set.bssid && otherCh === ch) count++;
      });
      channelNeighborCount.set(set.bssid, count);
    });

    // Pre-calculate jitter offsets to avoid expensive sin/cos calls during rendering
    const jitterOffsets = new Map<string, [number, number]>();
    const calculateJitterOffset = (seenCount: number): [number, number] => {
      if (seenCount === 0) return [0, 0];
      const cacheKey = `${seenCount}`;
      if (!jitterOffsets.has(cacheKey)) {
        const angle = seenCount * 2.399963229728653; // golden angle in radians
        const radius = Math.min(0.00015, 0.00002 * Math.sqrt(seenCount));
        jitterOffsets.set(cacheKey, [Math.sin(angle) * radius, Math.cos(angle) * radius]);
      }
      return jitterOffsets.get(cacheKey) || [0, 0];
    };

    // Create numbered point features for each observation (numbered per network)
    const jitterIndex = new Map<string, number>();
    const features: any[] = [];

    activeObservationSets.forEach((set) => {
      let lastPoint: [number, number] | null = null;
      let lastTime: Date | null = null;

      set.observations.forEach((obs, index) => {
        const network = networkLookupRef.current.get(obs.bssid);
        const threatLevel = network?.threat?.level ?? 'NONE';
        const lat = obs.lat;
        const lon = obs.lon;

        // Calculate distance from last point in meters (optimized haversine)
        let deltaMeters = null;
        if (lastPoint) {
          const [lastLon, lastLat] = lastPoint;
          const latDiff = Math.abs(lat - lastLat);
          const lonDiff = Math.abs(lon - lastLon);

          if (latDiff > 0.00001 || lonDiff > 0.00001) {
            const R = 6371e3; // metres
            const φ1 = (lastLat * Math.PI) / 180;
            const φ2 = (lat * Math.PI) / 180;
            const Δφ = ((lat - lastLat) * Math.PI) / 180;
            const Δλ = ((lon - lastLon) * Math.PI) / 180;

            const a =
              Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            deltaMeters = R * c;
          } else {
            deltaMeters = 0;
          }
        }
        lastPoint = [lon, lat];

        // Calculate time since prior observation
        let timeSincePrior: string | null = null;
        let timeSincePriorMs: number | null = null;
        const currentTime = obs.time ? new Date(obs.time) : null;
        if (currentTime && lastTime) {
          timeSincePriorMs = currentTime.getTime() - lastTime.getTime();
          timeSincePrior = formatTimeSince(Math.abs(timeSincePriorMs));
        }
        if (currentTime) lastTime = currentTime;

        const coordKey = `${lat.toFixed(6)}:${lon.toFixed(6)}`;
        const seenCount = jitterIndex.get(coordKey) ?? 0;
        jitterIndex.set(coordKey, seenCount + 1);
        let displayLat = lat;
        let displayLon = lon;
        if (seenCount > 0) {
          const [sinOffset, cosOffset] = calculateJitterOffset(seenCount);
          const radius = Math.min(0.00015, 0.00002 * Math.sqrt(seenCount));
          displayLat = lat + sinOffset * radius;
          displayLon = lon + cosOffset * radius;
        }

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [displayLon, displayLat],
          },
          properties: buildObservationTooltipProps({
            obs,
            network,
            threatLevel,
            deltaMeters,
            timeSincePrior,
            timeSincePriorMs,
            number: index + 1,
            color: bssidColors[obs.bssid],
            coChannelNeighbors: channelNeighborCount.get(obs.bssid) ?? 0,
          }),
        });
      });
    });

    // Create line features connecting observations for each network
    const lineFeatures = activeObservationSets
      .filter((set) => set.observations.length > 1)
      .map((set) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: set.observations.map((obs) => [obs.lon, obs.lat]),
        },
        properties: {
          bssid: set.bssid,
          color: bssidColors[set.bssid],
        },
      }));

    const syncObservationSources = () => {
      const observationSource = map.getSource('observations') as GeoJSONSource | undefined;
      const lineSource = map.getSource('observation-lines') as GeoJSONSource | undefined;
      if (!observationSource || !lineSource) return false;

      observationSource.setData({
        type: 'FeatureCollection',
        features: features as any,
      });

      lineSource.setData({
        type: 'FeatureCollection',
        features: lineFeatures as any,
      });

      // Auto-zoom to fit bounds of all observations (skip if locked)
      if (features.length > 0 && !isViewportLocked) {
        const coords = features.map((f: any) => f.geometry.coordinates as [number, number]);
        const bounds = coords.reduce(
          (bounds, coord) => bounds.extend(coord),
          new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        fitBoundsWithZoomInset(map, bounds, { padding: 80, duration: 1000, maxZoom: 15 });
      }

      return true;
    };

    if (syncObservationSources()) return;

    const handleStyleLoad = () => {
      syncObservationSources();
    };

    map.once('style.load', handleStyleLoad);
    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [activeObservationSets, mapReady, mapRef, mapboxRef, isViewportLocked, mapStyle]);
};
