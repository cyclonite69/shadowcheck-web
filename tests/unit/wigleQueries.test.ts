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
    expect(buildWigleSearchQuery({ bssid: 'AA:BB', limit: 10 }).sql).toContain('bssid ILIKE $1');
    expect(buildWigleSearchQuery({ ssid: 'Test', limit: null }).sql).toContain('ssid ILIKE $1');
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
      whereClauses: ['ssid ILIKE $1'],
      queryParams: ['%corp%'],
    });
    const observations = buildWigleObservationsQuery('net1', 10, 30);
    const count = buildWigleV3CountQuery(['ssid ILIKE $1'], ['%corp%']);

    expect(v3.sql).toContain('WHERE ssid ILIKE $1');
    expect(v3.sql).toContain('LIMIT $2');
    expect(v3.sql).toContain('OFFSET $3');
    expect(observations.sql).toContain('WHERE netid = $1');
    expect(observations.sql).toContain('LIMIT $2');
    expect(observations.sql).toContain('OFFSET $3');
    expect(count.sql).toContain('COUNT(*) as total');
  });
});
