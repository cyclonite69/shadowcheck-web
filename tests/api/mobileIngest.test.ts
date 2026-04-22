import * as path from 'path';

// 1. Setup all mocks BEFORE any other imports
jest.mock('../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    on: jest.fn(),
  },
}));

jest.mock('../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn().mockResolvedValue({ rows: [{ id: 123 }] }),
}));

// Simple mock for secretsManager
const mockSecrets: Record<string, string> = {
  s3_backup_bucket: 'test-bucket',
  aws_region: 'us-east-1',
  shadowcheck_api_key: 'test-secret-key',
};

jest.mock('../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: {
    load: jest.fn().mockResolvedValue(undefined),
    get: jest.fn((key: string) => mockSecrets[key.toLowerCase()]),
  },
}));

jest.mock('../../server/src/services/featureFlagService', () => ({
  refreshCache: jest.fn().mockResolvedValue({}),
  getFlag: jest.fn().mockReturnValue(false),
}));

jest.mock('../../server/src/services/adminImportHistoryService', () => ({
  captureImportMetrics: jest.fn().mockResolvedValue({ networks: 100 }),
  createImportHistoryEntry: jest.fn().mockResolvedValue(42),
  completeImportSuccess: jest.fn().mockResolvedValue(undefined),
  failImportHistory: jest.fn().mockResolvedValue(undefined),
}));

// Mock AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutObjectCommand: jest.fn().mockImplementation((args) => args),
  HeadObjectCommand: jest.fn().mockImplementation((args) => args),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com/upload'),
}));

// 2. NOW import the router
const { S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const mobileIngestModule = require('../../server/src/api/routes/v1/mobileIngest');
const mobileIngestRouter = mobileIngestModule.default || mobileIngestModule;
const { adminQuery } = require('../../server/src/services/adminDbService');
const adminImportHistoryService = require('../../server/src/services/adminImportHistoryService');

type MockRequest = {
  body: Record<string, unknown>;
  headers: Record<string, string | undefined>;
  ip: string;
};

type MockResponse = {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
  status: (code: number) => MockResponse;
  json: (payload: any) => MockResponse;
  setHeader: (name: string, value: string) => void;
  getHeader: (name: string) => string | undefined;
};

function getRouteHandler(path: string, method: 'post') {
  const layer = mobileIngestRouter.stack.find(
    (entry: any) => entry.route?.path === path && entry.route.methods?.[method]
  );
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

async function invokeRoute(path: string, options: any = {}) {
  const handler = getRouteHandler(path, 'post');
  const req: MockRequest = {
    body: options.body || {},
    headers: { authorization: options.authorization },
    ip: '127.0.0.1',
  };

  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const res: MockResponse = {
      statusCode: 200,
      body: undefined,
      headers: {},
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.body = payload;
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      getHeader(name: string) {
        return this.headers[name.toLowerCase()];
      },
    };

    handler(req, res, (err: any) => {
      if (err) resolve({ status: 500, body: { error: err.message } });
      else resolve({ status: res.statusCode, body: res.body });
    });
  });
}

describe('Mobile Ingest API - Request Upload', () => {
  const API_KEY = 'test-secret-key';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SHADOWCHECK_API_KEY = API_KEY;
    S3Client.mockImplementation(() => ({ send: mockSend }));
    getSignedUrl.mockResolvedValue('https://mock-presigned-url.com/upload');
    adminQuery.mockResolvedValue({ rows: [{ id: 123 }] });
    adminImportHistoryService.captureImportMetrics.mockResolvedValue({ networks: 100 });
    adminImportHistoryService.createImportHistoryEntry.mockResolvedValue(42);
  });

  it('should return 401 if Authorization header is missing', async () => {
    const response = await invokeRoute('/request-upload');
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Missing Authorization header');
  });

  it('should return 200 and presigned URL data on success', async () => {
    const response = await invokeRoute('/request-upload', {
      authorization: `Bearer ${API_KEY}`,
      body: { fileName: 'test.sqlite' },
    });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('uploadUrl');
    expect(response.body).toHaveProperty('s3Key');
  });

  it('records verified uploads as pending for manual start', async () => {
    mockSend.mockResolvedValueOnce({});

    const response = await invokeRoute('/complete', {
      authorization: `Bearer ${API_KEY}`,
      body: {
        s3Key: 'uploads/default/20260422/test.sqlite',
        sourceTag: 'android_shadowcheck_test',
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      status: 'pending',
      uploadId: 123,
      s3Key: 'uploads/default/20260422/test.sqlite',
      sourceTag: 'android_shadowcheck_test',
    });
    expect(adminImportHistoryService.createImportHistoryEntry).toHaveBeenCalledWith(
      'android_shadowcheck_test',
      'test.sqlite',
      { networks: 100 },
      'pending'
    );
  });
});
