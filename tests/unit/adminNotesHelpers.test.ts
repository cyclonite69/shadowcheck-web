export {};

const logger = {
  error: jest.fn(),
};

type MockRes = {
  statusCode: number;
  body: any;
  status: (code: number) => MockRes;
  json: (payload: any) => MockRes;
};

function createRes(): MockRes {
  return {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}

describe('adminNotesHelpers.handleNoteMediaUpload', () => {
  let handleNoteMediaUpload: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    ({ handleNoteMediaUpload } = require('../../server/src/api/routes/v1/admin/adminNotesHelpers'));
  });

  test('uses the note bssid instead of client multipart bssid when uploading media', async () => {
    const service = {
      getNetworkNoteById: jest.fn().mockResolvedValue({
        id: 8,
        bssid: 'AA:BB:CC:DD:EE:FF',
      }),
      addNoteMedia: jest.fn().mockResolvedValue({
        id: 99,
        file_name: 'LaFimilaSign.webp',
        file_size: 1234,
        mime_type: 'image/webp',
      }),
    };
    const req = {
      params: { noteId: '8' },
      body: { bssid: 'bad:bssid:value:00' },
      file: {
        originalname: 'LaFimilaSign.webp',
        size: 1234,
        mimetype: 'image/webp',
        buffer: Buffer.from('test'),
      },
    };
    const res = createRes();

    await handleNoteMediaUpload(req, res, service, logger);

    expect(service.getNetworkNoteById).toHaveBeenCalledWith('8');
    expect(service.addNoteMedia).toHaveBeenCalledWith(
      '8',
      'AA:BB:CC:DD:EE:FF',
      null,
      'LaFimilaSign.webp',
      1234,
      'image',
      expect.any(Buffer),
      'image/webp',
      'db'
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('returns 404 when the note does not exist', async () => {
    const service = {
      getNetworkNoteById: jest.fn().mockResolvedValue(null),
      addNoteMedia: jest.fn(),
    };
    const req = {
      params: { noteId: '8' },
      body: {},
      file: {
        originalname: 'LaFimilaSign.webp',
        size: 1234,
        mimetype: 'image/webp',
        buffer: Buffer.from('test'),
      },
    };
    const res = createRes();

    await handleNoteMediaUpload(req, res, service, logger);

    expect(service.addNoteMedia).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Note not found');
  });
});
