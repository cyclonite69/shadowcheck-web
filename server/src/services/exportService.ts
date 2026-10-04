/**
 * Export Service Layer
 * Data shaping and formatting logic for export operations.
 * All database access is delegated to exportRepository.
 */

const logger = require('../logging/logger');
const {
  acquireExportClient,
  queryObservationsForCSV,
  queryObservationsForJSON,
  queryNetworksForJSON,
  queryObservationsForGeoJSON,
  streamObservationsForGeoJSON,
  queryAppTableNames,
  queryTableRowCount,
  queryTableRows,
  queryObservationsForKML,
} = require('../repositories/exportRepository');

export interface GeoJsonExportRow {
  bssid: string | null;
  ssid: string | null;
  latitude: number | null;
  longitude: number | null;
  signal_dbm: number | null;
  observed_at: unknown;
  radio_type: string | null;
  frequency: number | null;
  capabilities: string | null;
  accuracy: number | null;
  [key: string]: unknown;
}

/**
 * Format a single observation row into a GeoJSON Feature.
 * Uses Point [lon, lat] coordinates; geometry is null if coords are null, non-finite, or out of range.
 * Properties preserve the existing export column set minus the geometry coordinates.
 *
 * @param row - Observation record
 * @returns GeoJSON Feature object
 */
export function formatGeoJsonFeature(row: GeoJsonExportRow) {
  const rawLat = row.latitude;
  const rawLon = row.longitude;

  const lat =
    typeof rawLat === 'number'
      ? rawLat
      : rawLat !== null && rawLat !== undefined && rawLat !== ''
        ? Number(rawLat)
        : NaN;
  const lon =
    typeof rawLon === 'number'
      ? rawLon
      : rawLon !== null && rawLon !== undefined && rawLon !== ''
        ? Number(rawLon)
        : NaN;

  const isValidCoord =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180;

  const geometry = isValidCoord
    ? {
        type: 'Point',
        coordinates: [lon, lat],
      }
    : null;

  return {
    type: 'Feature',
    geometry,
    properties: {
      bssid: row.bssid ?? null,
      ssid: row.ssid ?? null,
      signal_dbm: row.signal_dbm ?? null,
      observed_at: row.observed_at ?? null,
      radio_type: row.radio_type ?? null,
      frequency: row.frequency ?? null,
      capabilities: row.capabilities ?? null,
      accuracy: row.accuracy ?? null,
    },
  };
}

export async function getObservationsForCSV(): Promise<any[]> {
  return queryObservationsForCSV();
}

export async function getObservationsAndNetworksForJSON(): Promise<{
  observations: any[];
  networks: any[];
}> {
  const [observations, networks] = await Promise.all([
    queryObservationsForJSON(),
    queryNetworksForJSON(),
  ]);
  return { observations, networks };
}

export async function getObservationsForGeoJSON(): Promise<any[]> {
  return queryObservationsForGeoJSON();
}

/**
 * Streams all observations in GeoJSON FeatureCollection format incrementally to an Express response.
 * Yields features from the cursor batch-by-batch, awaiting drain when backpressure occurs.
 * On client disconnect or mid-stream error, the response is destroyed and resources are cleaned up.
 *
 * @param res - Express response object
 * @param signal - Optional AbortSignal from request client disconnect
 * @param batchSize - Batch size for database cursor fetches (default: 5000)
 * @returns Object containing totalRows and durationMs
 */
export async function streamAllObservationsGeoJson(
  res: any,
  signal?: AbortSignal,
  batchSize = 5000,
  drainTimeoutMs = 60000
): Promise<{ totalRows: number; durationMs: number }> {
  const startTime = Date.now();
  let totalRows = 0;
  let isFirstFeature = true;

  const writeWithBackpressure = async (chunk: string): Promise<boolean> => {
    if (signal?.aborted || res.writableEnded || res.destroyed) {
      return false;
    }
    const canContinue = res.write(chunk);
    if (!canContinue) {
      await new Promise<void>((resolve) => {
        let settled = false;
        let stallTimer: NodeJS.Timeout | null = null;

        const onDrain = () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve();
        };
        const onClose = () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve();
        };
        const onError = () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve();
        };
        const onAbort = () => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve();
        };
        const onStall = () => {
          if (settled) {
            return;
          }
          settled = true;
          logger.warn(
            `GeoJSON export drain wait exceeded stall timeout (${drainTimeoutMs}ms), aborting stream`
          );
          if (typeof res.destroy === 'function' && !res.destroyed) {
            res.destroy(new Error('Export stream stalled on drain wait'));
          }
          cleanup();
          resolve();
        };

        const cleanup = () => {
          if (stallTimer) {
            clearTimeout(stallTimer);
            stallTimer = null;
          }
          res.removeListener('drain', onDrain);
          res.removeListener('close', onClose);
          res.removeListener('error', onError);
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
        };

        res.once('drain', onDrain);
        res.once('close', onClose);
        res.once('error', onError);
        if (signal) {
          signal.addEventListener('abort', onAbort, { once: true });
        }
        stallTimer = setTimeout(onStall, drainTimeoutMs);
      });
    }
    return !signal?.aborted && !res.destroyed && !res.writableEnded;
  };

  // 1. Acquire pool client BEFORE setting headers or writing anything
  const client = await acquireExportClient();

  // Release-once wrapper: prevents double-release between generator and service finally blocks
  let released = false;
  const originalRelease =
    typeof client?.release === 'function' ? client.release.bind(client) : () => {};
  const releaseOnce = () => {
    if (!released) {
      released = true;
      originalRelease();
    }
  };
  if (client) {
    client.release = releaseOnce;
  }

  try {
    const generator = streamObservationsForGeoJSON(client, batchSize, signal);

    // 2. Set headers and stream response
    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadowcheck_observations_all_${Date.now()}.geojson"`
    );

    const canContinue = await writeWithBackpressure('{"type":"FeatureCollection","features":[');
    if (!canContinue) {
      await generator.return();
      return { totalRows: 0, durationMs: Date.now() - startTime };
    }

    for await (const batch of generator) {
      if (signal?.aborted || res.writableEnded || res.destroyed) {
        break;
      }

      let batchBuffer = '';
      for (let i = 0; i < batch.length; i++) {
        const feature = formatGeoJsonFeature(batch[i]);
        const prefix = isFirstFeature ? '' : ',';
        isFirstFeature = false;
        batchBuffer += prefix + JSON.stringify(feature);
      }

      if (batchBuffer.length > 0) {
        const ok = await writeWithBackpressure(batchBuffer);
        if (!ok) {
          break;
        }
      }
      totalRows += batch.length;
    }

    if (!signal?.aborted && !res.destroyed && !res.writableEnded) {
      await writeWithBackpressure(']}');
      res.end();
    }
  } catch (err: any) {
    logger.error(`GeoJSON full export failed mid-stream: ${err.message || err}`, {
      error: err,
      stack: err.stack,
    });
    if (res.headersSent && !res.writableEnded && !res.destroyed) {
      res.destroy(err);
    }
    throw err;
  } finally {
    releaseOnce();
  }

  const durationMs = Date.now() - startTime;
  return { totalRows, durationMs };
}

export async function getFullDatabaseSnapshot(): Promise<{
  schema: string;
  exported_at: string;
  truncated: boolean;
  limits: {
    maxRowsPerTable: number;
    maxRowsTotal: number;
  };
  tables: Record<
    string,
    { rowCount: number; exportedRowCount: number; truncated: boolean; rows: any[] }
  >;
}> {
  const maxRowsPerTable = Number.parseInt(
    process.env.FULL_EXPORT_MAX_ROWS_PER_TABLE || '10000',
    10
  );
  const maxRowsTotal = Number.parseInt(process.env.FULL_EXPORT_MAX_ROWS_TOTAL || '100000', 10);

  const tableNames: string[] = await queryAppTableNames();

  const tables: Record<
    string,
    { rowCount: number; exportedRowCount: number; truncated: boolean; rows: any[] }
  > = {};
  let totalExportedRows = 0;
  let snapshotTruncated = false;

  for (const tableName of tableNames) {
    const rowCount = await queryTableRowCount(tableName);
    const remainingBudget = Math.max(0, maxRowsTotal - totalExportedRows);
    const exportLimit = Math.min(maxRowsPerTable, remainingBudget);
    const rows = await queryTableRows(tableName, exportLimit);
    const exportedRowCount = rows.length;
    const tableTruncated = exportedRowCount < rowCount;

    if (tableTruncated) {
      snapshotTruncated = true;
    }
    totalExportedRows += exportedRowCount;

    tables[tableName] = { rowCount, exportedRowCount, truncated: tableTruncated, rows };
  }

  return {
    schema: 'app',
    exported_at: new Date().toISOString(),
    truncated: snapshotTruncated,
    limits: { maxRowsPerTable, maxRowsTotal },
    tables,
  };
}

export async function getObservationsForKML(bssids: string[]): Promise<any[]> {
  if (!bssids || bssids.length === 0) {
    return [];
  }
  return queryObservationsForKML(bssids);
}

export function generateKML(observations: any[]): string {
  if (!observations || observations.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>ShadowCheck Export - No Data</name>
    <description>Exported from ShadowCheck SIGINT Forensics Platform</description>
  </Document>
</kml>`;
  }

  const byBSSID: Record<string, any[]> = {};
  observations.forEach((obs) => {
    if (!byBSSID[obs.bssid]) {
      byBSSID[obs.bssid] = [];
    }
    byBSSID[obs.bssid].push(obs);
  });

  const folders = Object.entries(byBSSID)
    .map(
      ([bssid, obs]) => `
    <Folder>
      <name>${escapeXml(obs[0].ssid || '(hidden)')}</name>
      <description>BSSID: ${bssid} | Type: ${obs[0].radio_type || 'Unknown'} | Observations: ${obs.length}</description>
      <Placemark>
        <name>${escapeXml(obs[0].ssid || bssid)}</name>
        <description>
Signal: ${obs[0].signal_dbm}dBm
Frequency: ${obs[0].frequency} MHz
Type: ${obs[0].radio_type}
Observations: ${obs.length}
First Seen: ${new Date(obs[obs.length - 1].observed_at).toISOString()}
Last Seen: ${new Date(obs[0].observed_at).toISOString()}
        </description>
        <Point>
          <coordinates>${obs[0].lon},${obs[0].lat}${obs[0].altitude ? `,${obs[0].altitude}` : ''}</coordinates>
        </Point>
      </Placemark>
      ${obs
        .slice(1)
        .map(
          (o) => `
      <Placemark>
        <name>Observation - ${new Date(o.observed_at).toLocaleString()}</name>
        <description>Signal: ${o.signal_dbm}dBm | Accuracy: ${o.accuracy ? o.accuracy.toFixed(2) : 'N/A'}m</description>
        <Point>
          <coordinates>${o.lon},${o.lat}${o.altitude ? `,${o.altitude}` : ''}</coordinates>
        </Point>
      </Placemark>`
        )
        .join('')}
    </Folder>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>ShadowCheck Export - ${Object.keys(byBSSID).length} Network(s)</name>
    <description>Exported from ShadowCheck SIGINT Forensics Platform on ${new Date().toISOString()}</description>
    <Style id="network-style">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/blue-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>
    <Style id="observation-style">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>
    ${folders}
  </Document>
</kml>`;
}

function escapeXml(str: string): string {
  if (!str) {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  formatGeoJsonFeature,
  getObservationsForCSV,
  getObservationsAndNetworksForJSON,
  getObservationsForGeoJSON,
  streamAllObservationsGeoJson,
  getFullDatabaseSnapshot,
  getObservationsForKML,
  generateKML,
};
