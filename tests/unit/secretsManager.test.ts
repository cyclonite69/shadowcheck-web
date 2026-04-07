jest.mock('@aws-sdk/client-secrets-manager', () => {
  let secretStore: Record<string, string> = {};

  class GetSecretValueCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  class PutSecretValueCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  const SecretsManagerClient = jest.fn().mockImplementation(() => ({
    send: jest.fn(async (cmd: any) => {
      if (cmd instanceof GetSecretValueCommand) {
        return { SecretString: JSON.stringify(secretStore) };
      }
      if (cmd instanceof PutSecretValueCommand) {
        secretStore = JSON.parse(cmd.input.SecretString);
        return {};
      }
      return {};
    }),
  }));

  return {
    SecretsManagerClient,
    GetSecretValueCommand,
    PutSecretValueCommand,
    __setSecretStore: (store: Record<string, string>) => {
      secretStore = { ...store };
    },
    __getSecretStore: () => ({ ...secretStore }),
  };
});

describe('SecretsManager (AWS SM only)', () => {
  let secretsManager: any;
  let awsSdk: any;
  let originalDbPassword: string | undefined;
  let originalMapboxToken: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeAll(() => {
    originalDbPassword = process.env.DB_PASSWORD;
    originalMapboxToken = process.env.MAPBOX_TOKEN;
    originalNodeEnv = process.env.NODE_ENV;
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.DB_PASSWORD;
    delete process.env.MAPBOX_TOKEN;
    // We need to keep NODE_ENV=test but force AWS SM for these tests
    process.env.NODE_ENV = 'test';
    process.env.FORCE_AWS_SM = 'true';
    
    awsSdk = require('@aws-sdk/client-secrets-manager');
    awsSdk.__setSecretStore({});
    secretsManager = require('../../server/src/services/secretsManager').default;
    secretsManager.secrets.clear();
    secretsManager.accessLog = [];
  });

  afterAll(() => {
    if (originalDbPassword === undefined) delete process.env.DB_PASSWORD;
    else process.env.DB_PASSWORD = originalDbPassword;

    if (originalMapboxToken === undefined) delete process.env.MAPBOX_TOKEN;
    else process.env.MAPBOX_TOKEN = originalMapboxToken;
    
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.FORCE_AWS_SM;
  });

  test('loads secrets from AWS Secrets Manager', async () => {
    awsSdk.__setSecretStore({
      db_password: 'aws_password',
      mapbox_token: 'pk.aws_token',
    });

    await secretsManager.load();

    expect(secretsManager.get('db_password')).toBe('aws_password');
    expect(secretsManager.get('mapbox_token')).toBe('pk.aws_token');
  });

  test('falls back to environment variable if missing from AWS SM', async () => {
    awsSdk.__setSecretStore({
      mapbox_token: 'pk.aws_token',
    });
    process.env.DB_PASSWORD = 'env_password';

    await secretsManager.load();

    expect(secretsManager.get('db_password')).toBe('env_password');
  });

  test('throws if db_password is missing from both AWS and environment', async () => {
    awsSdk.__setSecretStore({
      mapbox_token: 'pk.aws_token',
    });
    // DB_PASSWORD is deleted in beforeEach

    await expect(secretsManager.load()).rejects.toThrow(
      /Required secret 'db_password' not found in AWS Secrets Manager/
    );
  });

  test('warns if Mapbox token does not start with pk.', async () => {
    awsSdk.__setSecretStore({
      db_password: 'aws_password',
      mapbox_token: 'sk.invalid',
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    await secretsManager.load();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('MAPBOX_TOKEN should start with "pk."')
    );

    consoleSpy.mockRestore();
  });

  test('getOrThrow throws for missing secret', async () => {
    awsSdk.__setSecretStore({
      db_password: 'aws_password',
    });

    await secretsManager.load();

    expect(() => secretsManager.getOrThrow('nonexistent')).toThrow(
      /Secret 'nonexistent' is required but not available/
    );
  });

  test('access log records lookups', async () => {
    awsSdk.__setSecretStore({
      db_password: 'aws_password',
      mapbox_token: 'pk.aws_token',
    });

    await secretsManager.load();

    secretsManager.get('db_password');
    secretsManager.get('nonexistent');

    const log = secretsManager.getAccessLog();
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ secret: 'db_password', found: true });
    expect(log[1]).toMatchObject({ secret: 'nonexistent', found: false });
  });
});
