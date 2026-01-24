/**
 * Filter primitive component types
 */
import React from 'react';

export interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  compact?: boolean;
}

export interface FilterInputProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  compact?: boolean;
}
