const wigleImportService = require('../../../server/src/services/wigleImportService');
const adminDb = require('../../../server/src/services/adminDbService');
import * as fs from 'fs';
const logger = require('../../../server/src/logging/logger');

jest.mock('fs');
jest.mock('../../../server/src/services/adminDbService');
jest.mock('../../../server/src/logging/logger');

describe('wigleImportService', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (adminDb.getAdminPool as jest.Mock).mockReturnValue({
      connect: jest.fn().mockResolvedValue(mockClient),
    });
  });

  describe('importWigleDirectory', () => {
    it('should throw if directory does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await expect(wigleImportService.importWigleDirectory('/nonexistent')).rejects.toThrow();
    });

    it('should process JSON files in directory', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['test.json']);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ results: [] }));

      const result = await wigleImportService.importWigleDirectory('/test');
      expect(result.totalImported).toBe(0);
      expect(mockClient.connect).toHaveBeenCalled();
    });
  });
});
