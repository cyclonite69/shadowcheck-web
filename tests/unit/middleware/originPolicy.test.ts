import {
  isOriginAllowed,
  isOriginPermitted,
  isUnsafeMethod,
  normalizeOrigins,
  resolveOriginPolicy,
} from '../../../server/src/middleware/originPolicy';

describe('originPolicy', () => {
  test('trims origins and drops empty entries', () => {
    expect(normalizeOrigins([' https://allowed.test ', '', '  ', 'https://other.test'])).toEqual([
      'https://allowed.test',
      'https://other.test',
    ]);
    expect(normalizeOrigins(['https://allowed.test', ''])).toEqual(['https://allowed.test']);
  });

  test.each([
    ['https://allowed.test', ['https://allowed.test'], true],
    ['https://allowed.test.evil', ['https://allowed.test'], false],
    ['null', ['null'], false],
    ['https://any.test', ['*'], true],
    [undefined, ['https://allowed.test'], false],
  ])('checks %j against %j', (origin, allowlist, expected) => {
    expect(isOriginAllowed(origin, allowlist)).toBe(expected);
  });

  test.each([
    ['POST', true],
    ['post', true],
    ['PUT', true],
    ['PATCH', true],
    ['DELETE', true],
    ['GET', false],
    ['HEAD', false],
    ['OPTIONS', false],
  ])('classifies %s as unsafe=%s', (method, expected) => {
    expect(isUnsafeMethod(method)).toBe(expected);
  });

  describe('resolveOriginPolicy', () => {
    test('ignores wildcard in production while retaining explicit origins', () => {
      expect(resolveOriginPolicy(['*', ' https://app.test ', ''], 'production')).toEqual({
        allowlist: ['https://app.test'],
        wildcard: false,
        wildcardIgnored: true,
      });
    });

    test('marks an empty production allowlist when wildcard is ignored', () => {
      expect(resolveOriginPolicy(['*'], 'production')).toEqual({
        allowlist: [],
        wildcard: false,
        wildcardIgnored: true,
      });
    });

    test.each([undefined, 'test', 'Production'])(
      'preserves wildcard outside exact production (%s)',
      (nodeEnv) => {
        expect(resolveOriginPolicy(['*', 'https://app.test'], nodeEnv)).toEqual({
          allowlist: ['*', 'https://app.test'],
          wildcard: true,
          wildcardIgnored: false,
        });
      }
    );
  });

  describe('isOriginPermitted', () => {
    const listedOrigin = 'https://app.test';
    const explicitPolicy = resolveOriginPolicy([listedOrigin], 'production');
    const wildcardPolicy = resolveOriginPolicy(['*'], 'test');

    test.each([
      [undefined, explicitPolicy, true],
      ['https://other.test', wildcardPolicy, true],
      [listedOrigin, explicitPolicy, true],
      ['https://other.test', explicitPolicy, false],
      ['null', explicitPolicy, false],
      ['', explicitPolicy, false],
      [`${listedOrigin}, https://other.test`, explicitPolicy, false],
      [`${listedOrigin}/`, explicitPolicy, false],
      ['https://APP.test', explicitPolicy, false],
      ['http://app.test', explicitPolicy, false],
      ['https://app.test:444', explicitPolicy, false],
    ])('checks Origin %j against policy as %s', (origin, policy, expected) => {
      expect(isOriginPermitted(origin, policy)).toBe(expected);
    });
  });
});
