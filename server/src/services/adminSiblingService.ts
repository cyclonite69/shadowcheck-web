export {};

const { adminQuery } = require('./adminDbService');

async function setNetworkSiblingOverride(
  bssidA: string,
  bssidB: string,
  relation: 'sibling' | 'not_sibling',
  updatedBy: string,
  notes: string | null = null,
  confidence = 1.0
): Promise<void> {
  await adminQuery('SELECT app.set_network_sibling_override($1, $2, $3, $4, $5, $6)', [
    bssidA,
    bssidB,
    relation,
    updatedBy,
    notes,
    confidence,
  ]);
}

async function getNetworkSiblingLinks(bssid: string): Promise<
  Array<{
    sibling_bssid: string;
    source: string | null;
    rule: string | null;
    pair_strength: string | null;
    confidence: number | null;
  }>
> {
  const result = await adminQuery(
    `
      SELECT
        CASE
          WHEN bssid1 = $1 THEN bssid2
          ELSE bssid1
        END AS sibling_bssid,
        source,
        rule,
        pair_strength,
        confidence
      FROM app.network_siblings_effective
      WHERE bssid1 = $1 OR bssid2 = $1
      ORDER BY
        confidence DESC NULLS LAST,
        sibling_bssid ASC
    `,
    [bssid]
  );

  return result.rows;
}

async function getNetworkSiblingLinksBatch(bssids: string[]): Promise<
  Array<{
    bssid_a: string;
    bssid_b: string;
    source: string | null;
    rule: string | null;
    pair_strength: string | null;
    confidence: number | null;
  }>
> {
  const normalized = Array.from(
    new Set(
      (Array.isArray(bssids) ? bssids : [])
        .map((value) =>
          String(value || '')
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    )
  );

  if (normalized.length === 0) {
    return [];
  }

  const result = await adminQuery(
    `
      SELECT
        bssid1 AS bssid_a,
        bssid2 AS bssid_b,
        source,
        rule,
        pair_strength,
        confidence
      FROM app.network_siblings_effective
      WHERE bssid1 = ANY($1::text[])
         OR bssid2 = ANY($1::text[])
      ORDER BY
        confidence DESC NULLS LAST,
        bssid1 ASC,
        bssid2 ASC
    `,
    [normalized]
  );

  return result.rows;
}

/**
 * Full connected component for a seed BSSID in network_siblings_effective (undirected).
 * Used when search filters the network list so page-local edge union is incomplete.
 */
async function getSiblingComponentBssids(seedBssid: string): Promise<string[]> {
  const seed = String(seedBssid || '')
    .trim()
    .toUpperCase();
  if (!seed) {
    return [];
  }

  const result = await adminQuery(
    `
      WITH RECURSIVE
      seed AS (SELECT $1::text AS bssid),
      edges AS (
        SELECT upper(bssid1) AS a, upper(bssid2) AS b
        FROM app.network_siblings_effective
      ),
      comp AS (
        SELECT (SELECT bssid FROM seed) AS bssid
        UNION
        SELECT CASE WHEN e.a = c.bssid THEN e.b ELSE e.a END
        FROM comp c
        JOIN edges e ON e.a = c.bssid OR e.b = c.bssid
      )
      SELECT bssid FROM comp ORDER BY bssid
    `,
    [seed]
  );

  return result.rows.map((row: { bssid: string }) => String(row.bssid).trim().toUpperCase());
}

module.exports = {
  setNetworkSiblingOverride,
  getNetworkSiblingLinks,
  getNetworkSiblingLinksBatch,
  getSiblingComponentBssids,
};
