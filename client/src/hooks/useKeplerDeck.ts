import { useRef, useCallback, useState } from 'react';
import { NetworkData, LayerType } from '../components/kepler/types';
import { renderNetworkTooltip } from '../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../utils/geospatial/tooltipDataNormalizer';

/** Compute center + zoom that fits [[minLon,minLat],[maxLon,maxLat]] into a viewport. */
function zoomForBounds(
  bounds: [[number, number], [number, number]],
  width: number,
  height: number,
  padding = 60
): { longitude: number; latitude: number; zoom: number } {
  const [[w, s], [e, n]] = bounds;
  const lng = (w + e) / 2;
  const lat = (s + n) / 2;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const latY = (l: number) => Math.log(Math.tan(Math.PI / 4 + toRad(l) / 2));
  const vw = Math.max(width - padding * 2, 1);
  const vh = Math.max(height - padding * 2, 1);
  const lonZoom = Math.log2((vw * 360) / (256 * Math.max(e - w, 0.001)));
  const latZoom = Math.log2((vh * Math.PI) / (128 * Math.abs(latY(n) - latY(s) || 0.001)));
  return {
    longitude: lng,
    latitude: lat,
    zoom: Math.max(1, Math.min(18, Math.min(lonZoom, latZoom))),
  };
}

export function useKeplerDeck({
  layerType,
  pointSize,
  pitch,
  height3d,
}: {
  layerType: LayerType;
  pointSize: number;
  pitch: number;
  height3d: number;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<any>(null);
  const navigationControlRef = useRef<any>(null);
  const [zoom, setZoom] = useState<number>(10);

  const handleFitBounds = useCallback(
    (networkData: NetworkData[]) => {
      if (!deckRef.current || !networkData.length) return;

      const validData = networkData.filter((d) => d.position && !isNaN(d.position[0]));
      if (validData.length === 0) return;

      let minLon = Infinity,
        maxLon = -Infinity,
        minLat = Infinity,
        maxLat = -Infinity;
      for (const d of validData) {
        const [lon, lat] = d.position;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }

      const el = mapRef.current;
      const w = el?.clientWidth || 1200;
      const h = el?.clientHeight || 800;
      const {
        longitude,
        latitude,
        zoom: newZoom,
      } = zoomForBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        w,
        h
      );

      deckRef.current.setProps({
        initialViewState: {
          longitude,
          latitude,
          zoom: newZoom,
          pitch,
          bearing: 0,
          transitionDuration: 1000,
          transitionInterpolator: new window.deck.FlyToInterpolator(),
        },
      });
      setZoom(newZoom);
    },
    [pitch]
  );

  const initDeck = useCallback(
    (token: string, data: NetworkData[]) => {
      if (!window.deck || !mapRef.current) return;

      let centerLon = -83.6968; // Default
      let centerLat = 43.0234;
      let initialZoom = 10;

      if (data && data.length > 0) {
        const validData = data.filter((d) => d.position && !isNaN(d.position[0]));
        if (validData.length > 0) {
          let minLon = Infinity,
            maxLon = -Infinity,
            minLat = Infinity,
            maxLat = -Infinity;
          for (const d of validData) {
            const [lon, lat] = d.position;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
          const el = mapRef.current;
          const fit = zoomForBounds(
            [
              [minLon, minLat],
              [maxLon, maxLat],
            ],
            el?.clientWidth || 1200,
            el?.clientHeight || 800
          );
          centerLon = fit.longitude;
          centerLat = fit.latitude;
          initialZoom = fit.zoom;
        }
      }

      const INITIAL_VIEW_STATE = {
        longitude: centerLon,
        latitude: centerLat,
        zoom: initialZoom,
        pitch,
        bearing: 0,
      };
      setZoom(initialZoom);

      const layers = [];
      const deck = window.deck;
      if (!deck) return;
      const ensureNavigationControl = () => {
        if (navigationControlRef.current || !window.mapboxgl || !deckRef.current) return;

        const map = deckRef.current.getMapboxMap?.() ?? deckRef.current._map?.getMap?.();
        if (!map) return;

        navigationControlRef.current = new window.mapboxgl.NavigationControl();
        map.addControl(navigationControlRef.current, 'top-right');
      };

      // Helper to find layer class in possible deck namespaces
      const getLayer = (name: string) =>
        deck[name] ||
        (deck.layers && deck.layers[name]) ||
        (deck.aggregationLayers && deck.aggregationLayers[name]);

      if (layerType === 'scatterplot') {
        const ScatterplotLayer = getLayer('ScatterplotLayer');
        if (ScatterplotLayer) {
          layers.push(
            new ScatterplotLayer({
              id: 'points',
              data,
              getPosition: (d: NetworkData) => d.position,
              getFillColor: (d: NetworkData) => d.color || [34, 197, 94, 200],
              getRadius: pointSize * 50,
              pickable: true,
              autoHighlight: true,
            })
          );
        }
      } else if (layerType === 'heatmap') {
        const HeatmapLayer = getLayer('HeatmapLayer');
        if (HeatmapLayer) {
          layers.push(
            new HeatmapLayer({
              id: 'heatmap',
              data,
              getPosition: (d: NetworkData) => d.position,
              getWeight: (d: NetworkData) => (d.signal ? (d.signal + 120) / 120 : 0.5),
              radiusPixels: pointSize * 100,
            })
          );
        }
      } else if (layerType === 'hexagon') {
        const HexagonLayer = getLayer('HexagonLayer');
        if (HexagonLayer) {
          layers.push(
            new HexagonLayer({
              id: 'hexagon',
              data,
              getPosition: (d: NetworkData) => d.position,
              radius: pointSize * 500,
              elevationScale: height3d * 10,
              extruded: pitch > 0,
              pickable: true,
            })
          );
        }
      } else if (layerType === 'icon') {
        const IconLayer = getLayer('IconLayer');
        if (IconLayer) {
          layers.push(
            new IconLayer({
              id: 'icon',
              data,
              iconAtlas:
                'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
              iconMapping: {
                marker: { x: 0, y: 0, width: 128, height: 128, mask: true },
              },
              getIcon: () => 'marker',
              getPosition: (d: NetworkData) => d.position,
              getSize: pointSize * 100,
              getColor: (d: NetworkData) => d.color || [0, 255, 65, 200],
              pickable: true,
            })
          );
        }
      }

      if (deckRef.current) {
        deckRef.current.setProps({ layers, initialViewState: INITIAL_VIEW_STATE });
        ensureNavigationControl();
      } else {
        deckRef.current = new window.deck.DeckGL({
          container: mapRef.current,
          initialViewState: INITIAL_VIEW_STATE,
          controller: true,
          mapStyle: 'mapbox://styles/mapbox/dark-v11',
          mapboxApiAccessToken: token,
          layers,
          getTooltip: ({ object }: any) => {
            if (!object) return null;
            const normalized = normalizeTooltipData(object);
            return {
              html: renderNetworkTooltip(normalized),
              style: {
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                maxWidth: 'min(340px, 90vw)',
              },
            };
          },
        });
        ensureNavigationControl();
      }
    },
    [layerType, pointSize, pitch, height3d]
  );

  return { mapRef, deckRef, zoom, setZoom, handleFitBounds, initDeck };
}
