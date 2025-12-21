import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    deck?: any;
    mapboxgl?: any;
  }
}

type NetworkData = {
  position: [number, number];
  bssid: string;
  ssid: string;
  signal: number;
  level: number;
  encryption: string;
  channel: number;
  frequency: number;
  manufacturer: string;
  device_type: string;
  type: string;
  capabilities: string;
  timestamp: string;
  last_seen: string;
  device_id?: string;
  source_tag?: string;
  accuracy?: number;
  altitude?: number;
  obs_count?: number;
  threat_level?: string;
  is_suspicious?: boolean;
  distance_from_home?: number;
};

type LayerType = 'scatterplot' | 'heatmap' | 'hexagon';
type DrawMode = 'none' | 'rectangle' | 'polygon' | 'circle';

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

const loadCss = (href: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS ${href}`));
    document.head.appendChild(link);
  });

const KeplerTestPage: React.FC = () => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [networkData, setNetworkData] = useState<NetworkData[]>([]);
  const [selectedPoints, setSelectedPoints] = useState<NetworkData[]>([]);
  const [actualCounts, setActualCounts] = useState<{
    observations: number;
    networks: number;
  } | null>(null);

  // Controls
  const [layerType, setLayerType] = useState<LayerType>('scatterplot');
  const [pointSize, setPointSize] = useState<number>(0.1);
  const [signalThreshold, setSignalThreshold] = useState<number>(-100);
  const [pitch, setPitch] = useState<number>(0);
  const [height3d, setHeight3d] = useState<number>(1);
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [datasetType, setDatasetType] = useState<'observations' | 'networks'>('observations');

  const initDeck = (token: string, data: NetworkData[]) => {
    if (!window.deck || !mapRef.current) return;

    let centerLon = -83.6968; // Default to Flint, MI
    let centerLat = 43.0234;
    let zoom = 10;

    // Validate data and calculate bounding box only if we have valid data
    if (data && data.length > 0) {
      // Filter for valid coordinates with both lon and lat values
      const validData = data.filter(
        (d) =>
          d.position &&
          d.position.length >= 2 &&
          typeof d.position[0] === 'number' &&
          typeof d.position[1] === 'number' &&
          !isNaN(d.position[0]) &&
          !isNaN(d.position[1])
      );

      if (validData.length > 0) {
        // Calculate bounds without spread operator to handle large datasets
        let minLon = Infinity,
          maxLon = -Infinity;
        let minLat = Infinity,
          maxLat = -Infinity;

        for (const d of validData) {
          const [lon, lat] = d.position;
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }

        const bounds = { minLon, maxLon, minLat, maxLat };

        centerLon = (bounds.minLon + bounds.maxLon) / 2;
        centerLat = (bounds.minLat + bounds.maxLat) / 2;

        // Calculate zoom to fit all points, prevent Math.log2(0)
        const lonDiff = bounds.maxLon - bounds.minLon;
        const latDiff = bounds.maxLat - bounds.minLat;
        const maxDiff = Math.max(lonDiff, latDiff, 0.01); // Prevent 0
        zoom = Math.max(1, Math.min(15, 10 - Math.log2(maxDiff)));
      }
    }

    const { DeckGL } = window.deck;
    const mapboxgl = window.mapboxgl;
    deckRef.current = new DeckGL({
      container: mapRef.current,
      mapLib: mapboxgl,
      mapboxApiAccessToken: token,
      mapStyle: 'mapbox://styles/mapbox/dark-v11',
      initialViewState: {
        longitude: centerLon,
        latitude: centerLat,
        zoom: zoom,
        pitch: pitch,
        bearing: 0,
        minZoom: 1,
        maxZoom: 24,
      },
      controller: drawMode === 'none',
      useDevicePixels: false,
      getTooltip: ({ object }: { object: any }) => {
        if (!object) return null;

        const radioType = interpretWigleType(object.type);
        const security = interpretSecurity(
          object.capabilities || object.encryption,
          object.encryption
        );
        const signalStrength = interpretSignalStrength(object.signal || object.bestlevel || 0);
        const networkIcon = getNetworkIcon(object.type);

        // Calculate observation time span if we have both first and last seen
        let obsTimeSpan = '';
        let obsCount = object.obs_count || object.observation_count || 0;
        const firstSeen = object.timestamp || object.first_seen;
        const lastSeen = object.last_seen;

        if (firstSeen && lastSeen) {
          const first = new Date(firstSeen);
          const last = new Date(lastSeen);
          const diffMs = last.getTime() - first.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

          if (diffDays > 0) {
            obsTimeSpan = `${diffDays}d ${diffHours}h`;
          } else if (diffHours > 0) {
            obsTimeSpan = `${diffHours}h`;
          } else {
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            obsTimeSpan = `${diffMins}m`;
          }
        }

        // Only show channel/frequency for WiFi
        const isWiFi = !object.type || object.type === 'W' || object.type === 'wifi';
        const channelInfo =
          isWiFi && object.channel
            ? `
          <div style="background: rgba(59, 130, 246, 0.08); padding: 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.15);">
            <span style="color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">Channel</span>
            <div style="color: #e2e8f0; margin-top: 3px; font-size: 10px;">Ch ${object.channel}${object.frequency ? ` • ${object.frequency} MHz` : ''}</div>
          </div>
        `
            : '';

        return {
          html: `
            <div style="background: linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%); color: #f8fafc; padding: 16px; border-radius: 12px; max-width: 450px; font-size: 11px; border: 1px solid rgba(59, 130, 246, 0.3); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid rgba(59, 130, 246, 0.2);">
                ${networkIcon}
                <div style="flex: 1;">
                  <div style="color: #60a5fa; font-weight: bold; font-size: 16px;">${object.ssid || 'Hidden Network'}</div>
                  <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">${radioType.name} Network</div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                <div style="background: rgba(59, 130, 246, 0.08); padding: 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.15);">
                  <span style="color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">BSSID</span>
                  <div style="font-family: 'Courier New', monospace; font-size: 10px; margin-top: 3px; color: #e2e8f0;">${object.bssid}</div>
                </div>
                <div style="background: rgba(59, 130, 246, 0.08); padding: 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.15);">
                  <span style="color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">Signal</span>
                  <div style="margin-top: 3px;">
                    <span style="color: ${signalStrength.color}; font-weight: bold;">${object.signal || object.bestlevel ? `${object.signal || object.bestlevel} dBm` : 'N/A'}</span>
                    <span style="color: #64748b; font-size: 9px; margin-left: 4px;">(${signalStrength.text})</span>
                  </div>
                </div>
                ${
                  isWiFi
                    ? `
                <div style="background: rgba(59, 130, 246, 0.08); padding: 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.15);">
                  <span style="color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">Security</span>
                  <div style="color: ${security.color}; font-weight: 600; margin-top: 3px; font-size: 10px;">${security.text}</div>
                </div>
                `
                    : ''
                }
                ${channelInfo}
              </div>

              ${
                object.manufacturer && object.manufacturer !== 'Unknown'
                  ? `
              <div style="background: rgba(59, 130, 246, 0.05); padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #3b82f6;">
                <div style="color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Manufacturer</div>
                <div style="color: #60a5fa; font-weight: 500;">${object.manufacturer}</div>
              </div>`
                  : ''
              }

              <!-- Observation Details -->
              <div style="background: rgba(16, 185, 129, 0.08); padding: 10px; border-radius: 6px; margin-bottom: 10px; border: 1px solid rgba(16, 185, 129, 0.2);">
                <div style="color: #10b981; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">📡 Network Intelligence</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10px;">
                  ${obsCount > 0 ? `<div><span style="color: #94a3b8;">Observations:</span><br><span style="color: #6ee7b7; font-weight: 600;">${obsCount}</span></div>` : ''}
                  ${object.threat_level ? `<div><span style="color: #94a3b8;">Threat Level:</span><br><span style="color: ${object.threat_level === 'HIGH' ? '#ef4444' : object.threat_level === 'MEDIUM' ? '#f59e0b' : '#22c55e'}; font-weight: 600;">${object.threat_level}</span></div>` : ''}
                  ${object.distance_from_home ? `<div><span style="color: #94a3b8;">Distance:</span><br><span style="color: #6ee7b7;">${object.distance_from_home.toFixed(1)}km</span></div>` : ''}
                  ${object.is_suspicious ? `<div><span style="color: #94a3b8;">Status:</span><br><span style="color: #ef4444; font-weight: 600;">⚠️ Suspicious</span></div>` : ''}
                </div>
              </div>

              <!-- Observation Times - Highlighted -->
              <div style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%); padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(251, 191, 36, 0.3);">
                <div style="color: #fbbf24; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">⏱️ Observation Timeline</div>
                ${
                  firstSeen
                    ? `
                <div style="margin-bottom: 4px;">
                  <span style="color: #94a3b8; font-size: 9px;">First Seen:</span>
                  <div style="color: #fde68a; font-weight: 600; font-size: 11px; margin-top: 2px;">${new Date(firstSeen).toLocaleString()}</div>
                </div>`
                    : ''
                }
                ${
                  lastSeen && lastSeen !== firstSeen
                    ? `
                <div style="margin-bottom: 4px;">
                  <span style="color: #94a3b8; font-size: 9px;">Last Seen:</span>
                  <div style="color: #fde68a; font-weight: 600; font-size: 11px; margin-top: 2px;">${new Date(lastSeen).toLocaleString()}</div>
                </div>
                <div style="display: flex; gap: 12px; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(251, 191, 36, 0.2);">
                  ${obsTimeSpan ? `<div><span style="color: #94a3b8; font-size: 9px;">Span:</span> <span style="color: #fbbf24; font-weight: 600; font-size: 10px;">${obsTimeSpan}</span></div>` : ''}
                  ${obsCount > 0 ? `<div><span style="color: #94a3b8; font-size: 9px;">Observations:</span> <span style="color: #fbbf24; font-weight: 600; font-size: 10px;">${obsCount}</span></div>` : ''}
                </div>
                `
                    : ''
                }
              </div>

              <div style="border-top: 1px solid rgba(59, 130, 246, 0.2); padding-top: 10px;">
                <div style="display: flex; align-items: center; gap: 6px; font-size: 10px;">
                  <span style="color: #94a3b8;">📍</span>
                  <span style="font-family: 'Courier New', monospace; color: #94a3b8;">${object.position ? object.position[1].toFixed(6) + ', ' + object.position[0].toFixed(6) : 'Unknown'}</span>
                </div>
              </div>
            </div>
          `,
          style: { backgroundColor: 'transparent', fontSize: '12px' },
        };
      },
      onClick: ({ object }: { object: any }) => {
        if (object && !selectedPoints.find((p) => p.bssid === object.bssid)) {
          setSelectedPoints((prev) => [...prev, object]);
        }
      },
    });
  };

  const updateVisualization = () => {
    if (!deckRef.current || !window.deck) return;

    const filteredData = networkData.filter((d) => d.signal >= signalThreshold);
    let layer;

    if (layerType === 'scatterplot') {
      layer = new window.deck.ScatterplotLayer({
        id: 'networks',
        data: filteredData,
        getPosition: (d: NetworkData) => d.position,
        getRadius: pointSize * 10,
        getFillColor: (d: NetworkData) => {
          if (d.signal > -50) return [255, 0, 0, 180];
          if (d.signal > -70) return [255, 255, 0, 180];
          return [0, 255, 0, 180];
        },
        pickable: true,
        radiusMinPixels: 2,
        radiusMaxPixels: 50,
      });
    } else if (layerType === 'heatmap') {
      layer = new window.deck.HeatmapLayer({
        id: 'networks-heatmap',
        data: filteredData,
        getPosition: (d: NetworkData) => d.position,
        getWeight: (d: NetworkData) => Math.max(1, d.signal / 10),
        radiusPixels: 50,
      });
    } else if (layerType === 'hexagon') {
      layer = new window.deck.HexagonLayer({
        id: 'networks-hexagon',
        data: filteredData,
        getPosition: (d: NetworkData) => d.position,
        radius: 200,
        elevationScale: height3d * 4,
        extruded: true,
        pickable: true,
        getFillColor: [255, 140, 0, 180],
      });
    }

    deckRef.current.setProps({ layers: [layer] });
  };

  const clearSelection = () => {
    setSelectedPoints([]);
  };

  useEffect(() => {
    const setup = async () => {
      try {
        setLoading(true);

        await Promise.all([
          loadCss('https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css'),
          loadScript('https://cdn.jsdelivr.net/npm/deck.gl@8.9.0/dist.min.js'),
          loadScript('https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'),
        ]);

        const [tokenRes, dataRes] = await Promise.all([
          fetch('/api/mapbox-token'),
          fetch('/api/kepler/observations'), // Back to raw observations for full dataset
        ]);

        const tokenData = await tokenRes.json();
        const geojson = await dataRes.json();

        // Set actual counts from the data itself
        setActualCounts({
          observations: geojson.features?.length || 0,
          networks: 0, // Will be updated when we add networks endpoint
        });

        if (geojson.error) throw new Error(`API Error: ${geojson.error}`);
        if (!geojson.features || !Array.isArray(geojson.features))
          throw new Error(`Invalid data format`);
        if (geojson.features.length === 0) throw new Error('No network data found');

        const processedData: NetworkData[] = geojson.features
          .filter(
            (f: any) => f.geometry && f.geometry.coordinates && f.geometry.coordinates.length >= 2
          )
          .map((f: any) => ({
            position: f.geometry.coordinates,
            bssid: f.properties.bssid || 'Unknown',
            ssid: f.properties.ssid || 'Hidden Network',
            signal: f.properties.bestlevel || f.properties.signal || -90,
            level: f.properties.bestlevel || f.properties.signal || -90,
            encryption: f.properties.encryption || 'Unknown',
            channel: f.properties.channel || 0,
            frequency: f.properties.frequency || 0,
            manufacturer: f.properties.manufacturer || 'Unknown',
            device_type: f.properties.device_type || 'Unknown',
            type: f.properties.type || 'W',
            capabilities: f.properties.capabilities || '',
            timestamp: f.properties.first_seen || f.properties.timestamp,
            last_seen: f.properties.last_seen || f.properties.timestamp,
            device_id: f.properties.device_id,
            source_tag: f.properties.source_tag,
            accuracy: f.properties.accuracy,
            altitude: f.properties.altitude,
          }));

        setNetworkData(processedData);
        initDeck(tokenData.token, processedData);
        setLoading(false);
      } catch (err: any) {
        console.error('Error:', err);
        setError(err?.message || 'Failed to initialize visualization');
        setLoading(false);
      }
    };

    setup();
  }, []);

  useEffect(() => {
    updateVisualization();
  }, [networkData, layerType, pointSize, signalThreshold, height3d]);

  useEffect(() => {
    if (deckRef.current) {
      deckRef.current.setProps({
        initialViewState: {
          ...deckRef.current.props.initialViewState,
          pitch: pitch,
        },
      });
    }
  }, [pitch]);

  const filteredCount = networkData.filter((d) => d.signal >= signalThreshold).length;

  return (
    <>
      <div className="min-h-screen text-white relative bg-black">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-50">
            <div className="px-4 py-3 bg-slate-800 rounded-lg border border-slate-700">
              Loading network data…
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900 text-red-100 px-4 py-2 rounded-lg border border-red-700 z-50">
            {error}
          </div>
        )}

        <div ref={mapRef} className="w-full h-screen" />
      </div>

      {/* Controls Panel */}
      <div
        className="text-white rounded-xl max-w-sm space-y-3.5 text-sm"
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.92)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          backdropFilter: 'blur(16px)',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.1)',
          zIndex: 99999,
          position: 'fixed',
          top: '20px',
          left: '20px',
          padding: '20px',
        }}
      >
        <div
          style={{
            borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
            paddingBottom: '14px',
            marginBottom: '6px',
          }}
        >
          <h3
            className="text-xl font-bold"
            style={{
              background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            🛡️ ShadowCheck
          </h3>
          <p className="text-xs text-slate-400 mt-1">Network Visualization</p>
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">Dataset:</label>
          <select
            value={datasetType}
            onChange={(e) => setDatasetType(e.target.value as 'observations' | 'networks')}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
          >
            <option value="observations">
              Observations ({actualCounts ? actualCounts.observations.toLocaleString() : '416K'}{' '}
              raw)
            </option>
            <option value="networks">
              Networks ({actualCounts ? actualCounts.networks.toLocaleString() : '117K'}{' '}
              trilaterated)
            </option>
          </select>
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">3D View - Pitch: {pitch}°</label>
          <input
            type="range"
            min="0"
            max="60"
            value={pitch}
            onChange={(e) => setPitch(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">3D Height: {height3d}</label>
          <input
            type="range"
            min="1"
            max="50"
            value={height3d}
            onChange={(e) => setHeight3d(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">Visualization Type:</label>
          <select
            value={layerType}
            onChange={(e) => setLayerType(e.target.value as LayerType)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
          >
            <option value="scatterplot">Points</option>
            <option value="heatmap">Heatmap</option>
            <option value="hexagon">Hexagon Clusters</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">Point Size: {pointSize}</label>
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={pointSize}
            onChange={(e) => setPointSize(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">Drawing Mode:</label>
          <select
            value={drawMode}
            onChange={(e) => setDrawMode(e.target.value as DrawMode)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
          >
            <option value="none">None</option>
            <option value="rectangle">Rectangle Select</option>
            <option value="polygon">Polygon Select</option>
            <option value="circle">Circle Select</option>
          </select>
        </div>

        <button
          onClick={clearSelection}
          className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs"
        >
          Clear Selection
        </button>

        <div>
          <label className="block mb-1 text-xs text-slate-300">
            Signal Threshold: {signalThreshold} dBm
          </label>
          <input
            type="range"
            min="-100"
            max="-30"
            value={signalThreshold}
            onChange={(e) => setSignalThreshold(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div
          className="text-xs pt-3 mt-2"
          style={{
            borderTop: '1px solid rgba(59, 130, 246, 0.2)',
            background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.05), transparent)',
            padding: '12px',
            margin: '0 -20px -20px -20px',
            borderRadius: '0 0 12px 12px',
          }}
        >
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">DB Total:</span>
              <span className="text-blue-400 font-semibold">
                {actualCounts ? actualCounts.observations.toLocaleString() : 'Loading...'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Rendered:</span>
              <span className="text-blue-400 font-semibold">
                {filteredCount.toLocaleString()} / {networkData.length.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Selected:</span>
              <span className="text-emerald-400 font-semibold">{selectedPoints.length}</span>
            </div>
            <div className="text-slate-500 text-[10px] mt-2 pt-2 border-t border-slate-700/50">
              ⚡ WebGL • 📍 Interactive • 🔥 GPU Accelerated
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Helper functions for tooltip rendering
function interpretWigleType(type: string) {
  const typeMap: Record<string, string> = {
    W: 'WiFi',
    E: 'BLE',
    B: 'Bluetooth',
    L: 'LTE',
    N: '5G NR',
    G: 'GSM',
  };
  if (!type || type === 'Unknown' || type === '') return { name: 'WiFi', code: 'W' };
  const typeCode = type.toString().toUpperCase();
  return { name: typeMap[typeCode] || typeCode || 'Unknown', code: typeCode };
}

function interpretSecurity(capabilities: string, encryption: string) {
  if (!capabilities || capabilities === 'Unknown') {
    if (encryption && encryption !== 'Open/Unknown') return { text: encryption, color: '#fbbf24' };
    return { text: 'Open', color: '#ef4444' };
  }
  if (capabilities.includes('WPA3')) return { text: 'WPA3 (Secure)', color: '#22c55e' };
  if (capabilities.includes('WPA2')) return { text: 'WPA2 (Secure)', color: '#22c55e' };
  if (capabilities.includes('WPA')) return { text: 'WPA (Moderate)', color: '#f59e0b' };
  if (capabilities.includes('WEP')) return { text: 'WEP (Insecure)', color: '#ef4444' };
  return { text: 'Open', color: '#ef4444' };
}

function interpretSignalStrength(signal: number) {
  if (signal > -50) return { color: '#22c55e', text: 'Excellent' };
  if (signal > -60) return { color: '#84cc16', text: 'Good' };
  if (signal > -70) return { color: '#fbbf24', text: 'Fair' };
  if (signal > -80) return { color: '#f97316', text: 'Weak' };
  return { color: '#ef4444', text: 'Very Weak' };
}

function getNetworkIcon(networkType: string) {
  const type = (networkType || 'wifi').toLowerCase();
  if (type.includes('ble') || type.includes('bluetooth') || type === 'b' || type === 'e') {
    return `<svg viewBox="0 0 24 24" fill="#3b82f6" width="18" height="18"><path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/></svg>`;
  }
  if (
    type.includes('cellular') ||
    type.includes('cell') ||
    type.includes('gsm') ||
    type.includes('lte') ||
    type.includes('5g') ||
    type === 'g' ||
    type === 'l' ||
    type === 'n'
  ) {
    return `<svg viewBox="0 0 24 24" fill="#3b82f6" width="18" height="18"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/><circle cx="12" cy="3.5" r=".75"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="#3b82f6" width="18" height="18"><path d="M12 18.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/><path d="M12 14c-1.7 0-3.3.6-4.6 1.8a1 1 0 1 0 1.4 1.4A5 5 0 0 1 12 16a5 5 0 0 1 3.2 1.2 1 1 0 1 0 1.3-1.5A6.9 6.9 0 0 0 12 14z"/><path d="M12 9.5c-3 0-5.8 1.1-8 3.2a1 1 0 1 0 1.4 1.4c1.8-1.8 4.1-2.7 6.6-2.7 2.5 0 4.8.9 6.6 2.7a1 1 0 1 0 1.4-1.4c-2.2-2.1-5.1-3.2-8-3.2z"/></svg>`;
}

export default KeplerTestPage;
