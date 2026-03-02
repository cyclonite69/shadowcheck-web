/** @jest-environment jsdom */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useDashboard } from '../../hooks/useDashboard';
import { createInitialCards } from '../dashboard/cardDefinitions';
import { dashboardApi } from '../../api/dashboardApi';

jest.mock('../../api/dashboardApi', () => ({
  dashboardApi: {
    getMetrics: jest.fn(),
    getThreatSeverityCounts: jest.fn(),
  },
}));

const mockedDashboardApi = dashboardApi as jest.Mocked<typeof dashboardApi>;

const Icon = () => React.createElement('span', { 'data-testid': 'icon' }, 'i');
const initialCards = createInitialCards({
  Network: Icon,
  Wifi: Icon,
  Smartphone: Icon,
  Bluetooth: Icon,
  Tower: Icon,
  Radio: Icon,
  BarChart3: Icon,
  AlertTriangle: Icon,
});

function WifiCounterProbe({ filterKey }: { filterKey: string }) {
  const { cards } = useDashboard(initialCards, filterKey);
  const wifiCard = cards.find((card) => card.type === 'wifi-count');
  const value =
    typeof wifiCard?.value === 'number'
      ? wifiCard.value.toLocaleString()
      : String(wifiCard?.value ?? '');

  return React.createElement(
    'div',
    {},
    React.createElement('div', { 'data-testid': 'wifi-card-present' }, wifiCard ? 'yes' : 'no'),
    React.createElement('div', { 'data-testid': 'wifi-value' }, value)
  );
}

function ThreatHighProbe({ filterKey }: { filterKey: string }) {
  const { cards } = useDashboard(initialCards, filterKey);
  const highThreatCard = cards.find((card) => card.type === 'threat-high');
  const value =
    typeof highThreatCard?.value === 'number'
      ? highThreatCard.value.toLocaleString()
      : String(highThreatCard?.value ?? '');

  return React.createElement(
    'div',
    {},
    React.createElement(
      'div',
      { 'data-testid': 'threat-high-card-present' },
      highThreatCard ? 'yes' : 'no'
    ),
    React.createElement('div', { 'data-testid': 'threat-high-value' }, value)
  );
}

describe('Universal Filter UI Contract - Wi-Fi Count Rendering', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockedDashboardApi.getThreatSeverityCounts.mockResolvedValue({
      counts: {
        critical: { unique_networks: 0, total_observations: 0 },
        high: { unique_networks: 0, total_observations: 0 },
        medium: { unique_networks: 0, total_observations: 0 },
        low: { unique_networks: 0, total_observations: 0 },
      },
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders Wi-Fi count card and formatted value from API, then updates after filter change', async () => {
    mockedDashboardApi.getMetrics
      .mockResolvedValueOnce({
        networks: { wifi: 12345 },
        observations: { wifi: 67890 },
        filtersApplied: 1,
      } as any)
      .mockResolvedValueOnce({
        networks: { wifi: 7 },
        observations: { wifi: 11 },
        filtersApplied: 2,
      } as any);

    const firstFilterKey = JSON.stringify({
      filters: { radioTypes: ['W'] },
      enabled: { radioTypes: true },
    });

    const secondFilterKey = JSON.stringify({
      filters: { radioTypes: ['W'], threatCategories: ['high'] },
      enabled: { radioTypes: true, threatCategories: true },
    });

    const view = render(React.createElement(WifiCounterProbe, { filterKey: firstFilterKey }));

    expect(screen.getByTestId('wifi-card-present').textContent).toBe('yes');

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByTestId('wifi-value').textContent).toBe('12,345');
    });

    view.rerender(React.createElement(WifiCounterProbe, { filterKey: secondFilterKey }));

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByTestId('wifi-value').textContent).toBe('7');
    });
  });

  test('renders explicit zero Wi-Fi count when API returns zero', async () => {
    mockedDashboardApi.getMetrics.mockResolvedValue({
      networks: { wifi: 0 },
      observations: { wifi: 0 },
      filtersApplied: 1,
    } as any);

    const filterKey = JSON.stringify({
      filters: { radioTypes: ['W'] },
      enabled: { radioTypes: true },
    });

    render(React.createElement(WifiCounterProbe, { filterKey }));

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByTestId('wifi-card-present').textContent).toBe('yes');
      expect(screen.getByTestId('wifi-value').textContent).toBe('0');
    });
  });

  test('falls back to dashboard threat metrics when severity endpoint fails', async () => {
    mockedDashboardApi.getMetrics.mockResolvedValue({
      threats: { critical: 3, high: 11, medium: 7, low: 2 },
      networks: { wifi: 1 },
      observations: { wifi: 1 },
      filtersApplied: 1,
    } as any);
    mockedDashboardApi.getThreatSeverityCounts.mockRejectedValueOnce(
      new Error('severity endpoint failed')
    );

    const filterKey = JSON.stringify({
      filters: { radioTypes: ['W'] },
      enabled: { radioTypes: true },
    });

    render(React.createElement(ThreatHighProbe, { filterKey }));

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByTestId('threat-high-card-present').textContent).toBe('yes');
      expect(screen.getByTestId('threat-high-value').textContent).toBe('11');
    });
  });
});
