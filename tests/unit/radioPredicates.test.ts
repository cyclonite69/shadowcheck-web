export {};

import { buildRadioPredicates } from '../../server/src/services/filterQueryBuilder/radioPredicates';
import { DEFAULT_ENABLED } from '../../server/src/services/filterQueryBuilder/constants';

const makeAddParam = () => {
  const params: unknown[] = [];
  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  return { params, addParam };
};

describe('buildRadioPredicates', () => {
  test('builds observation-style predicates with noise-floor and null-check', () => {
    const { params, addParam } = makeAddParam();
    const result = buildRadioPredicates({
      enabled: { ...DEFAULT_ENABLED, rssiMin: true, rssiMax: true },
      filters: { rssiMin: -80, rssiMax: -40 },
      addParam,
      expressions: {
        typeExpr: 't',
        frequencyExpr: 'f',
        channelExpr: 'c',
        signalExpr: 'o.level',
      },
      options: {
        rssiRequireNotNullExpr: 'o.level IS NOT NULL',
        rssiIncludeNoiseFloor: true,
      },
    });

    expect(result.where).toEqual([
      'o.level IS NOT NULL',
      'o.level >= $1',
      'o.level >= $2',
      'o.level IS NOT NULL',
      'o.level >= $3',
      'o.level <= $4',
    ]);
    expect(params).toEqual([-95, -80, -95, -40]);
    expect(result.applied.map((v) => v.field)).toEqual(['rssiMin', 'rssiMax']);
  });

  test('maps radio types and frequency bands with expected SQL', () => {
    const { addParam } = makeAddParam();
    const result = buildRadioPredicates({
      enabled: { ...DEFAULT_ENABLED, radioTypes: true, frequencyBands: true },
      filters: { radioTypes: ['W'], frequencyBands: ['BLE', 'Cellular', '6GHz'] },
      addParam,
      expressions: {
        typeExpr: 'network_type_expr',
        frequencyExpr: 'freq_expr',
        channelExpr: 'channel_expr',
        signalExpr: 'signal_expr',
      },
    });

    expect(result.where[0]).toContain('network_type_expr = ANY');
    expect(result.where[1]).toContain("network_type_expr = 'E'");
    expect(result.where[1]).toContain("network_type_expr IN ('L', 'G', 'N')");
    expect(result.where[1]).toContain('(freq_expr BETWEEN 5925 AND 7125)');
  });

  test('treats full supported radioTypes selection as neutral', () => {
    const { params, addParam } = makeAddParam();
    const result = buildRadioPredicates({
      enabled: { ...DEFAULT_ENABLED, radioTypes: true },
      filters: { radioTypes: ['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?'] },
      addParam,
      expressions: {
        typeExpr: 'network_type_expr',
        frequencyExpr: 'freq_expr',
        channelExpr: 'channel_expr',
        signalExpr: 'signal_expr',
      },
    });

    expect(result.where).toEqual([]);
    expect(result.applied).toEqual([]);
    expect(params).toEqual([]);
  });
  test('wraps channel comparisons when requested', () => {
    const { addParam } = makeAddParam();
    const result = buildRadioPredicates({
      enabled: { ...DEFAULT_ENABLED, channelMin: true, channelMax: true },
      filters: { channelMin: 1, channelMax: 11 },
      addParam,
      expressions: {
        typeExpr: 't',
        frequencyExpr: 'f',
        channelExpr: 'complex_channel_expr',
        signalExpr: 's',
      },
      options: {
        channelWrapComparisons: true,
      },
    });

    expect(result.where[0].startsWith('(')).toBe(true);
    expect(result.where[0]).toContain('complex_channel_expr >= $1');
    expect(result.where[1]).toContain('complex_channel_expr <= $2');
  });
});
