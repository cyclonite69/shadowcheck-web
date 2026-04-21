import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Map as MapboxMap, GeoJSONSource, MapLayerMouseEvent } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import type { NetworkRow } from '../../../types/network';
import { fitBoundsWithZoomInset } from '../../../utils/geospatial/mapViewUtils';
import { normalizeTooltipData } from '../../../utils/geospatial/tooltipDataNormalizer';
import { renderNetworkTooltip } from '../../../utils/geospatial/renderNetworkTooltip';
import { getPopupAnchor } from '../../../utils/geospatial/popupAnchor';
import { popupStateManager } from '../../../utils/geospatial/popupStateManager';

const WIGLE_UNIQUE_COLOR = '#f59e0b';
const WIGLE_MATCHED_COLOR = '#22c55e';

function wigleBadge(matched: boolean): string {
  const color = matched ? WIGLE_MATCHED_COLOR : WIGLE_UNIQUE_COLOR;
  return `<div style="background:${color}1a;border-bottom:1px solid ${color}44;padding:3px 12px;font-size:9px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${color};">◆ WiGLE ${matched ? 'Correlated' : 'External'}</div>`;
}

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
  bssid?: string;
};

export type WigleObservationsState = {
  bssid: string | null;
  bssids: string[];
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

  // Initialization: Layers, Sources, Handlers
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
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
        onOpenContextMenuRef.current(
          {
            preventDefault: () => {},
            stopPropagation: () => {},
            clientX: e.originalEvent.clientX,
            clientY: e.originalEvent.clientY,
          },
          network
        );
      }
    };

    const makeObsPopup = (props: any, coords: [number, number], matched: boolean) => {
      const lngLat = { lng: coords[0], lat: coords[1] };
      const immediateNormalized = normalizeTooltipData(
        { ...props, lat: coords[1], lon: coords[0], signal: props.level },
        [coords[0], coords[1]]
      );
      let immediateCard =
        renderNetworkTooltip({ ...immediateNormalized, triggerElement: map.getContainer() }) ?? '';

      if (!immediateCard) {
        const ssid = props.ssid || 'Hidden Network';
        const bssid = props.bssid || 'Unknown';
        const signal = props.level ? `${props.level} dBm` : 'N/A';
        const time = props.time ? new Date(Number(props.time)).toLocaleString() : 'Unknown';
        immediateCard = `<div style="min-width:220px;color:#e2e8f0;font:12px/1.45 system-ui,sans-serif">
            <div style="font-weight:700;color:#60a5fa;margin-bottom:8px">${ssid}</div>
            <div><strong>BSSID:</strong> ${bssid}</div>
            <div><strong>Signal:</strong> ${signal}</div>
            <div><strong>Observed:</strong> ${time}</div>
          </div>`;
      }
      const initialHtml = wigleBadge(matched) + immediateCard;
      const anchor = getPopupAnchor(map, lngLat, initialHtml);
      const popup = new (mapboxgl as any).Popup({
        anchor,
        maxWidth: 'min(360px, 90vw)',
        className: 'sc-popup',
        offset: 14,
        focusAfterOpen: false,
        closeOnClick: true,
        closeButton: false,
      })
        .setLngLat(coords)
        .setHTML(initialHtml)
        .addTo(map);

      popupStateManager.setActive(popup);
      const originalRemove = popup.remove.bind(popup);
      popup.remove = function () {
        popupStateManager.closeIfActive(popup);
        return originalRemove();
      };
      return popup;
    };

    const handleUniqueClick = (e: MapLayerMouseEvent) => {
      if (e.features?.[0])
        makeObsPopup(e.features[0].properties, (e.features[0].geometry as any).coordinates, false);
    };

    const handleMatchedClick = (e: MapLayerMouseEvent) => {
      if (e.features?.[0])
        makeObsPopup(e.features[0].properties, (e.features[0].geometry as any).coordinates, true);
    };

    if (!map.getSource('wigle-observations')) {
      map.addSource('wigle-observations', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!map.getLayer('wigle-unique-points')) {
      map.addLayer({
        id: 'wigle-unique-points',
        type: 'circle',
        source: 'wigle-observations',
        filter: ['==', ['get', 'source'], 'wigle_unique'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 4, 14, 7],
          'circle-color': '#f59e0b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#92400e',
          'circle-opacity': 0.9,
        },
      });
    }
    if (!map.getLayer('wigle-matched-points')) {
      map.addLayer({
        id: 'wigle-matched-points',
        type: 'circle',
        source: 'wigle-observations',
        filter: ['==', ['get', 'source'], 'matched'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 3, 14, 6],
          'circle-color': '#22c55e',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#14532d',
          'circle-opacity': 0.8,
        },
      });
    }

    map.on('click', 'wigle-unique-points', handleUniqueClick);
    map.on('contextmenu', 'wigle-unique-points', handleContextMenu);
    map.on('click', 'wigle-matched-points', handleMatchedClick);
    map.on('contextmenu', 'wigle-matched-points', handleContextMenu);

    return () => {
      map.off('click', 'wigle-unique-points', handleUniqueClick);
      map.off('contextmenu', 'wigle-unique-points', handleContextMenu);
      map.off('click', 'wigle-matched-points', handleMatchedClick);
      map.off('contextmenu', 'wigle-matched-points', handleContextMenu);
    };
  }, [mapReady, mapRef, mapboxRef]);

  // Sync Data Updates
  useEffect(() => {
    if (!mapReady || !mapRef.current || !wigleObservations) return;
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!mapboxgl) return;

    const wigleSource = map.getSource('wigle-observations') as GeoJSONSource | undefined;
    if (!wigleSource) return;

    if (wigleObservations.observations.length > 0) {
      const features = wigleObservations.observations.map((obs, index) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [obs.lon, obs.lat] },
        properties: { ...obs, number: index + 1, bssid: obs.bssid || wigleObservations.bssid },
      }));
      wigleSource.setData({ type: 'FeatureCollection', features: features as any });

      const coords = features.map((f) => f.geometry.coordinates as [number, number]);
      if (coords.length > 0 && !isViewportLocked) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        fitBoundsWithZoomInset(map, bounds, { padding: 80, duration: 1000 });
      }
    } else {
      wigleSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [wigleObservations, isViewportLocked]);
};
