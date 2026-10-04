import {
  isOriginAllowed,
  isUnsafeMethod,
  normalizeOrigins,
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
});
