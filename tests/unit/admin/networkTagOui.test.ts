/**
 * Network Tag OUI Unit Tests
 */

import {
  addTagToNetwork,
  removeTagFromNetwork,
  getOUIGroups,
} from '../../../server/src/services/admin/networkTagOui';
import { adminQuery } from '../../../server/src/services/adminDbService';
import { query } from '../../../server/src/config/database';

jest.mock('../../../server/src/services/adminDbService');
jest.mock('../../../server/src/config/database');

describe('networkTagOui Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addTagToNetwork', () => {
    it('should add a tag using app.network_add_tag function', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
      await addTagToNetwork('00:11:22:33:44:55', 'test-tag', 'some notes');
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.network_add_tag(tags, $2)'),
        ['00:11:22:33:44:55', 'test-tag', 'some notes']
      );
    });
  });

  describe('removeTagFromNetwork', () => {
    it('should remove a tag using app.network_remove_tag function', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
      await removeTagFromNetwork('00:11:22:33:44:55', 'test-tag');
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.network_remove_tag(tags, $2)'),
        ['00:11:22:33:44:55', 'test-tag']
      );
    });
  });

  describe('getOUIGroups', () => {
    it('should query oui_device_groups table', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ oui: '00:11:22', group_name: 'Test Group' }],
      });
      const result = await getOUIGroups();
      expect(result).toHaveLength(1);
      expect(result[0].oui).toBe('00:11:22');
      expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM app.oui_device_groups'));
    });
  });
});
