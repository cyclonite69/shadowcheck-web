/**
 * Network Tag Core Unit Tests
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
  addNetworkNote,
  checkDuplicateObservations,
  deleteNetworkTag,
  exportMLTrainingSet,
  getBackupData,
  getNetworkSummary,
  fetchNetworksPendingWigleLookup,
  insertNetworkTagIgnore,
  insertNetworkTagNotes,
  insertNetworkThreatTag,
  markNetworkInvestigate,
  requestWigleLookup,
  updateNetworkTagIgnore,
  updateNetworkTagNotes,
  updateNetworkThreatTag,
  upsertNetworkTag,
} from '../../../server/src/services/admin/networkTagCore';
const { adminDbService, databaseService } = require('../../../server/src/config/container');

describe('networkTagCore Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDuplicateObservations', () => {
    it('should query for duplicate observations', async () => {
      const mockResult = { rows: [{ total_observations: 5 }] };
      databaseService.query.mockResolvedValueOnce(mockResult);
      const result = await checkDuplicateObservations('00:11:22:33:44:55', 1234567890);
      expect(result).toEqual(mockResult.rows[0]);
      expect(databaseService.query).toHaveBeenCalledWith(expect.stringContaining('WITH target_obs AS'), [
        '00:11:22:33:44:55',
        1234567890,
      ]);
    });

    it('should return null if no observations found', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [] });
      const result = await checkDuplicateObservations('00:11:22:33:44:55', 1234567890);
      expect(result).toBeNull();
    });
  });

  describe('addNetworkNote', () => {
    it('should add a note and return its id', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [{ note_id: 123 }] });
      const result = await addNetworkNote('00:11:22:33:44:55', 'test note');
      expect(result).toBe(123);
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT app.network_add_note'),
        ['00:11:22:33:44:55', 'test note']
      );
    });
  });

  describe('getNetworkSummary', () => {
    it('should return network summary if found', async () => {
      const mockSummary = { bssid: '00:11:22:33:44:55', tags: [] };
      databaseService.query.mockResolvedValueOnce({ rows: [mockSummary] });
      const result = await getNetworkSummary('00:11:22:33:44:55');
      expect(result).toEqual(mockSummary);
    });

    it('should return null if not found', async () => {
      databaseService.query.mockResolvedValueOnce({ rows: [] });
      const result = await getNetworkSummary('00:11:22:33:44:55');
      expect(result).toBeNull();
    });
  });

  describe('getBackupData', () => {
    it('should fetch observations, networks, and tags', async () => {
      databaseService.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // observations
        .mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] }) // networks
        .mockResolvedValueOnce({ rows: [{ bssid: 'B1', tag: 'T1' }] }); // tags

      const result = await getBackupData();
      expect(result.observations).toHaveLength(1);
      expect(result.networks).toHaveLength(1);
      expect(result.tags).toHaveLength(1);
      expect(databaseService.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('upsertNetworkTag', () => {
    it('should call adminQuery with correct SQL and parameters', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ bssid: '00:11:22:33:44:55' }] });
      await upsertNetworkTag('00:11:22:33:44:55', true, 'test', 'THREAT', 0.9, 'notes');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_tags'),
        ['00:11:22:33:44:55', true, 'test', 'THREAT', 0.9, 'notes']
      );
    });
  });

  describe('updateNetworkTagIgnore', () => {
    it('should update ignore status', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      await updateNetworkTagIgnore('B1', true, 'Reason');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app.network_tags SET is_ignored = $1'),
        [true, 'Reason', 'B1']
      );
    });
  });

  describe('insertNetworkTagIgnore', () => {
    it('should insert ignore status', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      await insertNetworkTagIgnore('B1', true, 'Reason');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_tags (bssid, is_ignored, ignore_reason)'),
        ['B1', true, 'Reason']
      );
    });
  });

  describe('updateNetworkThreatTag', () => {
    it('should update threat tag', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      await updateNetworkThreatTag('B1', 'THREAT', 0.8);
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app.network_tags SET threat_tag = $1'),
        ['THREAT', 0.8, 'B1']
      );
    });
  });

  describe('insertNetworkThreatTag', () => {
    it('should insert threat tag', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      await insertNetworkThreatTag('B1', 'THREAT', 0.8);
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_tags (bssid, threat_tag, threat_confidence)'),
        ['B1', 'THREAT', 0.8]
      );
    });
  });

  describe('updateNetworkTagNotes', () => {
    it('should update notes', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      await updateNetworkTagNotes('B1', 'New notes');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app.network_tags SET notes = $1'),
        ['New notes', 'B1']
      );
    });
  });

  describe('insertNetworkTagNotes', () => {
    it('should insert notes', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      await insertNetworkTagNotes('B1', 'New notes');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_tags (bssid, notes)'),
        ['B1', 'New notes']
      );
    });
  });

  describe('deleteNetworkTag', () => {
    it('should return rowCount from adminQuery', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rowCount: 1 });
      const result = await deleteNetworkTag('00:11:22:33:44:55');
      expect(result).toBe(1);
    });

    it('should return 0 if rowCount is missing', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rowCount: null });
      const result = await deleteNetworkTag('00:11:22:33:44:55');
      expect(result).toBe(0);
    });
  });

  describe('requestWigleLookup', () => {
    it('should mark wigle_lookup_requested as true', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      await requestWigleLookup('B1');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET wigle_lookup_requested = true'),
        ['B1']
      );
    });
  });

  describe('markNetworkInvestigate', () => {
    it('should upsert investigate tag', async () => {
      adminDbService.adminQuery.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      await markNetworkInvestigate('B1');
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_tags'),
        ['B1']
      );
    });
  });

  describe('fetchNetworksPendingWigleLookup', () => {
    it('should fetch networks pending lookup', async () => {
      const mockRows = [{ bssid: 'B1' }];
      databaseService.query.mockResolvedValueOnce({ rows: mockRows });
      const result = await fetchNetworksPendingWigleLookup(10);
      expect(result).toEqual(mockRows);
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('wigle_lookup_requested = true'),
        [10]
      );
    });
  });

  describe('exportMLTrainingSet', () => {
    it('should query for ML training set', async () => {
      const mockRows = [{ bssid: 'B1', threat_tag: 'THREAT' }];
      databaseService.query.mockResolvedValueOnce({ rows: mockRows });
      const result = await exportMLTrainingSet();
      expect(result).toEqual(mockRows);
      expect(databaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        []
      );
    });
  });
});
