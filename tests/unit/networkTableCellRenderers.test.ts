import type { NetworkRow } from '../../client/src/types/network';
import { NETWORK_COLUMNS } from '../../client/src/constants/network';
import { renderNetworkTableCell } from '../../client/src/components/geospatial/networkTable/cellRenderers';
import React from 'react';

const baseRow: NetworkRow = {
  bssid: 'AA:BB:CC:DD:EE:FF',
  ssid: 'TestNet',
  type: 'W',
  signal: -51,
  security: 'WPA3',
  frequency: 2412,
  channel: 1,
  observations: 10,
  latitude: 42.0,
  longitude: -83.0,
  lastSeen: '2026-03-29T00:00:00Z',
};

const makeContext = (column: keyof NetworkRow | 'select', value: unknown) => ({
  column,
  columnConfig: NETWORK_COLUMNS[column as keyof typeof NETWORK_COLUMNS],
  row: baseRow,
  value,
  isSelected: true,
  isLinkedSibling: false,
  showSelectedAnchorLink: false,
  onToggleSelectNetwork: jest.fn(),
});

describe('renderNetworkTableCell', () => {
  it('renders the select checkbox with a flex wrapper', () => {
    const context = makeContext('select', true);
    const result = renderNetworkTableCell(context);
    expect(result.content).toBeDefined();
    const element = result.content as React.ReactElement;
    expect(element.type).toBe('input');
    expect(result.style?.display).toBe('flex');
    expect((element.props as Record<string, unknown>).type).toBe('checkbox');
  });

  it('renders the type badge when column is type', () => {
    const context = makeContext('type', 'W');
    const result = renderNetworkTableCell(context);
    expect(result.content).toBeDefined();
    const element = result.content as React.ReactElement<any>;
    expect(typeof element.type).toBe('function');
    expect(element.props?.type as string).toBe('W');
  });

  it('falls back to simple content for columns without special renderers', () => {
    const value = 123.45;
    const context = makeContext('accuracy', value);
    const result = renderNetworkTableCell(context);
    // Accuracy now has a custom renderer with tooltip, so it returns a Tooltip wrapper
    const content = getText(result.content);
    expect(content).toBe('123 m'); // formatAccuracy display value
  });

  it('renders threat score with formatted badge', () => {
    const context = makeContext('threat_score', 92);
    const result = renderNetworkTableCell(context);
    const content = getText(result.content);
    expect(content).toBe('92.0');
  });

  it('converts distance from home from metres to kilometers', () => {
    const context = makeContext('distanceFromHome', 10953.51892936);
    const result = renderNetworkTableCell(context);
    const content = getText(result.content);
    expect(content).toBe('10.95 km');
    expect(result.title).toBe('10.95 km from home');
  });

  it('converts max distance from metres to kilometers', () => {
    const context = makeContext('max_distance_meters', 10739.7370788);
    const result = renderNetworkTableCell(context);
    const content = getText(result.content);
    expect(content).toBe('10.74 km');
  });

  it('renders stationary confidence as percent', () => {
    const context = makeContext('stationaryConfidence', 0.37);
    const result = renderNetworkTableCell(context);
    expect(getText(result.content)).toBe('37%');
  });

  it('exposes the full BSSID in the cell title for truncated identifiers', () => {
    const longId = '310260_12345_67890_ABCDE';
    const context = makeContext('bssid', longId);
    context.row = { ...baseRow, bssid: longId, type: 'L' };

    const result = renderNetworkTableCell(context);
    expect(result.title).toBe(longId);
    expect(getText(result.content)).toBe(longId);
  });

  it('exposes full security context from capabilities in the cell title', () => {
    const context = makeContext('security', 'WPA2');
    context.row = {
      ...baseRow,
      security: 'WPA2',
      capabilities: '[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS]',
    };

    const result = renderNetworkTableCell(context);
    expect(result.title).toBe('WPA2 | [WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS]');
    expect(result.content).toBeDefined();
  });

  it('hides non-wifi frequency values in the explorer table', () => {
    const context = makeContext('frequency', 66586);
    context.row = { ...baseRow, type: 'G', frequency: 66586 };

    const result = renderNetworkTableCell(context);
    expect(getText(result.content)).toBe('—');
  });

  it('formats calculated coordinate columns like raw lat/lon with 4 decimals and 6 on hover', () => {
    const context = makeContext('centroid_lat', 42.990389);
    const result = renderNetworkTableCell(context);

    expect(getText(result.content)).toBe('42.9904');
    expect(result.title).toBe('Latitude: 42.990389°');
  });

  it('applies the same 6-decimal hover fallback to weighted longitude', () => {
    const context = makeContext('weighted_lon', -83.697534);
    const result = renderNetworkTableCell(context);

    expect(getText(result.content)).toBe('-83.6975');
    expect(result.title).toBe('Longitude: -83.697534°');
  });
});

const getText = (node: React.ReactNode): any => {
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<any>;
    const { children } = element.props;

    // If the element is a Tooltip (or any wrapper with display: contents),
    // recursively extract text from its children
    if (element.type === 'div' && element.props.style?.display === 'contents') {
      return getText(children);
    }

    // For other elements with children, extract from first child
    if (children) {
      if (Array.isArray(children)) {
        // Return the first child that has content
        for (const child of children) {
          if (child !== null && child !== undefined) {
            return getText(child);
          }
        }
      }
      return getText(children);
    }

    // For text-only elements (span, div, etc.) without explicit children
    return element.props.children || node;
  }
  return node;
};
