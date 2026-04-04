export {};

import { insertWigleV2SearchResult } from '../../server/src/repositories/wiglePersistenceRepository';

describe('wiglePersistenceRepository', () => {
  it('skips WiGLE v2 rows without valid coordinates', async () => {
    const query = jest.fn();

    const rowCount = await insertWigleV2SearchResult(
      { query },
      {
        netid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'bad-row',
        trilat: '',
        trilong: null,
      }
    );

    expect(rowCount).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('inserts WiGLE v2 rows with valid coordinates', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });

    const rowCount = await insertWigleV2SearchResult(
      { query },
      {
        netid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'good-row',
        trilat: '42.1234',
        trilong: '-83.1234',
        firsttime: '2026-01-01T00:00:00Z',
        lasttime: '2026-01-02T00:00:00Z',
        lastupdt: '2026-01-03T00:00:00Z',
      }
    );

    expect(rowCount).toBe(1);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
