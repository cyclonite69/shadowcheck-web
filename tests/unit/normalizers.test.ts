export {};

import { normalizeFilters } from '../../server/src/services/filterQueryBuilder/normalizers';

describe('filter normalizers', () => {
  test('normalizes radio type labels to canonical codes', () => {
    const normalized = normalizeFilters({
      radioTypes: ['wifi', 'BLE', 'bluetooth', '5g', 'unknown'],
    });

    expect(normalized.radioTypes).toEqual(['W', 'E', 'B', 'N', '?']);
  });

  test('normalizes frequency bands to canonical values', () => {
    const normalized = normalizeFilters({
      frequencyBands: ['2.4ghz', '5', '6GHZ', 'ble', 'cellular'],
    });

    expect(normalized.frequencyBands).toEqual(['2.4GHz', '5GHz', '6GHz', 'BLE', 'Cellular']);
  });

  test('accepts comma-delimited arrays and normalizes tag_type values', () => {
    const normalized = normalizeFilters({
      frequencyBands: '2.4ghz,5ghz',
      tag_type: 'THREAT,ignore,false_positive',
    });

    expect(normalized.frequencyBands).toEqual(['2.4GHz', '5GHz']);
    expect(normalized.tag_type).toEqual(['threat', 'ignore', 'false_positive']);
  });

  test('drops invalid numeric values that can poison predicates', () => {
    const normalized = normalizeFilters({
      channelMin: null,
      channelMax: '',
      rssiMin: NaN,
      rssiMax: 'not-a-number',
      threatScoreMin: Infinity,
    });

    expect(normalized.channelMin).toBeUndefined();
    expect(normalized.channelMax).toBeUndefined();
    expect(normalized.rssiMin).toBeUndefined();
    expect(normalized.rssiMax).toBeUndefined();
    expect(normalized.threatScoreMin).toBeUndefined();
  });
});
