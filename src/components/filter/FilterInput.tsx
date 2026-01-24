/**
 * Filter input with enable checkbox
 */
import React from 'react';
import type { FilterInputProps } from './types';

export const FilterInput: React.FC<FilterInputProps> = ({
  label,
  enabled,
  onToggle,
  children,
  compact = false,
}) => (
  <div className={`filter-panel__input ${compact ? 'space-y-1.5' : 'space-y-2'}`}>
    <label className={`flex items-center space-x-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
      />
      <span className="filter-panel__label text-slate-300">{label}</span>
    </label>
    {enabled && (
      <div className={`filter-panel__input-body ${compact ? 'ml-5' : 'ml-6'}`}>{children}</div>
    )}
  </div>
);
