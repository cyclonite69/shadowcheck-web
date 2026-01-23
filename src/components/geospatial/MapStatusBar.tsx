import React from 'react';

interface MapStatusBarProps {
  visibleCount: number;
  networkTruncated: boolean;
  networkTotal: number | null;
  selectedCount: number;
  observationCount: number;
  observationsTruncated: boolean;
  observationsTotal: number | null;
  renderBudgetExceeded: boolean;
  renderBudget: number | null;
  loadingNetworks: boolean;
  loadingObservations: boolean;
}

export const MapStatusBar = ({
  visibleCount,
  networkTruncated,
  networkTotal,
  selectedCount,
  observationCount,
  observationsTruncated,
  observationsTotal,
  renderBudgetExceeded,
  renderBudget,
  loadingNetworks,
  loadingObservations,
}: MapStatusBarProps) => {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: '1px solid rgba(71, 85, 105, 0.3)',
        fontSize: '11px',
        color: '#cbd5e1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '0 0 12px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>Visible: {visibleCount}</span>
        {networkTruncated && (
          <span style={{ color: '#fbbf24' }}>
            Networks truncated ({visibleCount}/{networkTotal ?? 'unknown'})
          </span>
        )}
        <span>Selected: {selectedCount}</span>
        <span>Observations: {observationCount}</span>
        {observationsTruncated && (
          <span style={{ color: '#fbbf24' }}>
            Observations truncated ({observationCount}/{observationsTotal ?? 'unknown'})
          </span>
        )}
        {renderBudgetExceeded && (
          <span style={{ color: '#f59e0b' }}>
            Render budget exceeded ({observationsTotal ?? 'unknown'}/{renderBudget ?? 0})
          </span>
        )}
      </div>
      <div style={{ color: '#94a3b8' }}>
        {loadingNetworks
          ? 'Loading networks…'
          : loadingObservations
            ? 'Loading observations…'
            : selectedCount > 0 && observationCount === 0
              ? 'No observations for selection'
              : 'Ready'}
      </div>
    </div>
  );
};
