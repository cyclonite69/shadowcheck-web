export {};

import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import { UniversalFilterQueryBuilder } from '../../server/src/services/filterQueryBuilder';
import { validateFilterPayload } from '../../server/src/services/filterQueryBuilder/validators';

describe('FilterBuildContext validation visibility', () => {
  test('validator errors are exposed while invalid values still flow into context state', () => {
    const result = validateFilterPayload({ gpsAccuracyMax: 5001 }, { gpsAccuracyMax: true });
    expect(result.errors).toContain('GPS accuracy limit too high (>1000m).');

    const ctx = new FilterBuildContext({ gpsAccuracyMax: 5001 }, { gpsAccuracyMax: true });
    const builder = new UniversalFilterQueryBuilder(
      { gpsAccuracyMax: 5001 },
      { gpsAccuracyMax: true }
    );
    const predicates = ctx.buildNetworkWhere();

    expect(ctx.getValidationErrors()).toEqual(['GPS accuracy limit too high (>1000m).']);
    expect(builder.getValidationErrors()).toEqual(['GPS accuracy limit too high (>1000m).']);
    expect(predicates.some((predicate) => predicate.includes('accuracy_meters <= $1'))).toBe(true);
    expect(ctx.getAppliedFilters()).toEqual([
      {
        type: 'quality',
        field: 'gpsAccuracyMax',
        value: 5001,
      },
    ]);
    expect(ctx.state.warnings()).toEqual([]);
  });
});
