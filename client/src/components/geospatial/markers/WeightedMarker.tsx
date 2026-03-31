import React from 'react';

interface WeightedMarkerProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * WeightedMarker: Presentational SVG component for network weighted average markers.
 * Rendered as a hollow triangle (pointing up), representing the weighted average position of a network's observations.
 */
export const WeightedMarker: React.FC<WeightedMarkerProps> = ({
  size = 24,
  color = '#34d399',
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
    <polygon points="12 2 22 20 2 20" />
  </svg>
);
