import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type mapboxglType from 'mapbox-gl';
import type { NetworkRow, Observation } from '../../types/network';
import { macColor } from '../../utils/mapHelpers';
import type { WigleObservation } from './useNetworkContextMenu';

// Calculate WiFi channel from frequency in MHz
const frequencyToChannel = (freqMhz: number | null | undefined): number | null => {
  if (!freqMhz) return null;
  // 2.4 GHz band (channels 1-14)
  if (freqMhz >= 2412 && freqMhz <= 2484) {
    if (freqMhz === 2484) return 14; // Japan only
    return Math.round((freqMhz - 2407) / 5);
  }
  // 5 GHz band
  if (freqMhz >= 5170 && freqMhz <= 5825) {
    return Math.round((freqMhz - 5000) / 5);
  }
  // 6 GHz band (WiFi 6E)
  if (freqMhz >= 5935 && freqMhz <= 7115) {
    return Math.round((freqMhz - 5950) / 5) + 1;
  }
  return null;
};

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

type WigleObservationsState = {
  bssid: string | null;
  observations: WigleObservation[];
  stats: {
    wigle_total: number;
    matched: number;
    unique: number;
    our_observations: number;
    max_distance_from_our_sightings_m: number;
  } | null;
  loading: boolean;
  error: string | null;
};

type ObservationLayerProps = {
  mapReady: boolean;
  mapRef: MutableRefObject<mapboxglType.Map | null>;
  mapboxRef: MutableRefObject<mapboxglType | null>;
  activeObservationSets: ObservationSet[];
  networkLookup: Map<string, NetworkRow>;
  wigleObservations?: WigleObservationsState;
  clearWigleObservations?: () => void;
};

export const useObservationLayers = ({
  mapReady,
  mapRef,
  mapboxRef,
  activeObservationSets,
  networkLookup,
  wigleObservations,
  clearWigleObservations,
}: ObservationLayerProps) => {
  const prevObservationCountRef = useRef(0);

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
    const features = activeObservationSets.flatMap((set) => {
      let lastPoint: [number, number] | null = null;
      let lastTime: Date | null = null;

      return set.observations.map((obs, index) => {
        const network = networkLookup.get(obs.bssid);
        const threatLevel = network?.threat?.level ?? 'NONE';
        const lat = obs.lat;
        const lon = obs.lon;

        // Calculate distance from last point in meters
        let deltaMeters = null;
        if (lastPoint) {
          const [lastLon, lastLat] = lastPoint;
          // Simple haversine approximation for small distances
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

        // Calculate channel from frequency
        const channel = frequencyToChannel(obs.frequency);

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
            channel: channel,
            altitude: obs.altitude,
            ssid: network?.ssid || '(hidden)',
            manufacturer: network?.manufacturer || null,
            security: network?.security || null,
            threat_level: threatLevel,
            threat_score: network?.threat_score ?? null,
            first_seen: network?.firstSeen || null,
            last_seen: network?.lastSeen || null,
            timespan_days: typeof network?.timespanDays === 'number' ? network.timespanDays : null,
            distance_from_home_km: obs.distance_from_home_km ?? network?.distanceFromHome ?? null,
            max_distance_km: network?.max_distance_meters
              ? network.max_distance_meters / 1000
              : null,
            distance_from_last_point_m: deltaMeters,
            time_since_prior: timeSincePrior,
            time_since_prior_ms: timeSincePriorMs,
            observation_count: network?.observations ?? 0,
            accuracy: obs.acc ?? network?.accuracy ?? null,
            unique_days: (network as any)?.unique_days ?? null,
            type: network?.type || null,
            number: index + 1,
            color: bssidColors[obs.bssid],
          },
        };
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

    // Auto-zoom to fit bounds of all observations (only on first load or significant change)
    const totalObservations = features.length;
    const shouldZoom = totalObservations > 0 && prevObservationCountRef.current === 0;
    prevObservationCountRef.current = totalObservations;

    if (shouldZoom) {
      const coords = features.map((f: any) => f.geometry.coordinates as [number, number]);
      const bounds = coords.reduce(
        (bounds, coord) => bounds.extend(coord),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 50, duration: 800, maxZoom: 15 });
    }
  }, [activeObservationSets, mapReady, mapRef, mapboxRef, networkLookup]);

  // WiGLE observations layer effect
  useEffect(() => {
    if (!mapReady || !mapRef.current || !wigleObservations) return;

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!mapboxgl) return;

    // Add WiGLE observations source if it doesn't exist
    if (!map.getSource('wigle-observations')) {
      map.addSource('wigle-observations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // WiGLE unique observations - diamond markers (orange)
      map.addLayer({
        id: 'wigle-unique-points',
        type: 'circle',
        source: 'wigle-observations',
        filter: ['==', ['get', 'source'], 'wigle_unique'],
        paint: {
          'circle-radius': 8,
          'circle-color': '#f59e0b', // amber-500
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });

      // WiGLE matched observations - smaller dots (green)
      map.addLayer({
        id: 'wigle-matched-points',
        type: 'circle',
        source: 'wigle-observations',
        filter: ['==', ['get', 'source'], 'matched'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#22c55e', // green-500
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.7,
        },
      });

      // Add click handler for WiGLE observations
      map.on('click', 'wigle-unique-points', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const coords = feature.geometry.coordinates;
        const time = props.time ? new Date(props.time).toLocaleString() : 'Unknown';
        const distance = props.distance_from_our_center_m
          ? `${(props.distance_from_our_center_m / 1000).toFixed(1)}km from your sightings`
          : '';

        const popup = new mapboxgl.Popup({ maxWidth: '300px' })
          .setLngLat(coords)
          .setHTML(
            `
            <div style="font-family: system-ui; font-size: 12px; color: #e2e8f0;">
              <div style="font-weight: 600; color: #f59e0b; margin-bottom: 4px;">
                🌐 WiGLE Crowdsourced Sighting
              </div>
              <div style="margin-bottom: 2px;">
                <strong>SSID:</strong> ${props.ssid || '(hidden)'}
              </div>
              <div style="margin-bottom: 2px;">
                <strong>Time:</strong> ${time}
              </div>
              <div style="margin-bottom: 2px;">
                <strong>Signal:</strong> ${props.level} dBm
              </div>
              ${props.channel ? `<div style="margin-bottom: 2px;"><strong>Channel:</strong> ${props.channel}</div>` : ''}
              ${distance ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #475569; color: #f59e0b; font-weight: 500;">${distance}</div>` : ''}
              <div style="margin-top: 4px; font-size: 10px; color: #94a3b8;">
                Not seen in your observations
              </div>
            </div>
          `
          )
          .addTo(map);
      });

      map.on('click', 'wigle-matched-points', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const coords = feature.geometry.coordinates;
        const time = props.time ? new Date(props.time).toLocaleString() : 'Unknown';

        const popup = new mapboxgl.Popup({ maxWidth: '280px' })
          .setLngLat(coords)
          .setHTML(
            `
            <div style="font-family: system-ui; font-size: 12px; color: #e2e8f0;">
              <div style="font-weight: 600; color: #22c55e; margin-bottom: 4px;">
                ✓ WiGLE + Your Data Match
              </div>
              <div style="margin-bottom: 2px;">
                <strong>SSID:</strong> ${props.ssid || '(hidden)'}
              </div>
              <div style="margin-bottom: 2px;">
                <strong>Time:</strong> ${time}
              </div>
              <div style="margin-bottom: 2px;">
                <strong>Signal:</strong> ${props.level} dBm
              </div>
              <div style="margin-top: 4px; font-size: 10px; color: #94a3b8;">
                Matches one of your observations
              </div>
            </div>
          `
          )
          .addTo(map);
      });

      // Hover cursor
      map.on('mouseenter', 'wigle-unique-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'wigle-unique-points', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'wigle-matched-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'wigle-matched-points', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Update WiGLE observations data
    const wigleSource = map.getSource('wigle-observations') as mapboxglType.GeoJSONSource;
    if (wigleSource) {
      if (wigleObservations.observations.length > 0) {
        const features = wigleObservations.observations.map((obs, index) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [obs.lon, obs.lat],
          },
          properties: {
            ssid: obs.ssid,
            level: obs.level,
            time: obs.time,
            channel: obs.channel,
            frequency: obs.frequency,
            source: obs.source,
            distance_from_our_center_m: obs.distance_from_our_center_m,
            number: index + 1,
          },
        }));

        wigleSource.setData({
          type: 'FeatureCollection',
          features: features as any,
        });

        // Auto-zoom to fit all WiGLE observations
        const coords = features.map((f) => f.geometry.coordinates as [number, number]);
        if (coords.length > 0) {
          const bounds = coords.reduce(
            (bounds, coord) => bounds.extend(coord),
            new mapboxgl.LngLatBounds(coords[0], coords[0])
          );
          map.fitBounds(bounds, { padding: 80, duration: 1000 });
        }
      } else {
        // Clear WiGLE observations
        wigleSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }
  }, [mapReady, mapRef, mapboxRef, wigleObservations]);
};
