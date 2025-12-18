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

  // Controls
  const [layerType, setLayerType] = useState<LayerType>('scatterplot');
  const [pointSize, setPointSize] = useState<number>(2);
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
      getTooltip: ({ object }: { object: any }) =>
        object && {
          html: `
            <div style="background: rgba(15, 23, 42, 0.95); color: #f8fafc; padding: 15px; border-radius: 8px; max-width: 380px; font-size: 11px; border: 1px solid rgba(148, 163, 184, 0.2);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <svg viewBox="0 0 24 24" fill="#22d3ee" width="16" height="16"><path d="M12 18.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/><path d="M12 14c-1.7 0-3.3.6-4.6 1.8a1 1 0 1 0 1.4 1.4A5 5 0 0 1 12 16a5 5 0 0 1 3.2 1.2 1 1 0 1 0 1.3-1.5A6.9 6.9 0 0 0 12 14z"/></svg>
                <span style="color: #22d3ee; font-weight: bold; font-size: 15px;">${object.ssid || 'Hidden Network'}</span>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                <div><span style="color: #94a3b8; font-size: 10px;">BSSID</span><br><span style="font-family: monospace; font-size: 10px;">${object.bssid}</span></div>
                <div><span style="color: #94a3b8; font-size: 10px;">Signal</span><br><span style="color: ${object.bestlevel > -50 ? '#22c55e' : object.bestlevel > -70 ? '#fbbf24' : '#ef4444'};">${object.bestlevel || 0} dBm</span></div>
                <div><span style="color: #94a3b8; font-size: 10px;">Device</span><br>${object.device_id || 'Unknown'}</div>
                <div><span style="color: #94a3b8; font-size: 10px;">Source</span><br>${object.source_tag || 'Unknown'}</div>
              </div>
              
              <div style="border-top: 1px solid rgba(148, 163, 184, 0.2); padding-top: 8px;">
                <div style="margin-bottom: 4px;"><span style="color: #94a3b8;">Coordinates:</span> <span style="font-family: monospace; font-size: 10px;">${object.position ? object.position[1].toFixed(6) + ', ' + object.position[0].toFixed(6) : 'Unknown'}</span></div>
                ${object.first_seen ? `<div style="margin-bottom: 4px;"><span style="color: #94a3b8;">Observed:</span> <span style="color: #e2e8f0;">${new Date(object.first_seen).toLocaleString()}</span></div>` : ''}
                ${object.altitude ? `<div><span style="color: #94a3b8;">Altitude:</span> ${object.altitude}m</div>` : ''}
              </div>
            </div>
          `,
          style: { backgroundColor: 'transparent', fontSize: '12px' },
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
          fetch('/api/kepler/observations'),
        ]);

        const tokenData = await tokenRes.json();
        const geojson = await dataRes.json();

        if (geojson.error) throw new Error(`API Error: ${geojson.error}`);
        if (!geojson.features || !Array.isArray(geojson.features))
          throw new Error(`Invalid data format`);
        if (geojson.features.length === 0) throw new Error('No network data found');

        const processedData: NetworkData[] = geojson.features.map((f: any) => ({
          position: f.geometry.coordinates,
          bssid: f.properties.bssid,
          ssid: f.properties.ssid,
          signal: f.properties.bestlevel || 0,
          level: f.properties.bestlevel || 0,
          encryption: f.properties.encryption,
          channel: f.properties.channel,
          frequency: f.properties.frequency,
          manufacturer: f.properties.manufacturer,
          device_type: f.properties.device_type,
          type: f.properties.type,
          capabilities: f.properties.capabilities,
          timestamp: f.properties.first_seen,
          last_seen: f.properties.last_seen,
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
        className="text-white p-4 rounded-lg max-w-xs space-y-3 text-sm shadow-2xl"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          backdropFilter: 'blur(12px)',
          zIndex: 99999,
          position: 'fixed',
          top: '16px',
          left: '16px',
        }}
      >
        <h3 className="text-lg font-semibold text-blue-400">🛡️ ShadowCheck Networks</h3>

        <div>
          <label className="block mb-1 text-xs text-slate-300">Dataset:</label>
          <select
            value={datasetType}
            onChange={(e) => setDatasetType(e.target.value as 'observations' | 'networks')}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
          >
            <option value="observations">Observations (416K raw)</option>
            <option value="networks">Networks (117K trilaterated)</option>
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
            min="0.5"
            max="20"
            step="0.5"
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

        <div className="text-xs text-slate-400 pt-2 border-t border-slate-700">
          📊 {filteredCount.toLocaleString()} / {networkData.length.toLocaleString()} networks
          <br />
          🔥 FULL DATASET - GPU BEAST MODE
          <br />
          🎯 Selected: {selectedPoints.length} networks
          <br />
          📍 Interactive tooltips & selection
          <br />⚡ WebGL performance at scale
        </div>
      </div>
    </>
  );
};

export default KeplerTestPage;
