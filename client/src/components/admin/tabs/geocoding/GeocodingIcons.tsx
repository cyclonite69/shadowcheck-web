import React from 'react';

export const MapIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
    <path d="M9 4v14" />
    <path d="M15 6v14" />
  </svg>
);

export const SparkIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2z" />
  </svg>
);

export const ClockIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);
