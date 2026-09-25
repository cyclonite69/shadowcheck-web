const wigleImportService = require('../../../server/src/services/wigleImportService');
const adminDb = require('../../../server/src/services/adminDbService');
import * as fs from 'fs';

jest.mock('fs');
jest.mock('../../../server/src/services/adminDbService');
jest.mock('../../../server/src/logging/logger');

describe('wigleImportService', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };
    (adminDb.getAdminPool as jest.Mock).mockReturnValue(mockPool);
  });

  describe('importWigleDirectory', () => {
    it('should throw if directory does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await expect(wigleImportService.importWigleDirectory('/nonexistent')).rejects.toThrow();
    });

    it('should rollback transaction on top-level error', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['test.json']);
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Parsing error');
      });

      await expect(wigleImportService.importWigleDirectory('/test')).resolves.toEqual({
        totalImported: 0,
        results: [{ file: 'test.json', imported: 0, error: 'Parsing error' }],
      });
      expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    });

    it('should continue processing other files if one file fails', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['file1.json', 'file2.json']);
      (fs.readFileSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('file1')) {
          return JSON.stringify({ results: [] });
        }
        throw new Error('File 2 failed');
      });

      const result = await wigleImportService.importWigleDirectory('/test');
      expect(result.totalImported).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[1].error).toBe('File 2 failed');
    });

    it('should rollback on SQL error within a file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['test.json']);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ results: [{ netid: '1' }] }));
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes('INSERT')) {
          return Promise.reject(new Error('Insert error'));
        }
        return Promise.resolve();
      });

      const result = await wigleImportService.importWigleDirectory('/test');
      expect(result.totalImported).toBe(0);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_network');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });
});
