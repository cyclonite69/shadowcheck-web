import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Map as MapboxMap, GeoJSONSource, MapLayerMouseEvent } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import type { NetworkRow } from '../../../types/network';
import { renderWigleObservationPopupCard } from '../../../utils/geospatial/renderMapPopupCards';
import { fitBoundsWithZoomInset } from '../../../utils/geospatial/mapViewUtils';

export type WigleObservation = {
  lat: number;
  lon: number;
  time: number;
  level: number;
  ssid: string | null;
  frequency: number | null;
  channel: number | null;
  encryption?: string | null;
  altitude?: number | null;
  accuracy?: number | null;
  source: 'matched' | 'wigle_unique' | string;
  distance_from_our_center_m: number | null;
  bssid?: string; // For batch mode - to color by network
};

export type WigleObservationsState = {
  bssid: string | null;
  bssids: string[]; // For batch mode
  observations: WigleObservation[];
};

type WigleLayerProps = {
  mapReady: boolean;
  mapRef: MutableRefObject<MapboxMap | null>;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  mapStyle?: string;
  networkLookup: Map<string, NetworkRow>;
  wigleObservations?: WigleObservationsState;
  isViewportLocked?: boolean;
  onOpenContextMenu?: (e: any, network: any) => void;
};

export const useWigleLayers = ({
  mapReady,
  mapRef,
  mapboxRef,
  mapStyle,
  networkLookup,
  wigleObservations,
  isViewportLocked = false,
  onOpenContextMenu,
}: WigleLayerProps) => {
  const onOpenContextMenuRef = useRef(onOpenContextMenu);
  const networkLookupRef = useRef(networkLookup);

  useEffect(() => {
    onOpenContextMenuRef.current = onOpenContextMenu;
    networkLookupRef.current = networkLookup;
  }, [onOpenContextMenu, networkLookup]);

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

    const handleUniqueClick = (e: MapLayerMouseEvent) => {
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
    };

    const handleMatchedClick = (e: MapLayerMouseEvent) => {
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
    };

    const handleUniqueEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleUniqueLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    const handleMatchedEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMatchedLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    const ensureWigleLayers = () => {
      if (!map.isStyleLoaded()) return false;

      if (!map.getSource('wigle-observations')) {
        map.addSource('wigle-observations', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });
      }

      if (!map.getLayer('wigle-unique-points')) {
        map.addLayer({
          id: 'wigle-unique-points',
          type: 'circle',
          source: 'wigle-observations',
          filter: ['==', ['get', 'source'], 'wigle_unique'],
          paint: {
            'circle-radius': 7,
            'circle-color': '#f59e0b',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          },
        });
        map.on('click', 'wigle-unique-points', handleUniqueClick);
        map.on('contextmenu', 'wigle-unique-points', handleContextMenu);
        map.on('mouseenter', 'wigle-unique-points', handleUniqueEnter);
        map.on('mouseleave', 'wigle-unique-points', handleUniqueLeave);
      }

      if (!map.getLayer('wigle-matched-points')) {
        map.addLayer({
          id: 'wigle-matched-points',
          type: 'circle',
          source: 'wigle-observations',
          filter: ['==', ['get', 'source'], 'matched'],
          paint: {
            'circle-radius': 5,
            'circle-color': '#22c55e',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.7,
          },
        });
        map.on('click', 'wigle-matched-points', handleMatchedClick);
        map.on('contextmenu', 'wigle-matched-points', handleContextMenu);
        map.on('mouseenter', 'wigle-matched-points', handleMatchedEnter);
        map.on('mouseleave', 'wigle-matched-points', handleMatchedLeave);
      }

      // Re-bind context menu for core observation points if they exist
      if (map.getLayer('observation-points')) {
        map.off('contextmenu', 'observation-points', handleContextMenu);
        map.on('contextmenu', 'observation-points', handleContextMenu);
      }

      return true;
    };

    const syncWigleSource = () => {
      if (!ensureWigleLayers()) return false;
      const wigleSource = map.getSource('wigle-observations') as GeoJSONSource | undefined;
      if (!wigleSource) return false;

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
        wigleSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }

      return true;
    };

    if (syncWigleSource()) {
      return () => {
        map.off('click', 'wigle-unique-points', handleUniqueClick);
        map.off('click', 'wigle-matched-points', handleMatchedClick);
        map.off('contextmenu', 'observation-points', handleContextMenu);
        map.off('contextmenu', 'wigle-unique-points', handleContextMenu);
        map.off('contextmenu', 'wigle-matched-points', handleContextMenu);
        map.off('mouseenter', 'wigle-unique-points', handleUniqueEnter);
        map.off('mouseleave', 'wigle-unique-points', handleUniqueLeave);
        map.off('mouseenter', 'wigle-matched-points', handleMatchedEnter);
        map.off('mouseleave', 'wigle-matched-points', handleMatchedLeave);
      };
    }

    const handleStyleLoad = () => {
      syncWigleSource();
    };

    map.once('style.load', handleStyleLoad);
    return () => {
      map.off('style.load', handleStyleLoad);
      map.off('click', 'wigle-unique-points', handleUniqueClick);
      map.off('click', 'wigle-matched-points', handleMatchedClick);
      map.off('contextmenu', 'observation-points', handleContextMenu);
      map.off('contextmenu', 'wigle-unique-points', handleContextMenu);
      map.off('contextmenu', 'wigle-matched-points', handleContextMenu);
      map.off('mouseenter', 'wigle-unique-points', handleUniqueEnter);
      map.off('mouseleave', 'wigle-unique-points', handleUniqueLeave);
      map.off('mouseenter', 'wigle-matched-points', handleMatchedEnter);
      map.off('mouseleave', 'wigle-matched-points', handleMatchedLeave);
    };
  }, [mapReady, mapRef, mapboxRef, wigleObservations, isViewportLocked, mapStyle]);
};
