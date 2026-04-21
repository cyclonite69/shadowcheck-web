import { describe, it, expect } from '@jest/globals';
import * as normalizersModule from '../../../../server/src/services/filterQueryBuilder/normalizers';

describe('Filter Query Normalizers', () => {
  it('should be defined', () => {
    expect(normalizersModule).toBeDefined();
  });
});
