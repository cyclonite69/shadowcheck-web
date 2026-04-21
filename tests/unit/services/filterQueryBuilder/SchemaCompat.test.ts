import { describe, it, expect } from '@jest/globals';
import * as SchemaCompatModule from '../../../../server/src/services/filterQueryBuilder/SchemaCompat';

describe('SchemaCompat', () => {
  it('should be defined', () => {
    expect(SchemaCompatModule).toBeDefined();
  });
});
