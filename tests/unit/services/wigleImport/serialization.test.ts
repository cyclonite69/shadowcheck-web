import { describe, it, expect } from '@jest/globals';
import * as serializationModule from '../../../../server/src/services/wigleImport/serialization';

describe('Wigle Import Serialization', () => {
  it('should be defined', () => {
    expect(serializationModule).toBeDefined();
  });
});
