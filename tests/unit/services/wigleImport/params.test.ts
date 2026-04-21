import { describe, it, expect } from '@jest/globals';
import * as paramsModule from '../../../../server/src/services/wigleImport/params';

describe('Wigle Import Params', () => {
  it('should be defined', () => {
    expect(paramsModule).toBeDefined();
  });
});
