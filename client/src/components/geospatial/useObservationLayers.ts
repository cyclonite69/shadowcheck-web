import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Map as MapboxMap, GeoJSONSource, MapLayerMouseEvent } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import type { NetworkRow, Observation } from '../../types/network';
import { macColor, frequencyToChannel } from '../../utils/mapHelpers';
import { buildObservationTooltipProps } from '../../utils/geospatial/observationTooltipProps';
import type { WigleObservation, WigleObservationsState } from './useNetworkContextMenu';
import { renderWigleObservationPopupCard } from '../../utils/geospatial/renderMapPopupCards';
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

type ObservationLayerProps = {
  mapReady: boolean;
  mapRef: MutableRefObject<MapboxMap | null>;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  activeObservationSets: ObservationSet[];
  networkLookup: Map<string, NetworkRow>;
  wigleObservations?: WigleObservationsState;
  isViewportLocked?: boolean;
  onOpenContextMenu?: (e: any, network: any) => void;
  showNetworkSummaries?: boolean;
};

export const useObservationLayers = ({
  mapReady,
  mapRef,
  mapboxRef,
  activeObservationSets,
  networkLookup,
  wigleObservations,
  isViewportLocked = false,
  onOpenContextMenu,
  showNetworkSummaries = false,
}: ObservationLayerProps) => {
  // Use refs for dynamic callbacks/data to avoid stale closures in Mapbox event handlers
  const onOpenContextMenuRef = useRef(onOpenContextMenu);
  const networkLookupRef = useRef(networkLookup);

  useEffect(() => {
    onOpenContextMenuRef.current = onOpenContextMenu;
    networkLookupRef.current = networkLookup;
  });

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
    // For each network, count how many OTHER loaded networks share the same channel.
    // Used by the hover signal-radius circle to model congestion-driven range reduction.
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
    const calculateJitterOffset = (
      seenCount: number,
      lat: number,
      lon: number
    ): [number, number] => {
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

        // Calculate distance from last point in meters (optimized)
        let deltaMeters = null;
        if (lastPoint) {
          const [lastLon, lastLat] = lastPoint;
          const latDiff = Math.abs(lat - lastLat);
          const lonDiff = Math.abs(lon - lastLon);

          // Quick check: if very close, skip expensive calculation
          if (latDiff > 0.00001 || lonDiff > 0.00001) {
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
          } else {
            deltaMeters = 0; // Very close, essentially same location
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
          const [sinOffset, cosOffset] = calculateJitterOffset(seenCount, lat, lon);
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

    if (map.getSource('observations')) {
      (map.getSource('observations') as GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: features as any,
      });
    }

    if (map.getSource('observation-lines')) {
      (map.getSource('observation-lines') as GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: lineFeatures as any,
      });
    }

    // Auto-zoom to fit bounds of all observations (skip if locked)
    if (features.length > 0 && !isViewportLocked) {
      const coords = features.map((f: any) => f.geometry.coordinates as [number, number]);
      const bounds = coords.reduce(
        (bounds, coord) => bounds.extend(coord),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      fitBoundsWithZoomInset(map, bounds, { padding: 80, duration: 1000, maxZoom: 15 });
    }
  }, [activeObservationSets, mapReady, mapRef, mapboxRef, isViewportLocked]);

  // WiGLE observations layer effect
  useEffect(() => {
    if (!mapReady || !mapRef.current || !wigleObservations) return;

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!mapboxgl) return;

    const handleContextMenu = (e: MapLayerMouseEvent) => {
      if (!onOpenContextMenuRef.current || !e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const props = feature.properties;
      if (!props || !props.bssid) return;

      const network = networkLookupRef.current.get(props.bssid);
      if (network) {
        const mockEvent = {
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: e.originalEvent.clientX,
          clientY: e.originalEvent.clientY,
          pageX: e.originalEvent.pageX,
          pageY: e.originalEvent.pageY,
        } as any;

        onOpenContextMenuRef.current(mockEvent, network);
      }
    };

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
          'circle-radius': 7,
          'circle-color': '#f59e0b', // amber-500
          'circle-stroke-width': 1,
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
      map.on('click', 'wigle-unique-points', (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const coords = (feature.geometry as any).coordinates;

        new (mapboxgl as any).Popup({
          maxWidth: 'min(360px, 90vw)',
          className: 'sc-popup',
          offset: 14,
          focusAfterOpen: false,
        })
          .setLngLat(coords)
          .setHTML(
            renderWigleObservationPopupCard({
              ssid: props.ssid,
              time: props.time,
              signal: props.level,
              channel: props.channel,
              distanceFromCenterMeters: props.distance_from_our_center_m,
              matched: false,
            })
          )
          .addTo(map);
      });

      map.on('click', 'wigle-matched-points', (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const props = feature.properties;
        if (!props) return;

        const coords = (feature.geometry as any).coordinates;

        new (mapboxgl as any).Popup({
          maxWidth: 'min(360px, 90vw)',
          className: 'sc-popup',
          offset: 14,
          focusAfterOpen: false,
        })
          .setLngLat(coords)
          .setHTML(
            renderWigleObservationPopupCard({
              ssid: props.ssid,
              time: props.time,
              signal: props.level,
              channel: props.channel,
              matched: true,
            })
          )
          .addTo(map);
      });

      // Add context menu handlers
      map.on('contextmenu', 'observation-points', handleContextMenu);
      map.on('contextmenu', 'wigle-unique-points', handleContextMenu);
      map.on('contextmenu', 'wigle-matched-points', handleContextMenu);

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
    const wigleSource = map.getSource('wigle-observations') as GeoJSONSource;
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
            bssid: obs.bssid || wigleObservations.bssid,
          },
        }));

        wigleSource.setData({
          type: 'FeatureCollection',
          features: features as any,
        });

        // Auto-zoom to fit all WiGLE observations (skip if locked)
        const coords = features.map((f) => f.geometry.coordinates as [number, number]);
        if (coords.length > 0 && !isViewportLocked) {
          const bounds = coords.reduce(
            (bounds, coord) => bounds.extend(coord),
            new mapboxgl.LngLatBounds(coords[0], coords[0])
          );
          fitBoundsWithZoomInset(map, bounds, { padding: 80, duration: 1000 });
        }
      } else {
        // Clear WiGLE observations
        wigleSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }
  }, [mapReady, mapRef, mapboxRef, wigleObservations, isViewportLocked]);

  // Network summary markers (centroid/weighted) layer effect
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!mapboxgl) return;

    try {
      // Add network summary source if it doesn't exist
      if (!map.getSource('network-summaries')) {
        map.addSource('network-summaries', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        // Centroid markers - hollow circles with blue stroke
        if (!map.getLayer('network-centroid-markers')) {
          map.addLayer({
            id: 'network-centroid-markers',
            type: 'circle',
            source: 'network-summaries',
            filter: ['==', ['get', 'markerType'], 'centroid'],
            paint: {
              'circle-radius': 12,
              'circle-color': 'rgba(96, 165, 250, 0.1)',
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#60a5fa',
              'circle-opacity': 1,
            },
          });
        }

        // Weighted markers - hollow circles with green stroke
        if (!map.getLayer('network-weighted-markers')) {
          map.addLayer({
            id: 'network-weighted-markers',
            type: 'circle',
            source: 'network-summaries',
            filter: ['==', ['get', 'markerType'], 'weighted'],
            paint: {
              'circle-radius': 12,
              'circle-color': 'rgba(52, 211, 153, 0.1)',
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#34d399',
              'circle-opacity': 1,
            },
          });
        }

        // Add labels to distinguish marker types
        if (!map.getLayer('network-marker-labels')) {
          map.addLayer({
            id: 'network-marker-labels',
            type: 'symbol',
            source: 'network-summaries',
            layout: {
              'text-field': ['case', ['==', ['get', 'markerType'], 'centroid'], '◊', '▲'],
              'text-size': 16,
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
              'text-offset': [0, 0],
            },
            paint: {
              'text-color': [
                'case',
                ['==', ['get', 'markerType'], 'centroid'],
                '#60a5fa',
                '#34d399',
              ],
              'text-opacity': 0.9,
            },
          });
        }
      }

      // Update marker data based on showNetworkSummaries flag
      const source = map.getSource('network-summaries') as GeoJSONSource;
      if (!source) return;

      if (showNetworkSummaries && activeObservationSets.length > 0) {
        const summaryFeatures: any[] = [];

        activeObservationSets.forEach((set) => {
          const network = networkLookupRef.current.get(set.bssid);
          if (!network) return;

          // Add centroid marker if coordinates exist
          if (
            network.centroid_lat !== null &&
            network.centroid_lat !== undefined &&
            network.centroid_lon !== null &&
            network.centroid_lon !== undefined
          ) {
            summaryFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [network.centroid_lon, network.centroid_lat],
              },
              properties: {
                bssid: set.bssid,
                markerType: 'centroid',
                ssid: network.ssid,
              },
            });
          }

          // Add weighted marker if coordinates exist
          if (
            network.weighted_lat !== null &&
            network.weighted_lat !== undefined &&
            network.weighted_lon !== null &&
            network.weighted_lon !== undefined
          ) {
            summaryFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [network.weighted_lon, network.weighted_lat],
              },
              properties: {
                bssid: set.bssid,
                markerType: 'weighted',
                ssid: network.ssid,
              },
            });
          }
        });

        source.setData({
          type: 'FeatureCollection',
          features: summaryFeatures,
        });
      } else {
        // Clear markers when disabled
        source.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    } catch (err) {
      console.error('[useObservationLayers] Error managing network summary markers:', err);
    }
  }, [mapReady, mapRef, mapboxRef, activeObservationSets, showNetworkSummaries]);
};
