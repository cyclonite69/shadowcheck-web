export {};

import { FilterPredicateBuilder } from '../../server/src/services/filterQueryBuilder/FilterPredicateBuilder';

class TestPredicateBuilder extends FilterPredicateBuilder {
  public readonly params: unknown[] = [];

  protected addParam(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  public buildRssiMinWithNoise(value?: number): string[] {
    return this.buildRssiPredicate({
      value,
      comparator: '>=',
      signalExpr: 'o.level',
      requireNotNullExpr: 'o.level IS NOT NULL',
      includeNoiseFloor: true,
    });
  }

  public buildChannelRange(min?: number, max?: number): string[] {
    return this.buildRangePredicate({
      min,
      max,
      expr: "CASE WHEN ne.frequency BETWEEN 2412 AND 2484 THEN 1 ELSE NULL END",
      wrapComparisons: true,
    });
  }

  public buildThreatRange(min?: number, max?: number): string[] {
    return this.buildThreatScorePredicate({
      min,
      max,
      expr: "COALESCE(nts.score, (to_jsonb(nt)->>'risk_score')::numeric, 0)",
      wrapExpr: true,
    });
  }
}

describe('FilterPredicateBuilder', () => {
  test('buildRssiPredicate includes null-check and noise-floor parameterization', () => {
    const builder = new TestPredicateBuilder();
    const clauses = builder.buildRssiMinWithNoise(-80);

    expect(clauses).toEqual(['o.level IS NOT NULL', 'o.level >= $1', 'o.level >= $2']);
    expect(builder.params).toEqual([-95, -80]);
  });

  test('buildRangePredicate builds wrapped min/max channel clauses', () => {
    const builder = new TestPredicateBuilder();
    const clauses = builder.buildChannelRange(1, 11);

    expect(clauses).toHaveLength(2);
    expect(clauses[0]).toContain('>= $1');
    expect(clauses[1]).toContain('<= $2');
    expect(clauses[0].startsWith('(')).toBe(true);
    expect(builder.params).toEqual([1, 11]);
  });

  test('buildThreatScorePredicate wraps expression and parameterizes bounds', () => {
    const builder = new TestPredicateBuilder();
    const clauses = builder.buildThreatRange(40, 80);

    expect(clauses).toEqual([
      "(COALESCE(nts.score, (to_jsonb(nt)->>'risk_score')::numeric, 0)) >= $1",
      "(COALESCE(nts.score, (to_jsonb(nt)->>'risk_score')::numeric, 0)) <= $2",
    ]);
    expect(builder.params).toEqual([40, 80]);
  });

  test('predicate builders return empty clauses when values are undefined', () => {
    const builder = new TestPredicateBuilder();

    expect(builder.buildRssiMinWithNoise(undefined)).toEqual([]);
    expect(builder.buildChannelRange(undefined, undefined)).toEqual([]);
    expect(builder.buildThreatRange(undefined, undefined)).toEqual([]);
    expect(builder.params).toEqual([]);
  });
});
