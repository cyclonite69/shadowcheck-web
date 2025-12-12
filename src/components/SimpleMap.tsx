import React, { useEffect, useRef } from 'react';

interface SimpleMapProps {
  selectedNetworks?: any[];
  onNetworkSelect?: (networks: any[]) => void;
}

const SimpleMap: React.FC<SimpleMapProps> = ({ selectedNetworks = [], onNetworkSelect }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Check if Mapbox GL is loaded
    if (!window.mapboxgl) {
      console.error('Mapbox GL JS not loaded');
      return;
    }

    // Load Mapbox token
    fetch('/api/mapbox-token')
      .then(response => response.json())
      .then(data => {
        if (data.token && data.token !== 'your-mapbox-token-here') {
          window.mapboxgl.accessToken = data.token;

          // Initialize map
          map.current = new window.mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-83.6968, 43.0234],
            zoom: 13
          });

          // Add navigation controls
          map.current.addControl(new window.mapboxgl.NavigationControl(), 'top-right');

          map.current.on('load', () => {
            console.log('✓ Map loaded successfully');
          });

        } else {
          if (mapContainer.current) {
            mapContainer.current.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Mapbox token not configured</div>';
          }
        }
      })
      .catch(error => {
        console.error('Failed to load Mapbox token:', error);
        if (mapContainer.current) {
          mapContainer.current.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Failed to load map</div>';
        }
      });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-header">
        <span>📍 Network Distribution Map</span>
      </div>
      <div className="panel-content">
        <div 
          ref={mapContainer} 
          style={{ 
            width: '100%', 
            height: '100%',
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8'
          }} 
        />
      </div>
    </div>
  );
};

export default SimpleMap;
