import { describe, it, expect } from '@jest/globals';
const analytics = require('../../../../server/src/services/analytics');

describe('Analytics Service', () => {
  it('should be defined', () => {
    expect(analytics).toBeDefined();
  });
});
