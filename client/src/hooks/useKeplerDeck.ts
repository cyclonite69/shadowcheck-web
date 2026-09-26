import { useRef, useCallback, useState, useEffect } from 'react';
import { NetworkData, LayerType } from '../components/kepler/types';
import { renderNetworkTooltip } from '../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../utils/geospatial/tooltipDataNormalizer';
import { networkApi } from '../api/networkApi';

type TooltipState = {
  x: number;
  y: number;
  html: string;
  pinned: boolean;
};

/** Compute center + zoom that fits [[minLon,minLat],[maxLon,maxLat]] into a viewport. */
function zoomForBounds(
  bounds: [[number, number], [number, number]],
  width: number,
  height: number,
  padding = 150
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
  const isMountedRef = useRef(true);
  const [zoom, setZoom] = useState<number>(10);
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;

      // 1. Defensively remove navigation control and break its references
      if (navigationControlRef.current) {
        try {
          const map =
            deckRef.current?.getMapboxMap?.() ??
            deckRef.current?._map?.map ??
            deckRef.current?._map?.getMap?.();
          if (map?.removeControl) {
            map.removeControl(navigationControlRef.current);
          }
        } catch {
          // ignore
        }
        navigationControlRef.current = null;
      }

      // 2. Comprehensive Deck.gl, Mapbox, and WebGL cleanup
      if (deckRef.current) {
        const deck = deckRef.current;
        try {
          // A. Stop CanvasObserver and destroy CanvasContext to unbind window.matchMedia listeners
          const canvasContext = deck._canvasContext || deck.device?.canvasContext;
          try {
            canvasContext?._canvasObserver?.stop?.();
          } catch {
            // ignore
          }
          try {
            canvasContext?.destroy?.();
          } catch {
            // ignore
          }

          // B. Stop animation loops
          try {
            deck.animationLoop?.stop?.();
            deck.animationLoop?.destroy?.();
          } catch {
            // ignore
          }

          // C. Force WebGL context release on the underlying luma.gl/WebGL device
          const gl = deck.device?.gl || deck.device?.handle;
          if (gl) {
            try {
              const ext = gl.getExtension?.('WEBGL_lose_context');
              ext?.loseContext?.();
            } catch {
              // ignore
            }
          }

          // D. Destroy the WebGL device
          try {
            deck.device?.destroy?.();
          } catch {
            // ignore
          }

          // E. Clean up Mapbox WebGL context before finalizing Deck
          const map = deck.getMapboxMap?.() ?? deck._map?.map ?? deck._map?.getMap?.();
          if (map) {
            try {
              const mapGl = map.painter?.context?.gl;
              if (mapGl) {
                try {
                  const ext = mapGl.getExtension?.('WEBGL_lose_context');
                  ext?.loseContext?.();
                } catch {
                  // ignore
                }
              }
            } catch {
              // ignore
            }
          }

          // F. Finalize Deck.gl (deck.finalize internally calls deck._map.finalize() which removes the Mapbox map)
          if (typeof deck.finalize === 'function') {
            deck.finalize();
          } else if (map && typeof map.remove === 'function') {
            // Fallback: if deck.finalize is absent, directly remove the Mapbox map
            try {
              map.remove();
            } catch (err) {
              console.error('Error removing mapbox map:', err);
            }
          }
        } catch (e) {
          console.error('Error finalizing deck instance:', e);
        }
        deckRef.current = null;
      }

      if (mapRef.current) {
        mapRef.current.innerHTML = '';
      }

      if (typeof performance !== 'undefined') {
        try {
          performance.clearMeasures?.();
          performance.clearMarks?.();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const buildTooltipState = useCallback(
    (object: NetworkData, x: number, y: number, pinned: boolean) => {
      const normalized = normalizeTooltipData(object, object.position);
      return {
        x,
        y,
        pinned,
        html: renderNetworkTooltip({ ...normalized, triggerElement: mapRef.current }) ?? '',
      };
    },
    []
  );

  /** Show placeholder immediately, then replace with full MV card when fetch resolves. */
  const handlePlatinumClick = useCallback(
    (object: NetworkData, x: number, y: number) => {
      const bssid = String((object as any).bssid || (object as any).netid || '');
      const ssid = (object as any).ssid || '';
      const placeholderHtml = `
        <div style="min-width:200px;padding:10px 12px;font:12px/1.5 system-ui,sans-serif;color:#e2e8f0">
          <div style="font-weight:700;color:#60a5fa;margin-bottom:4px">${ssid || bssid || 'Network'}</div>
          <div style="color:#94a3b8;font-size:11px">${bssid}</div>
          <div style="margin-top:8px;color:#64748b;font-size:11px">Loading full data…</div>
        </div>`;

      setTooltipState({ x, y, pinned: true, html: placeholderHtml });

      if (bssid) {
        networkApi.getNetworkByBssid(bssid).then((mvData) => {
          const source = mvData ?? object;
          const normalized = normalizeTooltipData(source, object.position);
          const fullHtml =
            renderNetworkTooltip({ ...normalized, triggerElement: mapRef.current }) ??
            placeholderHtml;
          setTooltipState((current) => {
            if (!current || !current.pinned) {
              return current;
            }
            return { x, y, pinned: true, html: fullHtml };
          });
        });
      }
    },
    [buildTooltipState]
  );

  const clearTooltip = useCallback(() => {
    setTooltipState(null);
  }, []);

  const handleFitBounds = useCallback(
    (networkData: NetworkData[]) => {
      if (!deckRef.current || !networkData.length) {
        return;
      }

      const validData = networkData.filter((d) => d.position && !isNaN(d.position[0]));
      if (validData.length === 0) {
        return;
      }

      let minLon = Infinity,
        maxLon = -Infinity,
        minLat = Infinity,
        maxLat = -Infinity;
      for (const d of validData) {
        const [lon, lat] = d.position;
        if (lon < minLon) {
          minLon = lon;
        }
        if (lon > maxLon) {
          maxLon = lon;
        }
        if (lat < minLat) {
          minLat = lat;
        }
        if (lat > maxLat) {
          maxLat = lat;
        }
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
          transitionInterpolator: new (window as any).deck.FlyToInterpolator(),
        },
      });
      setZoom(newZoom);
    },
    [pitch]
  );

  const initDeck = useCallback(
    (token: string, data: NetworkData[]) => {
      if (!isMountedRef.current || !(window as any).deck || !mapRef.current) {
        return;
      }

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
            if (lon < minLon) {
              minLon = lon;
            }
            if (lon > maxLon) {
              maxLon = lon;
            }
            if (lat < minLat) {
              minLat = lat;
            }
            if (lat > maxLat) {
              maxLat = lat;
            }
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
      const deck = (window as any).deck;
      if (!deck) {
        return;
      }
      const ensureNavigationControl = () => {
        if (navigationControlRef.current || !(window as any).mapboxgl || !deckRef.current) {
          return;
        }

        // getMapboxMap() is the public DeckGL method; _map?.getMap() is an internal fallback
        // for standalone CDN builds where getMapboxMap() might not be exposed on the prototype.
        const map = deckRef.current.getMapboxMap?.() ?? deckRef.current._map?.getMap?.();
        if (!map) {
          return;
        }

        navigationControlRef.current = new (window as any).mapboxgl.NavigationControl();
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
              radiusMinPixels: 5,
              pickable: true,
              autoHighlight: true,
              onHover: ({ object, x, y }: any) => {
                setTooltipState((current) => {
                  if (current?.pinned) {
                    return current;
                  }
                  if (!object) {
                    return null;
                  }
                  return buildTooltipState(object, x, y, false);
                });
              },
              onClick: ({ object, x, y }: any) => {
                if (!object) {
                  clearTooltip();
                  return;
                }
                handlePlatinumClick(object, x, y);
              },
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
              onHover: ({ object, x, y }: any) => {
                setTooltipState((current) => {
                  if (current?.pinned) {
                    return current;
                  }
                  if (!object) {
                    return null;
                  }
                  return buildTooltipState(object, x, y, false);
                });
              },
              onClick: ({ object, x, y }: any) => {
                if (!object) {
                  clearTooltip();
                  return;
                }
                handlePlatinumClick(object, x, y);
              },
            })
          );
        }
      }

      if (deckRef.current) {
        deckRef.current.setProps({ layers, initialViewState: INITIAL_VIEW_STATE });
        ensureNavigationControl();
      } else {
        deckRef.current = new (window as any).deck.DeckGL({
          container: mapRef.current,
          initialViewState: INITIAL_VIEW_STATE,
          controller: true,
          mapStyle: 'mapbox://styles/mapbox/dark-v11',
          mapboxApiAccessToken: token,
          layers,
          getCursor: ({ isHovering }: { isHovering: boolean }) =>
            isHovering ? 'crosshair' : 'default',
          onClick: ({ object }: any) => {
            if (!object) {
              clearTooltip();
            }
          },
        });
        ensureNavigationControl();
      }
    },
    [layerType, pointSize, pitch, height3d, buildTooltipState, clearTooltip]
  );

  return { mapRef, deckRef, zoom, setZoom, handleFitBounds, initDeck, tooltipState, clearTooltip };
}
