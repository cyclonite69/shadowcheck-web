import React from 'react';
import { CentroidMarker, WeightedMarker } from './markers';

interface GeospatialMarkerLegendProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * GeospatialMarkerLegend: Presentational legend component for map marker types.
 * Shows the visual representation and labels for observation, centroid, and weighted markers.
 *
 * This is a static, reusable component. Currently not wired into the map UI.
 * Future: Can be integrated into MapHeader, a collapsible legend panel, or an info drawer.
 */
export const GeospatialMarkerLegend: React.FC<GeospatialMarkerLegendProps> = ({
  className = '',
  style = {},
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: '16px',
        padding: '8px 12px',
        fontSize: '11px',
        ...style,
      }}
    >
      {/* Observation Marker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={16}
          height={16}
          fill="none"
          style={{
            flexShrink: 0,
          }}
        >
          <circle cx="12" cy="12" r="7" fill="#60a5fa" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
        <span style={{ color: '#cbd5e1' }}>Observation</span>
      </div>

      {/* Centroid Marker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CentroidMarker size={16} color="#60a5fa" strokeWidth={1.5} />
        </div>
        <span style={{ color: '#cbd5e1' }}>Centroid</span>
      </div>

      {/* Weighted Marker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <WeightedMarker size={16} color="#34d399" strokeWidth={1.5} />
        </div>
        <span style={{ color: '#cbd5e1' }}>Weighted</span>
      </div>
    </div>
  );
};
