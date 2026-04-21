import { describe, it, expect } from '@jest/globals';
import * as validatorsModule from '../../../../server/src/services/filterQueryBuilder/validators';

describe('Filter Query Validators', () => {
  it('should be defined', () => {
    expect(validatorsModule).toBeDefined();
  });
});
