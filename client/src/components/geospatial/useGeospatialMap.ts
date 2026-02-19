import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Map, GeoJSONSource, MapLayerMouseEvent } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { renderNetworkTooltip } from '../../utils/geospatial/renderNetworkTooltip';
import { DEFAULT_ZOOM, MAP_STYLES } from '../../constants/network';
import { mapboxApi } from '../../api/mapboxApi';
import {
  createCirclePolygon,
  calculateSignalRange,
  macColor,
  createGoogleStyle,
} from '../../utils/mapHelpers';

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

          // Add click handlers for observation points with signal circle tooltips
          map.on('click', 'observation-points', (e: MapLayerMouseEvent) => {
            if (!e.features || e.features.length === 0) return;

            const feature = e.features[0];
            const props = feature.properties;
            if (!props) return;

            const latitude = (feature.geometry as any).coordinates[1];

            const popupHTML = renderNetworkTooltip({
              ssid: props.ssid,
              bssid: props.bssid,
              type: props.type,
              threat_level: props.threat_level,
              threat_score: props.threat_score,
              signal: props.signal,
              security: props.security,
              frequency: props.frequency,
              channel: props.channel,
              lat: latitude,
              lon: (feature.geometry as any).coordinates[0],
              altitude: props.altitude,
              manufacturer: props.manufacturer,
              observation_count: props.observation_count,
              timespan_days: props.timespan_days,
              distance_from_home_km: props.distance_from_home_km,
              max_distance_km: props.max_distance_km,
              distance_from_last_point_m: props.distance_from_last_point_m,
              time_since_prior: props.time_since_prior,
              time: props.time,
              first_seen: props.first_seen,
              last_seen: props.last_seen,
              number: props.number,
              accuracy: props.accuracy,
              unique_days: props.unique_days,
            });

            // Smart positioning - keep popup within map bounds
            const popupWidth = 340;
            const popupHeight = 480;
            const padding = 20;

            // Get map container dimensions
            const mapContainer = map.getContainer();
            const mapRect = mapContainer.getBoundingClientRect();
            const mapWidth = mapRect.width;
            const mapHeight = mapRect.height;

            // Get click position relative to map container
            const point = map.project(e.lngLat);
            const clickX = point.x;
            const clickY = point.y;

            // Determine best anchor based on click position within the map
            // Use center-relative positioning for better centering
            const halfWidth = popupWidth / 2;
            const spaceAbove = clickY;
            const spaceBelow = mapHeight - clickY;
            const spaceLeft = clickX;
            const spaceRight = mapWidth - clickX;

            let anchor: string = 'bottom';
            let offsetX = 0;
            let offsetY = -15;

            // Vertical: prefer showing below point, flip if not enough space
            if (spaceBelow < popupHeight + padding && spaceAbove > spaceBelow) {
              anchor = 'top';
              offsetY = 15;
            }

            // Horizontal: try to center, but shift if near edges
            if (spaceRight < halfWidth + padding) {
              // Near right edge - anchor to right
              anchor = anchor === 'top' ? 'top-right' : 'bottom-right';
              offsetX = -10;
            } else if (spaceLeft < halfWidth + padding) {
              // Near left edge - anchor to left
              anchor = anchor === 'top' ? 'top-left' : 'bottom-left';
              offsetX = 10;
            }

            new mapboxgl.Popup({
              offset: [offsetX, offsetY],
              className: 'sc-popup',
              anchor: anchor as any,
              maxWidth: '340px',
              closeOnClick: true,
              closeButton: true,
            })
              .setLngLat(e.lngLat)
              .setHTML(popupHTML)
              .addTo(map);
          });

          // Add hover circle source and layer (added BEFORE observation-points so it renders below)
          map.addSource('hover-circle', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          // Insert hover circle layer BEFORE observation-lines so it appears below the points
          map.addLayer(
            {
              id: 'hover-circle-fill',
              type: 'circle',
              source: 'hover-circle',
              paint: {
                'circle-radius': ['get', 'radius'],
                'circle-color': ['get', 'color'],
                'circle-opacity': 0.35,
                'circle-stroke-width': 4,
                'circle-stroke-color': ['get', 'strokeColor'],
                'circle-stroke-opacity': 0.9,
              },
            },
            'observation-lines' // Insert before observation-lines layer
          );

          // Show signal circle on hover (tooltip removed - click for details)
          map.on('mouseenter', 'observation-points', (e: MapLayerMouseEvent) => {
            map.getCanvas().style.cursor = 'pointer';

            if (!e.features || e.features.length === 0) return;

            const feature = e.features[0];
            const props = feature.properties;
            if (!props || !e.lngLat) return;

            const currentZoom = map.getZoom();
            const signalRadius = calculateSignalRange(
              props.signal,
              props.frequency,
              currentZoom,
              e.lngLat.lat
            );
            const bssidColor = macColor(props.bssid);

            // Add signal range circle to map
            const hoverCircleSource = map.getSource('hover-circle') as GeoJSONSource;
            if (hoverCircleSource) {
              hoverCircleSource.setData({
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: [e.lngLat.lng, e.lngLat.lat],
                    },
                    properties: {
                      radius: signalRadius,
                      color: bssidColor,
                      strokeColor: bssidColor,
                    },
                  },
                ],
              });
            }
          });

          map.on('mouseleave', 'observation-points', () => {
            map.getCanvas().style.cursor = '';

            // Clear hover circle from map
            const hoverCircleSource = map.getSource('hover-circle') as GeoJSONSource;
            if (hoverCircleSource) {
              hoverCircleSource.setData({
                type: 'FeatureCollection',
                features: [],
              });
            }
          });

          map.on('mousemove', 'observation-points', (e: MapLayerMouseEvent) => {
            if (!e.features || e.features.length === 0 || !e.lngLat) return;
            const feature = e.features[0];
            const props = feature.properties;
            if (!props) return;

            const currentZoom = map.getZoom();
            const signalRadius = calculateSignalRange(
              props.signal,
              props.frequency,
              currentZoom,
              e.lngLat.lat
            );
            const bssidColor = macColor(props.bssid);

            const hoverCircleSource = map.getSource('hover-circle') as GeoJSONSource;
            if (hoverCircleSource) {
              hoverCircleSource.setData({
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: [e.lngLat.lng, e.lngLat.lat],
                    },
                    properties: {
                      radius: signalRadius,
                      color: bssidColor,
                      strokeColor: bssidColor,
                    },
                  },
                ],
              });
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
