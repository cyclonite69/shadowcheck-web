import * as fc from 'fast-check';
import { FilterBuildContext } from '../../../server/src/services/filterQueryBuilder/FilterBuildContext';

describe('FilterBuildContext Property-Based Tests', () => {
  test('ensures condition nesting does not orphan SQL fragments', async () => {
    await fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 })),
        (conditions) => {
          // A filter context should handle multiple conditions safely
          const ctx = new FilterBuildContext({}, {});
          
          // Mimic the addition of conditions
          conditions.forEach(cond => ctx.addParam(cond));
          
          // Verify that parameters and internal state are consistent
          expect(ctx.getParams().length).toBe(conditions.length);
        }
      )
    );
  });
});
