import { macColor } from '../mapHelpers';
import { isRandomizedMAC } from '../macUtils';

/**
 * Network Tooltip Renderer
 * Usage: Works with Geospatial, Kepler, and WiGLE pages
 * High-fidelity forensic design with data density and visual alerts.
 */

const THREAT_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MED: '#eab308',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
  NONE: '#94a3b8',
};

const BORDER_COLOR: Record<string, string> = {
  CRITICAL: 'rgba(239, 68, 68, 0.45)',
  HIGH: 'rgba(249, 115, 22, 0.45)',
  MED: 'rgba(234, 179, 8, 0.45)',
  MEDIUM: 'rgba(234, 179, 8, 0.45)',
  LOW: 'rgba(34, 197, 94, 0.35)',
  NONE: 'rgba(148, 163, 184, 0.25)',
};

function signalBars(rssi: number): string {
  const filled = Math.round(Math.max(0, Math.min(100, ((rssi + 100) / 60) * 100)) / 25);
  const color = rssi >= -65 ? '#22c55e' : rssi >= -80 ? '#eab308' : '#ef4444';
  return [1, 2, 3, 4]
    .map(
      (i) =>
        `<div style="width:3px;height:${5 + i * 3}px;border-radius:1px;align-self:flex-end;background:${i <= filled ? color : 'rgba(148,163,184,0.2)'};"></div>`
    )
    .join('');
}

function progressBar(pct: number, color: string): string {
  return `<div style="height:3px;border-radius:2px;background:rgba(148,163,184,0.15);margin-top:4px;overflow:hidden;">
    <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;"></div></div>`;
}

function fmtDate(s?: string): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

function buildLocation(p: any): string {
  const street = [p.housenumber, p.road].filter(Boolean).join(' ');
  const city = [p.city, p.region].filter(Boolean).join(', ');
  return street && city ? `${street}, ${city}` : city || '—';
}

function row(label: string, val: string): string {
  return `<tr>
    <td style="color:#475569;padding:2px 0;padding-right:10px;white-space:nowrap;">${label}</td>
    <td style="color:#94a3b8;text-align:right;padding:2px 0;">${val}</td>
  </tr>`;
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
  // Debug log to trace exact properties being passed to tooltip
  console.log('[Tooltip] Render Properties:', {
    bssid: props.bssid,
    ssid: props.ssid,
    freq: props.frequency,
    chan: props.channel,
    caps: props.capabilities,
    distHome: props.distance_from_home_km,
  });

  const threat = String(props.threat_level || props.threat || 'NONE').toUpperCase();
  const tc = THREAT_COLOR[threat] || '#94a3b8';
  const bc = BORDER_COLOR[threat] || 'rgba(148,163,184,0.25)';
  const bssidCol = macColor(props.bssid);
  const rssi = props.signal ?? props.rssi ?? props.level ?? -90;
  const score = Number(props.threat_score || 0);
  const quality = Math.round((props.quality_score || 0) * 100);
  const qualColor = quality >= 80 ? '#22c55e' : quality >= 60 ? '#eab308' : '#ef4444';
  const scoreColor = score >= 70 ? '#ef4444' : score >= 40 ? '#eab308' : '#22c55e';
  const lat = props.lat ?? props.latitude ?? props.trilat;
  const lon = props.lon ?? props.longitude ?? props.trilong;
  const randomized = isRandomizedMAC(props.bssid);

  // Format distance from home logic
  const distHomeRaw = Number(props.distance_from_home_km);
  const distHomeDisplay = (() => {
    if (props.distance_from_home_km === null || props.distance_from_home_km === undefined) {
      return '<span style="color:#475569;font-style:italic;">(no marker)</span>';
    }
    // Sanity check: > 10,000km is usually a missing-coordinate or cross-hemisphere calculation error
    if (distHomeRaw > 10000) {
      return '<span style="color:#475569;font-style:italic;">(out of range)</span>';
    }
    return distHomeRaw > 10
      ? `${distHomeRaw.toLocaleString(undefined, { maximumFractionDigits: 1 })}km`
      : `${Math.round(distHomeRaw * 1000)}m`;
  })();

  const distMaxRaw = Number(props.max_distance_km);
  const distMaxDisplay = (() => {
    if (props.max_distance_km === null || props.max_distance_km === undefined) return null;
    return distMaxRaw > 10
      ? `${distMaxRaw.toLocaleString(undefined, { maximumFractionDigits: 1 })}km`
      : `${Math.round(distMaxRaw * 1000)}m`;
  })();

  const distDeltaRaw = Number(props.distance_from_last_point_m);
  const distDeltaDisplay = (() => {
    if (props.distance_from_last_point_m === null || props.distance_from_last_point_m === undefined)
      return null;
    return distDeltaRaw > 10000
      ? `${(distDeltaRaw / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}km`
      : `${Math.round(distDeltaRaw)}m`;
  })();

  // Helper: Format timespan
  const timespanText = (() => {
    if (!props.timespan_days) return '';
    const d = props.timespan_days;
    if (d >= 365) return `${(d / 365).toFixed(1)}yr`;
    if (d >= 30) return `${(d / 30).toFixed(1)}mo`;
    return `${d}d`;
  })();

  return `
<div style="background:linear-gradient(160deg,rgba(9,13,26,0.98) 0%,rgba(6,10,20,0.98) 100%);color:#f1f5f9;padding:0;border-radius:10px;width:min(315px, 85vw);max-height:min(450px, 80vh);overflow-y:auto;border:1px solid ${bc};font-family:'JetBrains Mono','Fira Code',monospace;font-size:10.5px;box-sizing:border-box;box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8); scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.3) transparent;">

  <div style="padding:10px 14px 8px;border-bottom:1px solid rgba(148,163,184,0.1);position:sticky;top:0;background:rgba(9,13,26,0.95);backdrop-filter:blur(4px);z-index:10;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex-shrink:0;">${getRadioSVG(props.radio_type || 'WiFi', tc)}</div>
          <div style="font-size:13px;font-weight:700;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${props.ssid || '<span style="color:#475569;font-style:italic;">Hidden SSID</span>'}</div>
        </div>
        
        <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
          <div style="color:${bssidCol};font-size:9.5px;letter-spacing:0.1em;">${props.bssid || props.netid || '—'}</div>
          ${
            randomized
              ? `<div style="background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.4);color:#a78bfa;font-size:8px;padding:1px 5px;border-radius:3px;letter-spacing:0.08em;">RAND MAC</div>`
              : `<div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.25);color:#60a5fa;font-size:8px;padding:1px 5px;border-radius:3px;letter-spacing:0.08em;">OUI</div>`
          }
        </div>

        ${
          randomized
            ? `<div style="margin-top:7px;padding:5px 8px;background:rgba(167,139,250,0.07);border:1px solid rgba(167,139,250,0.2);border-radius:5px;font-size:9px;color:#7c6db5;line-height:1.4;">
                 Locally administered MAC — device is using a randomized hardware address. Real identity unknown.
               </div>`
            : ''
        }
      </div>
      <div style="flex-shrink:0;text-align:right;">
        <div style="background:${tc}18;border:1px solid ${tc}55;color:${tc};padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:0.12em;">${threat}</div>
        ${props.is_mobile ? `<div style="margin-top:3px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;font-size:8px;padding:1px 6px;border-radius:3px;letter-spacing:0.08em;">MOBILE</div>` : ''}
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid rgba(148,163,184,0.08);">
    <div style="padding:8px 10px;border-right:1px solid rgba(148,163,184,0.08);">
      <div style="color:#475569;font-size:8.5px;letter-spacing:0.08em;margin-bottom:4px;">SIGNAL</div>
      <div style="display:flex;align-items:flex-end;gap:3px;height:18px;">${signalBars(rssi)}</div>
      <div style="color:#94a3b8;font-size:10px;margin-top:2px;">${rssi} dBm</div>
    </div>
    <div style="padding:8px 10px;border-right:1px solid rgba(148,163,184,0.08);">
      <div style="color:#475569;font-size:8.5px;letter-spacing:0.08em;margin-bottom:4px;">THREAT SCORE</div>
      <div style="color:${tc};font-size:15px;font-weight:700;line-height:1;">${score.toFixed(1)}</div>
      ${progressBar(score, scoreColor)}
    </div>
    <div style="padding:8px 10px;">
      <div style="color:#475569;font-size:8.5px;letter-spacing:0.08em;margin-bottom:4px;">DATA QUALITY</div>
      <div style="color:#94a3b8;font-size:15px;font-weight:700;line-height:1;">${quality}%</div>
      ${progressBar(quality, qualColor)}
    </div>
  </div>

  <div style="padding:10px 14px;border-bottom:1px solid rgba(148,163,184,0.08);">
    <table style="width:100%;border-collapse:collapse;">
      ${row('Encryption', props.encryption || props.security || '—')}
      ${row('Channel', `${props.channel || '<span style="color:#475569;font-style:italic;">Unknown</span>'} <span style="color:#334155;">${props.band || ''}</span>`)}
      ${row('Frequency', `${props.frequency ? props.frequency + ' MHz' : '<span style="color:#475569;font-style:italic;">Unknown</span>'}`)}
      ${row('Manufacturer', props.manufacturer || '—')}
      ${row('Observations', `${props.observation_count ?? '0'} ${props.timespan_days ? `<span style="color:#475569;font-size:9px;">(${timespanText})</span>` : ''}`)}
      ${props.sibling_count > 0 ? row('Siblings', `<span style="color:#f97316;">${props.sibling_count} related</span>`) : ''}
      ${props.wigle_match ? row('WiGLE', '<span style="color:#60a5fa;">matched</span>') : ''}
      ${props.accuracy ? row('GPS Accuracy', `${props.accuracy}m` || '—') : ''}
      ${props.altitude ? row('Altitude', `${props.altitude.toFixed(0)}m` || '—') : ''}
    </table>
  </div>

  <div style="padding:8px 14px;border-bottom:1px solid rgba(148,163,184,0.08);">
    <div style="color:#475569;font-size:8.5px;letter-spacing:0.08em;margin-bottom:5px;">LOCATION</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <div style="color:#64748b;font-size:10px;flex:1;">${buildLocation(props)}</div>
      ${lat != null ? `<div style="color:#334155;font-size:9px;white-space:nowrap;">${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}</div>` : ''}
    </div>
    ${
      props.distance_from_home_km != null ||
      props.max_distance_km != null ||
      props.distance_from_last_point_m != null
        ? `
    <div style="margin-top:6px;display:flex;gap:10px;color:#475569;font-size:9px;">
      <span>HOME: <b style="color:#64748b;">${distHomeDisplay}</b></span>
      ${distMaxDisplay ? `<span>MAX: <b style="color:#64748b;">${distMaxDisplay}</b></span>` : ''}
      ${distDeltaDisplay ? `<span>DELTA: <b style="color:#64748b;">${distDeltaDisplay}</b></span>` : ''}
    </div>
    `
        : ''
    }
  </div>

  <div style="padding:8px 14px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:9px;">
      ${props.number ? `<div style="color:#3b82f6;font-weight:700;margin-bottom:2px;font-size:10px;">OBS # ${props.number} of ${props.observation_count}</div>` : ''}
      <div style="color:#334155;margin-bottom:1px;">FIRST <span style="color:#475569;">${fmtDate(props.first_seen)}</span></div>
      <div style="color:#334155;margin-bottom:1px;">LAST <span style="color:#64748b;">${fmtDate(props.last_seen)}</span></div>
      ${props.time ? `<div style="color:#f8fafc;margin-top:2px;padding-top:2px;border-top:1px solid rgba(148,163,184,0.1);">THIS OBS <span style="color:#60a5fa;font-weight:700;">${fmtDate(props.time)}</span></div>` : ''}
      ${props.time_since_prior ? `<div style="color:#f97316;margin-top:1px;">+${props.time_since_prior} since prev</div>` : ''}
    </div>
    ${props.notes ? `<div style="background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);color:#eab308;font-size:8.5px;padding:3px 7px;border-radius:4px;max-width:130px;text-align:right;line-height:1.3;">${props.notes}</div>` : ''}
  </div>

</div>`;
};
