// Mock logger
jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

import { refreshMaterializedViews } from '../../../../server/src/services/backgroundJobs/mvRefresh';
const mockLogger = require('../../../../server/src/logging/logger');

describe('mvRefresh service', () => {
  let runAdminQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    runAdminQuery = jest.fn();
  });

  it('should refresh all materialized views successfully', async () => {
    // Mock loadExistingViews to return all views
    runAdminQuery.mockResolvedValueOnce({ rows: [] }); // refresh_network_locations
    runAdminQuery.mockResolvedValueOnce({
      rows: [
        { full_name: 'app.api_network_explorer_mv' },
        { full_name: 'app.api_network_latest_mv' },
        { full_name: 'app.analytics_summary_mv' },
        { full_name: 'app.mv_network_timeline' },
      ],
    });
    runAdminQuery.mockResolvedValue({ rows: [] }); // refresh calls

    const result = await refreshMaterializedViews(runAdminQuery);

    expect(result.refreshedViews).toHaveLength(4);
    expect(runAdminQuery).toHaveBeenCalledWith('SELECT app.refresh_network_locations()');
    expect(runAdminQuery).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY app.api_network_explorer_mv'
    );
    expect(runAdminQuery).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW app.api_network_latest_mv'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Starting materialized view refresh')
    );
  });

  it('should skip non-existent materialized views', async () => {
    runAdminQuery.mockResolvedValueOnce({ rows: [] }); // refresh_network_locations
    runAdminQuery.mockResolvedValueOnce({
      rows: [{ full_name: 'app.api_network_explorer_mv' }],
    });
    runAdminQuery.mockResolvedValue({ rows: [] }); // refresh calls

    const result = await refreshMaterializedViews(runAdminQuery);

    expect(runAdminQuery).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY app.api_network_explorer_mv'
    );
    expect(runAdminQuery).not.toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW app.api_network_latest_mv'
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping non-existent materialized views')
    );
  });

  it('should handle non-critical failures and continue', async () => {
    runAdminQuery.mockResolvedValueOnce({ rows: [] }); // refresh_network_locations
    runAdminQuery.mockResolvedValueOnce({
      rows: [
        { full_name: 'app.api_network_explorer_mv' },
        { full_name: 'app.api_network_latest_mv' },
      ],
    });

    // First refresh (explorer_mv) succeeds
    runAdminQuery.mockResolvedValueOnce({ rows: [] });
    // Second refresh (latest_mv) fails
    runAdminQuery.mockRejectedValueOnce(new Error('Refresh failed'));

    // We expect it to throw at the end because one failed
    await expect(refreshMaterializedViews(runAdminQuery)).rejects.toThrow(
      'app.api_network_latest_mv: Refresh failed'
    );

    expect(runAdminQuery).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY app.api_network_explorer_mv'
    );
    expect(runAdminQuery).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW app.api_network_latest_mv'
    );
  });

  it('should mark critical failures correctly', async () => {
    runAdminQuery.mockResolvedValueOnce({ rows: [] }); // refresh_network_locations
    runAdminQuery.mockResolvedValueOnce({
      rows: [
        { full_name: 'app.api_network_explorer_mv' }, // This is critical
      ],
    });

    runAdminQuery.mockRejectedValueOnce(new Error('Critical refresh failed'));

    try {
      await refreshMaterializedViews(runAdminQuery);
      fail('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('app.api_network_explorer_mv: Critical refresh failed');
      expect(error.severity).toBe('CRITICAL_FAILURE');
    }
  });

  it('should handle pre-MV dependency refresh failure gracefully', async () => {
    // refresh_network_locations fails
    runAdminQuery.mockRejectedValueOnce(new Error('Dependency refresh failed'));
    runAdminQuery.mockResolvedValueOnce({
      rows: [{ full_name: 'app.api_network_explorer_mv' }],
    });
    runAdminQuery.mockResolvedValueOnce({ rows: [] }); // refresh call

    const result = await refreshMaterializedViews(runAdminQuery);

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[MV Refresh Job] Failed to refresh network_locations:',
      'Dependency refresh failed'
    );
    expect(result.refreshedViews).toBeDefined();
    expect(runAdminQuery).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY app.api_network_explorer_mv'
    );
  });
});
