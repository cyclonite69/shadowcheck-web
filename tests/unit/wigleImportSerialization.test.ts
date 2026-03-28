import { computeProgress, serializeRun } from '../../server/src/services/wigleImport/serialization';

describe('wigleImport serialization helpers', () => {
  it('computes progress percentages from run rows', () => {
    expect(
      computeProgress({
        api_total_results: 8,
        total_pages: 4,
        page_size: 2,
        pages_fetched: 3,
        rows_returned: 6,
        rows_inserted: 5,
      })
    ).toMatchObject({
      apiTotalResults: 8,
      totalPages: 4,
      pageSize: 2,
      pagesFetched: 3,
      rowsReturned: 6,
      rowsInserted: 5,
      rowCompletenessPct: 75,
      insertedRowCompletenessPct: 62.5,
      pageCompletenessPct: 75,
    });
  });

  it('serializes run and page rows into API shape', () => {
    const result = serializeRun(
      {
        id: '12',
        source: 'wigle',
        api_version: 'v2',
        search_term: 'fbi',
        state: 'IL',
        request_fingerprint: 'abc123',
        request_params: { ssid: 'fbi' },
        status: 'running',
        api_cursor: 'cursor-2',
        last_error: null,
        started_at: '2026-03-27T12:00:00.000Z',
        last_attempted_at: null,
        completed_at: null,
        last_successful_page: '2',
        next_page: '3',
        api_total_results: '8',
        total_pages: '4',
        page_size: '2',
        pages_fetched: '2',
        rows_returned: '4',
        rows_inserted: '3',
      },
      [
        {
          id: '7',
          page_number: '2',
          request_cursor: 'cursor-1',
          next_cursor: 'cursor-2',
          fetched_at: '2026-03-27T12:00:00.000Z',
          rows_returned: '2',
          rows_inserted: '1',
          success: 1,
          error_message: null,
        },
      ]
    );

    expect(result).toMatchObject({
      id: 12,
      apiVersion: 'v2',
      searchTerm: 'fbi',
      state: 'IL',
      requestFingerprint: 'abc123',
      lastSuccessfulPage: 2,
      nextPage: 3,
      pageSize: 2,
      pages: [
        {
          id: 7,
          pageNumber: 2,
          requestCursor: 'cursor-1',
          nextCursor: 'cursor-2',
          rowsReturned: 2,
          rowsInserted: 1,
          success: true,
        },
      ],
    });
  });
});
