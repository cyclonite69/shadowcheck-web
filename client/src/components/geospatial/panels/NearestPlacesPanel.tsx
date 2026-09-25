import React from 'react';
import type { NearestPlaceCluster } from '../../../utils/geospatial/mergeNearestPlaces';
import type { Map as MapboxMap } from 'mapbox-gl';

interface NearestPlacesPanelProps {
  clusters: NearestPlaceCluster[];
  loading: boolean;
  error: string;
  networkCount?: number;
  showAgencies: boolean;
  showCourthouses: boolean;
  mapRef?: React.MutableRefObject<MapboxMap | null>;
}

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: '120px',
  right: '80px',
  background: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgb(100, 116, 139)',
  borderRadius: '12px',
  padding: '16px',
  minWidth: '340px',
  maxWidth: '420px',
  maxHeight: '520px',
  zIndex: 1000,
  backdropFilter: 'blur(8px)',
  overflowY: 'auto',
};

const COURTHOUSE_TYPE_LABEL: Record<string, string> = {
  district_court: '⚖️ District Court',
  circuit_court_of_appeals: '🏛️ Circuit Court of Appeals',
  bankruptcy_court: '📋 Bankruptcy Court',
  magistrate_court: '🔨 Magistrate Court',
  specialty_court: '🔍 Specialty Court',
};

function sourceLabel(hasWigle: boolean, hasLocal: boolean): string {
  if (hasWigle && hasLocal) {
    return 'mixed';
  }
  if (hasWigle) {
    return 'WiGLE';
  }
  return 'local';
}

function flyTo(
  mapRef: React.MutableRefObject<MapboxMap | null> | undefined,
  lat: number,
  lon: number
) {
  if (!mapRef?.current) {
    return;
  }
  mapRef.current.flyTo({
    center: [lon, lat],
    zoom: 13,
    duration: 1200,
    essential: true,
  });
}

export const NearestPlacesPanel: React.FC<NearestPlacesPanelProps> = ({
  clusters,
  loading,
  error,
  networkCount = 1,
  showAgencies,
  showCourthouses,
  mapRef,
}) => {
  const title =
    showAgencies && showCourthouses
      ? 'Nearest Places'
      : showAgencies
        ? 'Nearest Agencies'
        : 'Nearest Courthouses';

  // Empty / no-selection state
  if (clusters.length === 0 && !loading && !error) {
    if (networkCount === 0) {
      return (
        <div style={{ ...PANEL_STYLE, maxHeight: undefined }}>
          <h2 className="text-lg font-semibold mb-2">{title}</h2>
          <p className="text-sm text-slate-500">
            Select networks to find nearby{' '}
            {showAgencies && showCourthouses
              ? 'agencies and courthouses'
              : showAgencies
                ? 'agencies'
                : 'courthouses'}
          </p>
        </div>
      );
    }
    return null;
  }

  const multiCluster = clusters.length > 1;

  return (
    <div style={PANEL_STYLE}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {multiCluster && (
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
            {clusters.length} clusters
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-3">
        {networkCount > 1
          ? `Nearest per observation cluster · ${networkCount} selected`
          : 'Nearest to observation points'}
      </p>

      {loading && <p className="text-slate-400 text-sm">Loading…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="space-y-4">
        {clusters.map((cluster, idx) => (
          <div key={cluster.key}>
            {/* Cluster header */}
            {multiCluster && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Cluster {idx + 1}
                </span>
                {cluster.observationCount !== null && (
                  <span className="text-xs text-slate-500">
                    {cluster.observationCount} obs ·{' '}
                    {sourceLabel(cluster.hasWigleObs, cluster.hasLocalObs)}
                  </span>
                )}
                {cluster.clusterLat !== null && cluster.clusterLon !== null && (
                  <button
                    className="text-xs text-slate-500 hover:text-blue-400 underline transition-colors ml-auto"
                    onClick={() => flyTo(mapRef, cluster.clusterLat!, cluster.clusterLon!)}
                    title="Fly to cluster centroid"
                  >
                    📍 centroid
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              {/* Agency row */}
              {showAgencies && cluster.agency && (
                <button
                  className="w-full text-left p-3 rounded border bg-slate-800/70 border-slate-700 hover:border-blue-500/50 hover:bg-slate-800 transition-colors group"
                  onClick={() =>
                    flyTo(mapRef, cluster.agency!.latitude!, cluster.agency!.longitude!)
                  }
                  title={`Fly to ${cluster.agency.name}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-200 truncate group-hover:text-blue-300 transition-colors">
                        {cluster.agency.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {cluster.agency.office_type === 'field_office'
                          ? '🏢 Field Office'
                          : '📍 Resident Agency'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {cluster.agency.city}, {cluster.agency.state} {cluster.agency.postal_code}
                      </div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <div className="text-sm font-semibold text-blue-400">
                        {((cluster.agency.distance_meters || 0) / 1000).toFixed(1)} km
                      </div>
                      {cluster.agency.has_wigle_obs && (
                        <div className="text-xs text-red-400 mt-0.5">WiGLE</div>
                      )}
                      <div className="text-xs text-slate-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        ✈ fly to
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Agency — no match */}
              {showAgencies && !cluster.agency && !loading && (
                <div className="p-2 rounded border border-slate-800/50 bg-slate-900/30 text-xs text-slate-500">
                  🏢 No agency within radius
                </div>
              )}

              {/* Courthouse row */}
              {showCourthouses && cluster.courthouse && (
                <button
                  className="w-full text-left p-3 rounded border bg-slate-800/70 border-slate-700 hover:border-amber-500/50 hover:bg-slate-800 transition-colors group"
                  onClick={() =>
                    flyTo(mapRef, cluster.courthouse!.latitude!, cluster.courthouse!.longitude!)
                  }
                  title={`Fly to ${cluster.courthouse.name}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-200 truncate group-hover:text-amber-300 transition-colors">
                        {cluster.courthouse.short_name || cluster.courthouse.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {cluster.courthouse.courthouse_type
                          ? (COURTHOUSE_TYPE_LABEL[cluster.courthouse.courthouse_type] ??
                            cluster.courthouse.courthouse_type)
                          : 'Courthouse'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {cluster.courthouse.district}
                      </div>
                      <div className="text-xs text-slate-500">
                        {cluster.courthouse.city}, {cluster.courthouse.state}{' '}
                        {cluster.courthouse.postal_code}
                      </div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <div className="text-sm font-semibold text-amber-400">
                        {((cluster.courthouse.distance_meters || 0) / 1000).toFixed(1)} km
                      </div>
                      {cluster.courthouse.has_wigle_obs && (
                        <div className="text-xs text-red-400 mt-0.5">WiGLE</div>
                      )}
                      <div className="text-xs text-slate-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        ✈ fly to
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Courthouse — no match */}
              {showCourthouses && !cluster.courthouse && !loading && (
                <div className="p-2 rounded border border-slate-800/50 bg-slate-900/30 text-xs text-slate-500">
                  ⚖️ No courthouse within radius
                </div>
              )}
            </div>
          </div>
        ))}

        {clusters.length === 0 && !loading && !error && (
          <p className="text-slate-500 text-sm">No results found nearby</p>
        )}
      </div>
    </div>
  );
};
