/**
 * Time Range Filters Section
 */

import React from 'react';
import { FilterSection, FilterInput } from '../../filter';
import { NetworkFilters, TemporalScope } from '../../../types/filters';

interface TimeFiltersProps {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  isCompact: boolean;
  controlClass: string;
  onSetFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  onEnableFilter: (key: keyof NetworkFilters, enabled: boolean) => void;
}

export const TimeFilters: React.FC<TimeFiltersProps> = ({
  filters,
  enabled,
  isCompact,
  controlClass,
  onSetFilter,
  onEnableFilter,
}) => {
  return (
    <FilterSection title="Time Range" compact={isCompact}>
      <FilterInput
        label="Timeframe"
        enabled={enabled.timeframe || false}
        onToggle={() => {
          const next = !enabled.timeframe;
          onEnableFilter('timeframe', next);
          onEnableFilter('temporalScope', next);
        }}
        compact={isCompact}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="temporal-scope-select" className="text-xs text-slate-400">
              Temporal Scope
            </label>
            <select
              id="temporal-scope-select"
              value={filters.temporalScope || TemporalScope.OBSERVATION_TIME}
              onChange={(e) => onSetFilter('temporalScope', e.target.value as TemporalScope)}
              className={`${controlClass} mt-1`}
            >
              <option value={TemporalScope.OBSERVATION_TIME}>Observation Time</option>
              <option value={TemporalScope.NETWORK_LIFETIME}>Network Lifetime</option>
              <option value={TemporalScope.THREAT_WINDOW}>Threat Window</option>
            </select>
          </div>

          <div>
            <label htmlFor="timeframe-mode-select" className="text-xs text-slate-400">
              Mode
            </label>
            <select
              id="timeframe-mode-select"
              value={filters.timeframe?.type || 'relative'}
              onChange={(e) =>
                onSetFilter('timeframe', {
                  ...(filters.timeframe || {}),
                  type: e.target.value as 'relative' | 'absolute',
                })
              }
              className={`${controlClass} mt-1`}
            >
              <option value="relative">Relative</option>
              <option value="absolute">Absolute</option>
            </select>
          </div>

          {filters.timeframe?.type !== 'absolute' ? (
            <div>
              <label htmlFor="relative-window-select" className="text-xs text-slate-400">
                Relative Window
              </label>
              <select
                id="relative-window-select"
                value={filters.timeframe?.relativeWindow || '30d'}
                onChange={(e) =>
                  onSetFilter('timeframe', {
                    type: 'relative',
                    relativeWindow: e.target.value as any,
                  })
                }
                className={`${controlClass} mt-1`}
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="6mo">Last 6 months</option>
                <option value="9mo">Last 9 months</option>
                <option value="1y">Last 1 year</option>
                <option value="18mo">Last 18 months</option>
                <option value="2y">Last 2 years</option>
                <option value="all">All time</option>
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label htmlFor="timeframe-start-input" className="text-xs text-slate-400">
                  Start (ISO)
                </label>
                <input
                  id="timeframe-start-input"
                  type="datetime-local"
                  value={filters.timeframe?.startTimestamp || ''}
                  onChange={(e) =>
                    onSetFilter('timeframe', {
                      type: 'absolute',
                      startTimestamp: e.target.value,
                      endTimestamp: filters.timeframe?.endTimestamp,
                    })
                  }
                  className={`${controlClass} mt-1`}
                />
              </div>
              <div>
                <label htmlFor="timeframe-end-input" className="text-xs text-slate-400">
                  End (ISO)
                </label>
                <input
                  id="timeframe-end-input"
                  type="datetime-local"
                  value={filters.timeframe?.endTimestamp || ''}
                  onChange={(e) =>
                    onSetFilter('timeframe', {
                      type: 'absolute',
                      startTimestamp: filters.timeframe?.startTimestamp,
                      endTimestamp: e.target.value,
                    })
                  }
                  className={`${controlClass} mt-1`}
                />
              </div>
            </div>
          )}
        </div>
      </FilterInput>
    </FilterSection>
  );
};
