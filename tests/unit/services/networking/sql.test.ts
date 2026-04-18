import {
  buildNetworkCountQuery,
  buildNetworkDataQuery,
} from '../../../../server/src/services/networking/sql';

describe('networking sql service', () => {
  describe('buildNetworkDataQuery', () => {
    it('should build a query with all parts provided', () => {
      const selectColumns: string[] = ['bssid', 'ssid'];
      const joins: string[] = ['LEFT JOIN other t ON t.id = ne.id'];
      const conditions: string[] = ["ne.bssid = '11:22:33:44:55:66'"];
      const sortClauses = 'ne.first_seen DESC';
      const paramIndex = 5;

      const query = buildNetworkDataQuery(
        selectColumns,
        joins,
        conditions,
        sortClauses,
        paramIndex
      );

      expect(query).toContain('SELECT\n      bssid,\nssid');
      expect(query).toContain('FROM app.api_network_explorer_mv ne');
      expect(query).toContain('LEFT JOIN other t ON t.id = ne.id');
      expect(query).toContain("WHERE ne.bssid = '11:22:33:44:55:66'");
      expect(query).toContain('ORDER BY ne.first_seen DESC');
      expect(query).toContain('LIMIT $5 OFFSET $6');
    });

    it('should build a query without conditions', () => {
      const selectColumns: string[] = ['*'];
      const joins: string[] = [];
      const conditions: string[] = [];
      const sortClauses = 'ne.bssid ASC';
      const paramIndex = 1;

      const query = buildNetworkDataQuery(
        selectColumns,
        joins,
        conditions,
        sortClauses,
        paramIndex
      );

      expect(query).not.toContain('WHERE');
      expect(query).toContain('LIMIT $1 OFFSET $2');
    });

    it('should handle multiple conditions', () => {
      const conditions: string[] = ['ne.bssid = $1', 'ne.ssid = $2'];
      const query = buildNetworkDataQuery(['*'], [], conditions, 'bssid', 3);
      expect(query).toContain('WHERE ne.bssid = $1\nAND ne.ssid = $2');
    });
  });

  describe('buildNetworkCountQuery', () => {
    it('should build a count query with conditions and joins', () => {
      const joins: string[] = ['JOIN t ON t.id = ne.id'];
      const conditions: string[] = ["ne.bssid = 'AA:BB'"];

      const query = buildNetworkCountQuery(conditions, joins);

      expect(query).toContain('SELECT COUNT(DISTINCT ne.bssid) AS total');
      expect(query).toContain('JOIN t ON t.id = ne.id');
      expect(query).toContain("WHERE ne.bssid = 'AA:BB'");
    });

    it('should build a count query without conditions', () => {
      const query = buildNetworkCountQuery([], []);
      expect(query).not.toContain('WHERE');
    });
  });
});
