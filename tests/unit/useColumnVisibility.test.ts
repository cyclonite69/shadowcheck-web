import { moveVisibleColumn } from '../../client/src/components/geospatial/useColumnVisibility';
import type { NetworkRow } from '../../client/src/types/network';

describe('moveVisibleColumn', () => {
  it('moves a column one position to the left', () => {
    const columns: Array<keyof NetworkRow | 'select'> = ['select', 'ssid', 'bssid', 'signal'];
    expect(moveVisibleColumn(columns, 'bssid', 'up')).toEqual([
      'select',
      'bssid',
      'ssid',
      'signal',
    ]);
  });

  it('moves a column one position down', () => {
    const columns: Array<keyof NetworkRow | 'select'> = ['select', 'ssid', 'bssid', 'signal'];
    expect(moveVisibleColumn(columns, 'ssid', 'down')).toEqual([
      'select',
      'bssid',
      'ssid',
      'signal',
    ]);
  });

  it('returns the original order when movement would go out of bounds', () => {
    const columns: Array<keyof NetworkRow | 'select'> = ['select', 'ssid', 'bssid'];
    expect(moveVisibleColumn(columns, 'select', 'up')).toBe(columns);
    expect(moveVisibleColumn(columns, 'bssid', 'down')).toBe(columns);
  });
});
