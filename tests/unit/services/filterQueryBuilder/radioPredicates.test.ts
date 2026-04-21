import { describe, it, expect } from '@jest/globals';
import { buildRadioPredicates } from '../../../../server/src/services/filterQueryBuilder/radioPredicates';

describe('Radio Predicates', () => {
  it('should have buildRadioPredicates', () => {
    expect(buildRadioPredicates).toBeDefined();
  });
});
