import React from 'react';

interface CentroidMarkerProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * CentroidMarker: Presentational SVG component for network centroid markers.
 * Rendered as a hollow diamond shape, representing the geometric center of a network's observations.
 */
export const CentroidMarker: React.FC<CentroidMarkerProps> = ({
  size = 24,
  color = '#60a5fa',
  strokeWidth = 2,
  className = '',
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
  >
    <polygon points="12 2 22 12 12 22 2 12" />
  </svg>
);
