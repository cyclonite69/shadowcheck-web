(() => {
  const featureFlagServiceLocal = require('../../../server/src/services/featureFlagService');
  const { query: queryLocal } = require('../../../server/src/config/database');

  jest.mock('../../../server/src/config/database');

  describe('featureFlagService', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return default flag when cache is not loaded', () => {
      expect(featureFlagServiceLocal.getFlag('dedupe_on_scan')).toBe(true);
    });

    it('should refresh cache from DB', async () => {
      (queryLocal as jest.Mock).mockResolvedValue({
        rows: [{ key: 'dedupe_on_scan', value: false }],
      });

      await featureFlagServiceLocal.refreshCache();
      expect(featureFlagServiceLocal.getFlag('dedupe_on_scan')).toBe(false);
    });
  });
})();
