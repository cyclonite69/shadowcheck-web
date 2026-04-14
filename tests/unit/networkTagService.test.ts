/**
 * NetworkTagService Unit Tests
 */

import { query } from '../../server/src/config/database';

const networkTagService = require('../../server/src/services/networkTagService');

jest.mock('../../server/src/config/database');

describe('NetworkTagService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTaggedNetworks', () => {
    it('should return tagged networks and total count', async () => {
      const mockRows = [{ bssid: 'B1', total_count: '10' }];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await networkTagService.getTaggedNetworks('TYPE', 10, 0);

      expect(result).toEqual({ rows: mockRows, totalCount: 10 });
      expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM app.network_tags'), [
        'TYPE',
        10,
        0,
      ]);
    });

    it('should return 0 count if no rows', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await networkTagService.getTaggedNetworks('TYPE', 10, 0);

      expect(result.totalCount).toBe(0);
    });
  });

  describe('checkNetworkExists', () => {
    it('should return true if network exists', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
      expect(await networkTagService.checkNetworkExists('B1')).toBe(true);
    });

    it('should return false if network does not exist', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 });
      expect(await networkTagService.checkNetworkExists('B1')).toBe(false);
    });
  });

  describe('deleteNetworkTag', () => {
    it('should return true if tag deleted', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
      expect(await networkTagService.deleteNetworkTag('B1')).toBe(true);
    });
  });

  describe('insertNetworkTag', () => {
    it('should insert and return new tag', async () => {
      const mockTag = { bssid: 'B1' };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockTag] });

      const result = await networkTagService.insertNetworkTag('B1', 'T', 0.9, 'N');

      expect(result).toEqual(mockTag);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO app.network_tags'), [
        'B1',
        'T',
        0.9,
        'N',
      ]);
    });
  });

  describe('deleteNetworkTagReturning', () => {
    it('should return rowCount', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
      expect(await networkTagService.deleteNetworkTagReturning('B1')).toBe(1);
    });

    it('should return 0 if rowCount is null', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: null });
      expect(await networkTagService.deleteNetworkTagReturning('B1')).toBe(0);
    });
  });

  describe('upsertThreatTag', () => {
    it('should upsert and return tag', async () => {
      const mockTag = { bssid: 'B1' };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockTag] });

      const result = await networkTagService.upsertThreatTag('B1', 'Notes');

      expect(result).toEqual(mockTag);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (bssid)'), [
        'B1',
        'Notes',
      ]);
    });
  });

  describe('getNetworkTagByBssid', () => {
    it('should return tag if found', async () => {
      const mockTag = { bssid: 'B1' };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockTag] });

      const result = await networkTagService.getNetworkTagByBssid('B1');

      expect(result).toEqual(mockTag);
    });

    it('should return null if not found', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      expect(await networkTagService.getNetworkTagByBssid('B1')).toBeNull();
    });
  });

  describe('listNetworkTags', () => {
    it('should list tags with filters', async () => {
      const mockRows = [{ bssid: 'B1', total_count: '5' }];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await networkTagService.listNetworkTags(['t.tag_type = $1'], ['TYPE'], 10, 0);

      expect(result).toEqual({ rows: mockRows, totalCount: 5 });
      expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE t.tag_type = $1'), [
        'TYPE',
        10,
        0,
      ]);
    });

    it('should handle no where clauses', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      await networkTagService.listNetworkTags([], [], 10, 0);
      expect(query).toHaveBeenCalledWith(expect.not.stringContaining('WHERE'), [10, 0]);
    });
  });

  describe('getManualThreatTags', () => {
    it('should return manual threat tags', async () => {
      const mockRows = [{ bssid: 'B1' }];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await networkTagService.getManualThreatTags();

      expect(result).toEqual(mockRows);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE threat_tag IS NOT NULL'));
    });
  });
});
