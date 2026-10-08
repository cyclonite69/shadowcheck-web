export {};

const mediaService = {
  getNetworkNotes: jest.fn(),
  addNetworkNoteWithFunction: jest.fn(),
  updateNetworkNote: jest.fn(),
  deleteNetworkNote: jest.fn(),
};

jest.mock('../../server/src/config/container', () => ({
  adminNetworkMediaService: mediaService,
}));

jest.mock('../../server/src/middleware/authMiddleware', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../server/src/validation/middleware', () => ({
  bssidParamMiddleware: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../server/src/logging/logger', () => ({
  error: jest.fn(),
}));

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

function getRouteHandler(
  router: any,
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  handlerIndex = -1
): (req: any, res: any) => Promise<any> | any {
  const layer = router.stack.find(
    (entry: any) => entry.route?.path === path && entry.route?.methods?.[method]
  );
  if (!layer) {
    throw new Error(`Missing route ${method.toUpperCase()} ${path}`);
  }

  const handlers = layer.route.stack.map((entry: any) => entry.handle);
  return handlerIndex >= 0 ? handlers[handlerIndex] : handlers[handlers.length - 1];
}

describe('network notes routes', () => {
  let router: any;
  let getNotesHandler: any;
  let postNoteHandler: any;
  let patchNoteHandler: any;
  let deleteNoteHandler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    router = require('../../server/src/api/routes/v1/networks/notes');
    getNotesHandler = getRouteHandler(router, 'get', '/networks/:bssid/notes');
    postNoteHandler = getRouteHandler(router, 'post', '/networks/:bssid/notes');
    patchNoteHandler = getRouteHandler(router, 'patch', '/networks/:bssid/notes/:noteId');
    deleteNoteHandler = getRouteHandler(router, 'delete', '/networks/:bssid/notes/:noteId');
  });

  test('loads notes via adminNetworkMediaService', async () => {
    mediaService.getNetworkNotes.mockResolvedValue([
      { id: 10, bssid: 'AA:BB:CC:DD:EE:FF', content: 'existing note' },
    ]);

    const req = { params: { bssid: 'AA:BB:CC:DD:EE:FF' } };
    const res = createRes();

    await getNotesHandler(req, res);

    expect(mediaService.getNetworkNotes).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
  });

  test('updates notes via adminNetworkMediaService', async () => {
    mediaService.updateNetworkNote.mockResolvedValue({
      id: 42,
      bssid: 'AA:BB:CC:DD:EE:FF',
      content: 'updated note',
    });

    const req = {
      params: { bssid: 'AA:BB:CC:DD:EE:FF', noteId: '42' },
      body: { content: 'updated note' },
    };
    const res = createRes();

    await patchNoteHandler(req, res);

    expect(mediaService.updateNetworkNote).toHaveBeenCalledWith('42', 'updated note');
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.content).toBe('updated note');
  });

  test('normalizes BSSID and creates a trimmed note', async () => {
    mediaService.addNetworkNoteWithFunction.mockResolvedValue('17');
    const req = {
      params: { bssid: 'aa:bb:cc:dd:ee:ff' },
      body: { content: '  analyst note  ' },
    };
    const res = createRes();

    await postNoteHandler(req, res);

    expect(mediaService.addNetworkNoteWithFunction).toHaveBeenCalledWith(
      'AA:BB:CC:DD:EE:FF',
      'analyst note',
      'general',
      'system'
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true, id: '17', bssid: 'AA:BB:CC:DD:EE:FF' });
  });

  test.each([
    ['post', { content: '   ' }],
    ['patch', { content: null }],
  ])('rejects empty content for %s', async (method, body) => {
    const req = {
      params: { bssid: 'AA:BB:CC:DD:EE:FF', noteId: '42' },
      body,
    };
    const res = createRes();

    await (method === 'post' ? postNoteHandler : patchNoteHandler)(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('content is required');
  });

  test('returns 404 when an update target is missing', async () => {
    mediaService.updateNetworkNote.mockResolvedValue(null);
    const req = {
      params: { bssid: 'AA:BB:CC:DD:EE:FF', noteId: '42' },
      body: { content: 'updated' },
    };
    const res = createRes();

    await patchNoteHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  test('hard-deletes notes and returns the affected BSSID', async () => {
    mediaService.deleteNetworkNote.mockResolvedValue('AA:BB:CC:DD:EE:FF');
    const req = { params: { bssid: 'AA:BB:CC:DD:EE:FF', noteId: '42' } };
    const res = createRes();

    await deleteNoteHandler(req, res);

    expect(mediaService.deleteNetworkNote).toHaveBeenCalledWith('42');
    expect(res.body).toEqual({
      ok: true,
      deleted: true,
      note_id: '42',
      bssid: 'AA:BB:CC:DD:EE:FF',
    });
  });

  test('returns 404 when a note cannot be deleted', async () => {
    mediaService.deleteNetworkNote.mockResolvedValue(null);
    const req = { params: { bssid: 'AA:BB:CC:DD:EE:FF', noteId: '42' } };
    const res = createRes();

    await deleteNoteHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Note not found');
  });

  test.each([
    ['get', () => getNotesHandler, 'getNetworkNotes'],
    ['post', () => postNoteHandler, 'addNetworkNoteWithFunction'],
    ['patch', () => patchNoteHandler, 'updateNetworkNote'],
    ['delete', () => deleteNoteHandler, 'deleteNetworkNote'],
  ])('returns 500 when the %s service call fails', async (_method, handler, serviceMethod) => {
    mediaService[serviceMethod as keyof typeof mediaService].mockRejectedValueOnce(
      new Error('service failed')
    );
    const req = {
      params: { bssid: 'AA:BB:CC:DD:EE:FF', noteId: '42' },
      body: { content: 'content' },
    };
    const res = createRes();

    await handler()(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('service failed');
  });
});
