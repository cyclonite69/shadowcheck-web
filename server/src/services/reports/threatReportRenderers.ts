/**
 * Threat report renderers for Markdown, HTML, and PDF outputs.
 */

const {
  buildGoogleMapsUrl,
  buildStreetViewUrl,
  escapeHtml,
  formatTimestamp,
} = require('./threatReportUtils');

function renderMarkdown(report: any): string {
  const n = report.network;
  const t = report.threat;
  const o = report.observations;

  const awayRows = o.awayLocations.length
    ? o.awayLocations
        .map((row: any) => {
          const mapsUrl = buildGoogleMapsUrl(row.lat, row.lon);
          const streetUrl = buildStreetViewUrl(row.lat, row.lon);
          const links = [
            mapsUrl ? `[Map](${mapsUrl})` : null,
            streetUrl ? `[Street View](${streetUrl})` : null,
          ]
            .filter(Boolean)
            .join(' | ');
          return `- ${row.distanceKm?.toFixed(2)} km | ${formatTimestamp(row.time)} | (${row.lat?.toFixed(6)}, ${row.lon?.toFixed(6)}) | ${row.signal ?? 'N/A'} dBm${links ? ` | ${links}` : ''}`;
        })
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
    '## Behavioral Context',
    `- Persistent near-home presence: ${o.behavioralContext.homeLikeCount}/${o.count} observations (${o.behavioralContext.homeLikePct}%)`,
    `- Persistence span: ${o.firstSeen} through ${o.lastSeen} (${o.spanDays} days)`,
    `- Follow-type events (>=0.5 km from home): ${o.behavioralContext.followEventCount}/${o.count} (${o.behavioralContext.followEventPct}%)`,
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
    .map((row: any) => {
      const mapsUrl = buildGoogleMapsUrl(row.lat, row.lon);
      const streetUrl = buildStreetViewUrl(row.lat, row.lon);
      const links = [
        mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Map</a>` : '',
        streetUrl
          ? `<a href="${escapeHtml(streetUrl)}" target="_blank" rel="noreferrer">Street View</a>`
          : '',
      ]
        .filter(Boolean)
        .join(' | ');
      return `
      <tr>
        <td>${row.distanceKm?.toFixed(2)}</td>
        <td>${escapeHtml(formatTimestamp(row.time))}</td>
        <td>${row.lat?.toFixed(6)}, ${row.lon?.toFixed(6)}</td>
        <td>${row.signal ?? 'N/A'}</td>
        <td>${links || 'N/A'}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Threat Report ${escapeHtml(n.bssid)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
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

  <h2>Behavioral Context</h2>
  <table>
    <thead><tr><th>Indicator</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Persistent near-home presence</td><td>${o.behavioralContext.homeLikeCount}/${o.count} (${o.behavioralContext.homeLikePct}%)</td></tr>
      <tr><td>Persistence span</td><td>${escapeHtml(o.firstSeen)} through ${escapeHtml(o.lastSeen)} (${o.spanDays} days)</td></tr>
      <tr><td>Follow-type events (>=0.5 km)</td><td>${o.behavioralContext.followEventCount}/${o.count} (${o.behavioralContext.followEventPct}%)</td></tr>
    </tbody>
  </table>

  <h2>Top Away Locations</h2>
  <table>
    <thead><tr><th>Distance (km)</th><th>Time</th><th>Lat/Lon</th><th>Signal dBm</th><th>Links</th></tr></thead>
    <tbody>
      ${awayRows || '<tr><td colspan="5">None</td></tr>'}
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
    doc.fontSize(14).text('Behavioral Context');
    doc.fontSize(11);
    doc.text(
      `Persistent near-home presence: ${o.behavioralContext.homeLikeCount}/${o.count} (${o.behavioralContext.homeLikePct}%)`
    );
    doc.text(`Persistence span: ${o.firstSeen} through ${o.lastSeen} (${o.spanDays} days)`);
    doc.text(
      `Follow-type events (>=0.5 km): ${o.behavioralContext.followEventCount}/${o.count} (${o.behavioralContext.followEventPct}%)`
    );

    doc.moveDown(1);
    doc.fontSize(14).text('Top Away Locations');
    doc.fontSize(10);
    if (o.awayLocations.length === 0) {
      doc.text('None');
    } else {
      for (const row of o.awayLocations) {
        const mapsUrl = buildGoogleMapsUrl(row.lat, row.lon);
        const streetUrl = buildStreetViewUrl(row.lat, row.lon);
        doc.text(
          `${row.distanceKm?.toFixed(2)} km | ${formatTimestamp(row.time)} | (${row.lat?.toFixed(6)}, ${row.lon?.toFixed(6)}) | ${row.signal ?? 'N/A'} dBm`
        );
        if (mapsUrl) doc.text(`Map: ${mapsUrl}`);
        if (streetUrl) doc.text(`Street View: ${streetUrl}`);
        doc.moveDown(0.3);
      }
    }

    doc.end();
  });
}

module.exports = {
  renderMarkdown,
  renderHtml,
  renderPdfBuffer,
};
