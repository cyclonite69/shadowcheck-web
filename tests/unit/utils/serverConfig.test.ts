import { getServerConfig } from '../../../server/src/utils/serverConfig';

describe('serverConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default configuration when no environment variables are set', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.FORCE_HTTPS;
    delete process.env.CORS_ORIGINS;

    const config = getServerConfig();

    expect(config.port).toBe(3001);
    expect(config.host).toBe('0.0.0.0');
    expect(config.forceHttps).toBe(false);
    expect(config.allowedOrigins).toEqual(['http://localhost:3001', 'http://127.0.0.1:3001']);
  });

  it('should use environment variables when provided', () => {
    process.env.PORT = '4000';
    process.env.HOST = '127.0.0.1';
    process.env.FORCE_HTTPS = 'true';
    process.env.CORS_ORIGINS = 'http://example.com, https://shadowcheck.io';

    const config = getServerConfig();

    expect(config.port).toBe(4000);
    expect(config.host).toBe('127.0.0.1');
    expect(config.forceHttps).toBe(true);
    expect(config.allowedOrigins).toEqual(['http://example.com', 'https://shadowcheck.io']);
  });

  it('should handle single CORS origin', () => {
    process.env.CORS_ORIGINS = 'http://onlyone.com';
    const config = getServerConfig();
    expect(config.allowedOrigins).toEqual(['http://onlyone.com']);
  });

  it('should handle empty CORS_ORIGINS as default', () => {
    process.env.NODE_ENV = 'development';
    process.env.CORS_ORIGINS = '';
    const config = getServerConfig();
    expect(config.allowedOrigins).toEqual(['http://localhost:3001', 'http://127.0.0.1:3001']);
  });

  it.each([
    ['unset', undefined],
    ['blank', ''],
    ['wildcard only', '*'],
  ])('should reject production configuration when CORS_ORIGINS is %s', (_label, origins) => {
    process.env.NODE_ENV = 'production';
    if (origins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = origins;
    }

    expect(() => getServerConfig()).toThrow(
      /CORS_ORIGINS.*explicit origin.*\*.*ignored in production.*scheme:\/\/host\[:port\]/
    );
  });

  it('should allow explicit production origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.example.test,http://localhost:8443';

    const config = getServerConfig();

    expect(config.allowedOrigins).toEqual(['https://app.example.test', 'http://localhost:8443']);
  });
});
