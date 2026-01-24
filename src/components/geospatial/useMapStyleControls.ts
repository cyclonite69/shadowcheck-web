import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type mapboxglType from 'mapbox-gl';
import type { NetworkRow, Observation } from '../../types/network';
import { MAP_STYLES } from '../../constants/network';
import { createCirclePolygon, createGoogleStyle, macColor } from '../../utils/mapHelpers';

type HomeLocation = {
  center: [number, number];
  radius: number;
};

type ObservationSet = {
  bssid: string;
  observations: Observation[];
};

type MapStyleControlsProps = {
  mapRef: MutableRefObject<mapboxglType.Map | null>;
  setMapStyle: Dispatch<SetStateAction<string>>;
  setEmbeddedView: Dispatch<SetStateAction<'street-view' | 'earth' | null>>;
  setMapError: Dispatch<SetStateAction<string | null>>;
  homeLocation: HomeLocation;
  activeObservationSets: ObservationSet[];
  networkLookup: Map<string, NetworkRow>;
  show3DBuildings: boolean;
  showTerrain: boolean;
  add3DBuildings: () => void;
  addTerrain: () => void;
  logError: (message: string, error?: unknown) => void;
};

export const useMapStyleControls = ({
  mapRef,
  setMapStyle,
  setEmbeddedView,
  setMapError,
  homeLocation,
  activeObservationSets,
  networkLookup,
  show3DBuildings,
  showTerrain,
  add3DBuildings,
  addTerrain,
  logError,
}: MapStyleControlsProps) => {
  // Export KML for Google Earth
  const exportToGoogleEarth = async () => {
    // Require network selection first
    if (activeObservationSets.length === 0) {
      alert(
        'Please select one or more networks first.\n\n' +
          'Click the eye icon next to a network in the table below to show its observations, ' +
          'then select Google Earth to export only those networks.'
      );
      return;
    }

    try {
      // Export only the selected networks
      const bssids = activeObservationSets.map((set) => set.bssid).join(',');
      const url = `/api/kml?bssids=${encodeURIComponent(bssids)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to export KML');
      }

      const kmlData = await response.text();

      // Create a blob and download link
      const blob = new Blob([kmlData], { type: 'application/vnd.google-earth.kml+xml' });
      const downloadUrl = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      const networkCount = activeObservationSets.length;
      link.download = `shadowcheck_${networkCount}_networks_${new Date().toISOString().split('T')[0]}.kml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      // Open Google Earth Web at current location
      const center = mapRef.current?.getCenter() || { lat: 43.0234, lng: -83.6968 };
      const zoom = mapRef.current?.getZoom() || 12;
      const altitude =
        (Math.pow(2, 22 - zoom) * 156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / 2;
      const earthUrl = `https://earth.google.com/web/@${center.lat},${center.lng},${altitude}a,${altitude}d,35y,0h,0t,0r`;

      // Show instruction to user
      const openEarth = window.confirm(
        `KML file with ${networkCount} network(s) downloaded!\n\n` +
          'To view in Google Earth:\n' +
          '1. Open Google Earth Pro (desktop) and File > Open the KML file, OR\n' +
          '2. Go to Google Earth Web and drag the KML file onto the map\n\n' +
          'Click OK to open Google Earth Web now.'
      );

      if (openEarth) {
        window.open(earthUrl, '_blank');
      }
    } catch (error) {
      logError('Failed to export KML', error);
      alert('Failed to export KML data. Please try again.');
    }
  };

  // Map style change handler
  const changeMapStyle = (styleUrl: string) => {
    // Handle Google Earth - generate KML with observations
    if (styleUrl === 'google-earth') {
      exportToGoogleEarth();
      return;
    }

    // Handle Street View embed
    if (styleUrl === 'google-street-view') {
      setEmbeddedView('street-view');
      localStorage.setItem('shadowcheck_map_style', styleUrl);
      setMapStyle(styleUrl);
      return;
    }

    // Clear embedded view when switching to regular map
    setEmbeddedView(null);

    if (!mapRef.current) return;

    const currentCenter = mapRef.current.getCenter();
    const currentZoom = mapRef.current.getZoom();

    // Save the style preference
    localStorage.setItem('shadowcheck_map_style', styleUrl);
    setMapStyle(styleUrl);

    // Find the style config for Standard variants
    const styleConfig = MAP_STYLES.find((s) => s.value === styleUrl);

    // Handle Google Maps styles
    if (styleUrl.startsWith('google-')) {
      const googleType = styleUrl.replace('google-', ''); // roadmap, satellite, hybrid, terrain
      const googleStyle = createGoogleStyle(googleType);

      // Clear any previous error when switching styles
      setMapError(null);

      mapRef.current.setStyle(googleStyle);
    } else {
      // Get the actual style URL (Standard variants all use the same base URL)
      const actualStyleUrl = styleUrl.startsWith('mapbox://styles/mapbox/standard')
        ? 'mapbox://styles/mapbox/standard'
        : styleUrl;
      mapRef.current.setStyle(actualStyleUrl);
    }

    mapRef.current.once('style.load', () => {
      if (!mapRef.current) return;

      mapRef.current.setCenter(currentCenter);
      mapRef.current.setZoom(currentZoom);

      // Apply light preset for Standard style variants
      if (styleConfig?.config?.lightPreset) {
        mapRef.current.setConfigProperty('basemap', 'lightPreset', styleConfig.config.lightPreset);
      }

      // Re-add observation sources and layers
      mapRef.current.addSource('observations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      mapRef.current.addSource('observation-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Line layer connecting observations
      mapRef.current.addLayer({
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
      mapRef.current.addLayer({
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
      mapRef.current.addLayer({
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

      // Re-add hover circle source and layer for signal range visualization
      mapRef.current.addSource('hover-circle', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Insert hover circle layer BEFORE observation-lines so it appears below the points
      mapRef.current.addLayer(
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

      // Re-add home location sources and layers
      mapRef.current.addSource('home-location-point', {
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

      mapRef.current.addSource('home-location-circle', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [createCirclePolygon(homeLocation.center, homeLocation.radius)],
        },
      });

      // Home circle fill
      mapRef.current.addLayer({
        id: 'home-circle-fill',
        type: 'fill',
        source: 'home-location-circle',
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.15,
        },
      });

      // Home circle outline
      mapRef.current.addLayer({
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
      mapRef.current.addLayer({
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
      mapRef.current.addLayer({
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

      // Restore layers if they were enabled
      if (show3DBuildings) {
        add3DBuildings();
      }
      if (showTerrain) {
        addTerrain();
      }

      // Re-render observations
      if (activeObservationSets.length > 0) {
        const features = activeObservationSets.flatMap((set) =>
          set.observations.map((obs, index) => {
            const network = networkLookup.get(obs.bssid);
            const threatLevel = network?.threat?.level ?? 'NONE';

            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [obs.lon, obs.lat],
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
                timespan_days:
                  typeof network?.timespanDays === 'number' ? network.timespanDays : null,
                type: network?.type || null,
                number: index + 1,
                color: macColor(obs.bssid),
              },
            };
          })
        );

        if (mapRef.current.getSource('observations')) {
          (mapRef.current.getSource('observations') as mapboxglType.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: features as any,
          });
        }
      }
    });
  };

  return { changeMapStyle };
};
