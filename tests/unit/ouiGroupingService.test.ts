/**
 * OUIGroupingService Unit Tests
 */

import { query, pool } from '../../server/src/config/database';
import logger from '../../server/src/logging/logger';

const OUIGroupingService = require('../../server/src/services/ouiGroupingService');

jest.mock('../../server/src/config/database');
jest.mock('../../server/src/logging/logger');

describe('OUIGroupingService', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  describe('generateOUIGroups', () => {
    it('should handle empty network list', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await OUIGroupingService.generateOUIGroups();

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(mockClient.release).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Completed: 0 groups'));
    });

    it('should not create a group for a single BSSID', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            bssid: '00:11:22:33:44:55',
            oui: '00:11:22',
            final_threat_score: 50,
            observations: 10,
            unique_days: 2,
            max_distance_km: 1.5,
          },
        ],
      });

      await OUIGroupingService.generateOUIGroups();

      expect(mockClient.query).toHaveBeenCalledTimes(3); // SELECT + BEGIN + COMMIT
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.oui_device_groups'),
        expect.anything()
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should create a group for multiple BSSIDs with the same OUI within a transaction', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              bssid: '00:11:22:33:44:55',
              oui: '00:11:22',
              final_threat_score: 90,
              observations: 10,
              unique_days: 5,
              max_distance_km: 2.0,
            },
            {
              bssid: '00:11:22:AA:BB:CC',
              oui: '00:11:22',
              final_threat_score: 50,
              observations: 5,
              unique_days: 2,
              max_distance_km: 1.0,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1 }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await OUIGroupingService.generateOUIGroups();

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.oui_device_groups'),
        ['00:11:22', 2, 90, 'CRITICAL', '00:11:22:33:44:55', ['00:11:22:AA:BB:CC']]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should correctly assign threat levels', async () => {
      const testCases = [
        { score: 85, level: 'CRITICAL' },
        { score: 65, level: 'HIGH' },
        { score: 45, level: 'MED' },
        { score: 25, level: 'LOW' },
        { score: 10, level: 'NONE' },
      ];

      for (const tc of testCases) {
        mockClient.query.mockReset();
        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              { bssid: '00:11:22:1', oui: '00:11:22', final_threat_score: tc.score },
              { bssid: '00:11:22:2', oui: '00:11:22', final_threat_score: 0 },
            ],
          })
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rowCount: 1 }) // INSERT
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        await OUIGroupingService.generateOUIGroups();

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO app.oui_device_groups'),
          expect.arrayContaining([tc.level])
        );
      }
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('DB error');
      mockClient.query.mockRejectedValueOnce(error);

      await OUIGroupingService.generateOUIGroups();

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed:'), error);
    });
  });

  describe('detectMACRandomization', () => {
    it('should handle empty results', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await OUIGroupingService.detectMACRandomization();

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should flag confirmed randomization within a transaction', async () => {
      const now = new Date();
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(now.getDate() - 10);

      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              oui: '00:AA:BB',
              mac_count: 10,
              mac_sequence: ['00:AA:BB:1', '00:AA:BB:2'],
              first_seen: tenDaysAgo.toISOString(),
              last_seen: now.toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1 }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await OUIGroupingService.detectMACRandomization();

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.mac_randomization_suspects'),
        expect.arrayContaining(['confirmed'])
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should handle errors and rollback in detectMACRandomization', async () => {
      const error = new Error('Randomization check failed');
      mockClient.query.mockRejectedValueOnce(error);

      await OUIGroupingService.detectMACRandomization();

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed:'), error);
    });

    it('should skip sequences with fewer than 3 MACs', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            oui: '00:11:22',
            mac_count: 2,
            mac_sequence: ['00:11:22:1', '00:11:22:2'],
          },
        ],
      });

      await OUIGroupingService.detectMACRandomization();

      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.mac_randomization_suspects'),
        expect.anything()
      );
    });

    it('should handle timeDelta calculation edge cases', async () => {
      // Case where first_seen or last_seen is null
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            oui: '00:BB:CC',
            mac_count: 3,
            mac_sequence: ['00:BB:CC:1', '00:BB:CC:2', '00:BB:CC:3'],
            first_seen: null,
            last_seen: null,
          },
        ],
      });

      await OUIGroupingService.detectMACRandomization();
      // timeDelta should be 0, avgSpeed should be 0, confidenceScore should be 0.5 (0.6 + 0.4 / 2)
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.mac_randomization_suspects'),
        expect.anything()
      );
    });
  });
});
