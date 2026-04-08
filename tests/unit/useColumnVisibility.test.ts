import { moveVisibleColumn } from '../../client/src/components/geospatial/hooks/useColumnVisibility';
import type { NetworkRow } from '../../client/src/types/network';

describe('moveVisibleColumn', () => {
  it('moves a column one position to the left', () => {
    const columns: Array<keyof NetworkRow | 'select'> = ['select', 'ssid', 'bssid', 'signal'];
    expect(moveVisibleColumn(columns, 'bssid', 'left')).toEqual([
      'select',
      'bssid',
      'ssid',
      'signal',
    ]);
  });

  it('moves a column one position to the right', () => {
    const columns: Array<keyof NetworkRow | 'select'> = ['select', 'ssid', 'bssid', 'signal'];
    expect(moveVisibleColumn(columns, 'ssid', 'right')).toEqual([
      'select',
      'bssid',
      'ssid',
      'signal',
    ]);
  });

  it('returns the original order when movement would go out of bounds', () => {
    const columns: Array<keyof NetworkRow | 'select'> = ['select', 'ssid', 'bssid'];
    expect(moveVisibleColumn(columns, 'select', 'left')).toBe(columns);
    expect(moveVisibleColumn(columns, 'bssid', 'right')).toBe(columns);
  });
});
