/**
 * Shared types for filter sections
 */

import { NetworkFilters } from '../../types/filters';

export interface FilterSectionProps {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  isCompact: boolean;
  controlClass: string;
  listLayoutClass?: string;
  listItemTextClass?: string;
  onSetFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  onToggleFilter: (key: keyof NetworkFilters) => void;
  onEnableFilter?: (key: keyof NetworkFilters, enabled: boolean) => void;
}
