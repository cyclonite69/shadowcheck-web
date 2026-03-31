import React from 'react';
import type { MarkerProps } from './types';

/**
 * CentroidMarker: Presentational SVG component for network centroid markers.
 * Rendered as a hollow diamond shape with strong stroke, representing the
 * geometric center of a network's observations.
 *
 * Note: When centroid and weighted markers overlap (same screen position),
 * they receive a subtle pixel offset applied by the map renderer to remain visible.
 */
export const CentroidMarker: React.FC<MarkerProps> = ({
  size = 28,
  color = '#60a5fa',
  strokeWidth = 2.5,
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
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Hollow diamond: larger and more pronounced */}
    <polygon points="12 1 23 12 12 23 1 12" />
  </svg>
);
