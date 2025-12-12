import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    mapboxgl: any;
  }
}

interface GeospatialMapProps {
  onNetworkSelect?: (networks: any[]) => void;
  selectedNetworks?: any[];
}

const GeospatialMap: React.FC<GeospatialMapProps> = ({ onNetworkSelect, selectedNetworks = [] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/standard');
  const [show3DBuildings, setShow3DBuildings] = useState(false);
  const [showTerrain, setShowTerrain] = useState(false);
  const [homeRadius, setHomeRadius] = useState(0);

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

          // Initialize map
          map.current = new window.mapboxgl.Map({
            container: mapContainer.current,
            style: savedStyle,
            center: [-83.6968, 43.0234],
            zoom: 13,
            transformRequest: (url: string, resourceType: string) => {
              if (resourceType === 'Tile' && url.startsWith('http')) {
                return {
                  url: url,
                  headers: {},
                  credentials: 'same-origin'
                };
              }
            }
          });

          // Add navigation controls
          map.current.addControl(new window.mapboxgl.NavigationControl(), 'top-right');

          map.current.on('load', () => {
            console.log('✓ Map loaded successfully');
            loadHomeMarker();
            
            // Check for selected networks from URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const selectedParam = urlParams.get('selected');
            if (selectedParam) {
              const selectedBssids = selectedParam.split(',');
              console.log(`🎯 Loading ${selectedBssids.length} selected networks to map`);
              loadSelectedNetworksToMap(selectedBssids);
            }
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

  const changeMapStyle = (newStyle: string) => {
    if (!map.current) return;
    
    map.current.setStyle(newStyle);
    setMapStyle(newStyle);
    localStorage.setItem('shadowcheck_map_style', newStyle);
    
    // Re-add 3D buildings and terrain after style change
    map.current.on('styledata', () => {
      if (show3DBuildings) {
        add3DBuildings();
      }
      if (showTerrain) {
        addTerrain();
      }
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
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      }, labelLayerId);
      
      console.log('✓ 3D buildings enabled');
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
      console.log('✓ Terrain disabled');
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
    console.log('✓ Terrain enabled');
  };

  const loadHomeMarker = () => {
    // Add home marker logic here
    console.log('Loading home marker...');
  };

  const loadSelectedNetworksToMap = (bssids: string[]) => {
    // Add selected networks to map logic here
    console.log('Loading selected networks:', bssids);
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
    // Fit all networks in view logic here
    console.log('Fitting bounds...');
  };

  const updateHomeCircle = (radius: number) => {
    setHomeRadius(radius);
    // Update home circle on map logic here
    console.log('Updating home circle radius:', radius);
  };

  return (
    <div className="panel" id="map-panel" style={{ flex: 1 }}>
      <div className="panel-header">
        <span>📍 Network Distribution Map</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select 
            value={mapStyle}
            onChange={(e) => changeMapStyle(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              color: '#f8fafc',
              borderRadius: '4px'
            }}
          >
            <option value="mapbox://styles/mapbox/standard">Standard</option>
            <option value="mapbox://styles/mapbox/streets-v12">Streets</option>
            <option value="mapbox://styles/mapbox/outdoors-v12">Outdoors</option>
            <option value="mapbox://styles/mapbox/light-v11">Light</option>
            <option value="mapbox://styles/mapbox/dark-v11">Dark</option>
            <option value="mapbox://styles/mapbox/satellite-v9">Satellite</option>
            <option value="mapbox://styles/mapbox/satellite-streets-v12">Satellite Streets</option>
            <option value="mapbox://styles/mapbox/navigation-day-v1">Navigation Day</option>
            <option value="mapbox://styles/mapbox/navigation-night-v1">Navigation Night</option>
          </select>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={show3DBuildings}
              onChange={(e) => toggle3DBuildings(e.target.checked)}
            />
            <span>🏢 3D Buildings</span>
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showTerrain}
              onChange={(e) => toggleTerrain(e.target.checked)}
            />
            <span>⛰️ Terrain</span>
          </label>
          
          <button onClick={centerOnHome} className="btn btn-sm" title="Center on home location">
            🏠 Home
          </button>
          
          <button onClick={centerOnCurrentLocation} className="btn btn-sm" title="Center on your current GPS location">
            📍 GPS
          </button>
          
          <button onClick={fitBounds} className="btn btn-sm" title="Fit all networks in view">
            🎯 Fit All
          </button>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
            <span>⭕ Radius:</span>
            <input 
              type="number" 
              value={homeRadius}
              min="0" 
              max="10000" 
              step="50" 
              onChange={(e) => updateHomeCircle(parseInt(e.target.value))}
              style={{
                width: '70px',
                padding: '4px 6px',
                fontSize: '11px',
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                color: '#f8fafc',
                borderRadius: '4px'
              }}
            />
            <span>m</span>
          </label>
        </div>
      </div>
      <div className="panel-content">
        <div ref={mapContainer} id="map" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default GeospatialMap;
