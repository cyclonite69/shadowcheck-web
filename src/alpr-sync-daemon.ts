import 'dotenv/config';
import { Pool } from 'pg';

const OVERPASS_ENDPOINTS = [
  'https://kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const DEFAULT_BOUNDARY = {
  west: -125.0,
  south: 24.0,
  east: -66.5,
  north: 49.5,
} as const;

const DEFAULT_RETRY_LIMIT = 4;
const DEFAULT_TIMEOUT_MS = 60000;

interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string | undefined>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface CameraRecord {
  osmId: number;
  lat: number;
  lon: number;
  sourceProperties: Record<string, unknown>;
  lastSeen: Date;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const buildUsBoundingBoxes = (): BBox[] => {
  const { west, south, east, north } = DEFAULT_BOUNDARY;
  const latCount = 8;
  const lonCount = 16;

  const latStep = (north - south) / latCount;
  const lonStep = (east - west) / lonCount;
  const boxes: BBox[] = [];

  for (let row = 0; row < latCount; row += 1) {
    for (let col = 0; col < lonCount; col += 1) {
      const segmentWest = west + col * lonStep;
      const segmentEast = west + (col + 1) * lonStep;
      const segmentSouth = south + row * latStep;
      const segmentNorth = south + (row + 1) * latStep;

      boxes.push({
        west: Number(segmentWest.toFixed(6)),
        south: Number(segmentSouth.toFixed(6)),
        east: Number(segmentEast.toFixed(6)),
        north: Number(segmentNorth.toFixed(6)),
      });
    }
  }

  return boxes;
};

const parseBBoxArg = (value?: string): BBox | null => {
  if (!value) {
    return null;
  }

  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [west, south, east, north] = parts;
  return {
    west,
    south,
    east,
    north,
  };
};

const createPool = (): Pool =>
  new Pool({
    user: process.env.DB_ADMIN_USER || process.env.DB_USER || 'shadowcheck_admin',
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'shadowcheck_db',
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT || '5432'),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    statement_timeout: 60000,
    application_name: 'shadowcheck-alpr-sync',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

const normalizeSourceProperties = (
  tags: Record<string, string | undefined>
): Record<string, unknown> => {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(tags)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
};

const buildOverpassQuery = (bbox: BBox): string => {
  const [minLat, minLon, maxLat, maxLon] = [bbox.south, bbox.west, bbox.north, bbox.east];

  return `
    [out:json][timeout:60];
    (
      node["surveillance"~"camera|alpr|yes|license_plate|license-plate"](${minLat}, ${minLon}, ${maxLat}, ${maxLon});
      node["camera"~"yes|alpr|surveillance"](${minLat}, ${minLon}, ${maxLat}, ${maxLon});
      node["man_made"="surveillance"](${minLat}, ${minLon}, ${maxLat}, ${maxLon});
    );
    out body qt;
  `;
};

const fetchJson = async <T>(url: string, timeoutMs: number): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const status = response.status;
      const error = new Error(`Overpass request failed with status ${status}`) as Error & {
        status?: number;
      };
      error.status = status;
      throw error;
    }

    const payload = (await response.json()) as T;
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
};

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error && 'status' in error) {
    const status = Number((error as Error & { status?: number }).status);
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
      return true;
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('timeout') || message.includes('429') || message.includes('rate limit');
  }

  return false;
};

const fetchOverpassForBBox = async (bbox: BBox): Promise<CameraRecord[]> => {
  const query = buildOverpassQuery(bbox);
  const endpoints = [...OVERPASS_ENDPOINTS];

  for (let attempt = 0; attempt < DEFAULT_RETRY_LIMIT; attempt += 1) {
    for (const endpoint of endpoints) {
      const url = `${endpoint}?data=${encodeURIComponent(query)}`;

      try {
        const payload = await fetchJson<OverpassResponse>(url, DEFAULT_TIMEOUT_MS);
        const elements = payload.elements ?? [];

        const records: CameraRecord[] = [];
        for (const element of elements) {
          const tags = element.tags ?? {};
          const tagKeys = Object.keys(tags);
          if (tagKeys.length === 0) {
            continue;
          }

          const lat = element.lat ?? element.center?.lat;
          const lon = element.lon ?? element.center?.lon;
          if (lat === undefined || lon === undefined) {
            continue;
          }

          const surveillanceLike =
            tags.surveillance ||
            tags.camera ||
            tags.man_made ||
            tags.amenity ||
            tags.operator ||
            tags['security:camera'] ||
            tags['surveillance:type'];

          if (!surveillanceLike) {
            continue;
          }

          const sourceProperties = normalizeSourceProperties(tags);
          records.push({
            osmId: Number(element.id),
            lat: Number(lat),
            lon: Number(lon),
            sourceProperties,
            lastSeen: new Date(),
          });
        }

        return records;
      } catch (error: unknown) {
        if (!isRetryableError(error)) {
          throw error;
        }

        await sleep(Math.min(5000, 250 * (attempt + 1)));
      }
    }

    const backoffMs = 2000 * (attempt + 1);
    await sleep(backoffMs);
  }

  throw new Error(`Overpass exhausted all retries for bbox ${JSON.stringify(bbox)}`);
};

const refreshCameraTable = async (pool: Pool, records: CameraRecord[]): Promise<number> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TEMP TABLE alpr_sync_records (
        osm_id BIGINT PRIMARY KEY,
        lat DOUBLE PRECISION NOT NULL,
        lon DOUBLE PRECISION NOT NULL,
        source_properties JSONB NOT NULL,
        last_seen TIMESTAMPTZ NOT NULL
      ) ON COMMIT DROP
    `);

    for (const record of records) {
      await client.query(
        `
          INSERT INTO alpr_sync_records (osm_id, lat, lon, source_properties, last_seen)
          VALUES ($1, $2, $3, $4::jsonb, $5)
        `,
        [
          record.osmId,
          record.lat,
          record.lon,
          JSON.stringify(record.sourceProperties),
          record.lastSeen,
        ]
      );
    }

    const upsertResult = await client.query(`
      INSERT INTO app.alpr_cameras (osm_id, geom, source_properties, last_seen)
      SELECT
        osm_id,
        ST_SetSRID(ST_MakePoint(lon, lat), 4326),
        source_properties,
        last_seen
      FROM alpr_sync_records
      ON CONFLICT (osm_id) DO UPDATE
      SET geom = EXCLUDED.geom,
          source_properties = EXCLUDED.source_properties,
          last_seen = EXCLUDED.last_seen
    `);

    await client.query(`
      DELETE FROM app.alpr_cameras cameras
      WHERE NOT EXISTS (
        SELECT 1
        FROM alpr_sync_records records
        WHERE records.osm_id = cameras.osm_id
      )
    `);

    await client.query('COMMIT');
    return upsertResult.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const syncAll = async (pool: Pool, bboxList: BBox[]): Promise<number> => {
  const recordsByOsmId = new Map<number, CameraRecord>();
  for (const bbox of bboxList) {
    const records = await fetchOverpassForBBox(bbox);
    for (const record of records) {
      recordsByOsmId.set(record.osmId, record);
    }
  }

  return refreshCameraTable(pool, [...recordsByOsmId.values()]);
};

const parseArgs = (): { once: boolean; continuous: boolean; customBBox: BBox | null } => {
  const args = new Set(process.argv.slice(2));
  const customBBox = parseBBoxArg(
    process.argv.find((value) => value.startsWith('--bbox='))?.split('=')[1]
  );

  return {
    once: args.has('--once'),
    continuous: args.has('--continuous'),
    customBBox,
  };
};

const run = async (): Promise<void> => {
  const pool = createPool();
  try {
    const { once, continuous, customBBox } = parseArgs();
    const boxes = customBBox ? [customBBox] : buildUsBoundingBoxes();

    while (true) {
      const totalRows = await syncAll(pool, boxes);
      console.log(`ALPR sync complete. Refreshed ${totalRows} camera records.`);

      if (once || !continuous) {
        break;
      }

      await sleep(60 * 60 * 1000);
    }
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  void run().catch((error: unknown) => {
    console.error('ALPR sync failed:', error);
    process.exitCode = 1;
  });
}

export { buildUsBoundingBoxes, syncAll, run, parseBBoxArg };
