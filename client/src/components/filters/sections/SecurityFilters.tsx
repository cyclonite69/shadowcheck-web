/**
 * Security Filters Section
 */

import React from 'react';
import { FilterSection, FilterInput } from '../../filter';
import {
  EncryptionType,
  AuthMethod,
  InsecureFlag,
  SecurityFlag,
  NetworkFilters,
} from '../../../types/filters';

interface SecurityFiltersProps {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  isCompact: boolean;
  listLayoutClass: string;
  listItemTextClass: string;
  onSetFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  onToggleFilter: (key: keyof NetworkFilters) => void;
  onEnableFilter: (key: keyof NetworkFilters, enabled: boolean) => void;
}

export const SecurityFilters: React.FC<SecurityFiltersProps> = ({
  filters,
  enabled,
  isCompact,
  listLayoutClass,
  listItemTextClass,
  onSetFilter,
  onToggleFilter,
  onEnableFilter,
}) => {
  return (
    <FilterSection title="Security" compact={isCompact}>
      <FilterInput
        label="Encryption Types"
        enabled={enabled.encryptionTypes || false}
        onToggle={() => onToggleFilter('encryptionTypes')}
        compact={isCompact}
      >
        <div className={listLayoutClass}>
          {(['OPEN', 'WEP', 'WPA', 'WPA2', 'WPA3'] as EncryptionType[]).map((type) => (
            <label key={type} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.encryptionTypes?.includes(type) || false}
                onChange={(e) => {
                  const current = filters.encryptionTypes || [];
                  const updated = e.target.checked
                    ? [...current, type]
                    : current.filter((t: string) => t !== type);
                  onSetFilter('encryptionTypes', updated);
                  if (e.target.checked && updated.length > 0)
                    onEnableFilter('encryptionTypes', true);
                  if (!e.target.checked && updated.length === 0)
                    onEnableFilter('encryptionTypes', false);
                }}
                className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
              />
              <span className={`${listItemTextClass} text-slate-300`}>{type}</span>
            </label>
          ))}
        </div>
      </FilterInput>

      <FilterInput
        label="Auth Methods"
        enabled={enabled.authMethods || false}
        onToggle={() => onToggleFilter('authMethods')}
        compact={isCompact}
      >
        <div className={listLayoutClass}>
          {(['PSK', 'Enterprise', 'SAE', 'OWE', 'None'] as AuthMethod[]).map((method) => (
            <label key={method} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.authMethods?.includes(method) || false}
                onChange={(e) => {
                  const current = filters.authMethods || [];
                  const updated = e.target.checked
                    ? [...current, method]
                    : current.filter((m: string) => m !== method);
                  onSetFilter('authMethods', updated);
                }}
                className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
              />
              <span className={`${listItemTextClass} text-slate-300`}>{method}</span>
            </label>
          ))}
        </div>
      </FilterInput>

      <FilterInput
        label="Insecure Flags"
        enabled={enabled.insecureFlags || false}
        onToggle={() => onToggleFilter('insecureFlags')}
        compact={isCompact}
      >
        <div className={listLayoutClass}>
          {(['open', 'wep', 'wps', 'deprecated'] as InsecureFlag[]).map((flag) => (
            <label key={flag} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.insecureFlags?.includes(flag) || false}
                onChange={(e) => {
                  const current = filters.insecureFlags || [];
                  const updated = e.target.checked
                    ? [...current, flag]
                    : current.filter((f: string) => f !== flag);
                  onSetFilter('insecureFlags', updated);
                }}
                className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
              />
              <span className={`${listItemTextClass} text-slate-300 capitalize`}>{flag}</span>
            </label>
          ))}
        </div>
      </FilterInput>

      <FilterInput
        label="Security Inference Flags"
        enabled={enabled.securityFlags || false}
        onToggle={() => onToggleFilter('securityFlags')}
        compact={isCompact}
      >
        <div className={listLayoutClass}>
          {(['insecure', 'deprecated', 'enterprise', 'personal', 'unknown'] as SecurityFlag[]).map(
            (flag) => (
              <label key={flag} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.securityFlags?.includes(flag) || false}
                  onChange={(e) => {
                    const current = filters.securityFlags || [];
                    const updated = e.target.checked
                      ? [...current, flag]
                      : current.filter((f: string) => f !== flag);
                    onSetFilter('securityFlags', updated);
                  }}
                  className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                />
                <span className={`${listItemTextClass} text-slate-300 capitalize`}>{flag}</span>
              </label>
            )
          )}
        </div>
      </FilterInput>
    </FilterSection>
  );
};
