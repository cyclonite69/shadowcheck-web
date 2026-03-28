import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';

type DashboardMetrics = {
  threats: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  networks: {
    total: number;
    wifi: number;
    ble: number;
    bluetooth: number;
    lte: number;
    nr: number;
    gsm: number;
  };
  observations: {
    total: number;
    wifi: number;
    ble: number;
    bluetooth: number;
    lte: number;
    nr: number;
    gsm: number;
  };
  activeSurveillance: number;
  timestamp?: string;
};

type DashboardSummary = {
  summary: {
    totalNetworks: number;
    totalThreats: number;
    criticalThreats: number;
    activeSurveillance: number;
  };
  timestamp?: string;
};

type IconProps = {
  className?: string;
};

const ActivityIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const AlertTriangleIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m10.29 3.86-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.71-3.14l-8-14a2 2 0 0 0-3.42 0Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ChartIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18" />
    <path d="m19 9-5 5-4-4-3 3" />
  </svg>
);

const RadioIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.48" />
    <path d="M7.76 16.24a6 6 0 0 1 0-8.48" />
    <path d="M18.95 5.05a10 10 0 0 1 0 13.9" />
    <path d="M5.05 18.95a10 10 0 0 1 0-13.9" />
  </svg>
);

const ShieldIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2 4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" />
  </svg>
);

const WifiIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const BluetoothIcon = ({ className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m7 7 10 10-5 5V2l5 5L7 17" />
  </svg>
);

function formatInt(value: number | undefined): string {
  return (value ?? 0).toLocaleString();
}

export default function StartPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [metricsData, summaryData] = await Promise.all([
          apiClient.get<DashboardMetrics>('/dashboard/metrics'),
          apiClient.get<DashboardSummary>('/dashboard/summary'),
        ]);
        if (!cancelled) {
          setMetrics(metricsData);
          setSummary(summaryData);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load live metrics');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(() => {
    const totalThreats =
      summary?.summary?.totalThreats ??
      (metrics?.threats.critical || 0) +
        (metrics?.threats.high || 0) +
        (metrics?.threats.medium || 0) +
        (metrics?.threats.low || 0);

    return [
      {
        label: 'Total Networks',
        value: summary?.summary?.totalNetworks ?? metrics?.networks.total ?? 0,
        icon: WifiIcon,
        color: 'text-cyan-300',
      },
      {
        label: 'Total Observations',
        value: metrics?.observations.total ?? 0,
        icon: ActivityIcon,
        color: 'text-blue-300',
      },
      {
        label: 'Critical Threats',
        value: summary?.summary?.criticalThreats ?? metrics?.threats.critical ?? 0,
        icon: AlertTriangleIcon,
        color: 'text-red-300',
      },
      {
        label: 'All Threats',
        value: totalThreats,
        icon: ShieldIcon,
        color: 'text-amber-300',
      },
      {
        label: 'Active Surveillance',
        value: summary?.summary?.activeSurveillance ?? metrics?.activeSurveillance ?? 0,
        icon: RadioIcon,
        color: 'text-violet-300',
      },
      {
        label: 'WiFi Networks',
        value: metrics?.networks.wifi ?? 0,
        icon: ChartIcon,
        color: 'text-emerald-300',
      },
    ];
  }, [metrics, summary]);

  return (
    <div className="relative w-full h-screen overflow-y-auto bg-slate-950 text-slate-100">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-28 left-24 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-12 left-1/2 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-8 py-24">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">
            ShadowCheck Case Study
          </p>
          <h1 className="text-5xl font-semibold leading-tight mb-4">Live Intelligence Snapshot</h1>
          <p className="text-slate-300 max-w-3xl text-lg">
            This page reflects current metrics directly from the active ShadowCheck database. Use it
            as the lead-in before diving into full dashboard and geospatial analysis.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <a
            href="/dashboard"
            className="px-4 py-2 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            Open Dashboard
          </a>
          <a
            href="/geospatial-explorer"
            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors"
          >
            Open Geospatial Explorer
          </a>
          <a
            href="/wigle"
            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors"
          >
            Open WiGLE
          </a>
        </div>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">
            Project Resources
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://dbcoopers-briefcase-161020170158.s3.us-east-1.amazonaws.com/demo-assets/Deconstructing_ShadowCheck.mp4"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors"
            >
              Watch Video Demo
            </a>
            <a
              href="https://dbcoopers-briefcase-161020170158.s3.us-east-1.amazonaws.com/demo-assets/ShadowCheck_and_the_invisible_wireless_fog.m4a"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors"
            >
              Listen to Audio Overview
            </a>
            <a
              href="https://dbcoopers-briefcase-161020170158.s3.us-east-1.amazonaws.com/demo-assets/ShadowCheck_SIGINT_Forensics.pptx"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors"
            >
              Download Presentation
            </a>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
            Loading live metrics...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-900/70 bg-red-950/40 p-6 text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur p-5"
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-slate-400 text-sm">{card.label}</p>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <p className={`mt-3 text-3xl font-semibold ${card.color}`}>
                      {formatInt(card.value)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <h2 className="text-lg font-semibold mb-4">Radio Breakdown (Networks)</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">WiFi</span>
                    <span className="text-cyan-300 font-semibold">
                      {formatInt(metrics?.networks.wifi)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">BLE</span>
                    <span className="text-blue-300 font-semibold">
                      {formatInt(metrics?.networks.ble)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Bluetooth</span>
                    <span className="text-violet-300 font-semibold">
                      {formatInt(metrics?.networks.bluetooth)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">LTE</span>
                    <span className="text-emerald-300 font-semibold">
                      {formatInt(metrics?.networks.lte)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">NR</span>
                    <span className="text-amber-300 font-semibold">
                      {formatInt(metrics?.networks.nr)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">GSM</span>
                    <span className="text-rose-300 font-semibold">
                      {formatInt(metrics?.networks.gsm)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <h2 className="text-lg font-semibold mb-4">Threat Distribution</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Critical</span>
                    <span className="text-red-300 font-semibold">
                      {formatInt(metrics?.threats.critical)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">High</span>
                    <span className="text-orange-300 font-semibold">
                      {formatInt(metrics?.threats.high)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Medium</span>
                    <span className="text-yellow-300 font-semibold">
                      {formatInt(metrics?.threats.medium)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Low</span>
                    <span className="text-green-300 font-semibold">
                      {formatInt(metrics?.threats.low)}
                    </span>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <BluetoothIcon className="w-4 h-4" />
                  Last updated:{' '}
                  {summary?.timestamp || metrics?.timestamp
                    ? new Date(summary?.timestamp || metrics?.timestamp || '').toLocaleString()
                    : 'Unknown'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
