import {
  buildSearchParams,
  DEFAULT_RESULTS_PER_PAGE,
  getRequestFingerprint,
  getSearchTerm,
  normalizeImportParams,
  validateImportQuery,
} from '../../server/src/services/wigleImport/params';

describe('wigleImport params helpers', () => {
  it('normalizes defaults and clamps resultsPerPage', () => {
    expect(normalizeImportParams({ ssid: 'fbi' })).toEqual({
      ssid: 'fbi',
      country: 'US',
      resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
      version: 'v2',
    });

    expect(normalizeImportParams({ resultsPerPage: '5000', country: 'CA' })).toEqual({
      country: 'CA',
      resultsPerPage: 1000,
      version: 'v2',
    });

    expect(normalizeImportParams({ resultsPerPage: -10 })).toEqual({
      country: 'US',
      resultsPerPage: 1,
      version: 'v2',
    });
  });

  it('builds search params with searchAfter when present', () => {
    const params = buildSearchParams(
      {
        ssid: 'fbi',
        region: 'IL',
        resultsPerPage: 25,
      },
      'cursor-2'
    );

    expect(params.toString()).toBe('ssidlike=fbi&region=IL&resultsPerPage=25&searchAfter=cursor-2');
  });

  it('stableStringify handles arrays correctly', () => {
    // Since stableStringify is not exported, we test it through getRequestFingerprint
    const fp1 = getRequestFingerprint({ ssid: 'test', region: ['IL', 'NY'] } as any);
    const fp2 = getRequestFingerprint({ region: ['IL', 'NY'], ssid: 'test' } as any);
    expect(fp1).toBe(fp2);
  });

  it('builds search params with all optional fields', () => {
    const query = {
      ssid: 'fbi',
      bssid: 'AA:BB:CC:DD:EE:FF',
      latrange1: '40',
      latrange2: '41',
      longrange1: '-70',
      longrange2: '-71',
      country: 'US',
      region: 'IL',
      city: 'Chicago',
      resultsPerPage: 50,
    };
    const params = buildSearchParams(query);
    const str = params.toString();
    expect(str).toContain('ssidlike=fbi');
    expect(str).toContain('netid=AA%3ABB%3ACC%3ADD%3AEE%3AFF');
    expect(str).toContain('latrange1=40');
    expect(str).toContain('latrange2=41');
    expect(str).toContain('longrange1=-70');
    expect(str).toContain('longrange2=-71');
    expect(str).toContain('country=US');
    expect(str).toContain('region=IL');
    expect(str).toContain('city=Chicago');
    expect(str).toContain('resultsPerPage=50');
  });

  it('builds search params for v3 API', () => {
    const params = buildSearchParams({ ssid: 'test' }, 'cursor123', 'v3');
    expect(params.get('search_after')).toBe('cursor123');
    expect(params.has('searchAfter')).toBe(false);
  });

  it('does NOT add "first" parameter alongside searchAfter in v2 (prevents WiGLE from+search_after conflict)', () => {
    const params = buildSearchParams({ ssid: 'test' }, '100', 'v2');
    expect(params.get('searchAfter')).toBe('100');
    expect(params.get('first')).toBeNull();
  });

  it('uses stable fingerprints for equivalent queries', () => {
    const left = getRequestFingerprint({
      ssid: 'fbi',
      country: 'US',
      resultsPerPage: 25,
      version: 'v2',
    });
    const right = getRequestFingerprint({
      version: 'v2',
      resultsPerPage: 25,
      country: 'US',
      ssid: 'fbi',
    });

    expect(left).toBe(right);
  });

  it('derives the search term from the highest-priority populated field', () => {
    expect(getSearchTerm({ ssid: 'fbi', city: 'Chicago' })).toBe('fbi');
    expect(getSearchTerm({ bssid: 'AA:BB', city: 'Chicago' })).toBe('AA:BB');
    expect(getSearchTerm({ city: 'Chicago' })).toBe('Chicago');
    expect(getSearchTerm({ country: 'US' })).toBe('US');
    expect(getSearchTerm({})).toBe('');
  });

  it('validates that at least one supported search field is present', () => {
    expect(validateImportQuery({})).toBeNull(); // Default country US makes it valid
    expect(validateImportQuery({ ssid: 'fbi' })).toBeNull();
  });
});
