import type { NetworkRow } from '../../client/src/types/network';
import type { ColumnBadgeConfig } from '../../client/src/types/badgeConfig';
import { NETWORK_COLUMNS } from '../../client/src/constants/network';
import { renderNetworkTableCell } from '../../client/src/components/geospatial/networkTable/cellRenderers';
import React from 'react';

jest.mock('../../client/src/api/client', () => ({
  apiClient: { get: jest.fn() },
}));

import { emitDetectionEvidence } from '../../client/src/components/geospatial/networkTagMenu/DetectionEvidenceModal';

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

  it('renders geocoded confidence as a percent with raw precision in the title', () => {
    const context = makeContext('geocoded_confidence', 0.87321);
    const result = renderNetworkTableCell(context);

    expect(getText(result.content)).toBe('87.3%');
    expect(result.title).toBe('Geocoding confidence: 87.3210%');
  });

  it('renders ignored as Yes for true and dash for falsey values', () => {
    const yesResult = renderNetworkTableCell(makeContext('is_ignored', true));
    const noResult = renderNetworkTableCell(makeContext('is_ignored', false));

    expect(getText(yesResult.content)).toBe('Yes');
    expect(getText(noResult.content)).toBe('—');
  });

  it('renders notes as presence rather than count while keeping the tooltip count', () => {
    const context = makeContext('notes_count', 3);
    const result = renderNetworkTableCell(context);

    expect(getText(result.content)).toBe('Yes');
  });

  it('truncation-backed text columns keep the full value in the title', () => {
    const address = '123 Main Street, Suite 450, Flint, Michigan 48502';
    const context = makeContext('geocoded_address', address);
    const result = renderNetworkTableCell(context);

    expect(getText(result.content)).toBe(address);
    expect(result.title).toBe(address);
  });

  it('exposes the full BSSID in the cell title for truncated identifiers', () => {
    const longId = '310260_12345_67890_ABCDE';
    const context = makeContext('bssid', longId);
    context.row = { ...baseRow, bssid: longId, type: 'L' };

    const result = renderNetworkTableCell(context);
    expect(result.title).toBe(longId);
    // renderBssid now wraps in <Tooltip><BssidCell label={longId} /></Tooltip>
    // Drill into the Tooltip child and verify the label prop carries the full value
    const tooltipChild = React.isValidElement(result.content)
      ? (result.content as React.ReactElement<any>).props.children
      : null;
    const bssidLabel = React.isValidElement(tooltipChild)
      ? (tooltipChild as React.ReactElement<any>).props.label
      : null;
    expect(bssidLabel).toBe(longId);
  });

  it('exposes full security context from capabilities in the cell title', () => {
    const context = makeContext('security', 'WPA2');
    context.row = {
      ...baseRow,
      security: 'WPA2',
      capabilities: '[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS]',
    };

    const result = renderNetworkTableCell(context);
    expect(result.title).toBe('WPA2-P | [WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS]');
    expect(result.content).toBeDefined();
  });

  it('uses the normalized OPEN label in the tooltip instead of malformed raw source text', () => {
    const context = makeContext('security', 'OPEN');
    context.row = {
      ...baseRow,
      security: 'OPEN',
      capabilities: 'OOEN',
    };

    const result = renderNetworkTableCell(context);
    expect(result.title).toBe('OPEN');
  });

  it('suppresses the OPEN tooltip when the badge is intentionally dashed for non-wifi rows', () => {
    const context = makeContext('security', 'OPEN');
    context.row = {
      ...baseRow,
      type: 'E',
      security: 'OPEN',
      capabilities: '[ESS]',
    };

    const result = renderNetworkTableCell(context);
    expect(result.title).toBeUndefined();
    const badge = result.content as React.ReactElement<any>;
    expect(typeof badge.type).toBe('function');
    expect(badge.props.security).toBe('OPEN');
    expect(badge.props.networkType).toBe('E');
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

  it('returns the existing raw renderer when badge config is missing', () => {
    const result = renderNetworkTableCell(makeContext('threat_score', 92));

    expect(getText(result.content)).toBe('92.0');
  });

  it('returns the existing raw renderer when badge config is disabled', () => {
    const disabledConfig: ColumnBadgeConfig = {
      column: 'threat_score',
      enabled: false,
      shape: 'pill',
      fill: 'solid',
      size: 'normal',
      defaultColor: { accentColor: '#ef4444' },
      rules: [{ match: { type: 'any' }, color: { accentColor: '#ef4444' }, label: 'BADGE' }],
    };

    const result = renderNetworkTableCell(makeContext('threat_score', 92), {
      threat_score: disabledConfig,
    });

    expect(getText(result.content)).toBe('92.0');
  });

  it('renders through BadgeRenderer when badge config is enabled', () => {
    const enabledConfig: ColumnBadgeConfig = {
      column: 'threat_score',
      enabled: true,
      shape: 'pill',
      fill: 'solid',
      size: 'normal',
      defaultColor: { accentColor: '#ef4444' },
      rules: [{ match: { type: 'any' }, color: { accentColor: '#ef4444' }, label: 'BADGE' }],
    };

    const result = renderNetworkTableCell(makeContext('threat_score', 92), {
      threat_score: enabledConfig,
    });

    const element = result.content as React.ReactElement<any>;
    expect(typeof element.type).toBe('object');
    expect(element.props.value).toBe(92);
    expect(element.props.config).toEqual(enabledConfig);
  });

  it('uses threat level as badge value for the structured threat column', () => {
    const enabledConfig: ColumnBadgeConfig = {
      column: 'threat',
      enabled: true,
      shape: 'pill',
      fill: 'ghost',
      size: 'normal',
      defaultColor: { accentColor: '#ef4444' },
      rules: [{ match: { type: 'any' }, color: { accentColor: '#ef4444' } }],
    };
    const context = makeContext('threat', baseRow.threat);
    context.row = {
      ...baseRow,
      threat: {
        score: 88,
        level: 'HIGH',
        summary: 'High risk',
      },
    };

    const result = renderNetworkTableCell(context, { threat: enabledConfig });
    const element = result.content as React.ReactElement<any>;

    expect(element.props.value).toBe('HIGH');
  });

  it('formats device_class values with the shared label utility', () => {
    const result = renderNetworkTableCell(makeContext('device_class', 'FLOCK_SAFETY_CAMERA'));
    expect(getText(result.content)).toBe('Flock Safety Camera');
    expect(result.title).toBe('FLOCK_SAFETY_CAMERA');
  });

  it('shows Vendor Intel action only for manifest-backed device classes', () => {
    const withIntel = renderNetworkTableCell(makeContext('device_class', 'L3HARRIS_STINGRAY'));
    expect(getText(withIntel.content)).toBe('L3Harris StingRay');

    const withoutIntel = renderNetworkTableCell(
      makeContext('device_class', 'SOME_NON_EXISTENT_CLASS')
    );
    const element = withoutIntel.content as React.ReactElement<any>;
    const children = React.Children.toArray(element.props.children);
    const hasVendorIntelButton = children.some(
      (child) =>
        React.isValidElement<{ title?: string }>(child) && child.props.title === 'Open Vendor Intel'
    );
    expect(hasVendorIntelButton).toBe(false);
  });

  it('renders Evidence action for operational device classes without manifest entries', () => {
    const result = renderNetworkTableCell(makeContext('device_class', 'SOME_NON_EXISTENT_CLASS'));
    const element = result.content as React.ReactElement<any>;
    const children = React.Children.toArray(element.props.children);
    const hasEvidenceButton = children.some(
      (child) =>
        React.isValidElement<{ title?: string }>(child) &&
        child.props.title === 'View Detection Evidence'
    );
    expect(hasEvidenceButton).toBe(true);
  });

  it('renders non-interactive explanation/tooltip for PRIVATE_OUI_REGISTERED', () => {
    const result = renderNetworkTableCell(makeContext('device_class', 'PRIVATE_OUI_REGISTERED'));
    const element = result.content as React.ReactElement<any>;
    const children = React.Children.toArray(element.props.children);
    const explanationNode = children.find(
      (child) =>
        React.isValidElement<{ title?: string }>(child) &&
        child.props.title?.includes('Privately registered OUI')
    ) as React.ReactElement<any> | undefined;

    expect(explanationNode).toBeDefined();
    expect(explanationNode!.props.children).toBe('?');
  });

  it('emitDetectionEvidence dispatches custom event with bssid and ssid', () => {
    const bssid = '00:11:22:33:44:55';
    const ssid = 'Test Network';

    const mockDispatch = jest.fn();
    const originalWindow = (global as any).window;
    (global as any).window = {
      dispatchEvent: mockDispatch,
    };

    emitDetectionEvidence(bssid, ssid);

    expect(mockDispatch).toHaveBeenCalled();
    const event = mockDispatch.mock.calls[0][0];
    expect(event.detail).toEqual({ bssid, ssid });

    if (originalWindow) {
      (global as any).window = originalWindow;
    } else {
      delete (global as any).window;
    }
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
