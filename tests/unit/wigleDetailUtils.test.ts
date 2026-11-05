export {};

import {
  computeTemporalSummary,
  computeSsidDisplaySummary,
  bestObservedSsid,
  isHiddenSsid,
  extractDetailErrorMessage,
  isValidNetid,
  extractNetidFromLedgerRow,
} from '../../client/src/utils/wigleDetailUtils';

// ─── computeTemporalSummary ───────────────────────────────────────────────────

describe('computeTemporalSummary', () => {
  const obs = (observed_at: string) => ({ observed_at });

  test('multiple observations produce earliest firstSeen and latest lastSeen', () => {
    const result = computeTemporalSummary(
      [obs('2026-05-28T03:00:00Z'), obs('2026-05-21T03:00:00Z'), obs('2026-05-25T12:00:00Z')],
      null
    );
    expect(result.firstSeen).toBe(new Date('2026-05-21T03:00:00Z').toISOString());
    expect(result.lastSeen).toBe(new Date('2026-05-28T03:00:00Z').toISOString());
  });

  test('selected observation timestamp is separate from first/last', () => {
    const result = computeTemporalSummary(
      [obs('2026-05-21T03:00:00Z'), obs('2026-05-28T03:00:00Z')],
      '2026-05-25T12:00:00Z'
    );
    expect(result.selectedSeen).toBe('2026-05-25T12:00:00Z');
    // first/last must NOT change because of selectedSeen
    expect(result.firstSeen).toBe(new Date('2026-05-21T03:00:00Z').toISOString());
    expect(result.lastSeen).toBe(new Date('2026-05-28T03:00:00Z').toISOString());
  });

  test('single observation produces same first and last', () => {
    const result = computeTemporalSummary([obs('2026-05-21T03:00:00Z')], null);
    expect(result.firstSeen).toBe(result.lastSeen);
  });

  test('invalid/null timestamps are ignored', () => {
    const result = computeTemporalSummary(
      [{ observed_at: null }, { observed_at: 'not-a-date' }, obs('2026-05-21T03:00:00Z')],
      null
    );
    expect(result.firstSeen).toBe(new Date('2026-05-21T03:00:00Z').toISOString());
    expect(result.lastSeen).toBe(new Date('2026-05-21T03:00:00Z').toISOString());
  });

  test('empty observations with no data timestamps returns nulls', () => {
    const result = computeTemporalSummary([], null);
    expect(result.firstSeen).toBeNull();
    expect(result.lastSeen).toBeNull();
    expect(result.selectedSeen).toBeNull();
  });

  test('data.firstSeen/lastSeen are folded in when no individual observations', () => {
    const result = computeTemporalSummary([], null, '2026-05-01T00:00:00Z', '2026-05-20T00:00:00Z');
    expect(result.firstSeen).toBe(new Date('2026-05-01T00:00:00Z').toISOString());
    expect(result.lastSeen).toBe(new Date('2026-05-20T00:00:00Z').toISOString());
  });

  test('observationCount reflects list length', () => {
    const result = computeTemporalSummary(
      [obs('2026-05-21T03:00:00Z'), obs('2026-05-22T03:00:00Z')],
      null
    );
    expect(result.observationCount).toBe(2);
  });

  test('null selectedObs timestamp produces null selectedSeen', () => {
    const result = computeTemporalSummary([obs('2026-05-21T03:00:00Z')], null);
    expect(result.selectedSeen).toBeNull();
  });
});

// ─── isHiddenSsid ─────────────────────────────────────────────────────────────

describe('isHiddenSsid', () => {
  test.each([null, undefined, '', '(hidden)', 'hidden', '(blank)'])('treats %s as hidden', (val) =>
    expect(isHiddenSsid(val)).toBe(true)
  );

  test.each(['FBI Surveillance Van', 'MyNetwork', '0'])('treats %s as visible', (val) =>
    expect(isHiddenSsid(val)).toBe(false)
  );
});

// ─── computeSsidDisplaySummary ────────────────────────────────────────────────

describe('computeSsidDisplaySummary', () => {
  test('canonical (hidden) + observed SSID exposes observedSsid', () => {
    const s = computeSsidDisplaySummary('(hidden)', 'FBI Surveillance Van');
    expect(s.isHiddenCanonical).toBe(true);
    expect(s.canonicalSsid).toBeNull();
    expect(s.observedSsid).toBe('FBI Surveillance Van');
    expect(s.displayTitle).toBe('FBI Surveillance Van');
  });

  test('canonical hidden + no observed SSID → displayTitle is (hidden)', () => {
    const s = computeSsidDisplaySummary(null, null);
    expect(s.displayTitle).toBe('(hidden)');
    expect(s.observedSsid).toBeNull();
  });

  test('canonical visible + same observed SSID → no duplicate', () => {
    const s = computeSsidDisplaySummary('MyNetwork', 'MyNetwork');
    expect(s.canonicalSsid).toBe('MyNetwork');
    expect(s.observedSsid).toBe('MyNetwork');
    expect(s.displayTitle).toBe('MyNetwork');
    expect(s.isHiddenCanonical).toBe(false);
  });

  test('canonical visible + different observed SSID → both exposed', () => {
    const s = computeSsidDisplaySummary('CorpWifi', 'FBI Van');
    expect(s.canonicalSsid).toBe('CorpWifi');
    expect(s.observedSsid).toBe('FBI Van');
    expect(s.displayTitle).toBe('CorpWifi'); // canonical wins for title
    expect(s.isHiddenCanonical).toBe(false);
  });

  test('blank string treated same as hidden', () => {
    const s = computeSsidDisplaySummary('', 'FBI Surveillance Van');
    expect(s.isHiddenCanonical).toBe(true);
    expect(s.observedSsid).toBe('FBI Surveillance Van');
  });
});

// ─── bestObservedSsid ─────────────────────────────────────────────────────────

describe('bestObservedSsid', () => {
  test('selected obs SSID takes priority over observation list', () => {
    const result = bestObservedSsid([{ ssid: 'FromList' }], 'FromSelected');
    expect(result).toBe('FromSelected');
  });

  test('falls back to first visible SSID in list when selected is null', () => {
    const result = bestObservedSsid(
      [{ ssid: null }, { ssid: '(hidden)' }, { ssid: 'FBI Surveillance Van' }],
      null
    );
    expect(result).toBe('FBI Surveillance Van');
  });

  test('returns null when all SSIDs are hidden', () => {
    const result = bestObservedSsid([{ ssid: null }, { ssid: '' }], null);
    expect(result).toBeNull();
  });

  test('empty list + no selected returns null', () => {
    expect(bestObservedSsid([], null)).toBeNull();
  });
});

describe('extractDetailErrorMessage', () => {
  test('returns fallback for null, undefined, or empty values', () => {
    expect(extractDetailErrorMessage(null)).toBe('Failed to fetch WiGLE detail');
    expect(extractDetailErrorMessage(undefined)).toBe('Failed to fetch WiGLE detail');
    expect(extractDetailErrorMessage('')).toBe('Failed to fetch WiGLE detail');
    expect(extractDetailErrorMessage('   ')).toBe('Failed to fetch WiGLE detail');
  });

  test('returns plain string errors directly', () => {
    expect(extractDetailErrorMessage('Network ID (BSSID) is required')).toBe(
      'Network ID (BSSID) is required'
    );
  });

  test('extracts message from structured AppError response ({ ok: false, error: { message, code } })', () => {
    const errorResponse = {
      ok: false,
      error: {
        message: 'unsupported Unicode escape sequence \\u0000',
        code: 'DATABASE_ERROR',
        statusCode: 500,
      },
    };
    expect(extractDetailErrorMessage(errorResponse)).toBe(
      'unsupported Unicode escape sequence \\u0000'
    );
  });

  test('extracts error string from { error: "Rate limit exceeded" }', () => {
    expect(extractDetailErrorMessage({ ok: false, error: 'Rate limit exceeded' })).toBe(
      'Rate limit exceeded'
    );
  });

  test('extracts string from details field', () => {
    expect(extractDetailErrorMessage({ ok: false, details: 'Gateway Timeout' })).toBe(
      'Gateway Timeout'
    );
  });

  test('extracts code when message is absent in error object', () => {
    expect(extractDetailErrorMessage({ ok: false, error: { code: 'FORBIDDEN' } })).toBe(
      'FORBIDDEN'
    );
  });

  test('extracts top-level message string', () => {
    expect(extractDetailErrorMessage({ message: 'Internal server error' })).toBe(
      'Internal server error'
    );
  });

  test('handles Error instance with clean message', () => {
    expect(extractDetailErrorMessage(new Error('Connection refused'))).toBe('Connection refused');
  });

  test('serializes unexpected error object properties without [object Object]', () => {
    const weirdObj = { ok: false, error: { foo: 'bar', val: 42 } };
    const result = extractDetailErrorMessage(weirdObj);
    expect(result).not.toContain('[object Object]');
    expect(result).toBe('{"foo":"bar","val":42}');
  });
});

describe('isValidNetid', () => {
  test('accepts valid colon-delimited MAC addresses', () => {
    expect(isValidNetid('00:11:22:33:44:55')).toBe(true);
    expect(isValidNetid('5C:54:10:7C:11:71')).toBe(true);
    expect(isValidNetid('a4:43:8c:64:2a:43')).toBe(true);
  });

  test('accepts valid hyphen-delimited and continuous hex MAC addresses', () => {
    expect(isValidNetid('00-11-22-33-44-55')).toBe(true);
    expect(isValidNetid('001122334455')).toBe(true);
  });

  test('accepts valid cellular identifiers', () => {
    expect(isValidNetid('310_410_12345')).toBe(true);
    expect(isValidNetid('LTE:Cell_01')).toBe(true);
    expect(isValidNetid('GSM-12345')).toBe(true);
  });

  test('rejects malformed, empty, or dangerous identifiers', () => {
    expect(isValidNetid('')).toBe(false);
    expect(isValidNetid('   ')).toBe(false);
    expect(isValidNetid(null)).toBe(false);
    expect(isValidNetid(undefined)).toBe(false);
    expect(isValidNetid('../../etc/passwd')).toBe(false);
    expect(isValidNetid('<script>alert(1)</script>')).toBe(false);
    expect(isValidNetid('MAC WITH SPACES')).toBe(false);
    expect(isValidNetid('00:11:22')).toBe(false);
  });
});

describe('extractNetidFromLedgerRow', () => {
  test('extracts valid netid from queryParams.netid', () => {
    const row = {
      queryParams: { netid: '00:11:22:33:44:55' },
    };
    expect(extractNetidFromLedgerRow(row)).toBe('00:11:22:33:44:55');
  });

  test('extracts valid bssid from queryParams.bssid', () => {
    const row = {
      queryParams: { bssid: '5C:54:10:7C:11:71' },
    };
    expect(extractNetidFromLedgerRow(row)).toBe('5C:54:10:7C:11:71');
  });

  test('extracts valid netid from Wi-Fi detail queryUrl', () => {
    const row = {
      queryUrl: 'https://api.wigle.net/api/v3/detail/wifi/00:11:22:33:44:55',
    };
    expect(extractNetidFromLedgerRow(row)).toBe('00:11:22:33:44:55');
  });

  test('extracts valid netid from Bluetooth detail queryUrl', () => {
    const row = {
      queryUrl: 'https://api.wigle.net/api/v3/detail/bt/5C:54:10:7C:11:71',
    };
    expect(extractNetidFromLedgerRow(row)).toBe('5C:54:10:7C:11:71');
  });

  test('extracts valid netid from cellular detail queryUrl', () => {
    const row = {
      queryUrl: 'https://api.wigle.net/api/v3/detail/cell/310_410_12345',
    };
    expect(extractNetidFromLedgerRow(row)).toBe('310_410_12345');
  });

  test('safely decodes percent-encoded netid from detail queryUrl', () => {
    const row = {
      queryUrl: 'https://api.wigle.net/api/v3/detail/wifi/00%3A11%3A22%3A33%3A44%3A55',
    };
    expect(extractNetidFromLedgerRow(row)).toBe('00:11:22:33:44:55');
  });

  test('handles malformed percent sequences gracefully without throwing URIError', () => {
    const rowMalformed = {
      queryUrl: 'https://api.wigle.net/api/v3/detail/bt/%E0%A4%A',
    };
    expect(() => extractNetidFromLedgerRow(rowMalformed)).not.toThrow();
    expect(extractNetidFromLedgerRow(rowMalformed)).toBeNull();

    const rowIncompletePercent = {
      queryUrl: 'https://api.wigle.net/api/v3/detail/bt/5C%2',
    };
    expect(extractNetidFromLedgerRow(rowIncompletePercent)).toBeNull();
  });

  test('returns null for missing, unsupported, or non-detail URLs', () => {
    expect(extractNetidFromLedgerRow(null)).toBeNull();
    expect(extractNetidFromLedgerRow(undefined)).toBeNull();
    expect(extractNetidFromLedgerRow({})).toBeNull();
    expect(
      extractNetidFromLedgerRow({
        queryUrl: 'https://api.wigle.net/api/v2/network/search?ssid=foo',
      })
    ).toBeNull();
    expect(
      extractNetidFromLedgerRow({ queryUrl: 'https://api.wigle.net/api/v3/detail/wifi/' })
    ).toBeNull();
  });

  test('returns null for path traversal or malicious injection in URL', () => {
    const rowMalicious = {
      queryUrl: 'https://api.wigle.net/api/v3/detail/wifi/../../etc/passwd',
    };
    expect(extractNetidFromLedgerRow(rowMalicious)).toBeNull();
  });
});
