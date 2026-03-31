import { THREAT_LEVEL_CONFIG } from '../../constants/network';
import { macColor } from '../../utils/mapHelpers';
import {
  formatCoord,
  formatAltitude,
  formatRSSI,
  formatConfidence,
  formatAccuracy,
  formatDateTime,
} from './fieldFormatting';

/**
 * Network Tooltip Renderer
 * Usage: Works with Geospatial, Kepler, and WiGLE pages
 * High-fidelity forensic design with data density and visual alerts.
 */

const EM_DASH = '&mdash;';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || trimmed.toLowerCase() === 'unknown';
  }
  return false;
}

function normalizeDisplay(value: unknown): string {
  return isMissingValue(value) ? EM_DASH : String(value);
}

function buildLocation(props: any): string {
  const street = [props.housenumber, props.road].filter(Boolean).join(' ');
  const city = [props.city, props.region].filter(Boolean).join(', ');
  return street && city ? `${street}, ${city}` : street || city || '';
}

function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return EM_DASH;
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

function formatObservationText(countValue: unknown, daysValue: unknown): string {
  if (isMissingValue(countValue)) return '';
  const count = Number(countValue);
  if (!Number.isFinite(count)) return '';
  const base = `${count} obs`;
  const days = Number(daysValue);
  return Number.isFinite(days) ? `${base} · ${Math.round(days)} days` : base;
}

function statBar(fillPct: number, color: string): string {
  return `<div style="width:100%;height:3px;border-radius:2px;background:rgba(255,255,255,0.1);overflow:hidden;"><div style="height:100%;width:${clamp(fillPct, 0, 100)}%;border-radius:2px;background:${color};"></div></div>`;
}

function statsCell(label: string, valueText: string, fillPct: number, color: string, borders = '') {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:8px 6px 6px;min-width:0;${borders}">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.4);margin-bottom:3px;white-space:nowrap;">${label}</div>
    <div style="font-size:15px;font-weight:600;color:#fff;line-height:1;margin-bottom:4px;white-space:nowrap;">${valueText}</div>
    ${statBar(fillPct, color)}
  </div>`;
}

function fieldRow(label: string, value: string, title?: string): string {
  const titleAttr = title ? `title="${title}"` : '';
  return `<div ${titleAttr} style="display:grid;grid-template-columns:130px 1fr;align-items:center;min-height:26px;padding:3px 12px;border-bottom:1px solid rgba(255,255,255,0.05);">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);white-space:nowrap;">${label}</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.85);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${value}</div>
  </div>`;
}

// Helper: Get radio type SVG icon with custom color
const getRadioSVG = (type: string, color: string) => {
  const iconMap: Record<string, string> = {
    WiFi: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.94 0M12 20h.01"/></svg>`,
    Bluetooth: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><circle cx="12" cy="12" r="1"/><path d="M12 1v6m0 6v4M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h4M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/></svg>`,
    LTE: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    Unknown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };
  return iconMap[type] || iconMap['WiFi'];
};

export const renderNetworkTooltip = (props: any): string => {
  const threat = String(props.threat_level || props.threat || 'NONE').toUpperCase();
  const threatConfig =
    THREAT_LEVEL_CONFIG[threat as keyof typeof THREAT_LEVEL_CONFIG] || THREAT_LEVEL_CONFIG.NONE;
  const tc = threatConfig.color;
  const threatBg = threatConfig.bg;
  const threatBorder = `${threatConfig.color}40`;
  const bssidRaw = props.bssid || props.netid || '';
  const bc = bssidRaw ? macColor(bssidRaw) : tc;
  const rssiValue =
    props.signal ??
    props.rssi ??
    props.level ??
    props.bestlevel ??
    props.signalDbm ??
    props.maxSignal ??
    props.max_signal;
  const rssi = typeof rssiValue === 'number' ? rssiValue : Number(rssiValue);
  const scoreValue = props.threat_score;
  const score = typeof scoreValue === 'number' ? scoreValue : Number(scoreValue);
  const qualitySource = props.quality_score;
  const qualityRaw = typeof qualitySource === 'number' ? qualitySource : Number(qualitySource);
  const quality = Number.isFinite(qualityRaw)
    ? Math.round(qualityRaw <= 1 ? qualityRaw * 100 : qualityRaw)
    : NaN;
  const lat = props.lat ?? props.latitude ?? props.trilat;
  const lon = props.lon ?? props.longitude ?? props.trilong;
  const ssid = normalizeDisplay(props.ssid);
  const bssid = normalizeDisplay(props.bssid || props.netid);

  const signalFill = Number.isFinite(rssi) ? clamp(((rssi - -90) / 60) * 100, 0, 100) : 0;
  const signalColor = !Number.isFinite(rssi)
    ? '#4ade80'
    : rssi > -50
      ? '#4ade80'
      : rssi > -70
        ? '#facc15'
        : '#f87171';
  const signalValue = Number.isFinite(rssi) ? formatRSSI(rssi) : EM_DASH;

  const scoreFill = Number.isFinite(score) ? clamp(score, 0, 100) : 0;
  const scoreColor = !Number.isFinite(score)
    ? '#4ade80'
    : score < 30
      ? '#4ade80'
      : score < 60
        ? '#facc15'
        : '#f87171';
  const scoreText = Number.isFinite(score) ? score.toFixed(1) : EM_DASH;

  const qualityFill = Number.isFinite(quality) ? clamp(quality, 0, 100) : 0;
  const qualityText = Number.isFinite(quality) ? formatConfidence(quality, true) : EM_DASH;

  const hasBand = !isMissingValue(props.band);
  const channelValue = isMissingValue(props.channel)
    ? ''
    : `${normalizeDisplay(props.channel)}${hasBand ? ` (${normalizeDisplay(props.band)})` : ''}`;
  const frequencyNumber = Number(props.frequency);
  const frequencyValue = isMissingValue(props.frequency)
    ? ''
    : Number.isFinite(frequencyNumber)
      ? `${frequencyNumber} MHz`
      : normalizeDisplay(props.frequency);
  const observationsValue = formatObservationText(props.observation_count, props.timespan_days);
  const siblingValue =
    Number(props.sibling_count) > 0 ? `${Number(props.sibling_count)} radios` : '';
  const wigleValue = props.wigle_match ? 'Yes' : '';
  const accuracyNumber = Number(props.accuracy);
  const accuracyValue = Number.isFinite(accuracyNumber) ? formatAccuracy(accuracyNumber) : '';
  const altitudeNumber = Number(props.altitude);
  const altitudeValue =
    Number.isFinite(altitudeNumber) && Math.abs(altitudeNumber) > 0.5
      ? formatAltitude(altitudeNumber)
      : '';

  const fieldRows = [
    !isMissingValue(props.encryption || props.security)
      ? fieldRow('Encryption', normalizeDisplay(props.encryption || props.security))
      : '',
    channelValue ? fieldRow('Channel', channelValue) : '',
    frequencyValue ? fieldRow('Frequency', frequencyValue) : '',
    !isMissingValue(props.manufacturer)
      ? fieldRow('Manufacturer', normalizeDisplay(props.manufacturer))
      : '',
    observationsValue ? fieldRow('Observations', observationsValue) : '',
    siblingValue ? fieldRow('Sibling Radios', siblingValue) : '',
    wigleValue ? fieldRow('WiGLE Match', wigleValue) : '',
    accuracyValue
      ? fieldRow(
          'GPS Accuracy',
          accuracyValue,
          Number.isFinite(accuracyNumber) ? `${accuracyNumber.toFixed(4)} m` : undefined
        )
      : '',
    altitudeValue
      ? fieldRow(
          'Altitude',
          altitudeValue,
          Number.isFinite(altitudeNumber) ? `${altitudeNumber.toFixed(2)} m` : undefined
        )
      : '',
  ]
    .filter(Boolean)
    .join('');

  const locationText = buildLocation(props);
  const hasCoords = lat != null && lon != null;
  const homeKm = Number(props.distance_from_home_km);
  const maxKm = Number(props.max_distance_km);
  const lastPointMeters = Number(props.distance_from_last_point_m);
  const homeColor = !Number.isFinite(homeKm)
    ? '#4ade80'
    : homeKm < 1
      ? '#4ade80'
      : homeKm < 5
        ? '#facc15'
        : '#f87171';
  const temporalPresent =
    !isMissingValue(props.first_seen) ||
    !isMissingValue(props.last_seen) ||
    !isMissingValue(props.time);

  return `
<div style="width:288px;max-width:min(340px, 90vw);background:#1a1d23;border:2px solid ${bc};border-radius:10px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#fff;box-sizing:border-box;">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px 6px;">
    <div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;display:flex;align-items:center;gap:6px;">
      <div style="flex-shrink:0;">${getRadioSVG(props.radio_type || 'WiFi', bc)}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ssid}</div>
    </div>
    <div style="flex-shrink:0;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:500;background:${threatBg};border:1px solid ${threatBorder};color:${tc};display:inline-block;white-space:nowrap;">${threat}</div>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;padding:0 12px 8px;">
    <div style="font-size:11px;font-family:monospace;color:${bc};letter-spacing:0.05em;word-break:break-all;">${bssid}</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:8px;">
    ${statsCell('Signal', signalValue, signalFill, signalColor)}
    ${statsCell(
      'Threat Score',
      scoreText,
      scoreFill,
      scoreColor,
      'border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);'
    )}
    ${statsCell('Data Quality', qualityText, qualityFill, '#60a5fa')}
  </div>

  ${fieldRows}

  <div style="padding:6px 12px 2px;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.3);border-top:1px solid rgba(255,255,255,0.08);margin-top:2px;">Location</div>
  ${locationText ? `<div style="padding:1px 12px;font-size:11px;color:rgba(255,255,255,0.7);">${locationText}</div>` : ''}
  ${hasCoords ? `<div title="${lat.toFixed(6)}, ${lon.toFixed(6)}" style="padding:1px 12px 4px;font-size:10px;font-family:monospace;color:rgba(255,255,255,0.45);cursor:help;">${formatCoord(Number(lat), 5)}, ${formatCoord(Number(lon), 5)}</div>` : ''}
  ${
    Number.isFinite(homeKm)
      ? `<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);white-space:nowrap;">HOME</div>
    <div style="flex:1;">${statBar((homeKm / 25) * 100, homeColor)}</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.85);text-align:right;white-space:nowrap;">${formatDistance(homeKm)}${Number.isFinite(maxKm) ? `<span style="color:rgba(255,255,255,0.45);"> · max ${formatDistance(maxKm)}</span>` : ''}</div>
  </div>`
      : ''
  }
  ${Number.isFinite(lastPointMeters) ? fieldRow('Last Pt', `${Math.round(lastPointMeters)}m`) : ''}

  ${
    temporalPresent
      ? `<div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);">
    ${!isMissingValue(props.number) ? `<div style="font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:6px;">OBS #${normalizeDisplay(props.number)}</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
      <div style="text-align:center;">
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.3);margin-bottom:2px;">First</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.85);font-family:monospace;line-height:1.3;">${formatDateTime(props.first_seen)}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.3);margin-bottom:2px;">Last</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.85);font-family:monospace;line-height:1.3;">${formatDateTime(props.last_seen)}</div>
      </div>
      <div ${!isMissingValue(props.time) ? `style="padding:4px 6px;background:#eab30820;border:1px solid #eab30840;border-radius:4px;text-align:center;"` : `style="text-align:center;"`}>
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.08em;color:${!isMissingValue(props.time) ? '#eab308' : 'rgba(255,255,255,0.3)'};font-weight:${!isMissingValue(props.time) ? '600' : '400'};margin-bottom:2px;">Seen</div>
        <div style="font-size:${!isMissingValue(props.time) ? '11px;font-weight:600' : '10px'};color:${!isMissingValue(props.time) ? '#eab308' : 'rgba(255,255,255,0.85)'};font-family:monospace;line-height:1.3;">${!isMissingValue(props.time) ? formatDateTime(props.time) : '—'}${!isMissingValue(props.time) && !isMissingValue(props.time_since_prior) ? `<span style="font-weight:400;font-size:9px;color:rgba(234,179,8,0.6);"> · ${normalizeDisplay(props.time_since_prior)}</span>` : ''}</div>
      </div>
    </div>
  </div>`
      : ''
  }
  ${
    !isMissingValue(props.notes)
      ? `<div style="padding:4px 12px 6px;font-size:10px;color:rgba(255,255,255,0.45);font-style:italic;border-top:1px solid rgba(255,255,255,0.05);">${normalizeDisplay(props.notes)}</div>`
      : ''
  }

</div>`;
};
