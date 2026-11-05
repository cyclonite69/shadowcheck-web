export {};

import {
  buildWigleObservationsQuery,
  buildWigleSearchQuery,
  buildWigleV2CountQuery,
  buildWigleV2NetworksQuery,
  buildWigleV3CountQuery,
  buildWigleV3NetworksQuery,
} from '../../server/src/repositories/wigleQueriesRepository';

describe('wigle query builders', () => {
  it('builds bssid and ssid search queries with optional limit', () => {
    const bssidQuery = buildWigleSearchQuery({ bssid: 'AA:BB', limit: 10 });
    const ssidQuery = buildWigleSearchQuery({ ssid: 'Test', limit: null });

    expect(bssidQuery.sql).toContain("bssid ILIKE $1 ESCAPE '\\'");
    expect(ssidQuery.sql).toContain("ssid ILIKE $1 ESCAPE '\\'");
  });

  it('escapes literal wildcard characters in wigle search patterns', () => {
    const query = buildWigleSearchQuery({ ssid: 'x_', limit: 10 });

    expect(query.queryParams).toEqual(['%x\\_%', 10]);
  });

  it('builds v2 network and count queries with where clauses and pagination', () => {
    const data = buildWigleV2NetworksQuery({
      limit: 10,
      offset: 5,
      whereClauses: ['type = $1'],
      queryParams: ['wifi'],
    });
    const count = buildWigleV2CountQuery(['type = $1'], ['wifi']);

    expect(data.sql).toContain('WHERE type = $1');
    expect(data.sql).toContain('LIMIT $2');
    expect(data.sql).toContain('OFFSET $3');
    expect(data.queryParams).toEqual(['wifi', 10, 5]);
    expect(count.sql).toContain('COUNT(*) as total');
  });

  it('builds v3 network and observation queries with optional pagination', () => {
    const v3 = buildWigleV3NetworksQuery({
      limit: 20,
      offset: 0,
      whereClauses: ['obs.ssid ILIKE $1'],
      queryParams: ['%corp%'],
    });
    const observations = buildWigleObservationsQuery('net1', 10, 30);
    const count = buildWigleV3CountQuery(['obs.ssid ILIKE $1'], ['%corp%']);

    expect(v3.sql).toContain('WHERE obs.ssid ILIKE $1');
    expect(v3.sql).toContain('LIMIT $2');
    expect(v3.sql).toContain('OFFSET $3');
    expect(v3.sql).not.toContain('api_network_explorer_mv');
    expect(observations.sql).toContain('WHERE netid = $1');
    expect(observations.sql).toContain('ORDER BY observed_at DESC, id DESC');
    expect(observations.sql).toContain('LIMIT $2');
    expect(observations.sql).toContain('OFFSET $3');
    expect(count.sql).toContain('COUNT(*) as total');
  });

  describe('buildWigleObservationsQuery pagination and stable ordering', () => {
    it('uses stable tie-breaker ordering and preserves param numbering across all 4 pagination combos', () => {
      // 1. Neither limit nor offset
      const noPagination = buildWigleObservationsQuery('net1');
      expect(noPagination.sql).toContain('WHERE netid = $1');
      expect(noPagination.sql).toContain('ORDER BY observed_at DESC, id DESC');
      expect(noPagination.sql).not.toContain('LIMIT');
      expect(noPagination.sql).not.toContain('OFFSET');
      expect(noPagination.queryParams).toEqual(['net1']);

      // 2. Limit only
      const limitOnly = buildWigleObservationsQuery('net1', 50);
      expect(limitOnly.sql).toContain('WHERE netid = $1');
      expect(limitOnly.sql).toContain('ORDER BY observed_at DESC, id DESC');
      expect(limitOnly.sql).toContain('LIMIT $2');
      expect(limitOnly.sql).not.toContain('OFFSET');
      expect(limitOnly.queryParams).toEqual(['net1', 50]);

      // 3. Offset only
      const offsetOnly = buildWigleObservationsQuery('net1', null, 100);
      expect(offsetOnly.sql).toContain('WHERE netid = $1');
      expect(offsetOnly.sql).toContain('ORDER BY observed_at DESC, id DESC');
      expect(offsetOnly.sql).not.toContain('LIMIT');
      expect(offsetOnly.sql).toContain('OFFSET $2');
      expect(offsetOnly.queryParams).toEqual(['net1', 100]);

      // 4. Both limit and offset
      const both = buildWigleObservationsQuery('net1', 50, 100);
      expect(both.sql).toContain('WHERE netid = $1');
      expect(both.sql).toContain('ORDER BY observed_at DESC, id DESC');
      expect(both.sql).toContain('LIMIT $2');
      expect(both.sql).toContain('OFFSET $3');
      expect(both.queryParams).toEqual(['net1', 50, 100]);
    });
  });
});
