jest.mock('../../../../server/src/config/container', () => ({
  adminDbService: {
    adminQuery: jest.fn(),
  },
}));

import * as networkTagsAdminService from '../../../../server/src/services/admin/networkTagsAdminService';
const { adminDbService } = require('../../../../server/src/config/container');

describe('networkTagsAdminService', () => {
  const bssid = 'AA:BB:CC:DD:EE:FF';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertNetworkTag', () => {
    it('should update existing tag when bssid exists', async () => {
      adminDbService.adminQuery
        .mockResolvedValueOnce({ rows: [{ bssid }] }) // existing check
        .mockResolvedValue({ rows: [{ bssid }] }); // all updates

      const result = await networkTagsAdminService.upsertNetworkTag(bssid, 'threat', true, 'some notes');

      expect(result).toEqual({ bssid, updated: true });
      expect(adminDbService.adminQuery).toHaveBeenCalledTimes(4); // check + 3 updates
    });

    it('should insert new tag when bssid does not exist', async () => {
      adminDbService.adminQuery
        .mockResolvedValueOnce({ rows: [] }) // existing check
        .mockResolvedValue({ rows: [{ bssid }] }); // all inserts

      const result = await networkTagsAdminService.upsertNetworkTag(bssid, 'threat', true, 'some notes');

      expect(result).toEqual({ bssid, inserted: true });
      expect(adminDbService.adminQuery).toHaveBeenCalledTimes(4); // check + 3 inserts
    });

    it('should only perform actions for non-null parameters', async () => {
      adminDbService.adminQuery
        .mockResolvedValueOnce({ rows: [{ bssid }] }) // existing check
        .mockResolvedValue({ rows: [{ bssid }] }); // updates

      await networkTagsAdminService.upsertNetworkTag(bssid, 'threat', null, null);

      expect(adminDbService.adminQuery).toHaveBeenCalledTimes(2); // check + 1 update (threatTag)
    });
  });

  describe('individual update/insert functions', () => {
    const mockRow = { bssid, threat_tag: 'threat', is_ignored: true, notes: 'notes' };

    it('updateNetworkTagIgnore should call UPDATE', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [mockRow] });
      await networkTagsAdminService.updateNetworkTagIgnore(bssid, true);
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app.network_tags SET is_ignored = $1'),
        [true, bssid]
      );
    });

    it('insertNetworkTagIgnore should call INSERT', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [mockRow] });
      await networkTagsAdminService.insertNetworkTagIgnore(bssid, true);
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_tags (bssid, is_ignored)'),
        [bssid, true]
      );
    });

    it('updateNetworkThreatTag should call UPDATE', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [mockRow] });
      await networkTagsAdminService.updateNetworkThreatTag(bssid, 'threat');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app.network_tags SET threat_tag = $1'),
        ['threat', bssid]
      );
    });

    it('insertNetworkThreatTag should call INSERT', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [mockRow] });
      await networkTagsAdminService.insertNetworkThreatTag(bssid, 'threat');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_tags (bssid, threat_tag)'),
        [bssid, 'threat']
      );
    });

    it('updateNetworkTagNotes should call UPDATE', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [mockRow] });
      await networkTagsAdminService.updateNetworkTagNotes(bssid, 'notes');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app.network_tags SET notes = $1'),
        ['notes', bssid]
      );
    });

    it('insertNetworkTagNotes should call INSERT', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [mockRow] });
      await networkTagsAdminService.insertNetworkTagNotes(bssid, 'notes');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_tags (bssid, notes)'),
        [bssid, 'notes']
      );
    });
  });

  describe('deleteNetworkTag', () => {
    it('should delete tag and return rowCount', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rowCount: 1 });
      const result = await networkTagsAdminService.deleteNetworkTag(bssid);
      expect(result).toBe(1);
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM app.network_tags WHERE bssid = $1'),
        [bssid]
      );
    });
  });
});
