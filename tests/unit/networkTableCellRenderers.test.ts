import React from 'react';
import type { NetworkRow } from '../../client/src/types/network';
import { NETWORK_COLUMNS } from '../../client/src/constants/network';
import { renderNetworkTableCell } from '../../client/src/components/geospatial/networkTable/cellRenderers';

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
    const context = makeContext('distanceFromHome', value);
    const result = renderNetworkTableCell(context);
    expect(result.content).toBe(value);
    expect(result.title).toBe(String(value));
  });
});
