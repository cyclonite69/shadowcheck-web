import * as fc from 'fast-check';
import { UniversalFilterQueryBuilder } from '../../../server/src/services/filterQueryBuilder/universalFilterQueryBuilder';

describe('UniversalFilterQueryBuilder Property-Based Tests', () => {
  test('handles unknown filter payloads without crashing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.anything(),
        fc.anything(),
        async (filters, enabled) => {
          try {
            const builder = new UniversalFilterQueryBuilder(filters, enabled);
            expect(builder).toBeDefined();
            // Ensure validation errors are captured not thrown
            expect(Array.isArray(builder.getValidationErrors())).toBe(true);
          } catch (e) {
            // If it crashes, the module failed its robustness requirement
            throw new Error(`Builder crashed with input ${JSON.stringify({ filters, enabled })}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
