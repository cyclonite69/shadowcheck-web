import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { NetworkRow } from '../../../types/network';
import type { NetworkColumnConfig } from '../../../constants/network';
import { TypeBadge, ThreatBadge, SecurityBadge } from '../../badges';
import { Tooltip } from '../../../utils/Tooltip';
import { macColor } from '../../../utils/mapHelpers';
import {
  getSignalColor,
  getSignalDisplay,
  getTimespanBadgeStyle,
  getTimespanDisplay,
} from '../../../utils/networkFormatting';
import { formatSecurity } from '../../../utils/wigle/security';
import {
  formatCoordOverview,
  formatAltitude,
  formatAccuracy,
} from '../../../utils/geospatial/fieldFormatting';

export interface NetworkTableCellRendererContext {
  column: keyof NetworkRow | 'select';
  columnConfig?: NetworkColumnConfig;
  row: NetworkRow;
  value: unknown;
  isSelected: boolean;
  isLinkedSibling: boolean;
  showSelectedAnchorLink: boolean;
  onToggleSelectNetwork: (bssid: string) => void;
}

export interface NetworkTableCellRendererResult {
  content: ReactNode;
  style?: CSSProperties;
  title?: string;
}

const renderSelect = ({
  row,
  isSelected,
  onToggleSelectNetwork,
}: NetworkTableCellRendererContext) => {
  const bssid = row.bssid;
  const handleChange = () => {
    if (bssid) {
      onToggleSelectNetwork(bssid);
    }
  };

  return {
    content: (
      <input
        type="checkbox"
        checked={isSelected}
        aria-label={`Select network ${row.ssid || row.bssid || ''}`}
        onChange={handleChange}
        onClick={(event) => event.stopPropagation()}
        style={{ cursor: 'pointer', margin: 0, display: 'block' }}
      />
    ),
    style: {
      display: 'flex',
      alignItems: 'center',
      height: '100%',
      boxSizing: 'border-box' as CSSProperties['boxSizing'],
    } as CSSProperties,
  };
};

const renderType = ({ value }: NetworkTableCellRendererContext) => {
  const networkType = (value as NetworkRow['type']) || '?';
  return {
    content: <TypeBadge type={networkType} />,
    style: {
      display: 'flex',
      alignItems: 'center',
      height: '100%',
      boxSizing: 'border-box',
    } as CSSProperties,
  };
};

const renderThreat = ({ row }: NetworkTableCellRendererContext) => {
  const threatBadge = (
    <ThreatBadge
      threat={row.threat || undefined}
      reasons={row.threatReasons as any}
      evidence={row.threatEvidence as any}
    />
  );

  const tooltip =
    typeof row.all_tags === 'string' && row.all_tags.trim().length > 0
      ? `Manual tags: ${row.all_tags}`
      : undefined;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{threatBadge}</Tooltip> : threatBadge,
  };
};

const renderSignal = ({ value }: NetworkTableCellRendererContext) => {
  const signalValue = value as number | null;
  return {
    content: (
      <span style={{ color: getSignalColor(signalValue), fontWeight: 600 }}>
        {getSignalDisplay(signalValue)}
      </span>
    ),
  };
};

const renderObservations = ({ value }: NetworkTableCellRendererContext) => ({
  content: (
    <span
      style={{
        background: 'rgba(59, 130, 246, 0.2)',
        color: '#93c5fd',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '500',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        display: 'inline-block',
      }}
    >
      {value as number}
    </span>
  ),
});

const renderChannel = ({ value, row }: NetworkTableCellRendererContext) => {
  const channelValue = value as number | null;
  const networkType = row.type;
  if (networkType === 'W' && channelValue && channelValue !== 0) {
    return {
      content: (
        <span
          style={{
            background: 'rgba(16, 185, 129, 0.2)',
            color: '#10b981',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'inline-block',
          }}
        >
          {channelValue}
        </span>
      ),
    };
  }

  return {
    content: <span>—</span>,
    style: { color: '#cbd5e1' },
  };
};

const renderFrequency = ({ value, row }: NetworkTableCellRendererContext) => {
  const freqValue = value as number | null;
  const isWiFi = row.type === 'W';

  if (isWiFi && freqValue && freqValue !== 0) {
    return {
      content: <span style={{ color: '#10b981', fontWeight: '600' }}>{freqValue} MHz</span>,
    };
  }

  return {
    content: <span>—</span>,
    style: { color: '#cbd5e1' },
  };
};

const renderTimespanDays = ({ value }: NetworkTableCellRendererContext) => {
  const days = value as number | null;
  if (days !== null && days >= 0) {
    const { bg, color, border } = getTimespanBadgeStyle(days);
    return {
      content: (
        <span
          style={{
            background: bg,
            color,
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500',
            border: `1px solid ${border}`,
            display: 'inline-block',
          }}
        >
          {getTimespanDisplay(days)}
        </span>
      ),
    };
  }

  return {
    content: <span>—</span>,
    style: { color: '#94a3b8' },
  };
};

const formatNumber = (value: number | null | undefined, precision = 1) =>
  value == null ? null : value.toFixed(precision);

const formatDistanceKm = (km: number | null | undefined) => {
  if (km == null || !Number.isFinite(km)) return null;
  return parseFloat(km.toFixed(2)).toString();
};

const metersToKm = (meters: number | null | undefined) => {
  if (meters == null || !Number.isFinite(meters)) return null;
  return meters / 1000;
};

const threatScoreColor = (value: number | null) => {
  if (value == null) return '#94a3b8';
  if (value >= 75) return '#dc2626';
  if (value >= 50) return '#f97316';
  if (value >= 25) return '#f59e0b';
  return '#22c55e';
};

const renderThreatScore = ({ value }: NetworkTableCellRendererContext) => {
  const score = typeof value === 'number' ? value : null;
  const label = formatNumber(score, 1) ?? '—';
  const scoreContent = (
    <span style={{ color: threatScoreColor(score), fontWeight: 600 }}>{label}</span>
  );
  const tooltip = score != null ? `Threat score: ${score.toFixed(1)}/100` : undefined;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{scoreContent}</Tooltip> : scoreContent,
  };
};

const renderDistanceFromHome = ({ value }: NetworkTableCellRendererContext) => {
  const km = metersToKm(typeof value === 'number' ? value : null);
  const label = formatDistanceKm(km);
  const distanceContent = <span>{label ? `${label} km` : '—'}</span>;
  const tooltipText = km != null ? `${formatDistanceKm(km)} km from home` : undefined;

  return {
    content: tooltipText ? (
      <Tooltip content={tooltipText}>{distanceContent}</Tooltip>
    ) : (
      distanceContent
    ),
    title: tooltipText,
  };
};

const renderMaxDistance = ({ value }: NetworkTableCellRendererContext) => {
  const km = metersToKm(typeof value === 'number' ? value : null);
  const label = formatDistanceKm(km);
  const maxDistanceContent = <span>{label ? `${label} km` : '—'}</span>;
  const tooltip = km != null ? `Max distance: ${formatDistanceKm(km)} km` : undefined;

  return {
    content: tooltip ? (
      <Tooltip content={tooltip}>{maxDistanceContent}</Tooltip>
    ) : (
      maxDistanceContent
    ),
  };
};

const getSecurityTooltip = (
  security: string | null | undefined,
  capabilities: string | null | undefined,
  networkType: string | null | undefined
) => {
  const displaySecurity = formatSecurity(capabilities, security).trim().toUpperCase();
  const normalizedType = String(networkType || '')
    .trim()
    .toUpperCase();
  const isWiFiType = normalizedType === 'W';
  const shouldShowDash =
    !displaySecurity ||
    displaySecurity.startsWith('UNKNOWN') ||
    displaySecurity === '—' ||
    (!isWiFiType && displaySecurity === 'OPEN');

  if (shouldShowDash) {
    return undefined;
  }

  const rawCapabilities = typeof capabilities === 'string' ? capabilities.trim() : '';
  const normalizedRawCapabilities = rawCapabilities.toUpperCase();
  const hasStructuredCapabilities =
    normalizedRawCapabilities.includes('[') ||
    /(WPA|RSN|WEP|WPS|OWE|SAE|TKIP|CCMP|EAP|ESS|IBSS)/.test(normalizedRawCapabilities);
  const shouldIncludeRawCapabilities =
    hasStructuredCapabilities &&
    rawCapabilities.length > 0 &&
    normalizedRawCapabilities !== displaySecurity &&
    normalizedRawCapabilities !== 'OPEN' &&
    normalizedRawCapabilities !== 'OPEN/UNKNOWN' &&
    normalizedRawCapabilities !== 'NONE';

  return shouldIncludeRawCapabilities ? `${displaySecurity} | ${rawCapabilities}` : displaySecurity;
};

const renderSecurity = ({ value, row }: NetworkTableCellRendererContext) => {
  const tooltip = getSecurityTooltip(value as string | null, row.capabilities, row.type);
  const badge = <SecurityBadge security={value as string | null} networkType={row.type} />;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{badge}</Tooltip> : badge,
    title: tooltip,
  };
};

const renderNotesCount = ({ value }: NetworkTableCellRendererContext) => {
  const count = typeof value === 'number' ? value : null;
  const notesContent = <span>{count && count > 0 ? 'Yes' : '—'}</span>;
  const tooltip = count && count > 0 ? `${count} note${count === 1 ? '' : 's'}` : undefined;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{notesContent}</Tooltip> : notesContent,
  };
};

const formatPercentLabel = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return null;
  const percent = value * 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
};

const renderStationaryConfidence = ({ value }: NetworkTableCellRendererContext) => {
  const raw = typeof value === 'number' ? value : null;
  const label = formatPercentLabel(raw);
  const confidenceContent = <span>{label ?? '—'}</span>;
  const tooltip = raw != null ? `Stationary confidence: ${(raw * 100).toFixed(4)}%` : undefined;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{confidenceContent}</Tooltip> : confidenceContent,
  };
};

const renderGeocodedConfidence = ({ value }: NetworkTableCellRendererContext) => {
  const raw = typeof value === 'number' ? value : null;
  const label = formatPercentLabel(raw);
  const confidenceContent = <span>{label ?? '—'}</span>;
  const tooltip = raw != null ? `Geocoding confidence: ${(raw * 100).toFixed(4)}%` : undefined;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{confidenceContent}</Tooltip> : confidenceContent,
    title: tooltip,
  };
};

const renderLatitude = ({ value }: NetworkTableCellRendererContext) => {
  const raw = typeof value === 'number' ? value : null;
  const latitudeContent = (
    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{formatCoordOverview(raw)}</span>
  );
  const tooltip = raw != null ? `Latitude: ${raw.toFixed(6)}°` : undefined;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{latitudeContent}</Tooltip> : latitudeContent,
    title: tooltip,
  };
};

const renderLongitude = ({ value }: NetworkTableCellRendererContext) => {
  const raw = typeof value === 'number' ? value : null;
  const longitudeContent = (
    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{formatCoordOverview(raw)}</span>
  );
  const tooltip = raw != null ? `Longitude: ${raw.toFixed(6)}°` : undefined;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{longitudeContent}</Tooltip> : longitudeContent,
    title: tooltip,
  };
};

const renderCoordinate = ({
  value,
  column,
}: Pick<NetworkTableCellRendererContext, 'value' | 'column'>) => {
  const raw = typeof value === 'number' ? value : null;
  const axis = String(column).toLowerCase().includes('lon') ? 'Longitude' : 'Latitude';
  const coordinateContent = (
    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{formatCoordOverview(raw)}</span>
  );
  const tooltip = raw != null ? `${axis}: ${raw.toFixed(6)}°` : undefined;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{coordinateContent}</Tooltip> : coordinateContent,
    title: tooltip,
  };
};

const renderAltitudeCell = ({ value }: NetworkTableCellRendererContext) => {
  const raw = typeof value === 'number' ? value : null;
  const altitudeContent = <span>{formatAltitude(raw)}</span>;
  const tooltip = raw != null ? `Altitude: ${raw.toFixed(2)} m` : undefined;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{altitudeContent}</Tooltip> : altitudeContent,
  };
};

const renderAccuracyCell = ({ value }: NetworkTableCellRendererContext) => {
  const raw = typeof value === 'number' ? value : null;
  const accuracyContent = <span>{formatAccuracy(raw)}</span>;
  const tooltip = raw != null ? `Accuracy: ±${raw.toFixed(4)} m` : undefined;

  return {
    content: tooltip ? <Tooltip content={tooltip}>{accuracyContent}</Tooltip> : accuracyContent,
  };
};

const renderBssid = ({
  value,
  row,
  showSelectedAnchorLink,
  isLinkedSibling,
}: NetworkTableCellRendererContext) => {
  const label = value == null ? '—' : String(value);
  const bssidContent = (
    <div
      style={{
        fontFamily: 'monospace',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: macColor(row.bssid ?? ''),
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>
        {label}
      </span>
    </div>
  );

  return {
    content: label === '—' ? bssidContent : <Tooltip content={label}>{bssidContent}</Tooltip>,
    title: label === '—' ? undefined : label,
  };
};

const renderSsid = ({
  value,
  row,
  showSelectedAnchorLink,
  isLinkedSibling,
}: NetworkTableCellRendererContext) => {
  const textContent =
    value == null || String(value).trim().length === 0 ? '(hidden)' : String(value);
  const fullValue = typeof value === 'string' && value.length > 0 ? value : null;

  const ssidContent = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <div
        style={{
          color: '#f1f5f9',
          fontWeight: 500,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {textContent}
      </div>
      {(showSelectedAnchorLink || isLinkedSibling) && (
        <span
          title={showSelectedAnchorLink ? 'Selected sibling anchor' : 'Linked sibling'}
          style={{ color: '#38bdf8', flex: '0 0 auto' }}
        >
          🔗
        </span>
      )}
    </div>
  );

  return {
    content: fullValue ? <Tooltip content={fullValue}>{ssidContent}</Tooltip> : ssidContent,
  };
};

const defaultValue = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value == null) {
    return '—';
  }
  return '—';
};

const defaultTitle = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;

const renderPresence = ({ value }: NetworkTableCellRendererContext) => {
  const isPresent = value === true;
  return {
    content: <span>{isPresent ? 'Yes' : '—'}</span>,
  };
};

const renderTruncatedText = ({ value }: NetworkTableCellRendererContext) => {
  const text = typeof value === 'string' ? value.trim() : '';
  const label = text || '—';
  const content = (
    <span
      style={{
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );

  return {
    content: text ? <Tooltip content={text}>{content}</Tooltip> : content,
    title: text || undefined,
  };
};

const columnRenderers: Partial<
  Record<
    keyof NetworkRow | 'select',
    (context: NetworkTableCellRendererContext) => NetworkTableCellRendererResult
  >
> = {
  select: renderSelect,
  type: renderType,
  threat: renderThreat,
  signal: renderSignal,
  threat_score: renderThreatScore,
  observations: renderObservations,
  security: renderSecurity,
  channel: renderChannel,
  frequency: renderFrequency,
  timespanDays: renderTimespanDays,
  bssid: renderBssid,
  ssid: renderSsid,
  distanceFromHome: renderDistanceFromHome,
  max_distance_meters: renderMaxDistance,
  notes_count: renderNotesCount,
  is_ignored: renderPresence,
  stationaryConfidence: renderStationaryConfidence,
  geocoded_confidence: renderGeocodedConfidence,
  manufacturer: renderTruncatedText,
  geocoded_address: renderTruncatedText,
  geocoded_city: renderTruncatedText,
  geocoded_state: renderTruncatedText,
  geocoded_postal_code: renderTruncatedText,
  geocoded_country: renderTruncatedText,
  geocoded_poi_name: renderTruncatedText,
  geocoded_poi_category: renderTruncatedText,
  geocoded_feature_type: renderTruncatedText,
  geocoded_provider: renderTruncatedText,
  accuracy: renderAccuracyCell,
  latitude: renderLatitude,
  longitude: renderLongitude,
  rawLatitude: renderLatitude,
  rawLongitude: renderLongitude,
  centroid_lat: renderCoordinate,
  centroid_lon: renderCoordinate,
  weighted_lat: renderCoordinate,
  weighted_lon: renderCoordinate,
  min_altitude_m: renderAltitudeCell,
  max_altitude_m: renderAltitudeCell,
  altitude_span_m: renderAltitudeCell,
  last_altitude_m: renderAltitudeCell,
};

export const renderNetworkTableCell = (
  context: NetworkTableCellRendererContext
): NetworkTableCellRendererResult => {
  const renderer = columnRenderers[context.column];
  if (renderer) {
    return renderer(context);
  }

  if (context.columnConfig?.render) {
    return { content: context.columnConfig.render(context.value, context.row) };
  }

  return {
    content: defaultValue(context.value),
    title: defaultTitle(context.value),
  };
};
