import { NOISE_FLOOR_DBM } from './constants';
import { isAllRadioTypesSelection, normalizeRadioTypes } from './sqlExpressions';
import type { EnabledFlags, Filters } from './types';

export type RadioAppliedFilterField =
  | 'radioTypes'
  | 'frequencyBands'
  | 'channelMin'
  | 'channelMax'
  | 'rssiMin'
  | 'rssiMax';

type RadioPredicateInput = {
  enabled: EnabledFlags;
  filters: Filters;
  addParam: (value: unknown) => string;
  expressions: {
    typeExpr: string;
    frequencyExpr: string;
    channelExpr: string;
    signalExpr: string;
  };
  options?: {
    channelWrapComparisons?: boolean;
    rssiRequireNotNullExpr?: string;
    rssiIncludeNoiseFloor?: boolean;
    noiseFloorValue?: number;
  };
};

type RadioPredicateResult = {
  where: string[];
  applied: Array<{ field: RadioAppliedFilterField; value: unknown }>;
};

const buildRangePredicate = (
  addParam: (value: unknown) => string,
  options: { min?: number; max?: number; expr: string; wrapComparisons?: boolean }
): string[] => {
  const { min, max, expr, wrapComparisons = false } = options;
  const wrap = (value: string) => (wrapComparisons ? `(${value})` : value);
  const conditions: string[] = [];
  if (min !== undefined) {
    conditions.push(wrap(`${expr} >= ${addParam(min)}`));
  }
  if (max !== undefined) {
    conditions.push(wrap(`${expr} <= ${addParam(max)}`));
  }
  return conditions;
};

const buildRssiPredicate = (
  addParam: (value: unknown) => string,
  options: {
    value?: number;
    comparator: '>=' | '<=';
    signalExpr: string;
    requireNotNullExpr?: string;
    includeNoiseFloor?: boolean;
    noiseFloorValue?: number;
  }
): string[] => {
  const {
    value,
    comparator,
    signalExpr,
    requireNotNullExpr,
    includeNoiseFloor = false,
    noiseFloorValue = NOISE_FLOOR_DBM,
  } = options;

  if (value === undefined) {
    return [];
  }

  const conditions: string[] = [];
  if (requireNotNullExpr) {
    conditions.push(requireNotNullExpr);
  }
  if (includeNoiseFloor) {
    conditions.push(`${signalExpr} >= ${addParam(noiseFloorValue)}`);
  }
  conditions.push(`${signalExpr} ${comparator} ${addParam(value)}`);
  return conditions;
};

const mapFrequencyBandClause = (
  band: string,
  expressions: { typeExpr: string; frequencyExpr: string }
): string | null => {
  if (band === '2.4GHz') {
    return `(${expressions.frequencyExpr} BETWEEN 2412 AND 2484)`;
  }
  if (band === '5GHz') {
    return `(${expressions.frequencyExpr} BETWEEN 5000 AND 5900)`;
  }
  if (band === '6GHz') {
    return `(${expressions.frequencyExpr} BETWEEN 5925 AND 7125)`;
  }
  if (band === 'BLE') {
    return `${expressions.typeExpr} = 'E'`;
  }
  if (band === 'Cellular') {
    return `${expressions.typeExpr} IN ('L', 'G', 'N')`;
  }
  return null;
};

export const buildRadioPredicates = ({
  enabled,
  filters,
  addParam,
  expressions,
  options,
}: RadioPredicateInput): RadioPredicateResult => {
  const where: string[] = [];
  const applied: Array<{ field: RadioAppliedFilterField; value: unknown }> = [];

  if (enabled.radioTypes && Array.isArray(filters.radioTypes) && filters.radioTypes.length > 0) {
    const normalizedRadioTypes = normalizeRadioTypes(filters.radioTypes);
    if (normalizedRadioTypes.length > 0 && !isAllRadioTypesSelection(normalizedRadioTypes)) {
      where.push(`${expressions.typeExpr} = ANY(${addParam(normalizedRadioTypes)})`);
      applied.push({ field: 'radioTypes', value: normalizedRadioTypes });
    }
  }

  if (
    enabled.frequencyBands &&
    Array.isArray(filters.frequencyBands) &&
    filters.frequencyBands.length > 0
  ) {
    const clauses = filters.frequencyBands
      .map((band) => mapFrequencyBandClause(band, expressions))
      .filter((clause): clause is string => Boolean(clause));
    if (clauses.length > 0) {
      where.push(`(${clauses.join(' OR ')})`);
      applied.push({ field: 'frequencyBands', value: filters.frequencyBands });
    }
  }

  if (enabled.channelMin && filters.channelMin !== undefined) {
    where.push(
      ...buildRangePredicate(addParam, {
        min: filters.channelMin,
        expr: expressions.channelExpr,
        wrapComparisons: options?.channelWrapComparisons,
      })
    );
    applied.push({ field: 'channelMin', value: filters.channelMin });
  }

  if (enabled.channelMax && filters.channelMax !== undefined) {
    where.push(
      ...buildRangePredicate(addParam, {
        max: filters.channelMax,
        expr: expressions.channelExpr,
        wrapComparisons: options?.channelWrapComparisons,
      })
    );
    applied.push({ field: 'channelMax', value: filters.channelMax });
  }

  if (enabled.rssiMin && filters.rssiMin !== undefined) {
    where.push(
      ...buildRssiPredicate(addParam, {
        value: filters.rssiMin,
        comparator: '>=',
        signalExpr: expressions.signalExpr,
        requireNotNullExpr: options?.rssiRequireNotNullExpr,
        includeNoiseFloor: options?.rssiIncludeNoiseFloor,
        noiseFloorValue: options?.noiseFloorValue,
      })
    );
    applied.push({ field: 'rssiMin', value: filters.rssiMin });
  }

  if (enabled.rssiMax && filters.rssiMax !== undefined) {
    where.push(
      ...buildRssiPredicate(addParam, {
        value: filters.rssiMax,
        comparator: '<=',
        signalExpr: expressions.signalExpr,
        requireNotNullExpr: options?.rssiRequireNotNullExpr,
        includeNoiseFloor: options?.rssiIncludeNoiseFloor,
        noiseFloorValue: options?.noiseFloorValue,
      })
    );
    applied.push({ field: 'rssiMax', value: filters.rssiMax });
  }

  return { where, applied };
};
