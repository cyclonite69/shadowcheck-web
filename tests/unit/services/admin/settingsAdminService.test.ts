jest.mock('../../../../server/src/config/container', () => ({
  adminDbService: {
    adminQuery: jest.fn(),
  },
}));

import * as settingsAdminService from '../../../../server/src/services/admin/settingsAdminService';
const { adminDbService } = require('../../../../server/src/config/container');

describe('settingsAdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllSettings', () => {
    it('should return all settings from DB', async () => {
      const mockRows = [
        { key: 'k1', value: 'v1', description: 'd1', updated_at: new Date() },
        { key: 'k2', value: 'v2', description: 'd2', updated_at: new Date() },
      ];
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: mockRows });

      const result = await settingsAdminService.getAllSettings();

      expect(result).toEqual(mockRows);
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT key, value, description, updated_at FROM app.settings'),
        []
      );
    });
  });

  describe('getSettingByKey', () => {
    it('should return setting by key', async () => {
      const mockRow = { key: 'k1', value: 'v1' };
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await settingsAdminService.getSettingByKey('k1');

      expect(result).toEqual(mockRow);
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE key = $1'),
        ['k1']
      );
    });

    it('should return null if setting not found', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [] });

      const result = await settingsAdminService.getSettingByKey('unknown');

      expect(result).toBeNull();
    });
  });

  describe('updateSetting', () => {
    it('should update value and return updated row', async () => {
      const mockRow = { key: 'k1', value: 'new_val' };
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await settingsAdminService.updateSetting('k1', 'new_val');

      expect(result).toEqual(mockRow);
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app.settings SET value = $1'),
        ['new_val', 'k1']
      );
    });
  });

  describe('toggleMLBlending', () => {
    it('should toggle from true to false', async () => {
      // 1. getSettingByKey returns true
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ value: 'true' }] });
      // 2. updateSetting
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ value: 'false' }] });

      const result = await settingsAdminService.toggleMLBlending();

      expect(result).toBe(false);
      expect(adminDbService.adminQuery).toHaveBeenCalledTimes(2);
    });

    it('should toggle from false to true', async () => {
      // 1. getSettingByKey returns false
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ value: 'false' }] });
      // 2. updateSetting
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ value: 'true' }] });

      const result = await settingsAdminService.toggleMLBlending();

      expect(result).toBe(true);
    });

    it('should toggle to true if current value is missing', async () => {
      // 1. getSettingByKey returns nothing
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [] });
      // 2. updateSetting
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ value: 'true' }] });

      const result = await settingsAdminService.toggleMLBlending();

      expect(result).toBe(true);
    });
  });

  describe('saveMLModelConfig', () => {
    it('should update all ML model config fields', async () => {
      adminDbService.adminQuery.mockResolvedValue({ rows: [{}] });

      const result = await settingsAdminService.saveMLModelConfig('v1.0', 0.95, 0.94, 0.93, 0.92);

      expect(result).toEqual({
        modelVersion: 'v1.0',
        accuracy: 0.95,
        precision: 0.94,
        recall: 0.93,
        f1: 0.92,
      });
      expect(adminDbService.adminQuery).toHaveBeenCalledTimes(5);
    });
  });
});
