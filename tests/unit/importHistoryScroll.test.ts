import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import path from 'path';
import { ImportHistory } from '../../client/src/components/admin/tabs/data-import/ImportHistory';
import { adminApi } from '../../client/src/api/adminApi';

jest.mock('../../client/src/api/adminApi', () => ({
  adminApi: {
    getImportHistory: jest.fn(),
    startMobileImport: jest.fn(),
  },
}));

const mockedAdminApi = adminApi as jest.Mocked<typeof adminApi>;

// Use the repository's JSDOM loader pattern because jest-environment-jsdom is not installed.
const mod = require('module');
const jsdomPath = path.resolve(__dirname, '../../node_modules/jsdom');
const { JSDOM } = mod._load(jsdomPath, null, false);
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(global, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Event: dom.window.Event,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const makeRun = (id: number, startedAt: string, sourceTag: string) =>
  ({
    id,
    upload_id: null,
    started_at: startedAt,
    finished_at: startedAt,
    source_tag: sourceTag,
    filename: `${sourceTag}.db`,
    imported: 1,
    failed: 0,
    duration_s: '1',
    status: 'success',
    error_detail: null,
    metrics_before: null,
    metrics_after: null,
    backup_taken: false,
  }) as any;

describe('ImportHistory scrolling', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  beforeEach(() => jest.clearAllMocks());

  it('loads older records when scrolling near the bottom and stops at the end', async () => {
    const newest = makeRun(2, '2026-10-03T12:00:00.000Z', 'newest-run');
    const oldestLoaded = makeRun(1, '2026-10-02T12:00:00.000Z', 'older-run');
    mockedAdminApi.getImportHistory
      .mockResolvedValueOnce({ history: [newest, oldestLoaded], hasMore: true } as any)
      .mockResolvedValueOnce({
        history: [makeRun(0, '2026-10-01T12:00:00.000Z', 'oldest-run')],
        hasMore: false,
      } as any);

    await act(async () => {
      root.render(React.createElement(ImportHistory, { refreshKey: 0 }));
      await Promise.resolve();
    });

    const scrollContainer = container.querySelector(
      '[data-testid="import-history-scroll-container"]'
    ) as HTMLDivElement;
    expect(container.textContent).toContain('newest-run');
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 300, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 700, configurable: true });

    await act(async () => {
      scrollContainer.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockedAdminApi.getImportHistory).toHaveBeenNthCalledWith(2, 10, {
      startedAt: oldestLoaded.started_at,
      id: oldestLoaded.id,
    });
    expect(container.textContent).toContain('oldest-run');
    expect(container.querySelector('button')).toBeNull();
  });

  it('offers a load button when older history is available', async () => {
    mockedAdminApi.getImportHistory.mockResolvedValueOnce({
      history: [makeRun(3, '2026-10-03T12:00:00.000Z', 'recent-run')],
      hasMore: true,
    } as any);

    await act(async () => {
      root.render(React.createElement(ImportHistory, { refreshKey: 0 }));
      await Promise.resolve();
    });
    expect(container.querySelector('button')?.textContent).toBe('Load older imports');
  });
});
