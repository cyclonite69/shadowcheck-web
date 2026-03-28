export {};

import {
  getBaseJoins,
  getBaseSelectColumns,
  withDistanceColumn,
} from '../../server/src/services/networking/querySchema';

describe('network query schema helpers', () => {
  it('builds base select columns including derived channel projection', () => {
    const columns = getBaseSelectColumns('channel_expr');

    expect(columns).toContain('ne.bssid');
    expect(columns).toContain('(channel_expr) AS channel');
    expect(columns).toContain('COALESCE(nn.notes_count, 0) AS notes_count');
  });

  it('adds distance projection only when requested', () => {
    const columns = ['ne.bssid'];

    expect(withDistanceColumn(columns, false)).toEqual(['ne.bssid']);
    expect(withDistanceColumn(columns, true)).toEqual([
      'ne.bssid',
      '(ne.distance_from_home_km)::numeric(10,4) AS distance_from_home_km',
    ]);
  });

  it('returns the expected base joins', () => {
    const joins = getBaseJoins();

    expect(joins).toContain('LEFT JOIN app.networks n ON ne.bssid = n.bssid');
    expect(joins).toContain('LEFT JOIN app.radio_manufacturers rm ON ne.oui = rm.prefix');
    expect(joins[4]).toContain('COUNT(*) AS notes_count');
  });
});
