/**
 * Shared utility helpers for threat report generation and rendering.
 */

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
    .replace(/\"/g, '&quot;')
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

function buildGoogleMapsUrl(lat: number | null, lon: number | null): string | null {
  if (lat === null || lon === null) return null;
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

function buildStreetViewUrl(lat: number | null, lon: number | null): string | null {
  if (lat === null || lon === null) return null;
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
}

module.exports = {
  toNumber,
  escapeHtml,
  formatTimestamp,
  buildGoogleMapsUrl,
  buildStreetViewUrl,
};
