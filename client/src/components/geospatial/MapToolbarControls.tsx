interface ViewControlsProps {
  onToggle3DBuildings: () => void;
  is3DBuildingsAvailable: boolean;
  show3DBuildings: boolean;
  onToggleTerrain: () => void;
  showTerrain: boolean;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

export const ViewControls = ({
  onToggle3DBuildings,
  is3DBuildingsAvailable,
  show3DBuildings,
  onToggleTerrain,
  showTerrain,
}: ViewControlsProps) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: '7px',
        padding: '3px',
        gap: '2px',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onToggle3DBuildings}
        disabled={!is3DBuildingsAvailable}
        title={
          is3DBuildingsAvailable
            ? 'Show/hide 3D building extrusions on the map'
            : '3D buildings unavailable for this map style'
        }
        style={{
          height: '26px',
          padding: '0 10px',
          borderRadius: '5px',
          border: show3DBuildings ? '0.5px solid rgba(59,130,246,0.25)' : 'none',
          fontSize: '11px',
          ...mono,
          letterSpacing: '0.05em',
          cursor: is3DBuildingsAvailable ? 'pointer' : 'not-allowed',
          background: show3DBuildings ? 'rgba(59,130,246,0.15)' : 'transparent',
          color: !is3DBuildingsAvailable
            ? '#64748b'
            : show3DBuildings
              ? '#60a5fa'
              : 'var(--nav-text-inactive)',
          opacity: is3DBuildingsAvailable ? 1 : 0.65,
        }}
      >
        3D
      </button>
      <button
        onClick={onToggleTerrain}
        title="Show/hide terrain elevation on the map"
        style={{
          height: '26px',
          padding: '0 10px',
          borderRadius: '5px',
          border: showTerrain ? '0.5px solid rgba(59,130,246,0.25)' : 'none',
          fontSize: '11px',
          ...mono,
          letterSpacing: '0.05em',
          cursor: 'pointer',
          background: showTerrain ? 'rgba(59,130,246,0.15)' : 'transparent',
          color: showTerrain ? '#60a5fa' : 'var(--nav-text-inactive)',
        }}
      >
        Terrain
      </button>
    </div>
  );
};

interface OverlayTogglesProps {
  onToggleNetworkSummaries?: (value: boolean) => void;
  showNetworkSummaries: boolean;
  onWigle?: () => void;
  canWigle?: boolean;
  wigleLoading?: boolean;
  wigleActive?: boolean;
  selectedCount?: number;
}

export const OverlayToggles = ({
  onToggleNetworkSummaries,
  showNetworkSummaries,
  onWigle,
  canWigle,
  wigleLoading,
  wigleActive,
  selectedCount,
}: OverlayTogglesProps) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => onToggleNetworkSummaries?.(!showNetworkSummaries)}
        title="Show/hide marker overlays for network summary positions: centroids (◊) represent the geometric center, weighted markers (▲) represent the signal-weighted average location"
        style={{
          height: '30px',
          padding: '0 10px',
          borderRadius: '6px',
          border: 'none',
          fontSize: '11px',
          ...mono,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          background: showNetworkSummaries ? 'rgba(59,130,246,0.10)' : 'transparent',
          color: showNetworkSummaries ? '#60a5fa' : 'var(--nav-text-inactive)',
        }}
      >
        <span className="hidden-narrow">Markers</span>
      </button>
      {onWigle && (
        <button
          onClick={onWigle}
          disabled={!canWigle || wigleLoading}
          title={
            wigleLoading
              ? 'Loading WiGLE data...'
              : canWigle
                ? 'Fetch and display observations from WiGLE API for selected networks'
                : 'Select networks to fetch WiGLE observations'
          }
          style={{
            height: '30px',
            padding: '0 10px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '11px',
            ...mono,
            letterSpacing: '0.04em',
            cursor: canWigle && !wigleLoading ? 'pointer' : 'not-allowed',
            background: wigleActive ? 'rgba(59,130,246,0.10)' : 'transparent',
            color: wigleActive ? '#60a5fa' : 'var(--nav-text-inactive)',
            opacity: canWigle ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {wigleLoading ? 'Loading...' : 'WIGLE'}
          {!wigleLoading && selectedCount != null && selectedCount > 0 && (
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'rgba(59,130,246,0.2)',
                color: '#60a5fa',
                marginLeft: '5px',
              }}
            >
              {selectedCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
};
