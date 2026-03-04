/**
 * Threat Report Service
 * Builds structured report data and renders JSON/Markdown/HTML/PDF.
 */

const { query } = require('../config/database');
const observationService = require('./observationService');

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimestamp(ms: number | null): string {
  if (!ms) return 'N/A';
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`;
}

async function getThreatReportData(bssid: string) {
  const normalizedBssid = String(bssid || '')
    .trim()
    .toUpperCase();

  const networkResult = await query(
    `SELECT
       UPPER(mv.bssid) AS bssid,
       mv.ssid,
       mv.manufacturer,
       mv.type,
       mv.observations,
       mv.max_distance_meters,
       mv.last_seen,
       mv.first_seen,
       COALESCE(NULLIF(mv.security, ''), NULLIF(mv.capabilities, '')) AS encryption,
       mv.frequency,
       nts.rule_based_score,
       nts.final_threat_score,
       nts.final_threat_level,
       nts.rule_based_flags,
       COALESCE(nt.is_ignored, false) AS is_ignored,
       nt.threat_tag
     FROM app.api_network_explorer_mv mv
     LEFT JOIN app.network_threat_scores nts
       ON UPPER(nts.bssid) = UPPER(mv.bssid)
     LEFT JOIN app.network_tags nt
       ON UPPER(nt.bssid) = UPPER(mv.bssid)
     WHERE UPPER(mv.bssid) = $1
     LIMIT 1`,
    [normalizedBssid]
  );

  if (!networkResult.rows[0]) {
    return null;
  }

  const network = networkResult.rows[0];
  const home = await observationService.getHomeLocationForObservations();
  const observations = await observationService.getObservationsByBSSID(
    normalizedBssid,
    home?.lon ?? null,
    home?.lat ?? null
  );

  const observationTimes = observations
    .map((o: any) => toNumber(o.time))
    .filter((t: number | null): t is number => t !== null)
    .sort((a: number, b: number) => a - b);

  const firstObsTime = observationTimes.length > 0 ? observationTimes[0] : null;
  const lastObsTime =
    observationTimes.length > 0 ? observationTimes[observationTimes.length - 1] : null;
  const spanDays =
    firstObsTime && lastObsTime
      ? Number(((lastObsTime - firstObsTime) / (1000 * 60 * 60 * 24)).toFixed(1))
      : 0;

  const uniqueDays = new Set(
    observationTimes.map((t: number) => new Date(t).toISOString().slice(0, 10))
  ).size;

  const distanceKm = observations
    .map((o: any) => toNumber(o.distance_from_home_km))
    .filter((d: number | null): d is number => d !== null);

  const bucket = {
    home: 0,
    near: 0,
    neighborhood: 0,
    away: 0,
    unknown: 0,
  };

  for (const d of distanceKm) {
    if (d < 0.1) bucket.home += 1;
    else if (d < 0.5) bucket.near += 1;
    else if (d < 2) bucket.neighborhood += 1;
    else bucket.away += 1;
  }
  bucket.unknown = observations.length - distanceKm.length;

  const awayLocations = observations
    .map((o: any) => ({
      lat: toNumber(o.lat),
      lon: toNumber(o.lon),
      time: toNumber(o.time),
      distanceKm: toNumber(o.distance_from_home_km),
      signal: toNumber(o.signal),
    }))
    .filter((o: any) => o.distanceKm !== null && o.distanceKm >= 2 && o.time !== null)
    .sort((a: any, b: any) => (b.distanceKm || 0) - (a.distanceKm || 0))
    .slice(0, 25);

  return {
    generatedAt: new Date().toISOString(),
    network: {
      bssid: network.bssid,
      ssid: network.ssid || '(hidden)',
      manufacturer: network.manufacturer || '<NULL>',
      type: network.type || 'W',
      encryption: network.encryption || 'N/A',
      frequency: network.frequency,
      observationsMv: toNumber(network.observations) || 0,
      firstSeen: network.first_seen,
      lastSeen: network.last_seen,
      maxDistanceMeters: toNumber(network.max_distance_meters),
      isIgnored: Boolean(network.is_ignored),
      threatTag: network.threat_tag || null,
    },
    threat: {
      ruleBasedScore: toNumber(network.rule_based_score),
      finalThreatScore: toNumber(network.final_threat_score),
      finalThreatLevel: network.final_threat_level || 'NONE',
      flags: network.rule_based_flags || {},
    },
    observations: {
      count: observations.length,
      uniqueDays,
      firstSeen: formatTimestamp(firstObsTime),
      lastSeen: formatTimestamp(lastObsTime),
      spanDays,
      distanceBuckets: bucket,
      awayLocations,
    },
  };
}

function renderMarkdown(report: any): string {
  const n = report.network;
  const t = report.threat;
  const o = report.observations;

  const awayRows = o.awayLocations.length
    ? o.awayLocations
        .map(
          (row: any) =>
            `- ${row.distanceKm?.toFixed(2)} km | ${formatTimestamp(row.time)} | (${row.lat?.toFixed(6)}, ${row.lon?.toFixed(6)}) | ${row.signal ?? 'N/A'} dBm`
        )
        .join('\n')
    : '- None';

  return [
    `# Threat Report: ${n.bssid}`,
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Network',
    `- SSID: ${n.ssid}`,
    `- Manufacturer: ${n.manufacturer}`,
    `- Type: ${n.type}`,
    `- Encryption: ${n.encryption}`,
    `- Ignored: ${n.isIgnored ? 'true' : 'false'}`,
    `- Threat Tag: ${n.threatTag || 'N/A'}`,
    '',
    '## Scoring',
    `- Final Threat Level: ${t.finalThreatLevel}`,
    `- Final Threat Score: ${t.finalThreatScore ?? 'N/A'}`,
    `- Rule-Based Score: ${t.ruleBasedScore ?? 'N/A'}`,
    '',
    '## Observation Summary',
    `- Count: ${o.count}`,
    `- Unique Days: ${o.uniqueDays}`,
    `- Span Days: ${o.spanDays}`,
    `- First Seen: ${o.firstSeen}`,
    `- Last Seen: ${o.lastSeen}`,
    '',
    '## Distance Buckets (from home marker)',
    `- Home (<100m): ${o.distanceBuckets.home}`,
    `- Near (100-500m): ${o.distanceBuckets.near}`,
    `- Neighborhood (0.5-2km): ${o.distanceBuckets.neighborhood}`,
    `- Away (>2km): ${o.distanceBuckets.away}`,
    `- Unknown: ${o.distanceBuckets.unknown}`,
    '',
    '## Top Away Locations',
    awayRows,
    '',
  ].join('\n');
}

function renderHtml(report: any): string {
  const n = report.network;
  const t = report.threat;
  const o = report.observations;

  const awayRows = o.awayLocations
    .map(
      (row: any) => `
      <tr>
        <td>${row.distanceKm?.toFixed(2)}</td>
        <td>${escapeHtml(formatTimestamp(row.time))}</td>
        <td>${row.lat?.toFixed(6)}, ${row.lon?.toFixed(6)}</td>
        <td>${row.signal ?? 'N/A'}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Threat Report ${escapeHtml(n.bssid)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1, h2 { margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
    th { background: #f5f5f5; }
    .mono { font-family: Menlo, Consolas, monospace; }
  </style>
</head>
<body>
  <h1>Threat Report</h1>
  <div class="mono">${escapeHtml(n.bssid)}</div>
  <div>Generated: ${escapeHtml(report.generatedAt)}</div>

  <h2>Network</h2>
  <div class="grid">
    <div class="card"><b>SSID</b><br/>${escapeHtml(n.ssid)}</div>
    <div class="card"><b>Manufacturer</b><br/>${escapeHtml(n.manufacturer)}</div>
    <div class="card"><b>Type</b><br/>${escapeHtml(n.type)}</div>
    <div class="card"><b>Encryption</b><br/>${escapeHtml(n.encryption)}</div>
    <div class="card"><b>Ignored</b><br/>${n.isIgnored ? 'true' : 'false'}</div>
    <div class="card"><b>Threat Tag</b><br/>${escapeHtml(n.threatTag || 'N/A')}</div>
  </div>

  <h2>Scoring</h2>
  <div class="grid">
    <div class="card"><b>Final Threat Level</b><br/>${escapeHtml(t.finalThreatLevel)}</div>
    <div class="card"><b>Final Threat Score</b><br/>${t.finalThreatScore ?? 'N/A'}</div>
    <div class="card"><b>Rule-Based Score</b><br/>${t.ruleBasedScore ?? 'N/A'}</div>
    <div class="card"><b>Observations</b><br/>${o.count}</div>
  </div>

  <h2>Distance Buckets</h2>
  <table>
    <thead><tr><th>Bucket</th><th>Count</th></tr></thead>
    <tbody>
      <tr><td>Home (&lt;100m)</td><td>${o.distanceBuckets.home}</td></tr>
      <tr><td>Near (100-500m)</td><td>${o.distanceBuckets.near}</td></tr>
      <tr><td>Neighborhood (0.5-2km)</td><td>${o.distanceBuckets.neighborhood}</td></tr>
      <tr><td>Away (&gt;2km)</td><td>${o.distanceBuckets.away}</td></tr>
      <tr><td>Unknown</td><td>${o.distanceBuckets.unknown}</td></tr>
    </tbody>
  </table>

  <h2>Top Away Locations</h2>
  <table>
    <thead><tr><th>Distance (km)</th><th>Time</th><th>Lat/Lon</th><th>Signal dBm</th></tr></thead>
    <tbody>
      ${awayRows || '<tr><td colspan="4">None</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

async function renderPdfBuffer(report: any): Promise<Buffer> {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch {
    const err = new Error('PDFKIT_NOT_INSTALLED');
    (err as any).code = 'PDFKIT_NOT_INSTALLED';
    throw err;
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const n = report.network;
    const t = report.threat;
    const o = report.observations;

    doc.fontSize(18).text('Threat Report');
    doc.moveDown(0.5);
    doc.fontSize(10).text(n.bssid);
    doc.text(`Generated: ${report.generatedAt}`);

    doc.moveDown(1);
    doc.fontSize(14).text('Network');
    doc.fontSize(11);
    doc.text(`SSID: ${n.ssid}`);
    doc.text(`Manufacturer: ${n.manufacturer}`);
    doc.text(`Type: ${n.type}`);
    doc.text(`Encryption: ${n.encryption}`);
    doc.text(`Ignored: ${n.isIgnored ? 'true' : 'false'}`);
    doc.text(`Threat Tag: ${n.threatTag || 'N/A'}`);

    doc.moveDown(1);
    doc.fontSize(14).text('Scoring');
    doc.fontSize(11);
    doc.text(`Final Threat Level: ${t.finalThreatLevel}`);
    doc.text(`Final Threat Score: ${t.finalThreatScore ?? 'N/A'}`);
    doc.text(`Rule-Based Score: ${t.ruleBasedScore ?? 'N/A'}`);

    doc.moveDown(1);
    doc.fontSize(14).text('Observation Summary');
    doc.fontSize(11);
    doc.text(`Count: ${o.count}`);
    doc.text(`Unique Days: ${o.uniqueDays}`);
    doc.text(`Span Days: ${o.spanDays}`);
    doc.text(`First Seen: ${o.firstSeen}`);
    doc.text(`Last Seen: ${o.lastSeen}`);
    doc.text(
      `Buckets: home=${o.distanceBuckets.home}, near=${o.distanceBuckets.near}, neighborhood=${o.distanceBuckets.neighborhood}, away=${o.distanceBuckets.away}, unknown=${o.distanceBuckets.unknown}`
    );

    doc.moveDown(1);
    doc.fontSize(14).text('Top Away Locations');
    doc.fontSize(10);
    if (o.awayLocations.length === 0) {
      doc.text('None');
    } else {
      for (const row of o.awayLocations) {
        doc.text(
          `${row.distanceKm?.toFixed(2)} km | ${formatTimestamp(row.time)} | (${row.lat?.toFixed(6)}, ${row.lon?.toFixed(6)}) | ${row.signal ?? 'N/A'} dBm`
        );
      }
    }

    doc.end();
  });
}

module.exports = {
  getThreatReportData,
  renderMarkdown,
  renderHtml,
  renderPdfBuffer,
};
