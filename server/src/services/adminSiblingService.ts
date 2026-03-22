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
  await adminQuery(`SELECT app.set_network_sibling_override($1, $2, $3, $4, $5, $6)`, [
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
        'manual'::text AS source,
        'manual_override'::text AS rule,
        'manual'::text AS pair_strength,
        confidence
      FROM app.network_sibling_overrides
      WHERE is_active IS TRUE
        AND relation = 'sibling'
        AND (bssid1 = $1 OR bssid2 = $1)
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
        'manual'::text AS source,
        'manual_override'::text AS rule,
        'manual'::text AS pair_strength,
        confidence
      FROM app.network_sibling_overrides
      WHERE is_active IS TRUE
        AND relation = 'sibling'
        AND (
          bssid1 = ANY($1::text[])
          OR bssid2 = ANY($1::text[])
        )
      ORDER BY
        confidence DESC NULLS LAST,
        bssid1 ASC,
        bssid2 ASC
    `,
    [normalized]
  );

  return result.rows;
}

module.exports = {
  setNetworkSiblingOverride,
  getNetworkSiblingLinks,
  getNetworkSiblingLinksBatch,
};
