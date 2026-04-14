const service = require('../../../server/src/services/adminSettingsService');
const { adminQuery } = require('../../../server/src/services/adminDbService');
const { query } = require('../../../server/src/config/database');

jest.mock('../../../server/src/services/adminDbService');
jest.mock('../../../server/src/config/database');

describe('adminSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getAllSettings returns settings', async () => {
    query.mockResolvedValue({ rows: [{ key: 'test', value: 'value' }] });
    const settings = await service.getAllSettings();
    expect(settings).toHaveLength(1);
  });

  test('getSettingByKey returns setting', async () => {
    query.mockResolvedValue({ rows: [{ value: 'test' }] });
    const setting = await service.getSettingByKey('my-key');
    expect(setting.value).toBe('test');
  });

  test('updateSetting updates setting', async () => {
    adminQuery.mockResolvedValue({ rows: [{ key: 'k', value: 'v' }] });
    const updated = await service.updateSetting('k', 'v');
    expect(updated.value).toBe('v');
  });
});
