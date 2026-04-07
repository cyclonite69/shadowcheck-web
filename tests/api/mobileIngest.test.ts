import request from 'supertest';
import express from 'express';

// Mock the logger
jest.mock('../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: mockSend,
  })),
  PutObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
}));

const mockGetSignedUrl = jest.fn().mockResolvedValue('https://mock-presigned-url.com/upload');
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

// Mock the Service
const mockRecordUpload = jest.fn().mockResolvedValue(123);
const mockProcessUpload = jest.fn().mockResolvedValue(undefined);

jest.mock('../../server/src/services/mobileIngestService', () => ({
  recordUpload: (...args: any[]) => mockRecordUpload(...args),
  processUpload: (...args: any[]) => mockProcessUpload(...args),
}));

// Use require for the router
const mobileIngestRouter = require('../../server/src/api/routes/v1/mobileIngest').default;

const app = express();
app.use(express.json());
app.use('/api/v1/ingest', mobileIngestRouter);

describe('Mobile Ingest API', () => {
  const API_KEY = 'test-secret-key';

  beforeAll(() => {
    process.env.SHADOWCHECK_API_KEY = API_KEY;
    process.env.S3_BACKUP_BUCKET = 'test-bucket';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue('https://mock-presigned-url.com/upload');
    mockRecordUpload.mockResolvedValue(123);
  });

  describe('POST /api/v1/ingest/request-upload', () => {
    it('should return 401 if Authorization header is missing', async () => {
      const response = await request(app)
        .post('/api/v1/ingest/request-upload')
        .send({ fileName: 'test.sqlite' });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Missing or invalid Authorization header');
    });

    it('should return 401 if API key is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/ingest/request-upload')
        .set('Authorization', 'Bearer wrong-key')
        .send({ fileName: 'test.sqlite' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 400 if fileName is missing', async () => {
      const response = await request(app)
        .post('/api/v1/ingest/request-upload')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ case_id: 'test-case' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('fileName is required');
    });

    it('should return 400 if filesize exceeds limit', async () => {
      const response = await request(app)
        .post('/api/v1/ingest/request-upload')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ fileName: 'test.sqlite', filesize: 600 * 1024 * 1024 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File size exceeds 500MB limit');
    });

    it('should return 200 and presigned URL data on success', async () => {
      const response = await request(app)
        .post('/api/v1/ingest/request-upload')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ fileName: 'test.sqlite', case_id: 'case123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('uploadUrl', 'https://mock-presigned-url.com/upload');
      expect(response.body).toHaveProperty('s3Key');
      expect(response.body.s3Key).toMatch(/^uploads\/case123\/\d{8}\/.*-test.sqlite$/);
      expect(response.body).toHaveProperty('uploadId');
      expect(response.body).toHaveProperty('expires_at');
    });
  });

  describe('POST /api/v1/ingest/complete', () => {
    it('should return 401 if unauthorized', async () => {
      const response = await request(app)
        .post('/api/v1/ingest/complete')
        .send({ uploadId: 'uuid', s3Key: 'path/to/obj' });

      expect(response.status).toBe(401);
    });

    it('should return 400 if s3Key is missing', async () => {
      const response = await request(app)
        .post('/api/v1/ingest/complete')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ uploadId: 'uuid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('s3Key is required');
    });

    it('should return 404 if file does not exist in S3', async () => {
      const notFoundError = new Error('Not Found');
      (notFoundError as any).$metadata = { httpStatusCode: 404 };
      mockSend.mockRejectedValueOnce(notFoundError);

      const response = await request(app)
        .post('/api/v1/ingest/complete')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ uploadId: 'uuid', s3Key: 'missing/path' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Upload not found in S3 storage');
    });

    it('should return 200 and record upload if file exists in S3', async () => {
      mockSend.mockResolvedValueOnce({}); // HeadObject success
      mockRecordUpload.mockResolvedValueOnce(123);

      const response = await request(app)
        .post('/api/v1/ingest/complete')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          uploadId: 'uuid',
          s3Key: 'valid/path',
          deviceModel: 'S22 Ultra',
          deviceId: 'my-s22',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('queued');
      expect(response.body.dbId).toBe(123);
      expect(mockRecordUpload).toHaveBeenCalled();
      expect(mockProcessUpload).toHaveBeenCalledWith(123);
    });
  });
});
