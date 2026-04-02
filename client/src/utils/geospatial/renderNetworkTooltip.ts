import { THREAT_LEVEL_CONFIG } from '../../constants/network';
import { macColor } from '../../utils/mapHelpers';
import { resolveRadioTech } from '../../utils/mapHelpers';
import { getDisplayRadioType, getRadioTypeIcon } from '../../utils/icons/radioTypeIcons';
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
  return Number.isFinite(days) && days > 0 ? `${base} · ${Math.round(days)} days` : base;
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

// Decode Bluetooth Class of Device (CoD) major device class
// WiGLE stores CoD in the "frequency" field for BT/BLE devices
function decodeBtCoD(cod: number): string {
  const major = (cod >> 8) & 0x1f;
  const labels: Record<number, string> = {
    0: 'Miscellaneous',
    1: 'Computer',
    2: 'Phone',
    3: 'LAN/Network AP',
    4: 'Audio/Video',
    5: 'Peripheral',
    6: 'Imaging',
    7: 'Wearable',
    8: 'Toy',
    9: 'Health',
    31: 'Uncategorized',
  };
  return labels[major] || `Class 0x${cod.toString(16)}`;
}

// Parse BT/BLE capabilities: "Headphones;10" → { device: "Headphones", bondState: "Not Paired" }
// Suffix is Android BluetoothDevice.getBondState(): 10=BOND_NONE, 11=BONDING, 12=BONDED
function parseBtCapabilities(caps: string): { device: string | null; bondState: string | null } {
  if (!caps || caps.startsWith('[')) return { device: null, bondState: null }; // WiFi caps leaked in
  const parts = caps.split(';');
  const raw = parts[0]?.trim() || null;
  const device = raw && raw !== 'null' && raw !== 'Uncategorized' && raw !== 'Misc' ? raw : null;
  const bond = parts[1]?.trim();
  const bondState =
    bond === '10' ? 'Not Paired' : bond === '11' ? 'Pairing' : bond === '12' ? 'Paired' : null;
  return { device, bondState };
}

// Common US MCC/MNC → carrier name
const MCC_MNC_CARRIERS: Record<string, string> = {
  '310410': 'AT&T',
  '310260': 'T-Mobile',
  '311480': 'Verizon',
  '310120': 'Sprint',
  '311580': 'US Cellular',
  '310830': 'TracFone',
  '315010': 'FirstNet',
};

// Parse LTE capabilities: "LTE;310410" → { tech: "LTE", carrier: "AT&T" }
function parseLteCapabilities(caps: string): { tech: string; carrier: string | null } {
  const parts = caps.split(';');
  const tech = parts[0]?.trim() || 'LTE';
  const mccMnc = parts[1]?.trim() || '';
  const carrier =
    MCC_MNC_CARRIERS[mccMnc] || (mccMnc && mccMnc !== 'us' ? `MCC/MNC ${mccMnc}` : null);
  return { tech, carrier };
}

function formatThreatFactors(factors: any): string {
  if (!factors || typeof factors !== 'object' || Object.keys(factors).length === 0) return '';

  const rows = Object.entries(factors)
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ').toUpperCase();
      const val = typeof value === 'number' ? value.toFixed(1) : String(value);
      return `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
        <span style="color:rgba(255,255,255,0.3);font-size:8px;letter-spacing:0.05em;">${label}</span>
        <span style="color:rgba(255,255,255,0.7);font-size:9px;font-family:monospace;">${val}</span>
      </div>`;
    })
    .join('');

  return `
    <div style="padding:6px 12px;background:rgba(255,0,255,0.05);border-top:1px solid rgba(255,255,255,0.08);">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.4);margin-bottom:4px;">Threat Factors</div>
      ${rows}
    </div>`;
}

export const renderNetworkTooltip = (props: any): string => {
  const threat = String(props.threat_level || props.threat || 'NONE').toUpperCase();
  const threatConfig =
    THREAT_LEVEL_CONFIG[threat as keyof typeof THREAT_LEVEL_CONFIG] || THREAT_LEVEL_CONFIG.NONE;
  const tc = threatConfig.color;
  const threatBg = threatConfig.bg;
  const threatBorder = `${threatConfig.color}40`;

  const frequencyNumber = Number(props.frequency);
  const rawCaps = String(props.capabilities_raw || props.capabilities || '').trim();
  const rawType = String(props.radio_type || props.type || '');

  // Reconcile type + capabilities to determine actual radio technology
  const tech = resolveRadioTech(rawType, rawCaps, frequencyNumber || null);
  const isStingray = tech === 'stingray';

  const bssidRaw = props.bssid || props.netid || '';
  const bc = isStingray ? '#FF00FF' : bssidRaw ? macColor(bssidRaw) : tc;

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
  const obsNumber = Number(props.number) || 0;
  const obsTotal = Number(props.observation_count) || 0;

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

  const isBT = tech === 'bt_classic' || tech === 'ble';
  const isCellular =
    tech === 'lte' || tech === 'nr' || tech === 'gsm' || tech === 'iwlan' || isStingray;
  const isWiFi = tech.startsWith('wifi') || tech === 'unknown';

  // Determine display radio type for SVG icon
  const displayRadioType = getDisplayRadioType(tech, isBT, isCellular, isStingray);

  // Parse radio-type-specific capabilities
  const btInfo = isBT ? parseBtCapabilities(rawCaps) : null;
  const cellInfo = isCellular ? parseLteCapabilities(rawCaps) : null;
  const btCoDDevice =
    isBT && !btInfo?.device && Number.isFinite(frequencyNumber) && frequencyNumber > 0
      ? decodeBtCoD(frequencyNumber)
      : null;
  const btDeviceLabel = btInfo?.device || btCoDDevice || null;

  const channelValue =
    isWiFi && !isMissingValue(props.channel) && Number(props.channel) !== 0
      ? `${normalizeDisplay(props.channel)}${hasBand ? ` (${normalizeDisplay(props.band)})` : ''}`
      : '';
  const frequencyValue =
    isWiFi &&
    !isMissingValue(props.frequency) &&
    Number.isFinite(frequencyNumber) &&
    frequencyNumber > 0
      ? `${frequencyNumber} MHz`
      : '';
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

  const securityValue = String(props.encryption || props.security || '').toUpperCase();

  // Helper to display security: show for WiFi, hide UNKNOWN/OPEN for BLE/BT
  const getSecurityDisplay = (): string | null => {
    if (!securityValue || securityValue === 'UNKNOWN') return null;
    const isBluetooth = tech === 'ble' || tech === 'bt_classic';
    if (isBluetooth && securityValue === 'OPEN') return '—';
    if (isWiFi) return securityValue;
    if (isBluetooth && securityValue && securityValue !== 'OPEN') return securityValue;
    return null;
  };

  const displaySecurity = getSecurityDisplay();
  const showSecurity = !!displaySecurity;

  const fieldRows = [
    isStingray ? fieldRow('SIGINT Type', 'Stingray') : '',
    showSecurity ? fieldRow('Encryption', displaySecurity) : '',
    btDeviceLabel ? fieldRow('Device Type', btDeviceLabel) : '',
    btInfo?.bondState ? fieldRow('Bond State', btInfo.bondState) : '',
    cellInfo?.carrier ? fieldRow('Carrier', cellInfo.carrier) : '',
    cellInfo && !cellInfo.carrier ? fieldRow('Network', cellInfo.tech) : '',
    channelValue ? fieldRow('Channel', channelValue) : '',
    frequencyValue ? fieldRow('Frequency', frequencyValue) : '',
    !isMissingValue(props.manufacturer) && String(props.manufacturer).toUpperCase() !== 'UNKNOWN'
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
    <div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0;">
      <span class="popup-drag-handle" title="Drag to move" aria-hidden="true">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
          <circle cx="3" cy="3" r="1" fill="currentColor" />
          <circle cx="7" cy="3" r="1" fill="currentColor" />
          <circle cx="3" cy="7" r="1" fill="currentColor" />
          <circle cx="7" cy="7" r="1" fill="currentColor" />
          <circle cx="3" cy="11" r="1" fill="currentColor" />
          <circle cx="7" cy="11" r="1" fill="currentColor" />
        </svg>
      </span>
      <div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;display:flex;align-items:center;gap:6px;">
        <div style="flex-shrink:0;">${getRadioTypeIcon(displayRadioType, bc)}</div>
        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ssid}</div>
      </div>
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
  ${formatThreatFactors(props.threat_factors)}

  <div style="padding:6px 12px 2px;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.3);border-top:1px solid rgba(255,255,255,0.08);margin-top:2px;">Location</div>
  ${locationText ? `<div style="padding:1px 12px;font-size:11px;color:rgba(255,255,255,0.7);">${locationText}</div>` : ''}
  ${hasCoords ? `<div title="${lat.toFixed(6)}, ${lon.toFixed(6)}" style="padding:1px 12px 4px;font-size:10px;font-family:monospace;color:rgba(255,255,255,0.45);cursor:help;display:flex;justify-content:space-between;">${formatCoord(Number(lat), 5)}, ${formatCoord(Number(lon), 5)}${obsNumber > 0 && obsTotal > 0 ? `<span style="color:rgba(255,255,255,0.3);">#${obsNumber} / ${obsTotal}</span>` : ''}</div>` : ''}
  ${
    Number.isFinite(homeKm)
      ? `<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.38);white-space:nowrap;">HOME</div>
    <div style="flex:1;">${statBar((homeKm / 25) * 100, homeColor)}</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.85);text-align:right;white-space:nowrap;">${formatDistance(homeKm)}${Number.isFinite(maxKm) && maxKm > 0 ? `<span style="color:rgba(255,255,255,0.45);"> · max ${formatDistance(maxKm)}</span>` : ''}</div>
  </div>`
      : ''
  }
  ${Number.isFinite(lastPointMeters) && lastPointMeters > 0 ? fieldRow('Last Pt', `${Math.round(lastPointMeters)}m`) : ''}

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
