import { SiblingRunRepository } from '../../../server/src/repositories/siblingRunRepository';

const mockAdminQuery = jest.fn();

jest.mock('../../../server/src/config/container', () => ({
  adminDbService: {
    adminQuery: (...args: any[]) => mockAdminQuery(...args),
  },
}));

describe('SiblingRunRepository', () => {
  let repository: SiblingRunRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new SiblingRunRepository();
  });

  it('createRun should insert a new sibling detection run', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ id: 123 }] });
    const runId = await repository.createRun('full', {
      maxOctetDelta: 1,
      minCandidateConf: 0.85,
      batchSize: 100,
      maxBatches: null,
    });
    expect(runId).toBe(123);
    expect(mockAdminQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO app.sibling_runs'),
      ['full', 1, 0.85, 100, null]
    );
  });

  it('completeRun should update run with five parameters including rowsUpdated', async () => {
    mockAdminQuery.mockResolvedValueOnce({});
    await repository.completeRun(123, 'completed', {
      seedsProcessed: 10,
      rowsUpserted: 20,
      rowsUpdated: 5,
    });
    expect(mockAdminQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE app.sibling_runs'),
      ['completed', 10, 20, 5, 123]
    );
  });

  it('getPreviousRunCutoff should return the latest completed scan start timestamp', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ cutoff: '2026-05-28T12:00:00Z' }] });
    const cutoff = await repository.getPreviousRunCutoff();
    expect(cutoff).toBe('2026-05-28T12:00:00Z');
    expect(mockAdminQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT MAX(started_at)'),
      []
    );
    expect(mockAdminQuery.mock.calls[0][0]).toMatch(
      /FROM app\.sibling_runs\s+WHERE status = 'completed'/
    );
    expect(mockAdminQuery.mock.calls[0][0]).not.toContain('network_sibling_pairs');
  });

  it('getPreviousRunCutoff should return null when no completed scan exists', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ cutoff: null }] });
    await expect(repository.getPreviousRunCutoff()).resolves.toBeNull();
  });

  // D1 regression tests: test-mode runs must not advance the global incremental watermark.

  it('getPreviousRunCutoff should filter to full and incremental run_modes only', async () => {
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ cutoff: '2026-05-31T05:00:00Z' }] });
    await repository.getPreviousRunCutoff();
    const sql: string = mockAdminQuery.mock.calls[0][0];
    expect(sql).toMatch(/run_mode IN \('full',\s*'incremental'\)/);
  });

  it('getPreviousRunCutoff should return null when only test runs exist', async () => {
    // Simulates: no full/incremental completed run exists — MAX returns NULL because
    // the run_mode filter excludes all test-mode rows.
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ cutoff: null }] });
    const cutoff = await repository.getPreviousRunCutoff();
    expect(cutoff).toBeNull();
  });

  it('getPreviousRunCutoff should not use a test run started_at that postdates the latest incremental', async () => {
    // Simulates the D1 scenario (counterfactual replay of run 177):
    //   - Last full/incremental completed: 2026-06-01T05:00:00Z (run 74)
    //   - OUI backfill test run completed later at 2026-06-01T15:51:38Z (run 176, 17 networks)
    // With the run_mode filter, the query returns the incremental cutoff, not the test run.
    mockAdminQuery.mockResolvedValueOnce({ rows: [{ cutoff: '2026-06-01T05:00:00.045877Z' }] });
    const cutoff = await repository.getPreviousRunCutoff();
    expect(cutoff).toBe('2026-06-01T05:00:00.045877Z');
    const sql: string = mockAdminQuery.mock.calls[0][0];
    expect(sql).toMatch(/run_mode IN \('full',\s*'incremental'\)/);
    expect(sql).not.toMatch(/run_mode\s*=\s*'test'/);
  });
});
