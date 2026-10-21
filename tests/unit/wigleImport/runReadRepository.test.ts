const { query } = require('../../../server/src/config/database');

import * as runReadRepository from '../../../server/src/services/wigleImport/repositories/runReadRepository';

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('runReadRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findLatestResumableRun queries by normalized fingerprint, statuses, and allowlisted WiFi sources', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 42, status: 'paused', source: 'wigle_v2' }] });

    const result = await runReadRepository.findLatestResumableRun({ ssid: 'test', country: 'US' }, [
      'paused',
      'failed',
    ]);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('AND source = ANY($3::text[])'), [
      expect.any(String),
      ['paused', 'failed'],
      ['wigle', 'wigle_v2'],
    ]);
    expect(result).toEqual({ id: 42, status: 'paused', source: 'wigle_v2' });
  });

  it('getRunPages returns ordered page rows', async () => {
    query.mockResolvedValueOnce({ rows: [{ page_number: 3 }, { page_number: 2 }] });

    const result = await runReadRepository.getRunPages(9, 2);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM app.wigle_import_run_pages'),
      [9, 2]
    );
    expect(result).toEqual([{ page_number: 3 }, { page_number: 2 }]);
  });
});
