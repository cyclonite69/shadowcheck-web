export {};

import { clearPostgresEnv } from '../../server/src/utils/envSanitizer';

describe('clearPostgresEnv', () => {
  const PG_VARS = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER'];

  beforeEach(() => {
    process.env.PGHOST = 'somehost';
    process.env.PGPORT = '5432';
    process.env.PGDATABASE = 'mydb';
    process.env.PGUSER = 'myuser';
  });

  afterEach(() => {
    PG_VARS.forEach((v) => delete process.env[v]);
  });

  test('removes all four PG env vars', () => {
    clearPostgresEnv();
    PG_VARS.forEach((v) => expect(process.env[v]).toBeUndefined());
  });

  test('is idempotent — safe to call when vars are already unset', () => {
    PG_VARS.forEach((v) => delete process.env[v]);
    expect(() => clearPostgresEnv()).not.toThrow();
    PG_VARS.forEach((v) => expect(process.env[v]).toBeUndefined());
  });

  test('does not affect unrelated env vars', () => {
    process.env.NODE_ENV = 'test';
    clearPostgresEnv();
    expect(process.env.NODE_ENV).toBe('test');
  });
});
