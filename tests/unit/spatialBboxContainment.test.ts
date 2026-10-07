/**
 * Real-PostGIS property test: radius bbox must contain every ST_DWithin match
 * on a ring of points at distance (r - 0.5m).
 *
 * Connects only via `pg` + env (shadowcheck_test). Does not import
 * filteredHelpers, config/container, or any app bootstrap path.
 * All writes are TEMP tables inside BEGIN/ROLLBACK.
 */
export {};

import { Client } from 'pg';
import { getSpatialBoundingBoxFragment } from '../../server/src/services/filterQueryBuilder/spatialHelpers';

const { runIntegration } = require('../helpers/integrationEnv');
const describeIfIntegration = runIntegration ? describe : describe.skip;

const LATS = [0, 43, 60, 80, 85];
const RADII_M = [150, 2000, 5000, 50000];
const CENTER_LON = 0; // synthetic; coordinates not asserted in output

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[spatialBboxContainment] missing required env ${name}; refusing fallback credentials`
    );
  }
  return v;
}

describeIfIntegration('spatial bbox containment (PostGIS property)', () => {
  if (!runIntegration) {
    test.skip('requires RUN_INTEGRATION_TESTS=true', () => {});
    return;
  }

  let client: Client;

  beforeAll(async () => {
    jest.setTimeout(120000);
    const dbName = requireEnv('DB_NAME');
    if (dbName !== 'shadowcheck_test') {
      throw new Error(
        `[spatialBboxContainment] refusing DB_NAME=${dbName}; expected shadowcheck_test`
      );
    }
    client = new Client({
      host: requireEnv('DB_HOST'),
      port: Number(process.env.DB_PORT || 5432),
      database: dbName,
      user: requireEnv('DB_USER'),
      password: requireEnv('DB_PASSWORD'),
    });
    await client.connect();
    const meta = await client.query(
      'SELECT current_database() AS db, PostGIS_Version() AS postgis'
    );
    const row = meta.rows[0];
    if (row.db !== 'shadowcheck_test') {
      throw new Error(`[spatialBboxContainment] connected to unexpected db ${row.db}`);
    }
    console.log(
      `PROPERTY_META: db=${row.db}; postgis=${String(row.postgis).split(' ')[0]}; lats=${LATS.join(',')}; radii=${RADII_M.join(',')}`
    );
  });

  afterAll(async () => {
    await client?.end();
  });

  test('bbox fragment is a superset of ST_DWithin for ring points at r-0.5m', async () => {
    const failByLat: Record<number, number> = Object.fromEntries(LATS.map((l) => [l, 0]));
    const caseLines: string[] = [];

    for (const lat of LATS) {
      for (const radiusMeters of RADII_M) {
        const bboxFrag = getSpatialBoundingBoxFragment(lat, CENTER_LON, radiusMeters, 'geom');
        // Transaction wraps TEMP table; always rolled back.
        await client.query('BEGIN');
        try {
          await client.query("SET LOCAL statement_timeout = '120s'");
          await client.query(
            `
            CREATE TEMP TABLE t6_ring ON COMMIT DROP AS
            SELECT bearing,
                   ST_Project(
                     ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                     $3::float8,
                     radians(bearing::float8)
                   )::geometry AS geom
            FROM generate_series(0, 359, 1) AS bearing
          `,
            [CENTER_LON, lat, radiusMeters - 0.5]
          );

          const q = await client.query(
            `
            SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE ST_DWithin(
                geom::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3::float8
              ))::int AS dwithin_pass,
              COUNT(*) FILTER (WHERE ${bboxFrag})::int AS bbox_pass,
              COUNT(*) FILTER (WHERE ST_DWithin(
                geom::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $3::float8
              ) AND NOT (${bboxFrag}))::int AS dwithin_but_bbox_fail,
              COALESCE(
                string_agg(bearing::text, ',' ORDER BY bearing)
                  FILTER (WHERE ST_DWithin(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                    $3::float8
                  ) AND NOT (${bboxFrag})),
                ''
              ) AS fail_bearings
            FROM t6_ring
          `,
            [CENTER_LON, lat, radiusMeters]
          );

          const row = q.rows[0];
          const missed = Number(row.dwithin_but_bbox_fail);
          failByLat[lat] += missed;
          const line =
            `PROPERTY_CASE: lat=${lat}; radius_m=${radiusMeters}; total=${row.total}; ` +
            `dwithin_pass=${row.dwithin_pass}; bbox_pass=${row.bbox_pass}; ` +
            `dwithin_but_bbox_fail=${missed}; fail_bearings=${row.fail_bearings || 'none'}`;
          caseLines.push(line);
        } finally {
          await client.query('ROLLBACK');
        }
      }
    }

    // One summary line per latitude; no per-case noise.
    console.log(
      `PROPERTY_SUMMARY: ${LATS.map((l) => `lat=${l}:fails=${failByLat[l]}`).join('; ')}`
    );

    const totalFails = Object.values(failByLat).reduce((a, b) => a + b, 0);
    const failingCases = caseLines.filter((l) => !l.includes('dwithin_but_bbox_fail=0'));
    expect({
      totalFails,
      failByLat,
      failingCaseCount: failingCases.length,
      failingCases,
    }).toEqual({
      totalFails: 0,
      failByLat: Object.fromEntries(LATS.map((l) => [l, 0])),
      failingCaseCount: 0,
      failingCases: [],
    });
  });
});
