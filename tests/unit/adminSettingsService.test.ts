/**
 * AdminSettingsService Unit Tests
 */

import { adminQuery } from '../../server/src/services/adminDbService';
import { query } from '../../server/src/config/database';

const adminSettingsService = require('../../server/src/services/adminSettingsService');

jest.mock('../../server/src/services/adminDbService');
jest.mock('../../server/src/config/database');

describe('AdminSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllSettings', () => {
    it('should return all settings', async () => {
      const mockSettings = [
        { key: 's1', value: 'v1' },
        { key: 's2', value: 'v2' },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockSettings });

      const settings = await adminSettingsService.getAllSettings();

      expect(settings).toEqual(mockSettings);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT key, value'));
    });
  });

  describe('getSettingByKey', () => {
    it('should return setting by key', async () => {
      const mockSetting = { value: 'v1', description: 'd1' };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockSetting] });

      const setting = await adminSettingsService.getSettingByKey('s1');

      expect(setting).toEqual(mockSetting);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE key = $1'), ['s1']);
    });

    it('should return null if setting not found', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const setting = await adminSettingsService.getSettingByKey('unknown');

      expect(setting).toBeNull();
    });
  });

  describe('updateSetting', () => {
    it('should update setting', async () => {
      const mockResult = { key: 's1', value: '"new_value"' };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockResult] });

      const result = await adminSettingsService.updateSetting('s1', 'new_value');

      expect(result).toEqual(mockResult);
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app.settings SET value = $1'),
        ['"new_value"', 's1']
      );
    });
  });

  describe('toggleMLBlending', () => {
    it('should toggle ML blending setting', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ value: 'true' }] });

      const result = await adminSettingsService.toggleMLBlending();

      expect(result).toBe('true');
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining("key = 'ml_blending_enabled'")
      );
    });

    it('should handle missing return row', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await adminSettingsService.toggleMLBlending();

      expect(result).toBeUndefined();
    });
  });

  describe('saveMLModelConfig', () => {
    it('should save ML model config', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });

      const result = await adminSettingsService.saveMLModelConfig('logistic', { a: 1 }, 0.5, [
        'f1',
        'f2',
      ]);

      expect(result).toBe(true);
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.ml_model_config'),
        ['logistic', '{"a":1}', 0.5, '["f1","f2"]']
      );
    });

    it('should return false if rowCount is 0', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: 0 });

      const result = await adminSettingsService.saveMLModelConfig('logistic', {}, 0, []);

      expect(result).toBe(false);
    });
  });
});
