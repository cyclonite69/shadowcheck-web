import { formatErrorWithCause } from '../../../server/src/utils/formatErrorWithCause';

describe('formatErrorWithCause', () => {
  it('returns message alone when there is no cause', () => {
    expect(formatErrorWithCause(new Error('Overpass unavailable'))).toBe('Overpass unavailable');
  });

  it('appends Error.cause message and errno code', () => {
    const cause = new Error('getaddrinfo ENOTFOUND overpass.nchc.org.tw') as NodeJS.ErrnoException;
    cause.code = 'ENOTFOUND';
    const err = new TypeError('fetch failed');
    (err as Error & { cause?: unknown }).cause = cause;

    expect(formatErrorWithCause(err)).toBe(
      'fetch failed (cause: getaddrinfo ENOTFOUND overpass.nchc.org.tw [ENOTFOUND])'
    );
  });

  it('handles a plain-object cause with message and code', () => {
    const err = new TypeError('fetch failed');
    (err as Error & { cause?: unknown }).cause = {
      message: 'connect ECONNREFUSED 127.0.0.1:443',
      code: 'ECONNREFUSED',
    };

    expect(formatErrorWithCause(err)).toBe(
      'fetch failed (cause: connect ECONNREFUSED 127.0.0.1:443 [ECONNREFUSED])'
    );
  });

  it('stringifies non-Error values', () => {
    expect(formatErrorWithCause('boom')).toBe('boom');
    expect(formatErrorWithCause(42)).toBe('42');
  });
});
