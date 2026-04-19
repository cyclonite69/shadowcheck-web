import { FilterPredicateBuilder } from '../../../../server/src/services/filterQueryBuilder/FilterPredicateBuilder';
import { NOISE_FLOOR_DBM } from '../../../../server/src/services/filterQueryBuilder/constants';

class TestPredicateBuilder extends FilterPredicateBuilder {
  public params: unknown[] = [];

  protected addParam(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  public reset() {
    this.params = [];
  }
}

describe('FilterPredicateBuilder', () => {
  let builder: TestPredicateBuilder;

  beforeEach(() => {
    builder = new TestPredicateBuilder();
  });

  describe('buildRssiPredicate', () => {
    it('returns empty array when value is undefined', () => {
      const result = builder.buildRssiPredicate({
        comparator: '>=',
        signalExpr: 'rssi',
      });
      expect(result).toEqual([]);
      expect(builder.params.length).toBe(0);
    });

    it('builds basic predicate with signalExpr and value', () => {
      const result = builder.buildRssiPredicate({
        value: -70,
        comparator: '>=',
        signalExpr: 'signal',
      });
      expect(result).toEqual(['signal >= $1']);
      expect(builder.params).toEqual([-70]);
    });

    it('builds predicate with requireNotNullExpr', () => {
      const result = builder.buildRssiPredicate({
        value: -80,
        comparator: '<=',
        signalExpr: 'signal',
        requireNotNullExpr: 'signal IS NOT NULL',
      });
      expect(result).toEqual(['signal IS NOT NULL', 'signal <= $1']);
      expect(builder.params).toEqual([-80]);
    });

    it('builds predicate with default noise floor inclusion', () => {
      const result = builder.buildRssiPredicate({
        value: -75,
        comparator: '>=',
        signalExpr: 'signal',
        includeNoiseFloor: true,
      });
      expect(result).toEqual([`signal >= $1`, `signal >= $2`]);
      expect(builder.params).toEqual([NOISE_FLOOR_DBM, -75]);
    });

    it('builds predicate with custom noise floor value', () => {
      const result = builder.buildRssiPredicate({
        value: -60,
        comparator: '<=',
        signalExpr: 'signal',
        includeNoiseFloor: true,
        noiseFloorValue: -100,
      });
      expect(result).toEqual([`signal >= $1`, `signal <= $2`]);
      expect(builder.params).toEqual([-100, -60]);
    });
  });

  describe('buildRangePredicate', () => {
    it('returns empty array when min and max are undefined', () => {
      const result = builder.buildRangePredicate({
        expr: 'frequency',
      });
      expect(result).toEqual([]);
      expect(builder.params.length).toBe(0);
    });

    it('builds predicate with min only', () => {
      const result = builder.buildRangePredicate({
        min: 2400,
        expr: 'frequency',
      });
      expect(result).toEqual(['frequency >= $1']);
      expect(builder.params).toEqual([2400]);
    });

    it('builds predicate with max only', () => {
      const result = builder.buildRangePredicate({
        max: 5000,
        expr: 'frequency',
      });
      expect(result).toEqual(['frequency <= $1']);
      expect(builder.params).toEqual([5000]);
    });

    it('builds predicate with both min and max', () => {
      const result = builder.buildRangePredicate({
        min: 2400,
        max: 5000,
        expr: 'frequency',
      });
      expect(result).toEqual(['frequency >= $1', 'frequency <= $2']);
      expect(builder.params).toEqual([2400, 5000]);
    });

    it('wraps comparisons when wrapComparisons is true', () => {
      const result = builder.buildRangePredicate({
        min: 10,
        max: 20,
        expr: 'score',
        wrapComparisons: true,
      });
      expect(result).toEqual(['(score >= $1)', '(score <= $2)']);
      expect(builder.params).toEqual([10, 20]);
    });
  });

  describe('buildThreatScorePredicate', () => {
    it('returns empty array when min and max are undefined', () => {
      const result = builder.buildThreatScorePredicate({
        expr: 'threat_score',
      });
      expect(result).toEqual([]);
      expect(builder.params.length).toBe(0);
    });

    it('builds predicate with min only', () => {
      const result = builder.buildThreatScorePredicate({
        min: 50,
        expr: 'threat_score',
      });
      expect(result).toEqual(['threat_score >= $1']);
      expect(builder.params).toEqual([50]);
    });

    it('builds predicate with max only', () => {
      const result = builder.buildThreatScorePredicate({
        max: 80,
        expr: 'threat_score',
      });
      expect(result).toEqual(['threat_score <= $1']);
      expect(builder.params).toEqual([80]);
    });

    it('builds predicate with both min and max', () => {
      const result = builder.buildThreatScorePredicate({
        min: 20,
        max: 90,
        expr: 'threat_score',
      });
      expect(result).toEqual(['threat_score >= $1', 'threat_score <= $2']);
      expect(builder.params).toEqual([20, 90]);
    });

    it('wraps expression when wrapExpr is true', () => {
      const result = builder.buildThreatScorePredicate({
        min: 30,
        max: 60,
        expr: 'get_score(a, b)',
        wrapExpr: true,
      });
      expect(result).toEqual(['(get_score(a, b)) >= $1', '(get_score(a, b)) <= $2']);
      expect(builder.params).toEqual([30, 60]);
    });
  });
});