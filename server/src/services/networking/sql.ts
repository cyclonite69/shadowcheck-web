export {};

const buildNetworkDataQuery = (
  selectColumns: string[],
  joins: string[],
  conditions: string[],
  sortClauses: string,
  paramIndex: number
): string => `
    SELECT
      ${selectColumns.join(',\n')}
    FROM app.api_network_explorer_mv ne
    ${joins.join('\n')}
    ${conditions.length > 0 ? `WHERE ${conditions.join('\nAND ')}` : ''}
    ORDER BY ${sortClauses}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

const buildNetworkCountQuery = (conditions: string[], joins: string[]): string => `
    SELECT COUNT(DISTINCT ne.bssid) AS total
    FROM app.api_network_explorer_mv ne
    ${joins.join('\n')}
    ${conditions.length > 0 ? `WHERE ${conditions.join('\nAND ')}` : ''}
  `;

export { buildNetworkCountQuery, buildNetworkDataQuery };
