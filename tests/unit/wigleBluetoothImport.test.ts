export {};

import {
  normalizeBtImportParams,
  validateBtImportQuery,
  buildBtSearchParams,
  getBtSearchTerm,
  getBtRequestFingerprint,
  DEFAULT_BT_RESULTS_PER_PAGE,
} from '../../server/src/services/wigleImport/btParams';
import { insertWigleBtSearchResult } from '../../server/src/repositories/wiglePersistenceRepository';

// ── btParams helpers ─────────────────────────────────────────────────────────

describe('btParams normalization', () => {
  it('applies defaults for empty input', () => {
    const result = normalizeBtImportParams({ country: 'US' });
    expect(result.country).toBe('US');
    expect(result.resultsPerPage).toBe(DEFAULT_BT_RESULTS_PER_PAGE);
    expect(result.showBt).toBe(true);
    expect(result.showBle).toBe(true);
  });

  it('fills default country when omitted', () => {
    const result = normalizeBtImportParams({ namelike: 'raven' });
    expect(result.country).toBe('US');
    expect(result.namelike).toBe('raven');
  });

  it('clamps resultsPerPage to valid range', () => {
    expect(normalizeBtImportParams({ country: 'US', resultsPerPage: '5000' }).resultsPerPage).toBe(
      1000
    );
    expect(normalizeBtImportParams({ country: 'US', resultsPerPage: '-5' }).resultsPerPage).toBe(1);
  });

  it('parses mfgrIdMinimum and mfgrIdMaximum as integers', () => {
    const result = normalizeBtImportParams({
      mfgrIdMinimum: '2504',
      mfgrIdMaximum: '2504',
    });
    expect(result.mfgrIdMinimum).toBe(2504);
    expect(result.mfgrIdMaximum).toBe(2504);
  });

  it('floors non-integer mfgrId values', () => {
    const result = normalizeBtImportParams({ mfgrIdMinimum: '1447.9' });
    expect(result.mfgrIdMinimum).toBe(1447);
  });

  it('rejects negative mfgrId values', () => {
    const result = normalizeBtImportParams({ mfgrIdMinimum: '-1' });
    expect(result.mfgrIdMinimum).toBeUndefined();
  });

  it('normalises showBt/showBle string booleans', () => {
    const result = normalizeBtImportParams({ showBt: 'false', showBle: 'true' });
    expect(result.showBt).toBe(false);
    expect(result.showBle).toBe(true);
  });

  it('strips empty-string fields', () => {
    const result = normalizeBtImportParams({ namelike: '', region: '' });
    expect(result.namelike).toBeUndefined();
    expect(result.region).toBeUndefined();
  });
});

describe('btParams validation', () => {
  it('accepts empty input (defaults to country=US)', () => {
    // Normalization always applies country='US', so empty input is valid.
    expect(validateBtImportQuery({})).toBeNull();
  });

  it('accepts country alone', () => {
    expect(validateBtImportQuery({ country: 'US' })).toBeNull();
  });

  it('accepts mfgrIdMinimum alone', () => {
    expect(validateBtImportQuery({ mfgrIdMinimum: 2504 })).toBeNull();
  });

  it('accepts namelike alone', () => {
    expect(validateBtImportQuery({ namelike: 'raven' })).toBeNull();
  });
});

describe('buildBtSearchParams', () => {
  it('includes mfgrId range when provided', () => {
    const params = buildBtSearchParams({
      country: 'US',
      mfgrIdMinimum: 2504,
      mfgrIdMaximum: 2504,
      resultsPerPage: 100,
    });
    const str = params.toString();
    expect(str).toContain('mfgrIdMinimum=2504');
    expect(str).toContain('mfgrIdMaximum=2504');
    expect(str).toContain('country=US');
    expect(str).toContain('resultsPerPage=100');
  });

  it('omits showBt/showBle when both are true', () => {
    const params = buildBtSearchParams({ country: 'US', showBt: true, showBle: true });
    expect(params.toString()).not.toContain('showBt');
    expect(params.toString()).not.toContain('showBle');
  });

  it('includes showBt=false when explicitly disabled', () => {
    const params = buildBtSearchParams({ country: 'US', showBt: false, showBle: true });
    expect(params.toString()).toContain('showBt=false');
    expect(params.toString()).not.toContain('showBle');
  });

  it('appends searchAfter cursor when provided', () => {
    const params = buildBtSearchParams({ country: 'US' }, 'cursor-123');
    expect(params.toString()).toContain('searchAfter=cursor-123');
  });

  it('preserves and encodes escaped wildcards in namelike without stripping backslashes', () => {
    const standard = buildBtSearchParams({ namelike: 'x_%', country: 'US' });
    expect(standard.get('namelike')).toBe('x_%');
    expect(standard.toString()).toContain('namelike=x_%25');

    const escaped = buildBtSearchParams({ namelike: 'x\\_%', country: 'US' });
    expect(escaped.get('namelike')).toBe('x\\_%');
    expect(escaped.toString()).toContain('namelike=x%5C_%25');
  });
});

describe('getBtSearchTerm', () => {
  it('prefers namelike', () => {
    expect(getBtSearchTerm({ namelike: 'raven', country: 'US', mfgrIdMinimum: 2504 })).toBe(
      'raven'
    );
  });

  it('falls back to mfgr: prefix for mfgrIdMinimum only', () => {
    expect(getBtSearchTerm({ mfgrIdMinimum: 2504, country: 'US' })).toBe('mfgr:2504');
  });

  it('falls back to country as last resort', () => {
    expect(getBtSearchTerm({ country: 'US' })).toBe('US');
  });
});

describe('getBtRequestFingerprint', () => {
  it('produces consistent hashes for the same params', () => {
    const p = { country: 'US', mfgrIdMinimum: 2504, resultsPerPage: 100 };
    expect(getBtRequestFingerprint(p)).toBe(getBtRequestFingerprint(p));
  });

  it('produces different hashes for different params', () => {
    const a = getBtRequestFingerprint({ country: 'US', mfgrIdMinimum: 2504 });
    const b = getBtRequestFingerprint({ country: 'US', mfgrIdMinimum: 1447 });
    expect(a).not.toBe(b);
  });

  it('is order-independent (stable stringify)', () => {
    const a = getBtRequestFingerprint({ country: 'US', mfgrIdMinimum: 2504 } as any);
    const b = getBtRequestFingerprint({ mfgrIdMinimum: 2504, country: 'US' } as any);
    expect(a).toBe(b);
  });
});

// ── insertWigleBtSearchResult ─────────────────────────────────────────────────

describe('insertWigleBtSearchResult', () => {
  it('skips devices without usable coordinates', async () => {
    const query = jest.fn();

    const count = await insertWigleBtSearchResult(
      { query },
      {
        netid: 'AA:BB:CC:DD:EE:FF',
        name: 'RavenR1',
        trilat: '',
        trilong: null,
      }
    );

    expect(count).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('inserts a device with valid coordinates', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });

    const count = await insertWigleBtSearchResult(
      { query },
      {
        netid: 'AA:BB:CC:DD:EE:FF',
        name: 'RavenR1',
        type: 'BLE',
        trilat: '42.1234',
        trilong: '-83.1234',
        firsttime: '2026-01-01T00:00:00Z',
        lasttime: '2026-01-02T00:00:00Z',
        lastupdt: '2026-01-03T00:00:00Z',
        mfgrId: 2504,
      }
    );

    expect(count).toBe(1);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('maps mfgrId to the mfgrid column parameter', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });

    await insertWigleBtSearchResult(
      { query },
      {
        netid: 'AA:BB:CC:DD:EE:FF',
        name: 'RavenR1',
        trilat: '42.0',
        trilong: '-83.0',
        mfgrId: 2504,
      }
    );

    const params: any[] = query.mock.calls[0][1];
    // mfgrid is the 9th bind param ($9)
    expect(params[8]).toBe(2504);
  });

  it('sets mfgrid to null when mfgrId is absent', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });

    await insertWigleBtSearchResult(
      { query },
      {
        netid: 'AA:BB:CC:DD:EE:FF',
        name: 'device-no-mfgr',
        trilat: '42.0',
        trilong: '-83.0',
      }
    );

    const params: any[] = query.mock.calls[0][1];
    expect(params[8]).toBeNull();
  });

  it('sets mfgrid to null when mfgrId is null', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });

    await insertWigleBtSearchResult(
      { query },
      {
        netid: 'AA:BB:CC:DD:EE:FF',
        trilat: '42.0',
        trilong: '-83.0',
        mfgrId: null,
      }
    );

    const params: any[] = query.mock.calls[0][1];
    expect(params[8]).toBeNull();
  });

  it('defaults type to BLE when absent from device', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });

    await insertWigleBtSearchResult(
      { query },
      {
        netid: 'AA:BB:CC:DD:EE:FF',
        trilat: '42.0',
        trilong: '-83.0',
      }
    );

    const params: any[] = query.mock.calls[0][1];
    // type is the 3rd bind param ($3)
    expect(params[2]).toBe('BLE');
  });

  it('passes explicit BT type through unchanged', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });

    await insertWigleBtSearchResult(
      { query },
      {
        netid: 'AA:BB:CC:DD:EE:FF',
        type: 'BT',
        trilat: '42.0',
        trilong: '-83.0',
      }
    );

    const params: any[] = query.mock.calls[0][1];
    expect(params[2]).toBe('BT');
  });

  it('uses ON CONFLICT upsert SQL targeting netid+trilat+trilong+lastupdt', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });

    await insertWigleBtSearchResult(
      { query },
      {
        netid: 'AA:BB:CC:DD:EE:FF',
        trilat: '42.0',
        trilong: '-83.0',
        lastupdt: '2026-01-03T00:00:00Z',
        mfgrId: 9999,
      }
    );

    const sql: string = query.mock.calls[0][0];
    expect(sql).toContain('ON CONFLICT (netid, trilat, trilong, lastupdt) DO UPDATE');
    expect(sql).toContain('mfgrid     = EXCLUDED.mfgrid');
  });
});
