import { formatShortDate } from '../formatDate';
import type { NormalizedWigleTooltip } from './wigleTooltipNormalizer';

const EM_DASH = '&mdash;';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeDisplay = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return EM_DASH;
  const text = String(value).trim();
  return text.length > 0 ? escapeHtml(text) : EM_DASH;
};

const formatCoordinate = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return EM_DASH;
  return value.toFixed(5);
};

const formatCapabilities = (value: string | null): string => {
  if (!value) return EM_DASH;
  return escapeHtml(value);
};

const formatDate = (value: string | null): string => {
  if (!value) return EM_DASH;
  const formatted = formatShortDate(value);
  return formatted === '—' ? escapeHtml(value) : escapeHtml(formatted);
};

const fieldRow = (label: string, value: string, allowWrap = false): string => {
  const valueStyle = allowWrap
    ? 'font-size:11px;color:rgba(255,255,255,0.85);text-align:right;white-space:normal;word-break:break-word;line-height:1.3;'
    : 'font-size:11px;color:rgba(255,255,255,0.85);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

  return `<div style="display:grid;grid-template-columns:130px 1fr;align-items:${allowWrap ? 'flex-start' : 'center'};min-height:26px;padding:3px 12px;border-bottom:1px solid rgba(255,255,255,0.05);">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);white-space:nowrap;padding-top:${allowWrap ? '3px' : '0px'};">${escapeHtml(label)}</div>
    <div style="${valueStyle}">${value}</div>
  </div>`;
};

export const renderWigleTooltip = (data: NormalizedWigleTooltip): string => {
  const localBadge = data.localMatchExists
    ? `<div style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.28);color:#86efac;font-size:10px;font-weight:600;white-space:nowrap;">
          Seen locally${data.localObservationCount && data.localObservationCount > 0 ? ` · ${escapeHtml(String(data.localObservationCount))} obs` : ''}
        </div>`
    : '';

  const sourceBadge = `<div style="flex-shrink:0;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.24);color:#93c5fd;white-space:nowrap;">${escapeHtml(data.source.toUpperCase())}</div>`;

  const fieldRows = [
    fieldRow('Capabilities', formatCapabilities(data.capabilities), true),
    fieldRow(
      'Frequency',
      data.frequency !== null ? `${escapeHtml(String(data.frequency))} MHz` : EM_DASH
    ),
    fieldRow('Channel', normalizeDisplay(data.channel)),
    fieldRow('WiGLE First Seen', formatDate(data.firstSeen)),
    fieldRow('WiGLE Last Seen', formatDate(data.lastSeen)),
    data.manufacturer ? fieldRow('Manufacturer', normalizeDisplay(data.manufacturer)) : '',
    data.trilateratedLat !== null || data.trilateratedLon !== null
      ? fieldRow(
          'Coordinates',
          `${formatCoordinate(data.trilateratedLat)}, ${formatCoordinate(data.trilateratedLon)}`
        )
      : '',
  ]
    .filter(Boolean)
    .join('');

  return `
<div style="width:288px;max-width:min(340px, 90vw);max-height:min(600px, 90vh);background:#1a1d23;border:2px solid #60a5fa;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#fff;box-sizing:border-box;">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:10px 12px 6px;">
    <div style="display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;">
      <div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${normalizeDisplay(data.ssid)}</div>
      <div style="font-size:11px;font-family:monospace;color:#60a5fa;letter-spacing:0.05em;word-break:break-all;">${normalizeDisplay(data.bssid)}</div>
      ${localBadge}
    </div>
    ${sourceBadge}
  </div>
  ${fieldRows}
</div>`;
};
