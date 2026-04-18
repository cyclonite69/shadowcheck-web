/**
 * Network Tag OUI Unit Tests
 */

jest.mock('../../../server/src/config/container', () => ({
  adminDbService: {
    adminQuery: jest.fn(),
  },
  databaseService: {
    query: jest.fn(),
  },
}));

import {
  addTagToNetwork,
  getAllNetworkTags,
  getMACRandomizationSuspects,
  getNetworkTagsAndNotes,
  getNetworkTagsByBssid,
  getNetworkTagsExpanded,
  getOUIGroupDetails,
  getOUIGroups,
  insertNetworkTagWithNotes,
  removeTagFromNetwork,
  searchNetworksByTag,
  searchNetworksByTagArray,
} from '../../../server/src/services/admin/networkTagOui';
const { adminDbService, databaseService } = require('../../../server/src/config/container');

describe('networkTagOui Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addTagToNetwork', () => {
    it('should add a tag using app.network_add_tag function', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rowCount: 1 });
      await addTagToNetwork('00:11:22:33:44:55', 'test-tag', 'some notes');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.network_add_tag(tags, $2)'),
        ['00:11:22:33:44:55', 'test-tag', 'some notes']
      );
    });
  });

  describe('removeTagFromNetwork', () => {
    it('should remove a tag using app.network_remove_tag function', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rowCount: 1 });
      await removeTagFromNetwork('00:11:22:33:44:55', 'test-tag');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.network_remove_tag(tags, $2)'),
        ['00:11:22:33:44:55', 'test-tag']
      );
    });
  });

  describe('getOUIGroups', () => {
    it('should query oui_device_groups table', async () => {
      databaseService.query.mockResolvedValueOnce({
        rows: [{ oui: '00:11:22', device_count: 5 }],
      });
      const result = await getOUIGroups();
      expect(result).toHaveLength(1);
      expect(result[0].oui).toBe('00:11:22');
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM app.oui_device_groups'),
        []
      );
    });
  });

  describe('getOUIGroupDetails', () => {
    it('should fetch group, randomization, and networks', async () => {
      databaseService.query
        .mockResolvedValueOnce({ rows: [{ oui: '00:11:22' }] }) // group
        .mockResolvedValueOnce({ rows: [{ oui: '00:11:22', status: 'SUSPECT' }] }) // randomization
        .mockResolvedValueOnce({ rows: [{ bssid: '00:11:22:33:44:55' }] }); // networks

      const result = await getOUIGroupDetails('00:11:22');
      expect(result.group.oui).toBe('00:11:22');
      expect(result.randomization.status).toBe('SUSPECT');
      expect(result.networks).toHaveLength(1);
      expect(databaseService.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('getMACRandomizationSuspects', () => {
    it('should query mac_randomization_suspects table', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [{ oui: '00:11:22' }] });
      const result = await getMACRandomizationSuspects();
      expect(result).toHaveLength(1);
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM app.mac_randomization_suspects'),
        []
      );
    });
  });

  describe('insertNetworkTagWithNotes', () => {
    it('should insert network tag with notes', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rowCount: 1 });
      await insertNetworkTagWithNotes('B1', ['T1'], 'Notes');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_tags'),
        ['B1', '["T1"]', 'Notes']
      );
    });
  });

  describe('getNetworkTagsByBssid', () => {
    it('should return tags if found', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [{ tags: ['T1'] }] });
      const result = await getNetworkTagsByBssid('B1');
      expect(result.tags).toEqual(['T1']);
    });

    it('should return null if not found', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [] });
      const result = await getNetworkTagsByBssid('B1');
      expect(result).toBeNull();
    });
  });

  describe('getNetworkTagsAndNotes', () => {
    it('should return tags and notes if found', async () => {
      databaseService.query.mockResolvedValueOnce({
        rows: [{ bssid: 'B1', tags: ['T1'], notes: 'N' }],
      });
      const result = await getNetworkTagsAndNotes('B1');
      expect(result.bssid).toBe('B1');
    });

    it('should return null if not found', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [] });
      const result = await getNetworkTagsAndNotes('B1');
      expect(result).toBeNull();
    });
  });

  describe('getAllNetworkTags', () => {
    it('should fetch all network tags', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      const result = await getAllNetworkTags();
      expect(result).toHaveLength(1);
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM app.network_tags'),
        []
      );
    });
  });

  describe('searchNetworksByTag', () => {
    it('should search networks by tag', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      const result = await searchNetworksByTag('T1');
      expect(result).toHaveLength(1);
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('$1 = ANY(nt.tags)'),
        ['T1']
      );
    });
  });

  describe('getNetworkTagsExpanded', () => {
    it('should fetch from expanded view', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      const result = await getNetworkTagsExpanded('B1');
      expect(result.bssid).toBe('B1');
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM app.network_tags_expanded'),
        ['B1']
      );
    });

    it('should return null if not found', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [] });
      const result = await getNetworkTagsExpanded('B1');
      expect(result).toBeNull();
    });
  });

  describe('searchNetworksByTagArray', () => {
    it('should search by tag array with limit', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      const result = await searchNetworksByTagArray(['T1', 'T2'], 10);
      expect(result).toHaveLength(1);
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('tags ?& $1'),
        [['T1', 'T2'], 10]
      );
    });
  });
});
