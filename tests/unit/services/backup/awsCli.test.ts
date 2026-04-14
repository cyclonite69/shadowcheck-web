import { spawn } from 'child_process';
import os from 'os';
import {
  buildAwsCliEnv,
  deleteS3BackupObject,
  listS3BackupObjects,
  runAwsCliJson,
  uploadBackupToS3,
} from '../../../../server/src/services/backup/awsCli';

const { getAwsConfig } = require('../../../../server/src/services/awsService');
const logger = require('../../../../server/src/logging/logger');

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('../../../../server/src/services/awsService', () => ({
  getAwsConfig: jest.fn(),
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('awsCli Service', () => {
  const mockSpawn = spawn as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildAwsCliEnv()', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should include region if configured', async () => {
      getAwsConfig.mockResolvedValueOnce({ region: 'us-east-1' });
      const env = await buildAwsCliEnv();
      expect(env.AWS_DEFAULT_REGION).toBe('us-east-1');
      expect(env.PATH).toContain('/usr/local/bin');
    });

    it('should not include AWS_DEFAULT_REGION if not configured', async () => {
      getAwsConfig.mockResolvedValueOnce({ region: null });
      const env = await buildAwsCliEnv();
      expect(env.AWS_DEFAULT_REGION).toBeUndefined();
    });

    it('should use default PATH if process.env.PATH is missing', async () => {
      delete process.env.PATH;
      getAwsConfig.mockResolvedValueOnce({ region: 'us-east-1' });
      const env = await buildAwsCliEnv();
      expect(env.PATH).toBe('/usr/local/bin:/usr/bin:/bin');
    });
  });

  describe('runAwsCliJson()', () => {
    const setupMockChild = () => {
      const callbacks: Record<string, Function> = {};
      const stdoutCallbacks: Record<string, Function> = {};
      const stderrCallbacks: Record<string, Function> = {};

      const mockChild = {
        stdout: {
          on: jest.fn((event, cb) => {
            stdoutCallbacks[event] = cb;
          }),
        },
        stderr: {
          on: jest.fn((event, cb) => {
            stderrCallbacks[event] = cb;
          }),
        },
        on: jest.fn((event, cb) => {
          callbacks[event] = cb;
        }),
      };
      mockSpawn.mockReturnValue(mockChild);

      return { mockChild, callbacks, stdoutCallbacks, stderrCallbacks };
    };

    it('should resolve with stdout on success', async () => {
      const { callbacks, stdoutCallbacks } = setupMockChild();
      getAwsConfig.mockResolvedValueOnce({ region: 'us-east-1' });

      const promise = runAwsCliJson(['s3', 'ls']);

      // Wait a tick for promise to register callbacks
      await new Promise((resolve) => setImmediate(resolve));

      stdoutCallbacks['data'](Buffer.from('["bucket1"]'));
      callbacks['close'](0);

      const result = await promise;
      expect(result).toBe('["bucket1"]');
      expect(mockSpawn).toHaveBeenCalledWith('aws', ['s3', 'ls'], expect.any(Object));
    });

    it('should reject on non-zero exit code', async () => {
      const { callbacks, stderrCallbacks } = setupMockChild();
      getAwsConfig.mockResolvedValueOnce({ region: 'us-east-1' });

      const promise = runAwsCliJson(['s3', 'ls']);

      await new Promise((resolve) => setImmediate(resolve));

      stderrCallbacks['data'](Buffer.from('AccessDenied'));
      callbacks['close'](1);

      await expect(promise).rejects.toThrow('AccessDenied');
    });

    it('should reject on process error', async () => {
      const { callbacks } = setupMockChild();
      getAwsConfig.mockResolvedValueOnce({ region: 'us-east-1' });

      const promise = runAwsCliJson(['s3', 'ls']);

      await new Promise((resolve) => setImmediate(resolve));

      callbacks['error'](new Error('Spawn failed'));

      await expect(promise).rejects.toThrow('Spawn failed');
    });

    it('should use default error message if stderr is empty on failure', async () => {
      const { callbacks } = setupMockChild();
      getAwsConfig.mockResolvedValueOnce({ region: 'us-east-1' });

      const promise = runAwsCliJson(['s3', 'ls']);

      await new Promise((resolve) => setImmediate(resolve));

      callbacks['close'](1);

      await expect(promise).rejects.toThrow('AWS CLI command failed with code 1');
    });

    it('should reject when AWS credentials are missing', async () => {
      const { callbacks, stderrCallbacks } = setupMockChild();
      getAwsConfig.mockResolvedValueOnce({ region: 'us-east-1' });

      const promise = runAwsCliJson(['s3', 'ls']);

      await new Promise((resolve) => setImmediate(resolve));

      stderrCallbacks['data'](
        Buffer.from(
          'Unable to locate credentials. You can configure credentials by running "aws configure".'
        )
      );
      callbacks['close'](255);

      await expect(promise).rejects.toThrow('Unable to locate credentials');
    });
  });

  describe('uploadBackupToS3()', () => {
    it('should call runAwsCliJson with correct arguments', async () => {
      const { callbacks, stdoutCallbacks } = (() => {
        const callbacks: Record<string, Function> = {};
        const stdoutCallbacks: Record<string, Function> = {};
        const mockChild = {
          stdout: {
            on: jest.fn((event, cb) => {
              stdoutCallbacks[event] = cb;
            }),
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, cb) => {
            callbacks[event] = cb;
          }),
        };
        mockSpawn.mockReturnValue(mockChild);
        return { callbacks, stdoutCallbacks };
      })();

      getAwsConfig.mockResolvedValue({ region: 'us-east-1' });

      const promise = uploadBackupToS3('my-bucket', '/tmp/file.dump', 'file.dump', {
        hostname: 'test-host',
        environment: 'production',
      });

      await new Promise((resolve) => setImmediate(resolve));
      callbacks['close'](0);

      const result = await promise;
      expect(result).toEqual({
        bucket: 'my-bucket',
        key: 'backups/production/file.dump',
        url: 's3://my-bucket/backups/production/file.dump',
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'aws',
        expect.arrayContaining([
          's3',
          'cp',
          '/tmp/file.dump',
          's3://my-bucket/backups/production/file.dump',
          '--storage-class',
          'STANDARD_IA',
          '--metadata',
          expect.stringContaining('source-env=production'),
        ]),
        expect.any(Object)
      );
    });

    it('should include instance-id in metadata if provided', async () => {
      const callbacks: Record<string, Function> = {};
      mockSpawn.mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, cb) => {
          callbacks[event] = cb;
        }),
      });

      getAwsConfig.mockResolvedValue({ region: 'us-east-1' });

      const promise = uploadBackupToS3('my-bucket', '/tmp/file.dump', 'file.dump', {
        hostname: 'test-host',
        environment: 'production',
        instanceId: 'i-1234567890abcdef0',
      });

      await new Promise((resolve) => setImmediate(resolve));
      callbacks['close'](0);

      await promise;

      const args = mockSpawn.mock.calls[0][1];
      const metadataIdx = args.indexOf('--metadata') + 1;
      expect(args[metadataIdx]).toContain('instance-id=i-1234567890abcdef0');
    });
  });

  describe('listS3BackupObjects()', () => {
    it('should return parsed JSON output', async () => {
      const callbacks: Record<string, Function> = {};
      const stdoutCallbacks: Record<string, Function> = {};
      mockSpawn.mockReturnValue({
        stdout: {
          on: jest.fn((event, cb) => {
            stdoutCallbacks[event] = cb;
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, cb) => {
          callbacks[event] = cb;
        }),
      });

      getAwsConfig.mockResolvedValue({ region: 'us-east-1' });

      const promise = listS3BackupObjects('my-bucket');

      await new Promise((resolve) => setImmediate(resolve));
      stdoutCallbacks['data'](Buffer.from(JSON.stringify([{ Key: 'test', Size: 100 }])));
      callbacks['close'](0);

      const result = await promise;
      expect(result).toEqual([{ Key: 'test', Size: 100 }]);
    });

    it('should return empty array if output is empty', async () => {
      const callbacks: Record<string, Function> = {};
      mockSpawn.mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, cb) => {
          callbacks[event] = cb;
        }),
      });

      getAwsConfig.mockResolvedValue({ region: 'us-east-1' });

      const promise = listS3BackupObjects('my-bucket');

      await new Promise((resolve) => setImmediate(resolve));
      callbacks['close'](0);

      const result = await promise;
      expect(result).toEqual([]);
    });
  });

  describe('deleteS3BackupObject()', () => {
    it('should call s3api delete-object', async () => {
      const callbacks: Record<string, Function> = {};
      mockSpawn.mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, cb) => {
          callbacks[event] = cb;
        }),
      });

      getAwsConfig.mockResolvedValue({ region: 'us-east-1' });

      const promise = deleteS3BackupObject('my-bucket', 'backups/prod/file.dump');

      await new Promise((resolve) => setImmediate(resolve));
      callbacks['close'](0);

      await promise;
      expect(mockSpawn).toHaveBeenCalledWith(
        'aws',
        ['s3api', 'delete-object', '--bucket', 'my-bucket', '--key', 'backups/prod/file.dump'],
        expect.any(Object)
      );
    });
  });
});
