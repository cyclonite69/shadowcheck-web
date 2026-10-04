import {
  EXPECTED_TEST_DB,
  canRunTests,
  formatTestDbBlockMessage,
  withTestDbGuard,
} from '../../client/src/components/admin/hooks/apiTestingDbGuard';

describe('apiTestingDbGuard', () => {
  describe('EXPECTED_TEST_DB', () => {
    test('is exactly shadowcheck_test', () => {
      expect(EXPECTED_TEST_DB).toBe('shadowcheck_test');
    });
  });

  describe('canRunTests', () => {
    test.each([
      [null],
      [undefined],
      [{ status: 'Loading' }],
      [{ status: 'OFFLINE', database: null }],
      [{ status: 'OFFLINE', database: 'N/A' }],
      [{ status: 'HEALTHY', database: null }],
      [{ status: 'HEALTHY', database: 'N/A' }],
      [{ status: 'HEALTHY', database: 'shadowcheck_db' }],
      [{ status: 'HEALTHY', database: 'Loading' }],
    ])('fails closed for %j', (health) => {
      expect(canRunTests(health as any)).toBe(false);
    });

    test('passes only when database is shadowcheck_test', () => {
      expect(canRunTests({ status: 'HEALTHY', database: 'shadowcheck_test' })).toBe(true);
    });
  });

  describe('formatTestDbBlockMessage', () => {
    test('uses unverified wording when database is missing or N/A', () => {
      expect(formatTestDbBlockMessage(null)).toBe('Blocked: database unverified');
      expect(formatTestDbBlockMessage(undefined)).toBe('Blocked: database unverified');
      expect(formatTestDbBlockMessage('N/A')).toBe('Blocked: database unverified');
      expect(formatTestDbBlockMessage('')).toBe('Blocked: database unverified');
    });

    test('includes live database name when connected to the wrong DB', () => {
      expect(formatTestDbBlockMessage('shadowcheck_db')).toBe(
        'Blocked: connected to shadowcheck_db; tests run only against shadowcheck_test'
      );
    });
  });

  describe('withTestDbGuard', () => {
    test('invokes run zero times when fetchHealth resolves to a blocked database', async () => {
      const run = jest.fn(async () => 'ran');
      const outcome = await withTestDbGuard({
        fetchHealth: async () => ({ status: 'HEALTHY', database: 'shadowcheck_db' }),
        run,
      });
      expect(run).not.toHaveBeenCalled();
      expect(outcome).toEqual({
        blocked: true,
        reason: 'Blocked: connected to shadowcheck_db; tests run only against shadowcheck_test',
        database: 'shadowcheck_db',
      });
    });

    test('invokes run zero times when fetchHealth rejects', async () => {
      const run = jest.fn(async () => 'ran');
      const outcome = await withTestDbGuard({
        fetchHealth: async () => {
          throw new Error('network down');
        },
        run,
      });
      expect(run).not.toHaveBeenCalled();
      expect(outcome).toEqual({
        blocked: true,
        reason: 'Blocked: database unverified',
        database: null,
      });
    });

    test('invokes run zero times when health is null (click before health resolves)', async () => {
      const run = jest.fn(async () => 'ran');
      const outcome = await withTestDbGuard({
        fetchHealth: async () => null,
        run,
      });
      expect(run).not.toHaveBeenCalled();
      expect(outcome.blocked).toBe(true);
    });

    test('calls run when live database is shadowcheck_test', async () => {
      const run = jest.fn(async () => 'ok');
      const outcome = await withTestDbGuard({
        fetchHealth: async () => ({ status: 'HEALTHY', database: EXPECTED_TEST_DB }),
        run,
      });
      expect(run).toHaveBeenCalledTimes(1);
      expect(outcome).toEqual({ blocked: false, result: 'ok' });
    });

    test('re-fetches health per invocation so a stale OK cannot authorize a later run', async () => {
      const run = jest.fn(async () => 'ran');
      let call = 0;
      const fetchHealth = jest.fn(async () => {
        call += 1;
        if (call === 1) {
          return { status: 'HEALTHY', database: EXPECTED_TEST_DB };
        }
        return { status: 'HEALTHY', database: 'shadowcheck_db' };
      });

      const first = await withTestDbGuard({ fetchHealth, run });
      expect(first).toEqual({ blocked: false, result: 'ran' });
      expect(run).toHaveBeenCalledTimes(1);

      const second = await withTestDbGuard({ fetchHealth, run });
      expect(second.blocked).toBe(true);
      expect(run).toHaveBeenCalledTimes(1);
      expect(fetchHealth).toHaveBeenCalledTimes(2);
    });
  });
});
