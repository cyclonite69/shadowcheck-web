interface WigleObservationsStats {
  wigle_total: number;
  matched: number;
  unique: number;
  our_observations: number;
  max_distance_from_our_sightings_m: number;
}

interface WigleBatchStats {
  total_wigle: number;
  total_matched: number;
  total_unique: number;
  network_count: number;
}

interface WigleObservationsPanelProps {
  bssid: string | null;
  bssids?: string[];
  loading: boolean;
  error: string | null;
  stats: WigleObservationsStats | null;
  batchStats?: WigleBatchStats | null;
  onClose: () => void;
}

export const WigleObservationsPanel = ({
  bssid,
  bssids,
  loading,
  error,
  stats,
  batchStats,
  onClose,
}: WigleObservationsPanelProps) => {
  const isBatchMode = bssids && bssids.length > 1;
  const hasData = bssid || (bssids && bssids.length > 0);

  if (!hasData && !loading) return null;

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '120px',
        left: '320px',
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid #f59e0b',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '240px',
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '12px' }}>
          🌐 WiGLE Crowdsourced Data
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px 6px',
          }}
        >
          ✕
        </button>
      </div>

      {loading && (
        <div style={{ color: '#94a3b8', fontSize: '11px' }}>
          Loading WiGLE observations{isBatchMode ? ` for ${bssids?.length} networks` : ''}...
        </div>
      )}

      {error && <div style={{ color: '#ef4444', fontSize: '11px' }}>{error}</div>}

      {/* Single network mode */}
      {stats && !loading && !isBatchMode && (
        <div style={{ fontSize: '11px', color: '#e2e8f0' }}>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              color: '#94a3b8',
              marginBottom: '6px',
            }}
          >
            {bssid}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto auto',
              gap: '4px 12px',
              marginBottom: '8px',
            }}
          >
            <span style={{ color: '#94a3b8' }}>WiGLE Total:</span>
            <span>{stats.wigle_total}</span>
            <span style={{ color: '#94a3b8' }}>Your Observations:</span>
            <span>{stats.our_observations}</span>
            <span style={{ color: '#22c55e' }}>Matched:</span>
            <span style={{ color: '#22c55e' }}>{stats.matched}</span>
            <span style={{ color: '#f59e0b' }}>WiGLE-Only:</span>
            <span style={{ color: '#f59e0b' }}>{stats.unique}</span>
          </div>

          {stats.max_distance_from_our_sightings_m > 0 && (
            <div
              style={{
                padding: '6px 8px',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '4px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <div style={{ color: '#f59e0b', fontWeight: 500, marginBottom: '2px' }}>
                📍 Farthest WiGLE Sighting
              </div>
              <div style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 600 }}>
                {formatDistance(stats.max_distance_from_our_sightings_m)} away
              </div>
              <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>
                This network was seen far from your observations
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(71, 85, 105, 0.3)',
              fontSize: '10px',
              color: '#64748b',
            }}
          >
            <span style={{ color: '#22c55e' }}>●</span> Green = matches your data
            <br />
            <span style={{ color: '#f59e0b' }}>●</span> Orange = WiGLE-only sightings
          </div>
        </div>
      )}

      {/* Batch mode */}
      {batchStats && !loading && isBatchMode && (
        <div style={{ fontSize: '11px', color: '#e2e8f0' }}>
          <div
            style={{
              fontSize: '10px',
              color: '#94a3b8',
              marginBottom: '6px',
              padding: '4px 6px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: '4px',
            }}
          >
            📊 {batchStats.network_count} networks selected
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto auto',
              gap: '4px 12px',
              marginBottom: '8px',
            }}
          >
            <span style={{ color: '#94a3b8' }}>Total WiGLE Obs:</span>
            <span>{batchStats.total_wigle}</span>
            <span style={{ color: '#22c55e' }}>Matched:</span>
            <span style={{ color: '#22c55e' }}>{batchStats.total_matched}</span>
            <span style={{ color: '#f59e0b' }}>WiGLE-Only:</span>
            <span style={{ color: '#f59e0b' }}>{batchStats.total_unique}</span>
          </div>

          {batchStats.total_unique > 0 && (
            <div
              style={{
                padding: '6px 8px',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '4px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                marginBottom: '8px',
              }}
            >
              <div style={{ color: '#f59e0b', fontWeight: 500 }}>
                {batchStats.total_unique} crowdsourced sightings
              </div>
              <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>
                Locations not in your local data
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(71, 85, 105, 0.3)',
              fontSize: '10px',
              color: '#64748b',
            }}
          >
            <span style={{ color: '#22c55e' }}>●</span> Green = matches your data
            <br />
            <span style={{ color: '#f59e0b' }}>●</span> Orange = WiGLE-only sightings
          </div>
        </div>
      )}
    </div>
  );
};
