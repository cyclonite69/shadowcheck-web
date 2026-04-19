import type { EnabledFlags, Filters, AppliedFilter } from './types';
import type { QueryState } from './QueryState';

export interface NetworkWhereBuildContext {
  filters: Filters;
  enabled: EnabledFlags;
  validationErrors: string[];
  params: unknown[];
  paramIndex: number;
  state: QueryState;
  obsJoins: Set<string>;
  requiresHome: boolean;
  addParam: (value: unknown) => string;
  addApplied: (type: string, field: string, value: unknown) => void;
  addIgnored: (type: string, field: string, reason: string) => void;
  addWarning: (message: string) => void;
  buildThreatScorePredicate: (params: {
    min?: number;
    max?: number;
    expr: string;
    wrapExpr?: boolean;
  }) => string[];
}

export type { AppliedFilter };
