import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

let secretStore: Record<string, string> = {};
let sendMock = jest.fn();

jest.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: sendMock,
    })),
    GetSecretValueCommand: jest.fn().mockImplementation((input) => ({ input })),
    PutSecretValueCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

describe('SecretsManager', () => {
  let secretsManager: any;
  let originalDbPassword: string | undefined;
  let originalMapboxToken: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeAll(() => {
    originalDbPassword = process.env.DB_PASSWORD;
    originalMapboxToken = process.env.MAPBOX_TOKEN;
    originalNodeEnv = process.env.NODE_ENV;
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    secretStore = {};
    sendMock.mockReset();
    
    // Default mock behavior
    sendMock.mockImplementation(async (cmd: any) => {
      if (cmd.input && cmd.input.SecretId === 'shadowcheck/config') {
        if (cmd.input.SecretString !== undefined) {
          // PutSecretValue
          secretStore = JSON.parse(cmd.input.SecretString);
          return {};
        } else {
          // GetSecretValue
          return { SecretString: JSON.stringify(secretStore) };
        }
      }
      return {};
    });

    delete process.env.DB_PASSWORD;
    delete process.env.MAPBOX_TOKEN;
    process.env.NODE_ENV = 'test';
    process.env.FORCE_AWS_SM = 'true';
    
    secretsManager = require('../../server/src/services/secretsManager').default;
    // Reset internal state
    secretsManager.secrets.clear();
    secretsManager.accessLog = [];
    secretsManager['awsLoaded'] = false;
    secretsManager['awsCache'] = null;
    secretsManager['deferredRetryScheduled'] = false;
    secretsManager.smReachable = false;
    secretsManager.smLastError = null;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.FORCE_AWS_SM;
    if (originalDbPassword !== undefined) process.env.DB_PASSWORD = originalDbPassword;
    if (originalMapboxToken !== undefined) process.env.MAPBOX_TOKEN = originalMapboxToken;
    jest.useRealTimers();
  });

  test('loads secrets from AWS Secrets Manager', async () => {
    secretStore = {
      db_password: 'aws_password',
      mapbox_token: 'pk.aws_token',
    };

    await secretsManager.load();

    expect(secretsManager.get('db_password')).toBe('aws_password');
    expect(secretsManager.get('mapbox_token')).toBe('pk.aws_token');
    expect(secretsManager.smReachable).toBe(true);
  });

  test('falls back to environment variable if missing from AWS SM', async () => {
    secretStore = {
      mapbox_token: 'pk.aws_token',
    };
    process.env.DB_PASSWORD = 'env_password';

    await secretsManager.load();

    expect(secretsManager.get('db_password')).toBe('env_password');
  });

  test('throws if db_password is missing from both AWS and environment', async () => {
    secretStore = {
      mapbox_token: 'pk.aws_token',
    };

    await expect(secretsManager.load()).rejects.toThrow(
      /Required secret 'db_password' not found in AWS Secrets Manager/
    );
  });

  test('warns if Mapbox token does not start with pk.', async () => {
    secretStore = {
      db_password: 'aws_password',
      mapbox_token: 'sk.invalid',
    };

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    await secretsManager.load();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('MAPBOX_TOKEN should start with "pk."')
    );
    consoleSpy.mockRestore();
  });

  test('getOrThrow throws for missing secret', async () => {
    secretStore = {
      db_password: 'aws_password',
    };

    await secretsManager.load();

    expect(() => secretsManager.getOrThrow('nonexistent')).toThrow(
      /Secret 'nonexistent' is required but not available/
    );
  });

  test('access log records lookups', async () => {
    secretStore = {
      db_password: 'aws_password',
    };

    await secretsManager.load();

    secretsManager.get('db_password');
    secretsManager.get('nonexistent');

    const log = secretsManager.getAccessLog();
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ secret: 'db_password', found: true });
    expect(log[1]).toMatchObject({ secret: 'nonexistent', found: false });
  });

  test('putSecret persists to AWS SM in production', async () => {
    process.env.NODE_ENV = 'production';
    secretStore = { db_password: 'existing' };
    secretsManager['awsLoaded'] = true;
    secretsManager['awsCache'] = { ...secretStore };

    await secretsManager.putSecret('new_key', 'new_value');

    expect(secretsManager.get('new_key')).toBe('new_value');
    expect(secretStore.new_key).toBe('new_value');
    expect(secretStore.db_password).toBe('existing');
    process.env.NODE_ENV = 'test';
  });

  test('putSecrets persists multiple to AWS SM in production', async () => {
    process.env.NODE_ENV = 'production';
    secretStore = { db_password: 'existing' };
    await secretsManager.putSecrets({ key1: 'val1', key2: 'val2' });

    expect(secretsManager.get('key1')).toBe('val1');
    expect(secretsManager.get('key2')).toBe('val2');
    expect(secretStore.key1).toBe('val1');
    expect(secretStore.key2).toBe('val2');
    process.env.NODE_ENV = 'test';
  });

  test('deleteSecret removes from AWS SM', async () => {
    secretStore = { key_to_delete: 'value', db_password: 'keep' };
    await secretsManager.deleteSecret('key_to_delete');

    expect(secretsManager.get('key_to_delete')).toBeNull();
    expect(secretStore.key_to_delete).toBeUndefined();
    expect(secretStore.db_password).toBe('keep');
  });

  test('getSecret loads if not already loaded', async () => {
    secretStore = { db_password: 'aws_password' };
    // Clear secrets to trigger load
    secretsManager.secrets.clear();
    
    const val = await secretsManager.getSecret('db_password');
    
    expect(val).toBe('aws_password');
  });

  test('has() checks both memory and environment', () => {
    secretsManager.secrets.set('mem_key', 'val');
    process.env.ENV_KEY = 'val';
    
    expect(secretsManager.has('mem_key')).toBe(true);
    expect(secretsManager.has('env_key')).toBe(true);
    expect(secretsManager.has('nonexistent')).toBe(false);
    
    delete process.env.ENV_KEY;
  });

  test('handles AWS SM errors during load', async () => {
    sendMock.mockRejectedValue(new Error('Error'));
    process.env.DB_PASSWORD = 'env_fallback';
    
    await secretsManager.load();
    expect(secretsManager.smReachable).toBe(false);
    expect(secretsManager.smLastError).toBe('Error');
  });

  test('retries AWS load periodically if it failed initially', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_PASSWORD = 'env_fallback';
    
    sendMock
      .mockRejectedValueOnce(new Error('First Fail'))
      .mockResolvedValueOnce({ SecretString: JSON.stringify({ db_password: 'recovered' }) });

    // Initial load fails SM but continues due to env fallback
    await secretsManager.load();
    
    expect(secretsManager.get('db_password')).toBe('env_fallback');
    expect(secretsManager.smReachable).toBe(false);
    expect(secretsManager['deferredRetryScheduled']).toBe(true);
    
    // Fast forward time
    await jest.advanceTimersByTimeAsync(10000);
    
    expect(secretsManager.get('db_password')).toBe('recovered');
    expect(secretsManager.smReachable).toBe(true);
    expect(secretsManager['deferredRetryScheduled']).toBe(false);
    
    process.env.NODE_ENV = 'test';
  });

  test('exponential backoff for retries', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_PASSWORD = 'env_fallback';
    sendMock.mockRejectedValue(new Error('Persistent Fail'));

    await secretsManager.load();
    
    const scheduleRetrySpy = jest.spyOn(secretsManager as any, 'scheduleRetry');
    
    // First retry happens after 10s
    await jest.advanceTimersByTimeAsync(10000);
    // It should have called scheduleRetry(20000)
    expect(scheduleRetrySpy).toHaveBeenCalledWith(20000);
    
    // Second retry happens after 20s
    await jest.advanceTimersByTimeAsync(20000);
    expect(scheduleRetrySpy).toHaveBeenCalledWith(40000);
    
    process.env.NODE_ENV = 'test';
  });

  test('handles ResourceNotFoundException gracefully', async () => {
    const err = new Error('Not Found');
    (err as any).name = 'ResourceNotFoundException';
    sendMock.mockRejectedValue(err);
    process.env.DB_PASSWORD = 'env_fallback';
    
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    
    await secretsManager.load();
    
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('AWS Secrets Manager unavailable'));
    
    logSpy.mockRestore();
  });
});
