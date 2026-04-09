/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useWigleSearch } from '../useWigleSearch';
import { wigleApi } from '../../../../api/wigleApi';

jest.mock('../../../../api/wigleApi', () => ({
  wigleApi: {
    getApiStatus: jest.fn(),
    searchWigle: jest.fn(),
    importAllWigle: jest.fn(),
    listImportRuns: jest.fn(),
    getImportCompletenessReport: jest.fn(),
    resumeImportRun: jest.fn(),
    pauseImportRun: jest.fn(),
    cancelImportRun: jest.fn(),
  },
}));

describe('useWigleSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads resumable runs and completeness for the current query', async () => {
    (wigleApi.listImportRuns as jest.Mock).mockResolvedValue({
      runs: [{ id: 17, status: 'paused', searchTerm: 'fbi', state: 'PA', nextPage: 4 }],
    });
    (wigleApi.getImportCompletenessReport as jest.Mock).mockResolvedValue({
      report: {
        states: [{ state: 'PA', runId: 17, missingApiRows: 88, resumable: true }],
      },
    });

    const { result } = renderHook(() => useWigleSearch());

    act(() => {
      result.current.setSearchParams({
        ...result.current.searchParams,
        ssid: 'fbi',
        region: 'PA',
      });
    });

    await act(async () => {
      await result.current.loadImportOperations();
    });

    expect((wigleApi.listImportRuns as jest.Mock).mock.calls[0][0].toString()).toContain(
      'searchTerm=fbi'
    );
    expect((wigleApi.listImportRuns as jest.Mock).mock.calls[0][0].toString()).toContain(
      'state=PA'
    );
    expect(result.current.importRuns[0]).toEqual(
      expect.objectContaining({ id: 17, status: 'paused' })
    );
    expect(result.current.completenessReport[0]).toEqual(
      expect.objectContaining({ state: 'PA', resumable: true })
    );
  });

  it('resumes a run and refreshes operator state', async () => {
    (wigleApi.resumeImportRun as jest.Mock).mockResolvedValue({
      run: {
        id: 9,
        status: 'running',
        apiTotalResults: 120,
        apiCursor: 'cursor-10',
        rowsReturned: 90,
        rowsInserted: 90,
        pagesFetched: 9,
        totalPages: 12,
      },
    });
    (wigleApi.listImportRuns as jest.Mock).mockResolvedValue({ runs: [] });
    (wigleApi.getImportCompletenessReport as jest.Mock).mockResolvedValue({
      report: { states: [] },
    });

    const { result } = renderHook(() => useWigleSearch());

    await act(async () => {
      await result.current.resumeImportRun(9);
    });

    expect(wigleApi.resumeImportRun).toHaveBeenCalledWith(9);
    expect(result.current.lastImportRun).toEqual(
      expect.objectContaining({ id: 9, status: 'running' })
    );
    expect(result.current.searchResults?.run).toEqual(
      expect.objectContaining({ id: 9, status: 'running' })
    );
    expect(result.current.currentRunActionId).toBeNull();
  });
});
