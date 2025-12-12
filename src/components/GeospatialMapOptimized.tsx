import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

declare global {
  interface Window {
    mapboxgl: any;
  }
}

interface GeospatialMapProps {
  onNetworkSelect?: (networks: any[]) => void;
  selectedNetworks?: any[];
}

// Debounce hook for performance
const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Lazy loading hook for map data
const useMapData = (bounds: any, zoom: number) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedBounds = useDebounce(bounds, 300); // 300ms debounce
  const debouncedZoom = useDebounce(zoom, 200);

  const fetchData = useCallback(async () => {
    if (!debouncedBounds || debouncedZoom < 10) return; // Don't load data at low zoom levels

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        minLat: debouncedBounds.getSouth().toString(),
        maxLat: debouncedBounds.getNorth().toString(),
        minLng: debouncedBounds.getWest().toString(),
        maxLng: debouncedBounds.getEast().toString(),
        zoom: debouncedZoom.toString(),
        limit: debouncedZoom > 15 ? '1000' : debouncedZoom > 12 ? '500' : '200' // Adaptive limits
      });

      const response = await fetch(`/api/networks/geospatial?${params}`);
      if (!response.ok) throw new Error('Failed to fetch network data');
      
      const result = await response.json();
      setData(result.networks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Map data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedBounds, debouncedZoom]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

const GeospatialMapOptimized: React.FC<GeospatialMapProps> = ({ onNetworkSelect, selectedNetworks = [] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/standard');
  const [show3DBuildings, setShow3DBuildings] = useState(false);
  const [showTerrain, setShowTerrain] = useState(false);
  const [homeRadius, setHomeRadius] = useState(0);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [mapZoom, setMapZoom] = useState(13);

  // Lazy load map data with debouncing
  const { data: networkData, loading, error } = useMapData(mapBounds, mapZoom);

  // Memoized network markers to prevent unnecessary re-renders
  const networkMarkers = useMemo(() => {
    return networkData.map(network => ({
      id: network.bssid,
      coordinates: [network.longitude, network.latitude],
      properties: network
    }));
  }, [networkData]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Load Mapbox token from API
    fetch('/api/mapbox-token')
      .then(response => response.json())
      .then(data => {
        if (data.token && data.token !== 'your-mapbox-token-here') {
          window.mapboxgl.accessToken = data.token;

          // Load saved map style from localStorage
          const savedStyle = localStorage.getItem('shadowcheck_map_style') || 'mapbox://styles/mapbox/standard';
          setMapStyle(savedStyle);

          // Initialize map with performance optimizations
          map.current = new window.mapboxgl.Map({
            container: mapContainer.current,
            style: savedStyle,
            center: [-83.6968, 43.0234],
            zoom: 13,
            // Performance optimizations
            antialias: false, // Disable for better performance
            optimizeForTerrain: true,
            renderWorldCopies: false,
            maxTileCacheSize: 50,
            transformRequest: (url: string, resourceType: string) => {
              if (resourceType === 'Tile' && url.startsWith('http')) {
                return {
                  url: url,
                  headers: { 'Cache-Control': 'max-age=3600' }, // 1 hour cache
                  credentials: 'same-origin'
                };
              }
            }
          });

          // Add navigation controls
          map.current.addControl(new window.mapboxgl.NavigationControl(), 'top-right');

          // Debounced move handler for lazy loading
          const handleMove = () => {
            const bounds = map.current.getBounds();
            const zoom = map.current.getZoom();
            setMapBounds(bounds);
            setMapZoom(zoom);
          };

          map.current.on('load', () => {
            console.log('✓ Map loaded successfully');
            loadHomeMarker();
            handleMove(); // Initial data load
          });

          // Throttled move events for performance
          let moveTimeout: NodeJS.Timeout;
          map.current.on('moveend', () => {
            clearTimeout(moveTimeout);
            moveTimeout = setTimeout(handleMove, 100);
          });

          map.current.on('error', (e: any) => {
            console.error('Map error:', e);
          });

        } else {
          console.error('Mapbox token not configured');
          if (mapContainer.current) {
            mapContainer.current.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Mapbox token not configured. Please set in Admin settings.</div>';
          }
        }
      })
      .catch(error => {
        console.error('Failed to load Mapbox token:', error);
      });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Efficiently update markers when network data changes
  useEffect(() => {
    if (!map.current || !networkMarkers.length) return;

    // Remove old markers
    markersRef.current.forEach((marker, id) => {
      if (!networkMarkers.find(n => n.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add new markers with clustering for performance
    networkMarkers.forEach(network => {
      if (!markersRef.current.has(network.id)) {
        const el = document.createElement('div');
        el.className = 'network-marker';
        el.style.cssText = `
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${getNetworkColor(network.properties)};
          border: 1px solid rgba(255,255,255,0.8);
          cursor: pointer;
          transition: transform 0.2s;
        `;

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.5)';
        });

        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });

        const marker = new window.mapboxgl.Marker(el)
          .setLngLat(network.coordinates)
          .setPopup(createNetworkPopup(network.properties))
          .addTo(map.current);

        markersRef.current.set(network.id, marker);
      }
    });
  }, [networkMarkers]);

  const getNetworkColor = (network: any) => {
    if (network.threat_score >= 70) return '#ef4444'; // Red for high threat
    if (network.threat_score >= 50) return '#f59e0b'; // Orange for medium threat
    if (network.type === 'W') return '#3b82f6'; // Blue for WiFi
    if (network.type === 'E') return '#8b5cf6'; // Purple for BLE
    return '#10b981'; // Green for others
  };

  const createNetworkPopup = (network: any) => {
    return new window.mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'dark-tooltip-popup'
    }).setHTML(`
      <div class="dark-tooltip">
        <div class="tooltip-header">
          <span class="tooltip-ssid">${network.ssid || '(hidden)'}</span>
        </div>
        <div class="tooltip-field">
          <span class="tooltip-label">BSSID:</span>
          <span class="tooltip-value mono">${network.bssid}</span>
        </div>
        <div class="tooltip-field">
          <span class="tooltip-label">Signal:</span>
          <span class="tooltip-value">${network.bestlevel || 'N/A'} dBm</span>
        </div>
        <div class="tooltip-field">
          <span class="tooltip-label">Threat Score:</span>
          <span class="tooltip-value">${network.threat_score || 0}</span>
        </div>
      </div>
    `);
  };

  const changeMapStyle = (newStyle: string) => {
    if (!map.current) return;
    
    map.current.setStyle(newStyle);
    setMapStyle(newStyle);
    localStorage.setItem('shadowcheck_map_style', newStyle);
    
    // Re-add 3D buildings and terrain after style change
    map.current.on('styledata', () => {
      if (show3DBuildings) add3DBuildings();
      if (showTerrain) addTerrain();
    });
  };

  const toggle3DBuildings = (enabled: boolean) => {
    if (!map.current) return;
    setShow3DBuildings(enabled);
    if (enabled) {
      add3DBuildings();
    } else {
      if (map.current.getLayer('3d-buildings')) {
        map.current.removeLayer('3d-buildings');
      }
    }
  };

  const add3DBuildings = () => {
    if (!map.current.getLayer('3d-buildings')) {
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers.find(
        (layer: any) => layer.type === 'symbol' && layer.layout['text-field']
      )?.id;

      map.current.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0, 15.05, ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            15, 0, 15.05, ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      }, labelLayerId);
    }
  };

  const toggleTerrain = (enabled: boolean) => {
    if (!map.current) return;
    setShowTerrain(enabled);
    if (enabled) {
      addTerrain();
    } else {
      map.current.setTerrain(null);
      if (map.current.getSource('mapbox-dem')) {
        map.current.removeSource('mapbox-dem');
      }
    }
  };

  const addTerrain = () => {
    if (!map.current.getSource('mapbox-dem')) {
      map.current.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
        'tileSize': 512,
        'maxzoom': 14
      });
    }
    map.current.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
  };

  const loadHomeMarker = () => {
    // Add home marker logic here
    console.log('Loading home marker...');
  };

  const centerOnHome = () => {
    if (map.current) {
      map.current.flyTo({ center: [-83.6968, 43.0234], zoom: 13 });
    }
  };

  const centerOnCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        if (map.current) {
          map.current.flyTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 15
          });
        }
      });
    }
  };

  const fitBounds = () => {
    if (map.current && networkMarkers.length > 0) {
      const bounds = new window.mapboxgl.LngLatBounds();
      networkMarkers.forEach(marker => {
        bounds.extend(marker.coordinates);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }
  };

  return (
    <div className="panel" id="map-panel" style={{ flex: 1 }}>
      <div className="panel-header">
        <span>📍 Network Distribution Map</span>
        {loading && <span className="text-xs text-blue-400 ml-2">Loading...</span>}
        {error && <span className="text-xs text-red-400 ml-2">Error: {error}</span>}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select 
            value={mapStyle}
            onChange={(e) => changeMapStyle(e.target.value)}
            style={{
              padding: '4px 8px', fontSize: '11px',
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              color: '#f8fafc', borderRadius: '4px'
            }}
          >
            <option value="mapbox://styles/mapbox/standard">Standard</option>
            <option value="mapbox://styles/mapbox/streets-v12">Streets</option>
            <option value="mapbox://styles/mapbox/outdoors-v12">Outdoors</option>
            <option value="mapbox://styles/mapbox/light-v11">Light</option>
            <option value="mapbox://styles/mapbox/dark-v11">Dark</option>
            <option value="mapbox://styles/mapbox/satellite-v9">Satellite</option>
            <option value="mapbox://styles/mapbox/satellite-streets-v12">Satellite Streets</option>
          </select>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
            <input type="checkbox" checked={show3DBuildings} onChange={(e) => toggle3DBuildings(e.target.checked)} />
            <span>🏢 3D Buildings</span>
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showTerrain} onChange={(e) => toggleTerrain(e.target.checked)} />
            <span>⛰️ Terrain</span>
          </label>
          
          <button onClick={centerOnHome} className="btn btn-sm">🏠 Home</button>
          <button onClick={centerOnCurrentLocation} className="btn btn-sm">📍 GPS</button>
          <button onClick={fitBounds} className="btn btn-sm">🎯 Fit All</button>
        </div>
      </div>
      <div className="panel-content">
        <div ref={mapContainer} id="map" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default GeospatialMapOptimized;
