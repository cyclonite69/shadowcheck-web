import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Map, GeoJSONSource, MapLayerMouseEvent } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { renderNetworkTooltip } from '../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../utils/geospatial/tooltipDataNormalizer';
import { getPopupAnchor } from '../../utils/geospatial/popupAnchor';
import {
  setupPopupDrag,
  cleanupPopupDrag,
  type PopupDragState,
} from '../../utils/geospatial/setupPopupDrag';
import {
  setupPopupTether,
  updateTetherDuringDrag,
  cleanupPopupTether,
  type PopupTetherState,
} from '../../utils/geospatial/setupPopupTether';
import { setupPopupPin } from '../../utils/geospatial/setupPopupPin';
import { DEFAULT_ZOOM, MAP_STYLES } from '../../constants/network';
import { mapboxApi } from '../../api/mapboxApi';
import {
  createCirclePolygon,
  calculateSignalRange,
  macColor,
  createGoogleStyle,
} from '../../utils/mapHelpers';

const getNumericProperty = (props: Record<string, unknown>, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = props[key];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) return value;
      continue;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
};

type HomeLocation = {
  center: [number, number];
  radius: number;
};

type GeospatialMapProps = {
  mapStyle: string;
  homeLocation: HomeLocation;
  mapRef: MutableRefObject<Map | null>;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  mapContainerRef: MutableRefObject<HTMLDivElement | null>;
  mapInitRef: MutableRefObject<boolean>;
  setMapReady: Dispatch<SetStateAction<boolean>>;
  setMapError: Dispatch<SetStateAction<string | null>>;
  logError: (message: string, error?: unknown) => void;
};

export const useGeospatialMap = ({
  mapStyle,
  homeLocation,
  mapRef,
  mapboxRef,
  mapContainerRef,
  mapInitRef,
  setMapReady,
  setMapError,
  logError,
}: GeospatialMapProps) => {
  useEffect(() => {
    if (mapInitRef.current || !mapContainerRef.current) return;
    mapInitRef.current = true;

    const init = async () => {
      try {
        setMapReady(false);
        setMapError(null);

        const tokenBody = await mapboxApi.getMapboxToken();
        if (!tokenBody?.token) {
          throw new Error(tokenBody?.error || `Mapbox token not available`);
        }

        const mapboxgl = mapboxRef.current ?? (await import('mapbox-gl')).default;
        mapboxRef.current = mapboxgl as any;
        await import('mapbox-gl/dist/mapbox-gl.css' as any);
        (mapboxgl as any).accessToken = String(tokenBody.token).trim();

        if (mapContainerRef.current) {
          mapContainerRef.current.innerHTML = '';
        }

        // Find the style config for Standard variants
        const styleConfig = MAP_STYLES.find((s) => s.value === mapStyle);

        // Determine initial style (Google or Mapbox)
        let initialStyle;
        if (mapStyle.startsWith('google-')) {
          const googleType = mapStyle.replace('google-', '');
          initialStyle = createGoogleStyle(googleType);
        } else {
          initialStyle = mapStyle.startsWith('mapbox://styles/mapbox/standard')
            ? 'mapbox://styles/mapbox/standard'
            : mapStyle;
        }

        const map = new mapboxgl.Map({
          container: mapContainerRef.current as HTMLDivElement,
          style: initialStyle,
          center: homeLocation.center,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
        });

        mapRef.current = map;

        // Add navigation control (compass + zoom) and scale bar
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        // Dynamically load orientation controls to reduce initial bundle size
        import('../../utils/mapOrientationControls').then(
          async ({ attachMapOrientationControls }) => {
            await attachMapOrientationControls(map, {
              scalePosition: 'bottom-right',
              scaleUnit: 'metric',
              ensureNavigation: false, // Already added above
            });
          }
        );

        map.on('load', () => {
          // Apply light preset for Standard style variants
          if (styleConfig && 'config' in styleConfig && (styleConfig.config as any)?.lightPreset) {
            map.setConfigProperty(
              'basemap',
              'lightPreset',
              (styleConfig.config as any).lightPreset
            );
          }

          // Add observation sources and layers
          map.addSource('observations', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          map.addSource('observation-lines', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          // Line layer connecting observations
          map.addLayer({
            id: 'observation-lines',
            type: 'line',
            source: 'observation-lines',
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 2,
              'line-opacity': 0.6,
            },
          });

          // Circle layer for observation points (fixed size)
          map.addLayer({
            id: 'observation-points',
            type: 'circle',
            source: 'observations',
            paint: {
              'circle-radius': 7, // Fixed size - not based on signal
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.8,
            },
          });

          // Number labels on observation points
          map.addLayer({
            id: 'observation-labels',
            type: 'symbol',
            source: 'observations',
            layout: {
              'text-field': ['get', 'number'],
              'text-size': 12,
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#ffffff',
            },
          });

          // TODO: render centroid/weighted network summary markers when showNetworkSummaries is true
          // Strategy for overlapping markers:
          // When centroid_lat/lon and weighted_lat/lon are identical or very close (<0.0001° ~11m),
          // apply a deterministic pixel offset based on marker type to keep both visible:
          // - Centroid: offset up-right (+2px, -2px)
          // - Weighted: offset down-left (-2px, +2px)
          // This applies only at screen level (pixel-space) after projection, not geographic coordinates.
          // See: https://docs.mapbox.com/mapbox-gl-js/api/layer/#paint-properties
          // Eventually add derived markers (centroids or weighted averages) as a separate GeoJSON layer
          // above the observation points layer, with appropriate styling from CentroidMarker + WeightedMarker components.

          // Click: show full tooltip popup
          map.on('click', 'observation-points', (e: MapLayerMouseEvent) => {
            if (!e.features || e.features.length === 0) return;

            const feature = e.features[0];
            const props = feature.properties;
            if (!props) return;

            const latitude = (feature.geometry as any).coordinates[1];

            const popupHTML = renderNetworkTooltip(
              normalizeTooltipData(
                {
                  ...props,
                  lat: latitude,
                  lon: (feature.geometry as any).coordinates[0],
                },
                [(feature.geometry as any).coordinates[0], latitude]
              )
            );
            const anchor = getPopupAnchor(map, e.lngLat, popupHTML);

            const popup = new (mapboxgl as any).Popup({
              anchor,
              offset: 15,
              className: 'sc-popup',
              maxWidth: 'min(340px, 90vw)',
              closeOnClick: true,
              closeButton: true,
              focusAfterOpen: false,
            })
              .setLngLat(e.lngLat)
              .setHTML(popupHTML)
              .addTo(map);

            // Setup drag functionality
            let dragState: PopupDragState | null = null;
            let tetherState: PopupTetherState | null = null;
            let pinCleanup: (() => void) | null = null;

            dragState = setupPopupDrag(popup, (offset) => {
              if (tetherState && popup.getElement()) {
                updateTetherDuringDrag(tetherState, popup.getElement()!);
              }
            });

            // Setup tether line
            tetherState = setupPopupTether(popup, map, e.lngLat);

            // Setup pin to viewport functionality
            pinCleanup = setupPopupPin(popup, map);

            // Cleanup on popup close
            const originalRemove = popup.remove.bind(popup);
            popup.remove = function () {
              if (dragState) {
                cleanupPopupDrag(popup, dragState);
              }
              if (tetherState) {
                cleanupPopupTether(tetherState);
              }
              if (pinCleanup) {
                pinCleanup();
              }
              return originalRemove();
            };
          });

          // Add hover circle source and layer (added BEFORE observation-points so it renders below)
          map.addSource('hover-circle', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          const isStandardStyle = mapStyle.startsWith('mapbox://styles/mapbox/standard');

          if (isStandardStyle) {
            map.addLayer({
              id: 'hover-circle-fill',
              type: 'fill',
              source: 'hover-circle',
              filter: ['==', ['geometry-type'], 'Polygon'],
              slot: 'middle',
              paint: {
                'fill-color': ['get', 'color'],
                'fill-opacity': 0.25,
              },
            } as any);

            map.addLayer({
              id: 'hover-circle-outline',
              type: 'line',
              source: 'hover-circle',
              filter: ['==', ['geometry-type'], 'Polygon'],
              slot: 'middle',
              paint: {
                'line-color': ['get', 'strokeColor'],
                'line-width': 2,
                'line-opacity': 0.9,
              },
            } as any);

            map.addLayer({
              id: 'hover-circle-radius-line',
              type: 'line',
              source: 'hover-circle',
              filter: ['==', ['geometry-type'], 'LineString'],
              slot: 'middle',
              paint: {
                'line-color': ['get', 'color'],
                'line-width': 1.5,
                'line-dasharray': [2, 2],
                'line-opacity': 0.7,
              },
            } as any);

            map.addLayer({
              id: 'hover-circle-label',
              type: 'symbol',
              source: 'hover-circle',
              filter: ['==', ['geometry-type'], 'LineString'],
              slot: 'top',
              layout: {
                'text-field': ['get', 'label'],
                'text-size': 12,
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
                'symbol-placement': 'line',
                'text-anchor': 'center',
                'text-offset': [0, -1.5],
              },
              paint: {
                'text-color': ['get', 'color'],
                'text-halo-color': 'rgba(0,0,0,0.75)',
                'text-halo-width': 1.5,
              },
            } as any);
          } else {
            map.addLayer(
              {
                id: 'hover-circle-fill',
                type: 'fill',
                source: 'hover-circle',
                filter: ['==', ['geometry-type'], 'Polygon'],
                paint: {
                  'fill-color': ['get', 'color'],
                  'fill-opacity': 0.25,
                },
              },
              'observation-lines'
            );

            map.addLayer(
              {
                id: 'hover-circle-outline',
                type: 'line',
                source: 'hover-circle',
                filter: ['==', ['geometry-type'], 'Polygon'],
                paint: {
                  'line-color': ['get', 'strokeColor'],
                  'line-width': 2,
                  'line-opacity': 0.9,
                },
              },
              'observation-lines'
            );

            map.addLayer(
              {
                id: 'hover-circle-radius-line',
                type: 'line',
                source: 'hover-circle',
                filter: ['==', ['geometry-type'], 'LineString'],
                paint: {
                  'line-color': ['get', 'color'],
                  'line-width': 1.5,
                  'line-dasharray': [2, 2],
                  'line-opacity': 0.7,
                },
              },
              'observation-lines'
            );

            map.addLayer({
              id: 'hover-circle-label',
              type: 'symbol',
              source: 'hover-circle',
              filter: ['==', ['geometry-type'], 'LineString'],
              layout: {
                'text-field': ['get', 'label'],
                'text-size': 12,
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
                'symbol-placement': 'line',
                'text-anchor': 'center',
                'text-offset': [0, -1.5],
              },
              paint: {
                'text-color': ['get', 'color'],
                'text-halo-color': 'rgba(0,0,0,0.75)',
                'text-halo-width': 1.5,
              },
            });
          }

          // Hover: draw signal-range circle only (tooltip is on click)
          map.on('mouseenter', 'observation-points', (e: MapLayerMouseEvent) => {
            map.getCanvas().style.cursor = 'pointer';

            if (!e.features || e.features.length === 0) return;
            const feature = e.features[0];
            const props = feature.properties as Record<string, unknown> | undefined;
            if (!props) return;

            const signal = getNumericProperty(
              props,
              'signal',
              'level',
              'bestlevel',
              'rssi',
              'signalDbm',
              'maxSignal',
              'max_signal'
            );
            const frequency = getNumericProperty(props, 'frequency', 'radio_frequency');
            const coChannelNeighbors = getNumericProperty(props, 'co_channel_neighbors') ?? 0;
            const signalRadius = calculateSignalRange(
              signal,
              frequency,
              map.getZoom(),
              e.lngLat.lat,
              coChannelNeighbors,
              String(props.radio_type || props.type || ''),
              String(props.capabilities || '')
            );
            const bssidColor = macColor(String(props.bssid ?? ''));
            const center: [number, number] = [
              (feature.geometry as any).coordinates[0],
              (feature.geometry as any).coordinates[1],
            ];
            const radiusLabel =
              signalRadius >= 1000
                ? `~${(signalRadius / 1000).toFixed(1)} km`
                : `~${Math.round(signalRadius)} m`;

            const hoverCircleSource = map.getSource('hover-circle') as GeoJSONSource;
            if (hoverCircleSource) {
              // Calculate radius line coordinates: from center to east cardinal point
              const radiusKm = signalRadius / 1000;
              const radiusLng = radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180));
              const radiusLineCoords: [number, number][] = [
                center,
                [center[0] + radiusLng, center[1]],
              ];

              hoverCircleSource.setData({
                type: 'FeatureCollection',
                features: [
                  {
                    ...createCirclePolygon(center, signalRadius),
                    properties: { color: bssidColor, strokeColor: bssidColor },
                  },
                  {
                    type: 'Feature' as const,
                    geometry: { type: 'LineString' as const, coordinates: radiusLineCoords },
                    properties: { label: radiusLabel, color: bssidColor },
                  },
                ],
              });
            }
          });

          map.on('mouseleave', 'observation-points', () => {
            map.getCanvas().style.cursor = '';
            const hoverCircleSource = map.getSource('hover-circle') as GeoJSONSource;
            if (hoverCircleSource) {
              hoverCircleSource.setData({ type: 'FeatureCollection', features: [] });
            }
          });

          // Add home marker point source
          map.addSource('home-location-point', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: homeLocation.center,
                  },
                  properties: {
                    title: 'Home',
                  },
                },
              ],
            },
          });

          // Add home circle polygon source (proper geographic radius)
          map.addSource('home-location-circle', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [createCirclePolygon(homeLocation.center, homeLocation.radius)],
            },
          });

          // Home circle fill (proper meter-based radius)
          map.addLayer({
            id: 'home-circle-fill',
            type: 'fill',
            source: 'home-location-circle',
            paint: {
              'fill-color': '#10b981',
              'fill-opacity': 0.15,
            },
          });

          // Home circle outline
          map.addLayer({
            id: 'home-circle-outline',
            type: 'line',
            source: 'home-location-circle',
            paint: {
              'line-color': '#10b981',
              'line-width': 2,
              'line-opacity': 0.8,
            },
          });

          // Home marker dot
          map.addLayer({
            id: 'home-dot',
            type: 'circle',
            source: 'home-location-point',
            paint: {
              'circle-radius': 8,
              'circle-color': '#10b981',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });

          // Home marker label
          map.addLayer({
            id: 'home-marker',
            type: 'symbol',
            source: 'home-location-point',
            layout: {
              'text-field': 'H',
              'text-size': 14,
              'text-anchor': 'center',
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            },
            paint: {
              'text-color': '#ffffff',
            },
          });

          setMapReady(true);
        });

        map.on('error', (e: any) => {
          // Suppress Google Maps tile errors (they spam the console)
          if (e?.error?.message === 'sn' || e?.sourceId === 'google-tiles') {
            // Google Maps tile loading error - likely API key issue
            if (mapStyle.startsWith('google-')) {
              setMapError('Google Maps tiles failed to load. Check API key configuration.');
            }
            return;
          }
          logError('Map error', e);
          setMapError('Map failed to load');
        });
      } catch (err) {
        logError('Map init failed', err);
        setMapError(err instanceof Error ? err.message : 'Map initialization failed');
      }
    };

    init();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      mapInitRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
