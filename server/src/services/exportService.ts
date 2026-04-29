/**
 * Export Service Layer
 * Data shaping and formatting logic for export operations.
 * All database access is delegated to exportRepository.
 */

const {
  queryObservationsForCSV,
  queryObservationsForJSON,
  queryNetworksForJSON,
  queryObservationsForGeoJSON,
  queryAppTableNames,
  queryTableRowCount,
  queryTableRows,
  queryObservationsForKML,
} = require('../repositories/exportRepository');

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

    if (tableTruncated) snapshotTruncated = true;
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
  if (!bssids || bssids.length === 0) return [];
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
    if (!byBSSID[obs.bssid]) byBSSID[obs.bssid] = [];
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
          <coordinates>${obs[0].lon},${obs[0].lat}${obs[0].altitude ? ',' + obs[0].altitude : ''}</coordinates>
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
          <coordinates>${o.lon},${o.lat}${o.altitude ? ',' + o.altitude : ''}</coordinates>
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
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  getObservationsForCSV,
  getObservationsAndNetworksForJSON,
  getObservationsForGeoJSON,
  getFullDatabaseSnapshot,
  getObservationsForKML,
  generateKML,
};
