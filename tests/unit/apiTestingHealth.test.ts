import {
  formatDbLabel,
  parseHealthPayload,
  resolveApiHealth,
} from '../../client/src/components/admin/hooks/apiTestingHealth';

describe('API Testing health helpers', () => {
  describe('parseHealthPayload', () => {
    test('rejects non-JSON text with a successful HTTP status', () => {
      expect(parseHealthPayload('OK\n', true)).toBeNull();
    });

    test('rejects JSON from a non-2xx response', () => {
      expect(
        parseHealthPayload(JSON.stringify({ database: 'shadowcheck_test' }), false)
      ).toBeNull();
    });

    test('rejects JSON without a database field', () => {
      expect(parseHealthPayload(JSON.stringify({ status: 'HEALTHY' }), true)).toBeNull();
    });

    test('rejects a non-string database field', () => {
      expect(parseHealthPayload(JSON.stringify({ database: 7 }), true)).toBeNull();
    });

    test('rejects an empty body', () => {
      expect(parseHealthPayload('', true)).toBeNull();
    });
  });

  describe('resolveApiHealth', () => {
    test('prefers JSON /api/health over the text /health stub', async () => {
      const fetchCandidate = jest.fn(async (path: string) => {
        if (path === '/api/health') {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({ status: 'healthy', version: '1.2.3', database: 'shadowcheck_test' }),
          };
        }

        return { ok: true, text: async () => 'OK\n' };
      });

      await expect(resolveApiHealth(fetchCandidate)).resolves.toEqual({
        status: 'HEALTHY',
        version: '1.2.3',
        database: 'shadowcheck_test',
      });
      expect(fetchCandidate.mock.calls.map(([path]) => path)).toEqual(['/api/health']);
    });

    test('returns offline with a null database when every candidate fails', async () => {
      const fetchCandidate = jest.fn(async (path: string) => ({
        ok: false,
        text: async () => (path === '/health' ? 'OK\n' : ''),
      }));

      await expect(resolveApiHealth(fetchCandidate)).resolves.toEqual({
        status: 'OFFLINE',
        version: 'N/A',
        database: null,
      });
      expect(fetchCandidate.mock.calls.map(([path]) => path)).toEqual(['/api/health', '/health']);
    });
  });

  describe('formatDbLabel', () => {
    test('shows Loading while health has not resolved', () => {
      expect(formatDbLabel(null)).toBe('Loading...');
    });

    test.each([null, undefined, 'N/A', ''])('labels %j as unverified', (database) => {
      expect(formatDbLabel({ status: 'OFFLINE', version: 'N/A', database })).toBe('unverified');
    });

    test('shows the live database name', () => {
      expect(
        formatDbLabel({ status: 'HEALTHY', version: '1.2.3', database: 'shadowcheck_test' })
      ).toBe('shadowcheck_test');
    });
  });
});
