import { macColor } from '../mapHelpers';

/**
 * Network Tooltip Renderer
 * Usage: Works with Geospatial, Kepler, and WiGLE pages
 * Only displays data that's available - omits N/A fields
 * Uses threat color for icon and status, BSSID color for network ID
 */

export const renderNetworkTooltip = (props: any): string => {
  // Helper: Format date as MM/DD/YY
  const formatDate = (date: string) => {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  // Helper: Format time as HH:MM:SS
  const formatTime = (date: string) => {
    if (!date) return '';
    try {
      return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '';
    }
  };

  // Helper: Format full datetime
  const formatDateTime = (date: string) => {
    if (!date) return '';
    const d = formatDate(date);
    const t = formatTime(date);
    return d && t ? `${d} ${t}` : d || t || '';
  };

  // Helper: Format coordinates
  const formatCoordinates = (lat: number, lon: number) => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir} ${Math.abs(lon).toFixed(4)}°${lonDir}`;
  };

  // Helper: Get radio type SVG icon with custom color
  const getRadioSVG = (type: string, color: string) => {
    const iconMap: Record<string, string> = {
      W: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.94 0M12 20h.01"/></svg>`,
      B: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="12" r="1"/><path d="M12 1v6m0 6v4M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h4M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/></svg>`,
      L: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
      G: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M20.07 4.93a10 10 0 0 1 0 14.14M3.93 19.07a10 10 0 0 1 0-14.14"/></svg>`,
      '5': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M4 11a9 9 0 0 1 16 0M6 11a7 7 0 0 1 12 0M8 11a5 5 0 0 1 8 0M10 11a3 3 0 0 1 4 0M12 11v10"/></svg>`,
    };
    return iconMap[type] || iconMap['W'];
  };

  // Threat level and color
  const threatLevel = String(props.threat_level || props.threat || 'NONE').toUpperCase();
  const threatColor =
    {
      CRITICAL: '#ef4444',
      HIGH: '#f97316',
      MED: '#eab308',
      MEDIUM: '#eab308',
      LOW: '#22c55e',
      NONE: '#94a3b8',
    }[threatLevel] || '#94a3b8';

  // BSSID-based color for consistent network identification
  const bssidColor = macColor(props.bssid);

  // Helper: Format timespan
  const timespanText = (() => {
    if (!props.timespan_days) return '';
    const d = props.timespan_days;
    if (d >= 365) return `${(d / 365).toFixed(1)}yr`;
    if (d >= 30) return `${(d / 30).toFixed(1)}mo`;
    return `${d}d`;
  })();

  return `
    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.95) 100%); color: #f8fafc; padding: 12px 14px; border-radius: 9px; max-width: 320px; font-size: 12px; border: 1px solid rgba(59, 130, 246, 0.4); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.4;">
      <!-- HEADER WITH ICON -->
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(59, 130, 246, 0.25);">
        <div style="width: 18px; height: 18px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          ${getRadioSVG(props.type, threatColor)}
        </div>
        <div style="color: ${bssidColor}; font-weight: 600; font-size: 14px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${props.ssid || 'Hidden'}
        </div>
        <div style="background: ${threatColor}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; white-space: nowrap; text-transform: uppercase;">
          ${threatLevel}
        </div>
      </div>

      <!-- SIGNAL, SECURITY, FREQUENCY -->
      ${
        props.signal || props.security || props.frequency
          ? `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px;">
        ${
          props.signal
            ? `
        <div style="background: rgba(59, 130, 246, 0.1); padding: 6px; border-radius: 4px; text-align: center;">
          <div style="color: #94a3b8; font-size: 8px; text-transform: uppercase; font-weight: 600;">Signal</div>
          <div style="color: #fbbf24; font-weight: 700; font-size: 13px;">${props.signal}<span style="font-size: 9px; font-weight: normal; margin-left: 1px;">dBm</span></div>
        </div>
        `
            : ''
        }
        ${
          props.security
            ? `
        <div style="background: rgba(59, 130, 246, 0.1); padding: 6px; border-radius: 4px; text-align: center;">
          <div style="color: #94a3b8; font-size: 8px; text-transform: uppercase; font-weight: 600;">Security</div>
          <div style="color: #e2e8f0; font-weight: 600; font-size: 10px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${props.security}</div>
        </div>
        `
            : ''
        }
        ${
          props.frequency
            ? `
        <div style="background: rgba(59, 130, 246, 0.1); padding: 6px; border-radius: 4px; text-align: center;">
          <div style="color: #94a3b8; font-size: 8px; text-transform: uppercase; font-weight: 600;">Channel</div>
          <div style="color: #e2e8f0; font-weight: 600; font-size: 11px; margin-top: 1px;">${props.channel || '?'}<span style="font-size: 8px; color: #64748b; margin-left: 3px;">${props.frequency}M</span></div>
        </div>
        `
            : ''
        }
      </div>
      `
          : ''
      }

      <!-- BSSID -->
      <div style="background: rgba(15, 23, 42, 0.4); padding: 6px 10px; border-radius: 4px; margin-bottom: 10px; border: 1px solid rgba(59, 130, 246, 0.1); display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: 600;">BSSID</span>
        <span style="font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 11px; color: ${threatColor}; letter-spacing: 0.5px;">${props.bssid || 'UNKNOWN'}</span>
      </div>

      <!-- SCORE & LOCATION -->
      <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 8px; margin-bottom: 10px;">
        <div style="background: rgba(59, 130, 246, 0.1); padding: 8px; border-radius: 4px; text-align: center; border-left: 3px solid ${threatColor};">
          <div style="color: #94a3b8; font-size: 8px; text-transform: uppercase; font-weight: 600;">Threat Score</div>
          <div style="color: ${threatColor}; font-weight: 800; font-size: 16px; margin-top: 2px;">${props.threat_score != null ? props.threat_score.toFixed(1) : '0.0'}</div>
        </div>
        <div style="background: rgba(59, 130, 246, 0.1); padding: 8px; border-radius: 4px;">
          <div style="color: #94a3b8; font-size: 8px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Geospatial Context</div>
          <div style="color: #60a5fa; font-weight: 600; font-size: 10px; font-family: monospace;">${props.lat && props.lon ? formatCoordinates(props.lat, props.lon) : 'NO COORDS'}</div>
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            ${props.altitude != null ? `<span style="color: #3b82f6; font-size: 9px;">Alt: <b>${props.altitude.toFixed(0)}m</b></span>` : ''}
            ${props.accuracy != null ? `<span style="color: #3b82f6; font-size: 9px;">Acc: <b>${props.accuracy.toFixed(1)}m</b></span>` : ''}
          </div>
        </div>
      </div>

      <!-- MANUFACTURER -->
      ${
        props.manufacturer && props.manufacturer !== 'Unknown'
          ? `
      <div style="background: rgba(59, 130, 246, 0.05); padding: 6px 10px; border-radius: 4px; margin-bottom: 10px; border: 1px solid rgba(59, 130, 246, 0.1);">
        <div style="color: #94a3b8; font-size: 8px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">OUI Manufacturer</div>
        <div style="color: #60a5fa; font-weight: 600; font-size: 11px;">${props.manufacturer}</div>
      </div>
      `
          : ''
      }

      <!-- OBSERVATIONS & DISTANCE -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
        <div style="background: rgba(251, 191, 36, 0.1); padding: 8px; border-radius: 4px; border-bottom: 2px solid #fbbf24;">
          <div style="color: #94a3b8; font-size: 8px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Sightings</div>
          <div style="color: #fbbf24; font-weight: 700; font-size: 14px;">${props.observation_count || props.observations || 0}</div>
          ${props.timespan_days ? `<div style="color: #94a3b8; font-size: 9px; margin-top: 2px;">Span: <b>${props.timespan_days}d</b> (${timespanText})</div>` : ''}
        </div>
        <div style="background: rgba(59, 130, 246, 0.1); padding: 8px; border-radius: 4px; border-bottom: 2px solid #3b82f6;">
          <div style="color: #94a3b8; font-size: 8px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Proximity</div>
          <div style="color: #60a5fa; font-size: 9px; line-height: 1.5; font-weight: 500;">
            ${props.distance_from_home_km != null ? `Home: <b>${(props.distance_from_home_km * 1000).toFixed(0)}m</b><br/>` : ''}
            ${props.max_distance_km != null ? `Max: <b>${(props.max_distance_km * 1000).toFixed(0)}m</b><br/>` : ''}
            ${props.distance_from_last_point_m != null ? `Delta: <b>${props.distance_from_last_point_m.toFixed(0)}m</b>` : ''}
          </div>
        </div>
      </div>

      <!-- TEMPORAL FOOTER -->
      <div style="background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 6px; border: 1px solid rgba(251, 191, 36, 0.2);">
        <div style="color: #fbbf24; font-size: 9px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px; display: flex; justify-content: space-between;">
          <span>Observation ${props.number ? `#${props.number}` : ''}</span>
          ${props.time_since_prior ? `<span style="color: #f97316;">+${props.time_since_prior} since #${(props.number || 1) - 1}</span>` : ''}
          ${!props.time_since_prior && props.unique_days ? `<span>${props.unique_days} Unique Days</span>` : ''}
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${
            props.time
              ? `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #94a3b8; font-size: 9px;">This Obs:</span>
            <span style="color: #fde68a; font-weight: 600; font-size: 11px;">${formatDateTime(props.time)}</span>
          </div>`
              : ''
          }
          ${
            props.first_seen
              ? `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #94a3b8; font-size: 9px;">First Seen:</span>
            <span style="color: #60a5fa; font-weight: 500; font-size: 10px;">${formatDateTime(props.first_seen)}</span>
          </div>`
              : ''
          }
          ${
            props.last_seen
              ? `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #94a3b8; font-size: 9px;">Last Known:</span>
            <span style="color: #60a5fa; font-weight: 500; font-size: 10px;">${formatDateTime(props.last_seen)}</span>
          </div>`
              : ''
          }
        </div>
      </div>
    </div>
  `;
};
