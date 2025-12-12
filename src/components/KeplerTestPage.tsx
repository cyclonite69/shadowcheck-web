import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    deck?: any;
    mapboxgl?: any;
  }
}

type ThreatPoint = {
  bssid: string;
  ssid: string;
  severity: string;
  threat_score: number | null;
  first_seen: string | null;
  last_seen: string | null;
  lat: number | null;
  lon: number | null;
  observation_count: number | null;
};

type ObservationPoint = {
  bssid: string;
  severity: string;
  observed_at: string;
  ts?: number;
  lat: number | null;
  lon: number | null;
  rssi: number | null;
  device_code: string | null;
};

type ThreatMapResponse = {
  threats: ThreatPoint[];
  observations: ObservationPoint[];
  meta: {
    severity: string;
    days: number;
    threat_count: number;
    observation_count: number;
  };
};

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
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

const severityPalette: Record<string, [number, number, number]> = {
  critical: [239, 68, 68],
  high: [249, 115, 22],
  medium: [234, 179, 8],
  low: [52, 211, 153],
};

const defaultColor: [number, number, number] = [96, 165, 250];

const hashColor = (key: string): [number, number, number] => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const r = (hash & 0xff0000) >> 16;
  const g = (hash & 0x00ff00) >> 8;
  const b = hash & 0x0000ff;
  return [Math.abs(r % 256), Math.abs(g % 256), Math.abs(b % 256)];
};

const KeplerTestPage: React.FC = () => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<any>(null);
  const tokenRef = useRef<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [showObservations, setShowObservations] = useState<boolean>(true);
  const [days, setDays] = useState<number>(30);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [trailHours, setTrailHours] = useState<number>(24);
  const [playing, setPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [timeBounds, setTimeBounds] = useState<{ min: number; max: number }>({ min: Date.now(), max: Date.now() });
  const [stats, setStats] = useState<{ threats: number; observations: number }>({
    threats: 0,
    observations: 0,
  });
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const threatsRef = useRef<ThreatPoint[]>([]);
  const observationsRef = useRef<ObservationPoint[]>([]);

  const initDeck = (token: string, center: { lon: number; lat: number }) => {
    if (!window.deck || !window.mapboxgl || !mapRef.current) return;
    const { DeckGL } = window.deck;
    deckRef.current = new DeckGL({
      container: mapRef.current,
      mapboxAccessToken: token,
      // keep legacy prop for older builds
      mapboxApiAccessToken: token,
      mapStyle: 'mapbox://styles/mapbox/dark-v11',
      initialViewState: {
        longitude: center.lon,
        latitude: center.lat,
        zoom: 11,
        pitch: 30,
        bearing: 0,
      },
      controller: true,
      getTooltip: ({ object }: { object: any }) =>
        object && {
          html: `<div style="font-size:12px;">
            <strong>${object.ssid || '(hidden)'}</strong><br/>
            ${object.bssid || ''}<br/>
            ${object.severity ? object.severity.toUpperCase() : ''}${
              object.threat_score ? ` • score ${object.threat_score.toFixed(2)}` : ''
            }${object.observed_at ? `<br/>${new Date(object.observed_at).toLocaleString()}` : ''}${
              object.rssi || object.rssi === 0 ? `<br/>${object.rssi} dBm` : ''
            }
          </div>`,
        },
    });
  };

  const fetchThreatData = async (daysWindow: number, severity: string, init: boolean) => {
    try {
      setRefreshing(!init);
      const res = await fetch(`/api/v2/threats/map?days=${daysWindow}&severity=${severity}`);
      const payload: ThreatMapResponse = await res.json();

      threatsRef.current = payload.threats || [];
      observationsRef.current = (payload.observations || []).map((o) => ({
        ...o,
        ts: o.observed_at ? new Date(o.observed_at).getTime() : undefined,
      }));

      const validThreats = threatsRef.current.filter((t) => t.lat !== null && t.lon !== null);
      const center =
        validThreats.length > 0
          ? {
              lon: validThreats.reduce((sum, t) => sum + (t.lon || 0), 0) / validThreats.length,
              lat: validThreats.reduce((sum, t) => sum + (t.lat || 0), 0) / validThreats.length,
            }
          : { lon: -83.6968, lat: 43.0234 };

      if (observationsRef.current.length > 0) {
        const times = observationsRef.current
          .map((o) => o.ts)
          .filter((t): t is number => typeof t === 'number')
          .sort((a, b) => a - b);
        if (times.length > 0) {
          setTimeBounds({ min: times[0], max: times[times.length - 1] });
          setCurrentTime(times[times.length - 1]);
        }
      }

      if (init || !deckRef.current) {
        initDeck(tokenRef.current, center);
      } else {
        deckRef.current.setProps({
          viewState: { ...deckRef.current.props.viewState, longitude: center.lon, latitude: center.lat },
        });
      }

      updateLayers();
    } catch (e: any) {
      setError(e?.message || 'Failed to load threat map data');
    } finally {
      setRefreshing(false);
    }
  };

  const updateLayers = () => {
    if (!deckRef.current || !window.deck) return;
    const severityFiltered =
      severityFilter === 'all'
        ? threatsRef.current
        : threatsRef.current.filter((t) => t.severity === severityFilter);

    const obsFiltered =
      severityFilter === 'all'
        ? observationsRef.current
        : observationsRef.current.filter((o) => o.severity === severityFilter);

    const cutoff = currentTime;
    const windowMs = trailHours * 60 * 60 * 1000;
    const obsTimeFiltered = obsFiltered.filter(
      (o) => typeof o.ts === 'number' && o.ts <= cutoff && o.ts >= cutoff - windowMs
    );

    setStats({ threats: severityFiltered.length, observations: obsTimeFiltered.length });

    const threatLayer = new window.deck.ScatterplotLayer({
      id: 'threats',
      data: severityFiltered.filter((t) => t.lat !== null && t.lon !== null),
      pickable: true,
      getPosition: (d: ThreatPoint) => [d.lon, d.lat],
      getRadius: (d: ThreatPoint) => Math.max(30, (d.threat_score || 0.1) * 120),
      radiusMinPixels: 4,
      radiusMaxPixels: 80,
      getFillColor: (d: ThreatPoint) => [...(severityPalette[d.severity] || defaultColor), 200],
      getLineColor: (d: ThreatPoint) => [...(severityPalette[d.severity] || defaultColor), 255],
      lineWidthMinPixels: 1.5,
    });

    const observationLayer =
      showObservations &&
      new window.deck.ScatterplotLayer({
        id: 'observations',
        data: obsTimeFiltered.filter((o) => o.lat !== null && o.lon !== null),
        pickable: true,
        opacity: 0.4,
        getPosition: (d: ObservationPoint) => [d.lon, d.lat],
        getRadius: 12,
        radiusMinPixels: 2,
        radiusMaxPixels: 20,
        getFillColor: (d: ObservationPoint) => [...hashColor(d.bssid || 'obs'), 160],
      });

    const trailsData = obsTimeFiltered.reduce<Record<string, Array<[number, number]>>>((acc, cur) => {
      if (cur.lat === null || cur.lon === null) return acc;
      if (!acc[cur.bssid]) acc[cur.bssid] = [];
      acc[cur.bssid].push([cur.lon, cur.lat]);
      return acc;
    }, {});

    const trailLayer =
      showObservations &&
      new window.deck.PathLayer({
        id: 'trails',
        data: Object.entries(trailsData).map(([bssid, path]) => ({ bssid, path })),
        getPath: (d: any) => d.path,
        getColor: (d: any) => [...hashColor(d.bssid), 180],
        widthScale: 4,
        widthMinPixels: 2,
        opacity: 0.35,
      });

    const layers = [threatLayer, observationLayer, trailLayer].filter(Boolean);

    deckRef.current.setProps({
      layers,
    });
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

        const tokenRes = await fetch('/api/mapbox-token');
        const tokenData = await tokenRes.json();
        tokenRef.current = tokenData.token;
        await fetchThreatData(days, severityFilter, true);
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to initialize visualization');
        setLoading(false);
      }
    };
    setup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tokenRef.current) {
      fetchThreatData(days, severityFilter, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, severityFilter]);

  useEffect(() => {
    updateLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showObservations, currentTime, trailHours]);

  // Playback loop
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 1000 * 30; // advance 30s per tick
        if (next > timeBounds.max) {
          return timeBounds.min;
        }
        return next;
      });
    }, 400);
    return () => clearInterval(id);
  }, [playing, timeBounds]);

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.08), transparent 25%), radial-gradient(circle at 80% 0%, rgba(16,185,129,0.06), transparent 20%), linear-gradient(135deg, #0a1525 0%, #0d1c31 40%, #0a1424 100%)',
      }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-50">
          <div className="px-4 py-3 bg-slate-800 rounded-lg border border-slate-700">Loading network data…</div>
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900 text-red-100 px-4 py-2 rounded-lg border border-red-700 z-50">
          {error}
        </div>
      )}

      <div ref={mapRef} id="kepler-map" className="w-full h-screen min-h-[600px]" />

      <div className="absolute top-4 left-4 z-40 bg-slate-900/90 border border-slate-700 rounded-lg p-4 w-80 space-y-3 text-sm shadow-2xl">
        <h3 className="text-lg font-semibold">🛡️ Threat Map (Kepler)</h3>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-slate-300">Severity</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showObservations}
              onChange={(e) => setShowObservations(e.target.checked)}
            />
            <span className="text-slate-300">Show observations</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-300">Window: last {days} days</span>
            <input
              type="range"
              min={1}
              max={180}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
            />
          </label>
          <div className="text-xs text-slate-400">
            {stats.threats} threats • {stats.observations} observations
            {refreshing && <span className="ml-2 text-blue-300">Refreshing…</span>}
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 border border-slate-700 rounded-lg px-4 py-3 w-[640px] max-w-full shadow-2xl text-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-200">Time playback</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <span className="text-slate-400">
              {new Date(currentTime).toLocaleString()}
            </span>
          </div>
        </div>
        <input
          type="range"
          min={timeBounds.min}
          max={timeBounds.max}
          value={currentTime}
          onChange={(e) => setCurrentTime(parseInt(e.target.value, 10))}
          className="w-full"
        />
        <div className="flex items-center justify-between mt-3 gap-4">
          <label className="flex flex-col gap-1 w-48">
            <span className="text-slate-300">Trail window (hours): {trailHours}</span>
            <input
              type="range"
              min={1}
              max={168}
              value={trailHours}
              onChange={(e) => setTrailHours(parseInt(e.target.value, 10))}
            />
          </label>
          <div className="text-xs text-slate-400">
            From {new Date(timeBounds.min).toLocaleString()} to {new Date(timeBounds.max).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeplerTestPage;
