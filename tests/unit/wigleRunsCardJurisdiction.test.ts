import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WigleRunsCard } from '../../client/src/components/admin/components/WigleRunsCard';
import type { WigleImportRun } from '../../client/src/types/admin';

const baseRun = (overrides: Partial<WigleImportRun>): WigleImportRun => ({
  id: 1,
  source: 'wigle_v2',
  apiVersion: 'v2',
  searchTerm: 'FBI Surveillance Van',
  state: null,
  requestFingerprint: 'fp-1',
  requestParams: {},
  status: 'paused',
  apiCursor: 'cursor-21',
  lastError: null,
  startedAt: '2026-06-01T12:00:00.000Z',
  lastAttemptedAt: null,
  completedAt: null,
  pageSize: 100,
  apiTotalResults: 500,
  totalPages: 5,
  lastSuccessfulPage: 20,
  nextPage: 21,
  pagesFetched: 20,
  rowsReturned: 2000,
  rowsInserted: 50,
  ...overrides,
});

const renderRunsCard = (runs: WigleImportRun[]) =>
  renderToStaticMarkup(
    React.createElement(WigleRunsCard, {
      runs,
      total: runs.length,
      hasMore: false,
      loading: false,
      actionLoading: false,
      error: null,
      onRefresh: jest.fn(),
      onResume: jest.fn(),
      onPause: jest.fn(),
      onCancel: jest.fn(),
      onDelete: jest.fn(),
    })
  );

describe('WigleRunsCard jurisdiction display', () => {
  it('shows state and territory labels in the default import-player table', () => {
    const html = renderRunsCard([
      baseRun({ id: 1, state: 'MI', requestParams: { country: 'US', region: 'MI' } }),
      baseRun({ id: 2, state: null, requestParams: { country: 'US', region: 'PR' } }),
      baseRun({ id: 3, state: null, requestParams: { country: 'GU' } }),
    ]);

    expect(html).toContain('State/Territory');
    expect(html).toContain('Last Run Rows Written');
    expect(html).toContain('MI — Michigan');
    expect(html).toContain('PR — Puerto Rico');
    expect(html).toContain('GU — Guam');
  });

  it('falls back to national, global, or unknown without affecting resume controls', () => {
    const html = renderRunsCard([
      baseRun({ id: 4, state: null, requestParams: {} }),
      baseRun({ id: 5, state: null, requestParams: { country: 'US' } }),
      baseRun({ id: 6, state: null, requestParams: { country: 'XX' } }),
      baseRun({ id: 7, state: null, requestParams: { country: 'ZZ', region: 'ZZ' } }),
    ]);

    expect(html).toContain('Global');
    expect(html).toContain('US — United States (National)');
    expect(html).toContain('Unknown');
    expect(html).toContain('country=XX region=- state=-');
    expect(html).toContain('country=ZZ region=ZZ state=-');
    expect(html).toContain('title="Resume"');
  });
});
