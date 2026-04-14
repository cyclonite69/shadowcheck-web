/**
 * Network Tag Core Unit Tests
 */

import {
  upsertNetworkTag,
  markNetworkInvestigate,
  deleteNetworkTag,
} from '../../../server/src/services/admin/networkTagCore';
import { adminQuery } from '../../../server/src/services/adminDbService';

jest.mock('../../../server/src/services/adminDbService');

describe('networkTagCore Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertNetworkTag', () => {
    it('should call adminQuery with correct SQL and parameters', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ bssid: '00:11:22:33:44:55' }] });
      await upsertNetworkTag('00:11:22:33:44:55', true, 'test', 'THREAT', 0.9, 'notes');
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_tags'),
        ['00:11:22:33:44:55', true, 'test', 'THREAT', 0.9, 'notes']
      );
    });
  });

  describe('markNetworkInvestigate', () => {
    it('should upsert investigate tag with complex conflict resolution logic', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ bssid: '00:11:22:33:44:55' }] });
      await markNetworkInvestigate('00:11:22:33:44:55');

      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (bssid) DO UPDATE'),
        ['00:11:22:33:44:55']
      );

      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('threat_tag = CASE'),
        expect.any(Array)
      );
    });
  });

  describe('deleteNetworkTag', () => {
    it('should return rowCount from adminQuery', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
      const result = await deleteNetworkTag('00:11:22:33:44:55');
      expect(result).toBe(1);
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM app.network_tags WHERE bssid = $1'),
        ['00:11:22:33:44:55']
      );
    });
  });
});
