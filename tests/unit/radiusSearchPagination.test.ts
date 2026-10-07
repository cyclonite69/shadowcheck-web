import { UniversalFilterQueryBuilder } from '../../server/src/services/filterQueryBuilder';

describe('radius-only filtered network list pagination', () => {
  const filters = {
    radiusFilter: {
      latitude: 43.02,
      longitude: -83.69,
      radiusMeters: 500,
    },
  };

  it('selects the sorted page of radius-matching networks before per-network rollups', () => {
    const query = new UniversalFilterQueryBuilder(filters, {
      radiusFilter: true,
    }).buildNetworkListQuery({
      limit: 500,
      offset: 500,
      orderBy: 'ne.last_seen DESC NULLS LAST, ne.bssid ASC',
    });

    const pageSelection = query.sql.indexOf('page_networks AS');
    const observationRollup = query.sql.indexOf('obs_rollup AS');
    const latestObservation = query.sql.indexOf('obs_latest AS');

    expect(pageSelection).toBeGreaterThan(-1);
    expect(pageSelection).toBeLessThan(observationRollup);
    expect(pageSelection).toBeLessThan(latestObservation);
    expect(query.sql).toContain('SELECT DISTINCT fo.bssid');
    expect(query.sql).toContain('ORDER BY ne.last_seen DESC NULLS LAST, candidates.bssid ASC');
    expect(query.sql).toContain(
      'ORDER BY ne.last_seen DESC NULLS LAST, COALESCE(ne.bssid, r.bssid) ASC'
    );
    expect(query.sql).toContain('FROM filtered_obs fo');
    expect(query.sql).toContain('JOIN page_networks pn ON pn.bssid = fo.bssid');
    expect(query.params.slice(-3)).toEqual([1000, 500, 500]);
  });

  it('uses the candidate BSSID as a deterministic tie-break when the MV row is absent', () => {
    const query = new UniversalFilterQueryBuilder(filters, {
      radiusFilter: true,
    }).buildNetworkListQuery({
      limit: 500,
      offset: 0,
      orderBy: 'ne.last_seen DESC NULLS LAST, ne.bssid ASC',
    });

    expect(
      query.sql.match(/ORDER BY ne\.last_seen DESC NULLS LAST, candidates\.bssid ASC/g)
    ).toHaveLength(1);
  });

  it('keeps the existing slow path when additional network filters are enabled', () => {
    const query = new UniversalFilterQueryBuilder(
      { ...filters, threatScoreMin: 40 },
      { radiusFilter: true, threatScoreMin: true }
    ).buildNetworkListQuery({
      limit: 500,
      offset: 0,
      orderBy: 'ne.last_seen DESC NULLS LAST, ne.bssid ASC',
    });

    expect(query.sql).not.toContain('page_networks AS');
    expect(query.sql.indexOf('obs_rollup AS')).toBeLessThan(
      query.sql.indexOf('ORDER BY ne.last_seen DESC NULLS LAST, ne.bssid ASC')
    );
  });

  it('keeps the existing slow path for sorts that are not the MV last-seen order', () => {
    const query = new UniversalFilterQueryBuilder(filters, {
      radiusFilter: true,
    }).buildNetworkListQuery({
      limit: 500,
      offset: 0,
      orderBy: 'ne.observations DESC NULLS LAST, ne.bssid ASC',
    });

    expect(query.sql).not.toContain('page_networks AS');
  });
});
