import { AUTOMATED_API_PRESETS } from '../../client/src/components/admin/hooks/apiTestingPresets';
import { resolveSameOriginTarget } from '../../client/src/components/admin/hooks/apiTestingSameOriginTarget';

const ORIGIN = 'http://localhost:8081';

describe('resolveSameOriginTarget', () => {
  test.each([
    'https://evil.test/x',
    'http://localhost:8080/api/x',
    '//evil.test/x',
    String.raw`/\evil.test/x`,
    String.raw`/\\evil.test/x`,
    String.raw`\evil.test\api\x`,
    '/\t/evil.test',
    '/\n/evil.test',
    '/\r/evil.test',
    `/${String.fromCharCode(9)}/evil.test`,
    `/${String.fromCharCode(10)}/evil.test`,
    `/${String.fromCharCode(13)}/evil.test`,
    `/${String.fromCharCode(160)}/evil.test`,
    `/${String.fromCharCode(8195)}/evil.test`,
    `/${String.fromCharCode(133)}/evil.test`,
    `/${String.fromCharCode(159)}/evil.test`,
    ' /api/x',
    'javascript:alert(1)',
    'data:text/plain,hello',
    '',
    '   ',
    'api/x',
  ])('rejects unsafe target %j', (target) => {
    expect(resolveSameOriginTarget(target, ORIGIN).ok).toBe(false);
  });

  test.each(['/%2F%2Fevil.test', '/%5Cevil.test', '/%252F%252Fevil.test', '/%255Cevil.test'])(
    'encoded target %j never resolves off-origin',
    (target) => {
      const result = resolveSameOriginTarget(target, ORIGIN);
      if (result.ok) {
        expect(new URL(result.path, ORIGIN).origin).toBe(ORIGIN);
      }
    }
  );

  test.each([
    ['/api/admin/status', '/api/admin/status'],
    ['/api/x?y=1', '/api/x?y=1'],
  ])('accepts and normalizes %j', (target, expectedPath) => {
    expect(resolveSameOriginTarget(target, ORIGIN)).toEqual({ ok: true, path: expectedPath });
  });

  test('accepts every automated preset path as same-origin', () => {
    for (const preset of AUTOMATED_API_PRESETS) {
      expect(resolveSameOriginTarget(preset.path, ORIGIN)).toEqual({
        ok: true,
        path: new URL(preset.path, ORIGIN).pathname + new URL(preset.path, ORIGIN).search,
      });
    }
  });
});
