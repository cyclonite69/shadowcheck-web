import { NOISE_FLOOR_DBM } from './constants';

export type QueryContext = {
  alias: string;
  mode: 'network-only' | 'list' | 'geospatial' | 'analytics';
  pageType?: 'geospatial' | 'wigle';
};

export type WhereClause = string[];

type RssiPredicateOptions = {
  value?: number;
  comparator: '>=' | '<=';
  signalExpr: string;
  requireNotNullExpr?: string;
  includeNoiseFloor?: boolean;
  noiseFloorValue?: number;
};

type RangePredicateOptions = {
  min?: number;
  max?: number;
  expr: string;
  wrapComparisons?: boolean;
};

type ThreatScorePredicateOptions = {
  min?: number;
  max?: number;
  expr: string;
  wrapExpr?: boolean;
};

export abstract class FilterPredicateBuilder {
  protected abstract addParam(value: unknown): string;

  protected buildRssiPredicate(options: RssiPredicateOptions): WhereClause {
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
      conditions.push(`${signalExpr} >= ${this.addParam(noiseFloorValue)}`);
    }
    conditions.push(`${signalExpr} ${comparator} ${this.addParam(value)}`);
    return conditions;
  }

  protected buildRangePredicate(options: RangePredicateOptions): WhereClause {
    const { min, max, expr, wrapComparisons = false } = options;
    const conditions: string[] = [];
    const wrap = (value: string) => (wrapComparisons ? `(${value})` : value);

    if (min !== undefined) {
      conditions.push(wrap(`${expr} >= ${this.addParam(min)}`));
    }
    if (max !== undefined) {
      conditions.push(wrap(`${expr} <= ${this.addParam(max)}`));
    }

    return conditions;
  }

  protected buildThreatScorePredicate(options: ThreatScorePredicateOptions): WhereClause {
    const { min, max, expr, wrapExpr = false } = options;
    const conditions: string[] = [];
    const formattedExpr = wrapExpr ? `(${expr})` : expr;

    if (min !== undefined) {
      conditions.push(`${formattedExpr} >= ${this.addParam(min)}`);
    }
    if (max !== undefined) {
      conditions.push(`${formattedExpr} <= ${this.addParam(max)}`);
    }

    return conditions;
  }
}
