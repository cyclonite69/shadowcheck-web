import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import path from 'path';

jest.mock('../../client/src/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import {
  WigleLedgerPanel,
  WigleLedgerObservationViewer,
} from '../../client/src/components/wigle/WigleLedgerPanel';
import { wigleApi, type LedgerRow } from '../../client/src/api/wigleApi';

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
(global as any).HTMLButtonElement = dom.window.HTMLButtonElement;
(global as any).HTMLDivElement = dom.window.HTMLDivElement;
(global as any).HTMLTableElement = dom.window.HTMLTableElement;
(global as any).Node = dom.window.Node;
(global as any).MouseEvent = dom.window.MouseEvent;
(global as any).Event = dom.window.Event;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
(global as any).IntersectionObserver = MockIntersectionObserver;

jest.mock('../../client/src/api/wigleApi', () => {
  const actual = jest.requireActual('../../client/src/api/wigleApi');
  return {
    ...actual,
    wigleApi: {
      ...actual.wigleApi,
      getLedger: jest.fn(),
      getWigleObservations: jest.fn(),
    },
  };
});

describe('WigleLedgerPanel and WigleLedgerObservationViewer', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockedGetLedger = jest.mocked(wigleApi.getLedger);
  const mockedGetObservations = jest.mocked(wigleApi.getWigleObservations);

  beforeEach(() => {
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

  const renderComponent = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(element);
    });
  };

  describe('WigleLedgerPanel table and counts parity', () => {
    const mockRows: LedgerRow[] = [
      {
        id: 'row-search-1',
        source: 'event',
        kind: 'network_search',
        status: 'success',
        timestamp: '2026-06-01T12:00:00.000Z',
        resultCount: 25,
        durationMs: 450,
        querySource: 'manual',
        queryUrl: 'https://api.wigle.net/api/v2/network/search?ssid=test',
      },
      {
        id: 'row-import-wifi',
        source: 'import',
        kind: 'network_search',
        status: 'success',
        timestamp: '2026-06-01T12:05:00.000Z',
        rowsReturned: 100,
        rowsInserted: 34,
        pagesFetched: 1,
        durationMs: 1200,
        querySource: 'wigle_v2',
      },
      {
        id: 'row-import-bt',
        source: 'import',
        kind: 'bt_search',
        status: 'success',
        timestamp: '2026-06-01T12:10:00.000Z',
        rowsReturned: 50,
        rowsInserted: 12,
        pagesFetched: 1,
        durationMs: 800,
        querySource: 'wigle_bt',
      },
      {
        id: 'row-detail-1',
        source: 'event',
        kind: 'detail',
        status: 'success',
        timestamp: '2026-06-01T12:15:00.000Z',
        resultCount: 1,
        durationMs: 320,
        querySource: 'manual',
        queryUrl: 'https://api.wigle.net/api/v3/detail/wifi/00:11:22:33:44:55',
      },
    ];

    it('renders column header "Results / Writes" and opens table on click', async () => {
      mockedGetLedger.mockResolvedValueOnce({
        rows: mockRows,
        hasMore: false,
      });

      await renderComponent(React.createElement(WigleLedgerPanel));

      // Initially closed
      expect(container.querySelector('table')).toBeNull();

      // Click header toggle button to open
      const toggleButton = container.querySelector('button');
      expect(toggleButton).not.toBeNull();
      expect(toggleButton?.textContent).toContain('REQUEST LEDGER');

      await act(async () => {
        toggleButton?.click();
      });

      expect(mockedGetLedger).toHaveBeenCalledWith({ status: 'all' });

      // Check column header
      const headers = Array.from(container.querySelectorAll('th')).map((th) =>
        th.textContent?.trim()
      );
      expect(headers).toContain('Results / Writes');
      expect(headers).toEqual([
        'Timestamp',
        'Source',
        'Kind',
        'Status',
        'Results / Writes',
        'Duration',
      ]);
    });

    it('search rows show returned result count', async () => {
      mockedGetLedger.mockResolvedValueOnce({
        rows: mockRows,
        hasMore: false,
      });

      await renderComponent(React.createElement(WigleLedgerPanel));
      const toggleButton = container.querySelector('button');
      await act(async () => {
        toggleButton?.click();
      });

      // Row 1 (search event) has resultCount: 25 -> "25 returned"
      const cellSearch = container.querySelector(
        'span[title="25 search results returned on this page"]'
      );
      expect(cellSearch).not.toBeNull();
      expect(cellSearch?.textContent).toBe('25 returned');
    });

    it('import rows show writes count with the Bluetooth/Wi-Fi explanation', async () => {
      mockedGetLedger.mockResolvedValueOnce({
        rows: mockRows,
        hasMore: false,
      });

      await renderComponent(React.createElement(WigleLedgerPanel));
      const toggleButton = container.querySelector('button');
      await act(async () => {
        toggleButton?.click();
      });

      // Wi-Fi import row: rowsInserted: 34 -> "34 writes" with Wi-Fi policy tooltip
      const spans = Array.from(container.querySelectorAll('span'));
      const cellWifi = spans.find((s) =>
        s.getAttribute('title')?.includes('Wi-Fi policy: net-new rows only')
      );
      expect(cellWifi).toBeDefined();
      expect(cellWifi?.getAttribute('title')).toBe(
        '34 rows inserted (Wi-Fi policy: net-new rows only)'
      );
      expect(cellWifi?.textContent).toBe('34 writes');

      // Bluetooth import row: rowsInserted: 12 -> "12 writes" with Bluetooth policy tooltip
      const cellBt = spans.find((s) =>
        s.getAttribute('title')?.includes('Bluetooth policy: inserts & updates')
      );
      expect(cellBt).toBeDefined();
      expect(cellBt?.getAttribute('title')).toBe(
        '12 rows written (Bluetooth policy: inserts & updates)'
      );
      expect(cellBt?.textContent).toBe('12 writes');
    });

    it('expanding an import row displays detailed DB Writes breakdown', async () => {
      mockedGetLedger.mockResolvedValueOnce({
        rows: mockRows,
        hasMore: false,
      });

      await renderComponent(React.createElement(WigleLedgerPanel));
      const toggleButton = container.querySelector('button');
      await act(async () => {
        toggleButton?.click();
      });

      // Click on the Bluetooth import row (the 3rd data row)
      const dataRows = container.querySelectorAll('tbody tr');
      expect(dataRows.length).toBe(4);

      await act(async () => {
        (dataRows[2] as HTMLTableRowElement).click();
      });

      // Expansion should reveal breakdown
      expect(container.textContent).toContain('DB Writes:');
      expect(container.textContent).toContain('(BT: inserts & updates)');
    });

    it('expanding a detail event triggers observation fetch for the safely extracted netid', async () => {
      mockedGetLedger.mockResolvedValueOnce({
        rows: mockRows,
        hasMore: false,
      });
      mockedGetObservations.mockResolvedValueOnce({
        ok: true,
        observations: [
          {
            id: 101,
            observed_at: '2026-06-01T12:00:00.000Z',
            latitude: 37.7749,
            longitude: -122.4194,
            altitude: 50,
            signal: -68,
            ssid: 'SafeNet',
          },
        ],
        total: 1,
      });

      await renderComponent(React.createElement(WigleLedgerPanel));
      const toggleButton = container.querySelector('button');
      await act(async () => {
        toggleButton?.click();
      });

      // The 4th row is row-detail-1 with netid 00:11:22:33:44:55
      const dataRows = container.querySelectorAll('tbody tr');
      await act(async () => {
        (dataRows[3] as HTMLTableRowElement).click();
      });

      // Verifies getWigleObservations was called for the safely extracted netid
      expect(mockedGetObservations).toHaveBeenCalledWith('00:11:22:33:44:55', {
        limit: 5,
        offset: 0,
      });

      // Observation viewer rendered inside expanded detail row
      expect(container.textContent).toContain('Stored Local Observations for 00:11:22:33:44:55');
    });

    it('gracefully handles malformed URL in detail event without crashing', async () => {
      mockedGetLedger.mockResolvedValueOnce({
        rows: [
          {
            id: 'row-detail-malformed',
            source: 'event',
            kind: 'detail',
            status: 'error',
            timestamp: '2026-06-01T12:20:00.000Z',
            resultCount: 0,
            durationMs: 150,
            querySource: 'manual',
            queryUrl: 'https://api.wigle.net/api/v3/detail/bt/%E0%A4%A',
          },
        ],
        hasMore: false,
      });

      await renderComponent(React.createElement(WigleLedgerPanel));
      const toggleButton = container.querySelector('button');
      await act(async () => {
        toggleButton?.click();
      });

      const row = container.querySelector('tbody tr');
      await act(async () => {
        (row as HTMLTableRowElement).click();
      });

      // Does not crash, and shows the fallback notice
      expect(container.textContent).toContain(
        'No network identifier (BSSID/netid) found in this detail request.'
      );
      expect(mockedGetObservations).not.toHaveBeenCalled();
    });
  });

  describe('WigleLedgerObservationViewer standalone tests', () => {
    const mockObs = [
      {
        id: 501,
        observed_at: '2026-05-15T10:30:00.000Z',
        latitude: 40.7128,
        longitude: -74.006,
        altitude: 15,
        signal: -72,
        ssid: 'Station-Alpha',
      },
      {
        id: 502,
        observed_at: '2026-05-15T11:00:00.000Z',
        latitude: 40.7135,
        longitude: -74.0055,
        altitude: 20,
        signal: -65,
        ssid: 'Station-Beta',
      },
    ];

    it('renders observation table with expected columns and data formatting', async () => {
      mockedGetObservations.mockResolvedValueOnce({
        ok: true,
        observations: mockObs,
        total: 2,
      });

      await renderComponent(
        React.createElement(WigleLedgerObservationViewer, { netid: 'AA:BB:CC:DD:EE:FF' })
      );

      // Check header columns
      const headers = Array.from(container.querySelectorAll('th')).map((th) =>
        th.textContent?.trim()
      );
      expect(headers).toEqual([
        'Obs ID',
        'Time',
        'Coordinates',
        'Altitude',
        'Signal',
        'SSID / Network',
      ]);

      // Check rows and cell formatting
      expect(container.textContent).toContain('#501');
      expect(container.textContent).toContain('40.71280, -74.00600');
      expect(container.textContent).toContain('15m');
      expect(container.textContent).toContain('-72 dBm');
      expect(container.textContent).toContain('Station-Alpha');

      expect(container.textContent).toContain('#502');
      expect(container.textContent).toContain('40.71350, -74.00550');
      expect(container.textContent).toContain('20m');
      expect(container.textContent).toContain('-65 dBm');
      expect(container.textContent).toContain('Station-Beta');
    });

    it('renders crowd-sourced attribution disclaimer notice', async () => {
      mockedGetObservations.mockResolvedValueOnce({
        ok: true,
        observations: mockObs,
        total: 2,
      });

      await renderComponent(
        React.createElement(WigleLedgerObservationViewer, { netid: 'AA:BB:CC:DD:EE:FF' })
      );

      expect(container.textContent).toContain(
        'Shows crowd-sourced points stored in PostgreSQL cache across all imports for this device.'
      );
      expect(container.textContent).toContain(
        'An individual detail request may retrieve new points, but all requests for this network share the underlying observations table.'
      );
    });

    it('renders loading state while fetch is pending', async () => {
      let resolveFetch: any;
      mockedGetObservations.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      await renderComponent(
        React.createElement(WigleLedgerObservationViewer, { netid: 'AA:BB:CC:DD:EE:FF' })
      );

      expect(container.textContent).toContain('Loading stored observations...');

      // Finish loading
      await act(async () => {
        resolveFetch({ ok: true, observations: [], total: 0 });
      });

      expect(container.textContent).not.toContain('Loading stored observations...');
    });

    it('renders empty observations state when no points exist', async () => {
      mockedGetObservations.mockResolvedValueOnce({
        ok: true,
        observations: [],
        total: 0,
      });

      await renderComponent(
        React.createElement(WigleLedgerObservationViewer, { netid: 'AA:BB:CC:DD:EE:FF' })
      );

      expect(container.textContent).toContain(
        'No crowd-sourced observation points stored for this network yet.'
      );
    });

    it('renders error state and retries on button click', async () => {
      mockedGetObservations.mockRejectedValueOnce(new Error('Gateway timeout'));

      await renderComponent(
        React.createElement(WigleLedgerObservationViewer, { netid: 'AA:BB:CC:DD:EE:FF' })
      );

      expect(container.textContent).toContain('Gateway timeout');
      const retryButton = container.querySelector('button');
      expect(retryButton?.textContent).toBe('Retry');

      // Retry succeeds
      mockedGetObservations.mockResolvedValueOnce({
        ok: true,
        observations: mockObs,
        total: 2,
      });

      await act(async () => {
        retryButton?.click();
      });

      expect(container.textContent).not.toContain('Gateway timeout');
      expect(container.textContent).toContain('#501');
    });

    it('renders message when netid is null', async () => {
      await renderComponent(React.createElement(WigleLedgerObservationViewer, { netid: null }));

      expect(container.textContent).toContain(
        'No network identifier (BSSID/netid) found in this detail request.'
      );
      expect(mockedGetObservations).not.toHaveBeenCalled();
    });

    it('handles pagination controls (Prev / Next buttons)', async () => {
      // 12 items with pageSize 5 => 3 pages
      mockedGetObservations.mockResolvedValueOnce({
        ok: true,
        observations: mockObs,
        total: 12,
      });

      await renderComponent(
        React.createElement(WigleLedgerObservationViewer, { netid: 'AA:BB:CC:DD:EE:FF' })
      );

      expect(container.textContent).toContain('Page 1 of 3');

      const buttons = container.querySelectorAll('button');
      const prevButton = Array.from(buttons).find(
        (b) => b.textContent === 'Prev'
      ) as HTMLButtonElement;
      const nextButton = Array.from(buttons).find(
        (b) => b.textContent === 'Next'
      ) as HTMLButtonElement;

      expect(prevButton).toBeDefined();
      expect(nextButton).toBeDefined();
      expect(prevButton.disabled).toBe(true);
      expect(nextButton.disabled).toBe(false);

      // Click Next -> page 2
      mockedGetObservations.mockResolvedValueOnce({
        ok: true,
        observations: mockObs,
        total: 12,
      });

      await act(async () => {
        nextButton.click();
      });

      expect(mockedGetObservations).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', {
        limit: 5,
        offset: 5,
      });
      expect(container.textContent).toContain('Page 2 of 3');
      expect(prevButton.disabled).toBe(false);
      expect(nextButton.disabled).toBe(false);

      // Click Prev -> page 1
      mockedGetObservations.mockResolvedValueOnce({
        ok: true,
        observations: mockObs,
        total: 12,
      });

      await act(async () => {
        prevButton.click();
      });

      expect(mockedGetObservations).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', {
        limit: 5,
        offset: 0,
      });
      expect(container.textContent).toContain('Page 1 of 3');
    });
  });
});
