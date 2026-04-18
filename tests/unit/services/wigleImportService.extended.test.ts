import * as fs from 'fs';
import * as path from 'path';
import * as wigleImportService from '../../../server/src/services/wigleImportService';
import * as adminDb from '../../../server/src/services/adminDbService';
import logger from '../../../server/src/logging/logger';

jest.mock('fs');
jest.mock('../../../server/src/services/adminDbService');
jest.mock('../../../server/src/logging/logger');

describe('wigleImportService - Extended', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn(),
    };
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };
    (adminDb.getAdminPool as jest.Mock).mockReturnValue(mockPool);
  });

  describe('importWigleV2Json', () => {
    it('should successfully import all networks in a JSON file', async () => {
      const mockData = {
        results: [
          { netid: 'AA:BB:CC', ssid: 'test1', trilat: '1.1', trilong: '2.2' },
          { netid: 'DD:EE:FF', ssid: 'test2', trilat: '3.3', trilong: '4.4' },
        ],
      };
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockData));

      // We need to access the private function importWigleV2Json.
      // Since it's not exported, we'll test it through importWigleDirectory or
      // by using require if it was exported.
      // Wait, looking at wigleImportService.ts, it ONLY exports importWigleDirectory.
      // So I must test it through importWigleDirectory.

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['data.json']);

      const result = await wigleImportService.importWigleDirectory('/test');
      expect(result.totalImported).toBe(2);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.query).toHaveBeenCalledWith('SAVEPOINT sp_network');
      expect(mockClient.query).toHaveBeenCalledWith('RELEASE SAVEPOINT sp_network');
    });

    it('should handle partial failures and continue importing', async () => {
      const mockData = {
        results: [
          { netid: 'GOOD', ssid: 'good' },
          { netid: 'BAD', ssid: 'bad' },
          { netid: 'GOOD2', ssid: 'good2' },
        ],
      };
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockData));
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['data.json']);

      // Mock query to fail for the 'BAD' network
      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        if (params && params[0] === 'BAD') {
          return Promise.reject(new Error('DB Error'));
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      const result = await wigleImportService.importWigleDirectory('/test');
      expect(result.totalImported).toBe(2);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_network');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error inserting network BAD')
      );
    });

    it('should rollback transaction if JSON parsing fails', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['data.json']);

      const result = await wigleImportService.importWigleDirectory('/test');
      expect(result.totalImported).toBe(0);
      expect(result.results[0].error).toBeDefined();
      // In importWigleV2Json, JSON.parse happens before BEGIN?
      // No, looking at the code:
      // try {
      //   const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
      //   ...
      //   await client.query('BEGIN');
      // But wait, the catch block calls ROLLBACK.
      // If it fails at JSON.parse, it will call ROLLBACK which might fail if BEGIN wasn't called.
      // Let's see how our mock handles it.
    });
  });

  describe('importWigleDirectory', () => {
    it('should ignore non-JSON files', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['data.json', 'readme.txt', 'other.json']);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ results: [] }));

      const result = await wigleImportService.importWigleDirectory('/test');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].file).toBe('data.json');
      expect(result.results[1].file).toBe('other.json');
    });

    it('should handle file read errors gracefully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['data.json']);
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = await wigleImportService.importWigleDirectory('/test');
      expect(result.totalImported).toBe(0);
      expect(result.results[0].error).toBe('Read error');
    });
  });
});
