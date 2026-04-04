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
  method: 'get' | 'patch',
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
  let patchNoteHandler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    router = require('../../server/src/api/routes/v1/networks/notes');
    getNotesHandler = getRouteHandler(router, 'get', '/networks/:bssid/notes');
    patchNoteHandler = getRouteHandler(router, 'patch', '/networks/:bssid/notes/:noteId');
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
});
