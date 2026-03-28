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

    expect(normalizeImportParams({ resultsPerPage: 5000, country: 'CA' })).toEqual({
      country: 'CA',
      resultsPerPage: 1000,
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
  });

  it('validates that at least one supported search field is present', () => {
    expect(validateImportQuery({})).toBeNull();
    expect(validateImportQuery({ country: '', region: '', city: '' })).toBeNull();
    expect(validateImportQuery({ ssid: 'fbi' })).toBeNull();
  });
});
