import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type mapboxglType from 'mapbox-gl';
import type { NetworkRow, Observation } from '../../types/network';
import { macColor } from '../../utils/mapHelpers';

type ObservationSet = {
  bssid: string;
  observations: Observation[];
};

type ObservationLayerProps = {
  mapReady: boolean;
  mapRef: MutableRefObject<mapboxglType.Map | null>;
  mapboxRef: MutableRefObject<mapboxglType | null>;
  activeObservationSets: ObservationSet[];
  networkLookup: Map<string, NetworkRow>;
};

export const useObservationLayers = ({
  mapReady,
  mapRef,
  mapboxRef,
  activeObservationSets,
  networkLookup,
}: ObservationLayerProps) => {
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

    // Create numbered point features for each observation (numbered per network)
    const jitterIndex = new Map<string, number>();
    const features = activeObservationSets.flatMap((set) =>
      set.observations.map((obs, index) => {
        const network = networkLookup.get(obs.bssid);
        const threatLevel = network?.threat?.level ?? 'NONE';
        const lat = obs.lat;
        const lon = obs.lon;
        const coordKey = `${lat.toFixed(6)}:${lon.toFixed(6)}`;
        const seenCount = jitterIndex.get(coordKey) ?? 0;
        jitterIndex.set(coordKey, seenCount + 1);
        let displayLat = lat;
        let displayLon = lon;
        if (seenCount > 0) {
          const angle = seenCount * 2.399963229728653; // golden angle in radians
          const radius = Math.min(0.00015, 0.00002 * Math.sqrt(seenCount));
          displayLat = lat + Math.sin(angle) * radius;
          displayLon = lon + Math.cos(angle) * radius;
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [displayLon, displayLat],
          },
          properties: {
            bssid: obs.bssid,
            signal: obs.signal,
            time: obs.time,
            frequency: obs.frequency,
            altitude: obs.altitude,
            ssid: network?.ssid || '(hidden)',
            manufacturer: network?.manufacturer || null,
            security: network?.security || null,
            threatLevel,
            first_seen: network?.firstSeen || null,
            last_seen: network?.lastSeen || null,
            timespan_days: typeof network?.timespanDays === 'number' ? network.timespanDays : null,
            type: network?.type || null,
            number: index + 1,
            color: bssidColors[obs.bssid],
          },
        };
      })
    );

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

    if (map.getSource('observations')) {
      (map.getSource('observations') as mapboxglType.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: features as any,
      });
    }

    if (map.getSource('observation-lines')) {
      (map.getSource('observation-lines') as mapboxglType.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: lineFeatures as any,
      });
    }

    // Auto-zoom to fit bounds of all observations
    if (features.length > 0) {
      const coords = features.map((f: any) => f.geometry.coordinates as [number, number]);
      const bounds = coords.reduce(
        (bounds, coord) => bounds.extend(coord),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 50, duration: 1000 });
    }
  }, [activeObservationSets, mapReady, mapRef, mapboxRef, networkLookup]);
};
