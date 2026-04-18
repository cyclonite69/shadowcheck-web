const { envFlag } = require('../../../server/src/utils/envFlag');

describe('envFlag', () => {
  it('returns the default when the env value is absent', () => {
    expect(envFlag(undefined, true)).toBe(true);
    expect(envFlag('', false)).toBe(false);
  });

  it('parses case-insensitive true values', () => {
    expect(envFlag('true', false)).toBe(true);
    expect(envFlag('TRUE', false)).toBe(true);
  });

  it('treats any other provided value as false', () => {
    expect(envFlag('false', true)).toBe(false);
    expect(envFlag('1', true)).toBe(false);
  });
});
