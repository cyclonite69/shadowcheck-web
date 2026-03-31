import React from 'react';
import type { MarkerProps } from './types';

/**
 * WeightedMarker: Presentational SVG component for network weighted average markers.
 * Rendered as a hollow triangle pointing up with strong stroke, representing the
 * weighted average position of a network's observations.
 *
 * Note: When centroid and weighted markers overlap (same screen position),
 * they receive a subtle pixel offset applied by the map renderer to remain visible.
 */
export const WeightedMarker: React.FC<MarkerProps> = ({
  size = 28,
  color = '#34d399',
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
    {/* Hollow triangle pointing up: larger and more pronounced */}
    <polygon points="12 1 23 22 1 22" />
  </svg>
);
