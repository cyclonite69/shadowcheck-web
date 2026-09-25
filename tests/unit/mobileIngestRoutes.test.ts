import express from 'express';
import request from 'supertest';

const mockSecretsGet = jest.fn();
const mockS3Send = jest.fn();
const mockGetSignedUrl = jest.fn();
const mockRecordUpload = jest.fn();

jest.mock('../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: { get: mockSecretsGet },
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn((input) => ({ type: 'put', input })),
  HeadObjectCommand: jest.fn((input) => ({ type: 'head', input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'upload-id'),
}));

jest.mock('../../server/src/services/mobileIngestService', () => ({
  recordUpload: mockRecordUpload,
}));

jest.mock('../../server/src/logging/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');

const app = express();
app.use(express.json());
app.use('/api/v1/ingest', require('../../server/src/api/routes/v1/mobileIngest').default);

describe('mobile ingest routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    S3Client.mockImplementation(() => ({ send: mockS3Send }));
    PutObjectCommand.mockImplementation((input: any) => ({ type: 'put', input }));
    HeadObjectCommand.mockImplementation((input: any) => ({ type: 'head', input }));
    randomUUID.mockReturnValue('upload-id');
    mockSecretsGet.mockImplementation((key: string) => {
      if (key === 'shadowcheck_api_key') {
        return 'server-key';
      }
      if (key === 's3_backup_bucket') {
        return 'bucket';
      }
      if (key === 'aws_region') {
        return 'us-east-2';
      }
      return undefined;
    });
  });

  it('requires an Authorization header', async () => {
    const response = await request(app).post('/api/v1/ingest/request-upload').send({});

    expect(response.status).toBe(401);
  });

  it('requires Bearer authorization', async () => {
    const response = await request(app)
      .post('/api/v1/ingest/request-upload')
      .set('Authorization', 'Basic key')
      .send({});

    expect(response.status).toBe(401);
  });

  it('rejects requests when the server key is not configured', async () => {
    mockSecretsGet.mockReturnValue(undefined);
    delete process.env.SHADOWCHECK_API_KEY;

    const response = await request(app)
      .post('/api/v1/ingest/request-upload')
      .set('Authorization', 'Bearer key')
      .send({ fileName: 'scan.sqlite' });

    expect(response.status).toBe(401);
  });

  it('rejects an incorrect API key', async () => {
    const response = await request(app)
      .post('/api/v1/ingest/request-upload')
      .set('Authorization', 'Bearer wrong-key')
      .send({ fileName: 'scan.sqlite' });

    expect(response.status).toBe(401);
  });

  it('requires an upload file name', async () => {
    const response = await request(app)
      .post('/api/v1/ingest/request-upload')
      .set('Authorization', 'Bearer server-key')
      .send({});

    expect(response.status).toBe(400);
  });

  it('enforces the upload size limit', async () => {
    const response = await request(app)
      .post('/api/v1/ingest/request-upload')
      .set('Authorization', 'Bearer server-key')
      .send({ fileName: 'scan.sqlite', filesize: 524288001 });

    expect(response.status).toBe(400);
  });

  it('creates a presigned upload request', async () => {
    mockGetSignedUrl.mockResolvedValue('https://upload.example');

    const response = await request(app)
      .post('/api/v1/ingest/request-upload')
      .set('Authorization', 'Bearer server-key')
      .send({ fileName: 'scan.sqlite', case_id: 'case-7' });

    expect(response.status).toBe(200);
    expect(response.body.uploadUrl).toBe('https://upload.example');
    expect(response.body.uploadId).toBe('upload-id');
    expect(response.body.s3Key).toMatch(/^uploads\/case-7\/\d{8}\/upload-id-scan\.sqlite$/);
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ type: 'put' }),
      { expiresIn: 900 }
    );
  });

  it('reports presigning failures', async () => {
    mockGetSignedUrl.mockRejectedValue(new Error('sign failed'));

    const response = await request(app)
      .post('/api/v1/ingest/request-upload')
      .set('Authorization', 'Bearer server-key')
      .send({ fileName: 'scan.sqlite' });

    expect(response.status).toBe(500);
  });

  it('requires an S3 key to complete an upload', async () => {
    const response = await request(app)
      .post('/api/v1/ingest/complete')
      .set('Authorization', 'Bearer server-key')
      .send({});

    expect(response.status).toBe(400);
  });

  it('verifies and records a completed upload', async () => {
    mockS3Send.mockResolvedValue({});
    mockRecordUpload.mockResolvedValue(42);

    const response = await request(app)
      .post('/api/v1/ingest/complete')
      .set('Authorization', 'Bearer server-key')
      .send({
        s3Key: 'uploads/case/file.sqlite',
        deviceId: 'device-1',
        extraMetadata: { source: 'mobile' },
      });

    expect(response.body).toEqual({
      ok: true,
      status: 'pending',
      uploadId: 42,
      s3Key: 'uploads/case/file.sqlite',
      sourceTag: 'device-1',
    });
    expect(mockRecordUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        s3Key: 'uploads/case/file.sqlite',
        sourceTag: 'device-1',
        extraMetadata: { source: 'mobile' },
      })
    );
  });

  it('returns 404 when the uploaded object is missing', async () => {
    const error: any = new Error('missing');
    error.name = 'NotFound';
    mockS3Send.mockRejectedValue(error);

    const response = await request(app)
      .post('/api/v1/ingest/complete')
      .set('Authorization', 'Bearer server-key')
      .send({ s3Key: 'uploads/missing.sqlite' });

    expect(response.status).toBe(404);
  });

  it('reports other completion verification failures', async () => {
    mockS3Send.mockRejectedValue(new Error('S3 failed'));

    const response = await request(app)
      .post('/api/v1/ingest/complete')
      .set('Authorization', 'Bearer server-key')
      .send({ s3Key: 'uploads/file.sqlite' });

    expect(response.status).toBe(500);
  });
});
