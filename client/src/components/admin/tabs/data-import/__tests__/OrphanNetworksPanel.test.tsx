/** @jest-environment jsdom */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OrphanNetworksPanel } from '../OrphanNetworksPanel';
import { adminApi } from '../../../../../../api/adminApi';

jest.mock('../../../../../../api/adminApi', () => ({
  adminApi: {
    getOrphanNetworks: jest.fn(),
    checkOrphanNetworkWigle: jest.fn(),
  },
}));

const mockedAdminApi = adminApi as jest.Mocked<typeof adminApi>;

const makeRow = (suffix: string) => ({
  bssid: `AA:BB:CC:DD:EE:${suffix}`,
  ssid: `Test-${suffix}`,
  type: 'W',
  frequency: 2412,
  capabilities: null,
  source_device: 'sensor-1',
  lasttime_ms: null,
  lastlat: 42.1,
  lastlon: -83.1,
  bestlevel: -45,
  bestlat: 42.1,
  bestlon: -83.1,
  unique_days: 2,
  unique_locations: 1,
  is_sentinel: false,
  wigle_v3_observation_count: 0,
  wigle_v3_last_import_at: null,
  moved_at: '2026-04-05T10:00:00Z',
  move_reason: 'missing_observations',
  backfill_status: 'not_attempted' as const,
  matched_netid: null,
  detail_imported: null,
  observations_imported: null,
  last_attempted_at: null,
  last_error: null,
});

describe('OrphanNetworksPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches the next page when the scroll container nears the bottom', async () => {
    mockedAdminApi.getOrphanNetworks
      .mockResolvedValueOnce({
        ok: true,
        total: 150,
        rows: [makeRow('01')],
        pagination: { limit: 100, offset: 0, hasMore: true },
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        total: 150,
        rows: [makeRow('02')],
        pagination: { limit: 100, offset: 100, hasMore: false },
      } as any);

    render(<OrphanNetworksPanel refreshKey={0} />);

    await waitFor(() => {
      expect(mockedAdminApi.getOrphanNetworks).toHaveBeenNthCalledWith(1, 100, '', 0);
    });

    expect(await screen.findByText('AA:BB:CC:DD:EE:01')).toBeTruthy();

    const container = screen.getByTestId('orphan-networks-scroll-container');
    Object.defineProperty(container, 'scrollHeight', { value: 1200, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(container, 'scrollTop', {
      value: 710,
      configurable: true,
      writable: true,
    });

    await act(async () => {
      fireEvent.scroll(container);
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    await waitFor(() => {
      expect(mockedAdminApi.getOrphanNetworks).toHaveBeenNthCalledWith(2, 100, '', 100);
    });

    expect(await screen.findByText('AA:BB:CC:DD:EE:02')).toBeTruthy();
    expect(screen.getByText(/Showing/).textContent).toContain('2');
  });

  test('resets to offset 0 when a new search is submitted', async () => {
    mockedAdminApi.getOrphanNetworks
      .mockResolvedValueOnce({
        ok: true,
        total: 1,
        rows: [makeRow('01')],
        pagination: { limit: 100, offset: 0, hasMore: false },
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        total: 1,
        rows: [makeRow('09')],
        pagination: { limit: 100, offset: 0, hasMore: false },
      } as any);

    render(<OrphanNetworksPanel refreshKey={0} />);

    await waitFor(() => {
      expect(mockedAdminApi.getOrphanNetworks).toHaveBeenNthCalledWith(1, 100, '', 0);
    });

    fireEvent.change(screen.getByPlaceholderText('Search BSSID or SSID'), {
      target: { value: 'Test-09' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(mockedAdminApi.getOrphanNetworks).toHaveBeenNthCalledWith(2, 100, 'Test-09', 0);
    });
  });
});
