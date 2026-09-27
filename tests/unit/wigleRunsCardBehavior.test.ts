import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import path from 'path';
import { WigleRunsCard } from '../../client/src/components/admin/components/WigleRunsCard';
import type { WigleImportRun } from '../../client/src/types/admin';
import type { SortEntry } from '../../client/src/components/admin/hooks/useWigleRuns';

// Load JSDOM via native Node module loader to bypass Jest ESM restriction on @exodus/bytes
const mod = require('module');
const jsdomPath = path.resolve(__dirname, '../../node_modules/jsdom');
const { JSDOM } = mod._load(jsdomPath, null, false);

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost',
});

// Configure DOM globals
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).localStorage = dom.window.localStorage;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).HTMLInputElement = dom.window.HTMLInputElement;
(global as any).Node = dom.window.Node;
(global as any).MouseEvent = dom.window.MouseEvent;
(global as any).Event = dom.window.Event;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const baseRun = (overrides: Partial<WigleImportRun> = {}): WigleImportRun => ({
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

describe('WigleRunsCard behavioral characterization', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const renderCard = async (props: Partial<React.ComponentProps<typeof WigleRunsCard>> = {}) => {
    const defaultProps: React.ComponentProps<typeof WigleRunsCard> = {
      runs: [],
      total: 0,
      hasMore: false,
      loading: false,
      actionLoading: false,
      error: null,
      onRefresh: jest.fn(),
      onResume: jest.fn(),
      onPause: jest.fn(),
      onCancel: jest.fn(),
      onDelete: jest.fn(),
      ...props,
    };

    await act(async () => {
      root.render(React.createElement(WigleRunsCard, defaultProps));
    });

    return defaultProps;
  };

  describe('1. Action buttons', () => {
    it('Resume: calls onResume(id) for paused or failed runs, disabled during actionLoading', async () => {
      const onResume = jest.fn();
      await renderCard({
        runs: [
          baseRun({ id: 101, status: 'paused' }),
          baseRun({ id: 102, status: 'failed', lastError: 'API limit reached' }),
        ],
        onResume,
      });

      const resumeButtons = container.querySelectorAll('button[title="Resume"]');
      expect(resumeButtons.length).toBe(2);

      await act(async () => {
        (resumeButtons[0] as HTMLButtonElement).click();
      });
      expect(onResume).toHaveBeenCalledWith(101);

      await act(async () => {
        (resumeButtons[1] as HTMLButtonElement).click();
      });
      expect(onResume).toHaveBeenCalledWith(102);

      // Re-render with actionLoading = true
      await renderCard({
        runs: [baseRun({ id: 101, status: 'paused' })],
        actionLoading: true,
        onResume,
      });
      const disabledButton = container.querySelector('button[title="Resume"]') as HTMLButtonElement;
      expect(disabledButton.disabled).toBe(true);
    });

    it('Pause: calls onPause(id) for running runs, disabled during actionLoading', async () => {
      const onPause = jest.fn();
      await renderCard({
        runs: [baseRun({ id: 201, status: 'running' })],
        onPause,
      });

      const pauseButton = container.querySelector('button[title="Pause"]') as HTMLButtonElement;
      expect(pauseButton).not.toBeNull();

      await act(async () => {
        pauseButton.click();
      });
      expect(onPause).toHaveBeenCalledWith(201);

      // Re-render with actionLoading = true
      await renderCard({
        runs: [baseRun({ id: 201, status: 'running' })],
        actionLoading: true,
        onPause,
      });
      const disabledPause = container.querySelector('button[title="Pause"]') as HTMLButtonElement;
      expect(disabledPause.disabled).toBe(true);
    });

    it('Cancel: calls onCancel(id) for running, paused, and failed runs', async () => {
      const onCancel = jest.fn();
      await renderCard({
        runs: [
          baseRun({ id: 301, status: 'running' }),
          baseRun({ id: 302, status: 'paused' }),
          baseRun({ id: 303, status: 'failed' }),
        ],
        onCancel,
      });

      const cancelButtons = container.querySelectorAll('button[title="Cancel"]');
      expect(cancelButtons.length).toBe(3);

      await act(async () => {
        (cancelButtons[0] as HTMLButtonElement).click();
      });
      expect(onCancel).toHaveBeenCalledWith(301);

      // Re-render with actionLoading = true
      await renderCard({
        runs: [baseRun({ id: 301, status: 'running' })],
        actionLoading: true,
        onCancel,
      });
      const disabledCancel = container.querySelector('button[title="Cancel"]') as HTMLButtonElement;
      expect(disabledCancel.disabled).toBe(true);
    });

    it('Delete: calls onDelete(id) for completed, cancelled, and failed runs', async () => {
      const onDelete = jest.fn();
      await renderCard({
        runs: [
          baseRun({ id: 401, status: 'completed' }),
          baseRun({ id: 402, status: 'cancelled' }),
          baseRun({ id: 403, status: 'failed' }),
        ],
        onDelete,
      });

      const deleteButtons = container.querySelectorAll('button[title="Delete"]');
      expect(deleteButtons.length).toBe(3);

      await act(async () => {
        (deleteButtons[0] as HTMLButtonElement).click();
      });
      expect(onDelete).toHaveBeenCalledWith(401);

      // Re-render with actionLoading = true
      await renderCard({
        runs: [baseRun({ id: 401, status: 'completed' })],
        actionLoading: true,
        onDelete,
      });
      const disabledDelete = container.querySelector('button[title="Delete"]') as HTMLButtonElement;
      expect(disabledDelete.disabled).toBe(true);
    });

    it('Refresh: calls onRefresh(), shows spinning state when loading, disabled during loading', async () => {
      const onRefresh = jest.fn();
      await renderCard({ onRefresh, loading: false });

      const refreshBtn = container.querySelector('button[title="Refresh"]') as HTMLButtonElement;
      expect(refreshBtn).not.toBeNull();
      expect(refreshBtn.disabled).toBe(false);
      expect(refreshBtn.querySelector('svg')?.classList.contains('animate-spin')).toBe(false);

      await act(async () => {
        refreshBtn.click();
      });
      expect(onRefresh).toHaveBeenCalledTimes(1);

      // Re-render with loading = true
      await renderCard({ onRefresh, loading: true });
      const loadingRefreshBtn = container.querySelector(
        'button[title="Refresh"]'
      ) as HTMLButtonElement;
      expect(loadingRefreshBtn.disabled).toBe(true);
      expect(loadingRefreshBtn.querySelector('svg')?.classList.contains('animate-spin')).toBe(true);

      // Re-render with actionLoading = true
      await renderCard({ onRefresh, actionLoading: true });
      const actionLoadingRefreshBtn = container.querySelector(
        'button[title="Refresh"]'
      ) as HTMLButtonElement;
      expect(actionLoadingRefreshBtn.disabled).toBe(true);
    });

    it('cleanup-cancelled-global: confirms before calling onCleanupCluster', async () => {
      const onCleanupCluster = jest.fn().mockResolvedValue(undefined);
      const confirmSpy = jest.spyOn(window, 'confirm');

      // Only counts cancelled runs where state is falsy (Global)
      const runs = [
        baseRun({ id: 501, status: 'cancelled', state: null }),
        baseRun({ id: 502, status: 'cancelled', state: null }),
        baseRun({ id: 503, status: 'cancelled', state: 'MI' }), // Not global
        baseRun({ id: 504, status: 'completed', state: null }),
      ];

      await renderCard({ runs, onCleanupCluster });

      const cleanupBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Clean Up (2)')
      ) as HTMLButtonElement;
      expect(cleanupBtn).toBeDefined();

      // Case A: User cancels confirm dialog
      confirmSpy.mockReturnValueOnce(false);
      await act(async () => {
        cleanupBtn.click();
      });
      expect(confirmSpy).toHaveBeenCalledWith(
        'Delete all 2 cancelled Global runs? This cannot be undone.'
      );
      expect(onCleanupCluster).not.toHaveBeenCalled();

      // Case B: User confirms dialog
      confirmSpy.mockReturnValueOnce(true);
      await act(async () => {
        cleanupBtn.click();
      });
      expect(onCleanupCluster).toHaveBeenCalledTimes(1);

      // Case C: When loading or actionLoading, button is disabled
      await renderCard({ runs, onCleanupCluster, loading: true });
      const disabledCleanupBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Clean Up (2)')
      ) as HTMLButtonElement;
      expect(disabledCleanupBtn.disabled).toBe(true);
    });

    it('cleanup-cancelled-global: not rendered when there are zero cancelled global runs', async () => {
      await renderCard({
        runs: [
          baseRun({ id: 601, status: 'completed' }),
          baseRun({ id: 602, status: 'cancelled', state: 'CA' }), // cancelled but has state
        ],
      });

      const cleanupBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Clean Up')
      );
      expect(cleanupBtn).toBeUndefined();
    });
  });

  describe('2. Column chooser & persistence', () => {
    it('opens and closes popover on button click', async () => {
      await renderCard({ runs: [baseRun()] });

      const chooserToggle = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('⊞ Columns')
      ) as HTMLButtonElement;
      expect(chooserToggle).toBeDefined();

      // Initial: popover menu is not visible
      expect(container.querySelector('input[type="checkbox"]')).toBeNull();

      // Click to open
      await act(async () => {
        chooserToggle.click();
      });
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(5);

      // Click again to close
      await act(async () => {
        chooserToggle.click();
      });
      expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    });

    it('closes popover on outside mousedown', async () => {
      await renderCard({ runs: [baseRun()] });

      const chooserToggle = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('⊞ Columns')
      ) as HTMLButtonElement;

      // Open chooser
      await act(async () => {
        chooserToggle.click();
      });
      expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();

      // Trigger mousedown outside
      await act(async () => {
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    });

    it('toggles column visibility and persists updated set to localStorage', async () => {
      await renderCard({ runs: [baseRun()] });

      // Open chooser
      const chooserToggle = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('⊞ Columns')
      ) as HTMLButtonElement;
      await act(async () => {
        chooserToggle.click();
      });

      // Default visible columns include "State/Territory"
      const thListBefore = Array.from(container.querySelectorAll('th')).map((th) =>
        th.textContent?.trim()
      );
      expect(thListBefore.some((t) => t?.includes('State/Territory'))).toBe(true);

      // Find the checkbox for State/Territory (id = jurisdiction)
      const labels = Array.from(container.querySelectorAll('label'));
      const stateLabel = labels.find((l) => l.textContent?.includes('State/Territory'));
      const stateCheckbox = stateLabel?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(stateCheckbox.checked).toBe(true);

      // Uncheck it
      await act(async () => {
        stateCheckbox.click();
      });

      // Header should no longer contain State/Territory
      const thListAfter = Array.from(container.querySelectorAll('th')).map((th) =>
        th.textContent?.trim()
      );
      expect(thListAfter.some((t) => t?.includes('State/Territory'))).toBe(false);

      // Check localStorage was updated
      const savedStorage = localStorage.getItem('import_runs_columns_v2');
      expect(savedStorage).not.toBeNull();
      const savedCols: string[] = JSON.parse(savedStorage!);
      expect(savedCols).not.toContain('jurisdiction');
    });

    it('initializes visible columns from localStorage if present and falls back gracefully on corrupted storage', async () => {
      // Pre-populate storage with only ID and Target
      localStorage.setItem('import_runs_columns_v2', JSON.stringify(['id', 'target']));

      await renderCard({ runs: [baseRun()] });

      const headers = Array.from(container.querySelectorAll('th')).map((th) =>
        th.textContent?.trim()
      );
      expect(headers).toEqual(['ID', 'Target']);

      // Unmount before testing fresh mount with corrupted storage
      act(() => {
        root.unmount();
      });
      container.remove();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);

      // Corrupted storage falls back to default columns on fresh mount
      localStorage.setItem('import_runs_columns_v2', 'invalid-json{');
      await renderCard({ runs: [baseRun()] });

      const defaultHeaders = Array.from(container.querySelectorAll('th')).map((th) =>
        th.textContent?.trim()
      );
      expect(defaultHeaders.some((h) => h?.includes('State/Territory'))).toBe(true);
    });
  });

  describe('3. Multi-column sort', () => {
    it('single-column click calls onSort with column def and event (shiftKey: false)', async () => {
      const onSort = jest.fn();
      await renderCard({
        runs: [baseRun()],
        onSort,
      });

      // Find Target header (sortKey: 'search_term')
      const targetTh = Array.from(container.querySelectorAll('th')).find((th) =>
        th.textContent?.includes('Target')
      ) as HTMLTableCellElement;
      expect(targetTh).toBeDefined();

      await act(async () => {
        targetTh.click();
      });

      expect(onSort).toHaveBeenCalledTimes(1);
      const [colArg, eventArg] = onSort.mock.calls[0];
      expect(colArg.id).toBe('target');
      expect(colArg.sortKey).toBe('search_term');
      expect(eventArg.shiftKey).toBe(false);
    });

    it('Shift+Click calls onSort with event.shiftKey: true', async () => {
      const onSort = jest.fn();
      await renderCard({
        runs: [baseRun()],
        onSort,
      });

      const targetTh = Array.from(container.querySelectorAll('th')).find((th) =>
        th.textContent?.includes('Target')
      ) as HTMLTableCellElement;

      await act(async () => {
        targetTh.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
      });

      expect(onSort).toHaveBeenCalledTimes(1);
      const [, eventArg] = onSort.mock.calls[0];
      expect(eventArg.shiftKey).toBe(true);
    });

    it('renders single sort indicator arrow without superscript priority index', async () => {
      const sortCols: SortEntry[] = [{ key: 'search_term', dir: 'asc' }];
      await renderCard({
        runs: [baseRun()],
        sortCols,
      });

      const targetTh = Array.from(container.querySelectorAll('th')).find((th) =>
        th.textContent?.includes('Target')
      );
      expect(targetTh?.textContent).toContain('↑');
      expect(targetTh?.querySelector('sup')).toBeNull();
    });

    it('renders multi-sort indicator arrows with 1-based priority superscript indices', async () => {
      const sortCols: SortEntry[] = [
        { key: 'search_term', dir: 'asc' },
        { key: 'state', dir: 'desc' },
      ];
      await renderCard({
        runs: [baseRun()],
        sortCols,
      });

      const targetTh = Array.from(container.querySelectorAll('th')).find((th) =>
        th.textContent?.includes('Target')
      );
      expect(targetTh?.textContent).toContain('↑');
      expect(targetTh?.querySelector('sup')?.textContent).toBe('1');

      const jurisdictionTh = Array.from(container.querySelectorAll('th')).find((th) =>
        th.textContent?.includes('State/Territory')
      );
      expect(jurisdictionTh?.textContent).toContain('↓');
      expect(jurisdictionTh?.querySelector('sup')?.textContent).toBe('2');
    });

    it('non-sortable column headers (sortKey: null) do not trigger onSort on click', async () => {
      const onSort = jest.fn();
      await renderCard({
        runs: [baseRun()],
        onSort,
      });

      // Actions column has sortKey: null
      const actionsTh = Array.from(container.querySelectorAll('th')).find((th) =>
        th.textContent?.includes('Actions')
      ) as HTMLTableCellElement;

      await act(async () => {
        actionsTh.click();
      });

      expect(onSort).not.toHaveBeenCalled();
    });
  });

  describe('4. Empty and error states', () => {
    it('renders empty table notice when runs array is empty and not loading', async () => {
      await renderCard({ runs: [], loading: false });

      expect(container.textContent).toContain('No recent import runs found.');
    });

    it('renders error banner when error prop is set', async () => {
      await renderCard({ runs: [], error: 'Failed to fetch import history' });

      expect(container.textContent).toContain('Failed to fetch import history');
    });

    it('renders total and count in header, and handles infinite scroll threshold with loading state', async () => {
      const onLoadMore = jest.fn();
      await renderCard({
        runs: [baseRun({ id: 1 }), baseRun({ id: 2 })],
        total: 50,
        hasMore: true,
        loading: false,
        onLoadMore,
      });

      expect(container.textContent).toContain('(2 of 50)');

      const scrollDiv = container.querySelector('.overflow-y-auto') as HTMLDivElement;
      expect(scrollDiv).not.toBeNull();

      Object.defineProperty(scrollDiv, 'scrollTop', { value: 700, configurable: true });
      Object.defineProperty(scrollDiv, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollDiv, 'clientHeight', { value: 200, configurable: true });

      await act(async () => {
        scrollDiv.dispatchEvent(new Event('scroll'));
      });
      expect(onLoadMore).toHaveBeenCalledTimes(1);

      // When loading is true, shows "Loading more…" and prevents extra onLoadMore calls
      await renderCard({
        runs: [baseRun({ id: 1 }), baseRun({ id: 2 })],
        total: 50,
        hasMore: true,
        loading: true,
        onLoadMore,
      });

      expect(container.textContent).toContain('Loading more…');

      await act(async () => {
        scrollDiv.dispatchEvent(new Event('scroll'));
      });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
  });
});
