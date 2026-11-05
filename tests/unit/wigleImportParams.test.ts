import {
  buildSearchParams,
  DEFAULT_RESULTS_PER_PAGE,
  getRequestFingerprint,
  getSearchTerm,
  normalizeImportParams,
  validateImportQuery,
} from '../../server/src/services/wigleImport/params';
import { WigleValidationError } from '../../server/src/services/wigleImport/wigleApiSpec';

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

    expect(normalizeImportParams({ country: '  us  ' })).toEqual({
      country: 'US',
      resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
      version: 'v2',
    });

    expect(normalizeImportParams({ country: 'FR' })).toEqual({
      country: 'FR',
      resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
      version: 'v2',
    });

    expect(normalizeImportParams({ country: 'United States' })).toEqual({
      country: 'UNITED STATES',
      resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
      version: 'v2',
    });

    expect(normalizeImportParams({ country: 'usa' })).toEqual({
      country: 'USA',
      resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
      version: 'v2',
    });

    expect(normalizeImportParams({ country: 'germany' })).toEqual({
      country: 'GERMANY',
      resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
      version: 'v2',
    });

    expect(normalizeImportParams({ country: ' Australia ' })).toEqual({
      country: 'AUSTRALIA',
      resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
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

  it('buildSearchParams country parameter normalization and validation', () => {
    // 1. Omitted country remains absent
    const paramsOmitted = buildSearchParams({ ssid: 'fbi' });
    expect(paramsOmitted.has('country')).toBe(false);
    expect(paramsOmitted.get('ssidlike')).toBe('fbi');

    // 2. Existing US code remains US
    const paramsUS = buildSearchParams({ ssid: 'fbi', country: 'US' });
    expect(paramsUS.get('country')).toBe('US');
    expect(paramsUS.get('ssidlike')).toBe('fbi');

    // 3. Lowercase valid codes normalize appropriately
    const paramsLowercase = buildSearchParams({ ssid: 'fbi', country: 'us' });
    expect(paramsLowercase.get('country')).toBe('US');
    expect(paramsLowercase.get('ssidlike')).toBe('fbi');

    // 4. Padded codes normalize appropriately
    const paramsPadded = buildSearchParams({ ssid: 'fbi', country: '   us   ' });
    expect(paramsPadded.get('country')).toBe('US');
    expect(paramsPadded.get('ssidlike')).toBe('fbi');

    // 5. Invalid values such as USA, United States, and XYZ fail clearly (throw WigleValidationError)
    expect(() => {
      buildSearchParams({ ssid: 'fbi', country: 'United States' });
    }).toThrow(WigleValidationError);

    expect(() => {
      buildSearchParams({ ssid: 'fbi', country: 'USA' });
    }).toThrow(WigleValidationError);

    expect(() => {
      buildSearchParams({ ssid: 'fbi', country: 'XYZ' });
    }).toThrow(WigleValidationError);

    // 6. Unrelated fields remain unchanged
    const paramsUnrelated = buildSearchParams({
      ssid: 'fbi',
      country: 'us',
      region: 'IL',
      city: 'Chicago',
    });
    expect(paramsUnrelated.get('country')).toBe('US');
    expect(paramsUnrelated.get('ssidlike')).toBe('fbi');
    expect(paramsUnrelated.get('region')).toBe('IL');
    expect(paramsUnrelated.get('city')).toBe('Chicago');
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

  it('builds search params with cursor using v2 searchAfter param (v2-only)', () => {
    const params = buildSearchParams({ ssid: 'test' }, 'cursor123');
    expect(params.get('searchAfter')).toBe('cursor123');
    expect(params.has('search_after')).toBe(false);
  });

  it('does NOT add "first" parameter alongside searchAfter in v2', () => {
    const params = buildSearchParams({ ssid: 'test' }, '100');
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

  describe('SSID pattern handling and wildcard serialization', () => {
    it('maps query.ssid directly to ssidlike without altering wildcards or stripping backslashes', () => {
      const standardWildcard = buildSearchParams({ ssid: 'x_%', country: 'US' });
      expect(standardWildcard.get('ssidlike')).toBe('x_%');
      expect(standardWildcard.toString()).toContain('ssidlike=x_%25');

      const escapedWildcard = buildSearchParams({ ssid: 'x\\_%', country: 'US' });
      expect(escapedWildcard.get('ssidlike')).toBe('x\\_%');
      // Verifies URLSearchParams properly encodes backslash (%5C) and percent (%25)
      expect(escapedWildcard.toString()).toContain('ssidlike=x%5C_%25');
    });
  });
});
