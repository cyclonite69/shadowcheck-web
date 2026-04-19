export {};

const {
  addNetworkNote,
  getNetworkNotes,
  deleteNetworkNote,
  uploadNetworkMedia,
  getNetworkMediaList,
  getNetworkMediaFile,
  addNetworkNotation,
  getNetworkNotations,
} = require('../../../../server/src/services/admin/networkNotesAdminService');

jest.mock('../../../../server/src/config/container', () => ({
  adminDbService: {
    adminQuery: jest.fn(),
  },
  databaseService: {
    query: jest.fn(),
  },
}));

const { adminDbService, databaseService } = require('../../../../server/src/config/container');

describe('networkNotesAdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const VALID_BSSID = 'AA:BB:CC:DD:EE:FF';

  describe('addNetworkNote', () => {
    it('should insert a note and return the id', async () => {
      adminDbService.adminQuery.mockResolvedValue({ rows: [{ id: 123 }] });
      const id = await addNetworkNote(VALID_BSSID, 'content');
      expect(id).toBe(123);
      expect(adminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_notes'),
        [VALID_BSSID, 'content']
      );
    });

    it('should throw error for invalid BSSID', async () => {
      await expect(addNetworkNote('invalid', 'content')).rejects.toThrow('Invalid BSSID');
    });
  });

  describe('getNetworkNotes', () => {
    it('should return notes for a BSSID', async () => {
      const mockNotes = [{ id: 1, content: 'test' }];
      databaseService.query.mockResolvedValue({ rows: mockNotes });
      const result = await getNetworkNotes(VALID_BSSID);
      expect(result).toEqual(mockNotes);
    });

    it('should return empty array for invalid BSSID', async () => {
      const result = await getNetworkNotes('invalid');
      expect(result).toEqual([]);
      expect(databaseService.query).not.toHaveBeenCalled();
    });
  });

  describe('deleteNetworkNote', () => {
    it('should delete a note and return the bssid', async () => {
      adminDbService.adminQuery.mockResolvedValue({ rows: [{ bssid: VALID_BSSID }] });
      const bssid = await deleteNetworkNote('note-1');
      expect(bssid).toBe(VALID_BSSID);
    });

    it('should return null if note not found', async () => {
      adminDbService.adminQuery.mockResolvedValue({ rows: [] });
      const bssid = await deleteNetworkNote('missing-note');
      expect(bssid).toBeNull();
    });
  });

  describe('uploadNetworkMedia', () => {
    const JPEG_DATA = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22]);

    it('should insert media and return the new row', async () => {
      const mockMedia = { id: 1, filename: 'test.jpg' };
      adminDbService.adminQuery.mockResolvedValue({ rows: [mockMedia] });
      const result = await uploadNetworkMedia(
        VALID_BSSID,
        'test.jpg',
        'image/jpeg',
        JPEG_DATA
      );
      expect(result).toEqual(mockMedia);
    });

    it('should throw for invalid BSSID', async () => {
      await expect(
        uploadNetworkMedia('invalid', 'test.jpg', 'image/jpeg', JPEG_DATA)
      ).rejects.toThrow('Invalid BSSID');
    });

    it('should throw for MIME-type mismatch', async () => {
      const randomData = Buffer.from([0x00, 0x11, 0x22, 0x33]);
      await expect(
        uploadNetworkMedia(VALID_BSSID, 'test.jpg', 'image/jpeg', randomData)
      ).rejects.toThrow('MIME-type mismatch');
    });

    it('should throw for truncated/empty buffer', async () => {
      await expect(
        uploadNetworkMedia(VALID_BSSID, 'test.jpg', 'image/jpeg', Buffer.alloc(0))
      ).rejects.toThrow('MIME-type mismatch');
    });

    it('should allow unknown MIME types with caution', async () => {
      const mockMedia = { id: 2, filename: 'test.unknown' };
      adminDbService.adminQuery.mockResolvedValue({ rows: [mockMedia] });
      const result = await uploadNetworkMedia(
        VALID_BSSID,
        'test.unknown',
        'application/octet-stream',
        Buffer.from([0xDE, 0xAD, 0xBE, 0xEF])
      );
      expect(result).toEqual(mockMedia);
    });
  });

  describe('getNetworkMediaList', () => {
    it('should return media list for a BSSID', async () => {
      const mockList = [{ id: 1 }];
      databaseService.query.mockResolvedValue({ rows: mockList });
      const result = await getNetworkMediaList(VALID_BSSID);
      expect(result).toEqual(mockList);
    });
  });

  describe('getNetworkMediaFile', () => {
    it('should return a single media file', async () => {
      const mockFile = { id: 1, data: 'binary' };
      databaseService.query.mockResolvedValue({ rows: [mockFile] });
      const result = await getNetworkMediaFile('1');
      expect(result).toEqual(mockFile);
    });

    it('should return null if not found', async () => {
      databaseService.query.mockResolvedValue({ rows: [] });
      const result = await getNetworkMediaFile('999');
      expect(result).toBeNull();
    });
  });

  describe('addNetworkNotation', () => {
    it('should insert a notation and return the row', async () => {
      const mockRow = { id: 1, text: 'test' };
      adminDbService.adminQuery.mockResolvedValue({ rows: [mockRow] });
      const result = await addNetworkNotation(VALID_BSSID, 'test', 'GENERAL');
      expect(result).toEqual(mockRow);
    });
  });

  describe('getNetworkNotations', () => {
    it('should return notations list', async () => {
      const mockList = [{ id: 1 }];
      databaseService.query.mockResolvedValue({ rows: mockList });
      const result = await getNetworkNotations(VALID_BSSID);
      expect(result).toEqual(mockList);
    });
  });
});
