export {};

import {
  UniversalFilterQueryBuilder,
  validateFilterPayload,
} from '../../server/src/services/filterQueryBuilder';

type FieldName =
  | 'radioTypes'
  | 'frequencyBands'
  | 'channelMin'
  | 'channelMax'
  | 'rssiMin'
  | 'rssiMax';

const appliedFields = (result: { appliedFilters: Array<{ field: string }> }): string[] =>
  result.appliedFilters.map((entry) => entry.field);

describe('Certification: Radio & Physical Filters', () => {
  test('radioTypes: mixed selections are preserved and parameterized', () => {
    const builder = new UniversalFilterQueryBuilder(
      { radioTypes: ['W', 'L'] },
      { radioTypes: true }
    );
    const result = builder.buildObservationFilters();

    expect(result.where.some((clause: string) => clause.includes('= ANY('))).toBe(true);
    expect(builder.getParams()).toContainEqual(['W', 'L']);
  });

  test.each([
    { band: '2.4GHz', expected: '2412 AND 2484' },
    { band: '5GHz', expected: '5000 AND 5900' },
    { band: '6GHz', expected: '5925 AND 7125' },
  ])('frequencyBands: $band maps to correct frequency predicate', ({ band, expected }) => {
    const builder = new UniversalFilterQueryBuilder(
      { frequencyBands: [band] },
      { frequencyBands: true }
    );
    const result = builder.buildObservationFilters();
    expect(result.where.some((clause: string) => clause.includes(expected))).toBe(true);
  });

  test('channelMin/channelMax: both predicates are applied with correct bounds', () => {
    const builder = new UniversalFilterQueryBuilder(
      { channelMin: 1, channelMax: 11 },
      { channelMin: true, channelMax: true }
    );
    const result = builder.buildObservationFilters();
    const whereSql = result.where.join('\n');

    expect(whereSql).toContain('>=');
    expect(whereSql).toContain('<=');
    expect(builder.getParams()).toContain(1);
    expect(builder.getParams()).toContain(11);
  });

  test('rssiMin/rssiMax: includes null-check and noise-floor handling in observation predicates', () => {
    const builder = new UniversalFilterQueryBuilder(
      { rssiMin: -80, rssiMax: -40 },
      { rssiMin: true, rssiMax: true }
    );
    const result = builder.buildObservationFilters();
    const whereSql = result.where.join('\n');
    const params = builder.getParams() as unknown[];

    expect(whereSql).toContain('o.level IS NOT NULL');
    expect(whereSql).toContain('o.level >=');
    expect(whereSql).toContain('o.level <=');
    // Noise floor is added for each RSSI bound when enabled.
    const noiseFloorCount = params.filter((v) => v === -95).length;
    expect(noiseFloorCount).toBeGreaterThanOrEqual(2);
    expect(params).toContain(-80);
    expect(params).toContain(-40);
  });

  test('rssi boundaries: validator accepts edge values and rejects out-of-range', () => {
    const valid = validateFilterPayload(
      { rssiMin: -95, rssiMax: 0 },
      { rssiMin: true, rssiMax: true }
    );
    expect(valid.errors).toHaveLength(0);

    const invalidMin = validateFilterPayload({ rssiMin: -96 }, { rssiMin: true });
    expect(invalidMin.errors.some((e) => e.includes('noise floor'))).toBe(true);

    const invalidMax = validateFilterPayload({ rssiMax: 1 }, { rssiMax: true });
    expect(invalidMax.errors.some((e) => e.includes('above 0'))).toBe(true);
  });

  test('combined certification matrix: all six radio/physical filters are applied together', () => {
    const filters = {
      radioTypes: ['W', 'L'],
      frequencyBands: ['6GHz'],
      channelMin: 1,
      channelMax: 11,
      rssiMin: -80,
      rssiMax: -40,
    };
    const enabled = {
      radioTypes: true,
      frequencyBands: true,
      channelMin: true,
      channelMax: true,
      rssiMin: true,
      rssiMax: true,
    };

    const query = new UniversalFilterQueryBuilder(filters, enabled, {
      pageType: 'wigle',
    }).buildNetworkListQuery();
    const fields = appliedFields(query);
    const required: FieldName[] = [
      'radioTypes',
      'frequencyBands',
      'channelMin',
      'channelMax',
      'rssiMin',
      'rssiMax',
    ];

    required.forEach((field) => {
      expect(fields).toContain(field);
    });
  });
});
