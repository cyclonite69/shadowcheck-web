import React, { useState, useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { NetworkRow } from '../../../types/network';
import type { NetworkColumnConfig } from '../../../constants/network';
import type { ColumnBadgeConfig } from '../../../types/badgeConfig';
import { TypeBadge, ThreatBadge, SecurityBadge } from '../../badges';
import { BadgeRenderer } from '../../badgeStudio/BadgeRenderer';
import { Tooltip } from '../../../utils/Tooltip';
import { macColor } from '../../../utils/mapHelpers';
import {
  getSignalColor,
  getSignalDisplay,
  getTimespanBadgeStyle,
  getTimespanDisplay,
} from '../../../utils/networkFormatting';
import {
  formatNumber,
  formatDistanceKm,
  metersToKm,
  threatScoreColor,
  formatPercentLabel,
  getChannelBand,
  getSignalQualityLabel,
  getSecurityTooltip,
} from './formattingHelpers';
import {
  formatCoordOverview,
  formatAltitude,
  formatAccuracy,
} from '../../../utils/geospatial/fieldFormatting';
import { emitVendorIntel } from '../../vendor-intel/VendorIntelDrawer';
import { emitDetectionEvidence } from '../networkTagMenu/DetectionEvidenceModal';
import {
  formatDeviceType,
  hasVendorIntelForDeviceClass,
  normalizeDeviceClass,
} from '../../../utils/deviceClassUtils';

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
  const signalContent = (
    <span style={{ color: getSignalColor(signalValue), fontWeight: 600 }}>
      {getSignalDisplay(signalValue)}
    </span>
  );
  const tooltip = getSignalQualityLabel(signalValue);
  return {
    content: tooltip ? <Tooltip content={tooltip}>{signalContent}</Tooltip> : signalContent,
  };
};

const renderObservations = ({ value }: NetworkTableCellRendererContext) => {
  const count = value as number | null;
  const obsContent = (
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
      {count}
    </span>
  );
  const tooltip =
    count != null && count > 0 ? `${count} detection${count === 1 ? '' : 's'} recorded` : undefined;
  return {
    content: tooltip ? <Tooltip content={tooltip}>{obsContent}</Tooltip> : obsContent,
  };
};

const renderChannel = ({ value, row }: NetworkTableCellRendererContext) => {
  const channelValue = value as number | null;
  const networkType = row.type;
  if (networkType === 'W' && channelValue && channelValue !== 0) {
    const band = getChannelBand(channelValue, (row.frequency as number | null) ?? null);
    const tooltip = band ? `Channel ${channelValue} · ${band}` : `Channel ${channelValue}`;
    const channelContent = (
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
    );
    return {
      content: <Tooltip content={tooltip}>{channelContent}</Tooltip>,
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

// ---------------------------------------------------------------------------
// BSSID cell with click-to-copy
// ---------------------------------------------------------------------------

const ClipboardIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="5" y="1" width="8" height="10" rx="1.5" />
    <path d="M3 3H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="2,7 6,11 12,3" />
  </svg>
);

interface BssidCellProps {
  label: string;
  color: string;
}

const BssidCell: React.FC<BssidCellProps> = ({ label, color }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(label).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [label]
  );

  return (
    <div
      className="bssid-cell-group"
      style={{
        fontFamily: 'monospace',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        color,
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        position: 'relative',
      }}
    >
      <style>{`
        .bssid-cell-group .bssid-copy-btn { opacity: 0; transition: opacity 0.15s; }
        .bssid-cell-group:hover .bssid-copy-btn { opacity: 1; }
      `}</style>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>
        {label}
      </span>
      <button
        type="button"
        className="bssid-copy-btn"
        onClick={handleCopy}
        aria-label={copied ? 'Copied!' : `Copy ${label}`}
        title={copied ? 'Copied!' : 'Copy BSSID'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          padding: 0,
          border: 'none',
          borderRadius: '3px',
          background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
          color: copied ? '#4ade80' : 'rgba(255,255,255,0.45)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {copied ? <CheckIcon /> : <ClipboardIcon />}
      </button>
    </div>
  );
};

const renderBssid = ({
  value,
  row: _row,
  showSelectedAnchorLink: _showSelectedAnchorLink,
  isLinkedSibling: _isLinkedSibling,
}: NetworkTableCellRendererContext) => {
  const label = value == null ? '—' : String(value);
  const bssidContent = <BssidCell label={label} color={macColor(_row.bssid ?? '')} />;

  return {
    content: label === '—' ? bssidContent : <Tooltip content={label}>{bssidContent}</Tooltip>,
    title: label === '—' ? undefined : label,
  };
};

interface SsidCellProps {
  label: string;
  showSelectedAnchorLink: boolean;
  isLinkedSibling: boolean;
}

const SsidCell: React.FC<SsidCellProps> = ({ label, showSelectedAnchorLink, isLinkedSibling }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(label).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [label]
  );

  return (
    <div
      className="ssid-cell-group"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style>{`
        .ssid-cell-group .ssid-copy-btn { opacity: 0; transition: opacity 0.15s; }
        .ssid-cell-group:hover .ssid-copy-btn { opacity: 1; }
      `}</style>
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
        {label}
      </div>
      {(showSelectedAnchorLink || isLinkedSibling) && (
        <span
          title={showSelectedAnchorLink ? 'Selected sibling anchor' : 'Linked sibling'}
          style={{ color: '#38bdf8', flex: '0 0 auto' }}
        >
          🔗
        </span>
      )}
      <button
        type="button"
        className="ssid-copy-btn"
        onClick={handleCopy}
        aria-label={copied ? 'Copied!' : `Copy ${label}`}
        title={copied ? 'Copied!' : 'Copy SSID'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          padding: 0,
          border: 'none',
          borderRadius: '3px',
          background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
          color: copied ? '#4ade80' : 'rgba(255,255,255,0.45)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {copied ? <CheckIcon /> : <ClipboardIcon />}
      </button>
    </div>
  );
};

const renderSsid = ({
  value,
  row: _row,
  showSelectedAnchorLink: _showSelectedAnchorLink,
  isLinkedSibling: _isLinkedSibling,
}: NetworkTableCellRendererContext) => {
  const textContent =
    value == null || String(value).trim().length === 0 ? '(hidden)' : String(value);

  const ssidContent = (
    <SsidCell
      label={textContent}
      showSelectedAnchorLink={_showSelectedAnchorLink}
      isLinkedSibling={_isLinkedSibling}
    />
  );

  return {
    content: value ? <Tooltip content={String(value)}>{ssidContent}</Tooltip> : ssidContent,
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

const renderDeviceClass = ({ value, row }: NetworkTableCellRendererContext) => {
  const raw = normalizeDeviceClass(typeof value === 'string' ? value : null);
  if (!raw) return { content: <span style={{ color: '#475569' }}>—</span> };

  const label = formatDeviceType(raw);
  const hasIntel = hasVendorIntelForDeviceClass(raw);
  const isPrivateOui = raw === 'PRIVATE_OUI_REGISTERED';

  // Route 1: manifest entry exists → Intel drawer
  // Route 2: operational detection (no manifest, not private) → Evidence modal
  // Route 3: private/unknown OUI → explanatory tooltip chip, no button
  let action: React.ReactNode = null;

  if (hasIntel && !isPrivateOui) {
    action = (
      <button
        aria-label={`Open vendor intel for ${label}`}
        title="Open Vendor Intel"
        onClick={(e) => {
          e.stopPropagation();
          emitVendorIntel(raw);
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 3px',
          fontSize: 10,
          lineHeight: 1,
          color: '#f97316',
          flexShrink: 0,
        }}
      >
        Intel
      </button>
    );
  } else if (!isPrivateOui) {
    action = (
      <button
        aria-label={`View detection evidence for ${label}`}
        title="View Detection Evidence"
        onClick={(e) => {
          e.stopPropagation();
          emitDetectionEvidence(row.bssid, row.ssid);
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 3px',
          fontSize: 10,
          lineHeight: 1,
          color: '#60a5fa',
          flexShrink: 0,
        }}
      >
        Evidence
      </button>
    );
  } else {
    // Private OUI — no actionable button; tooltip on the label explains
    action = (
      <span
        title="Privately registered OUI — vendor identity not publicly attributed"
        style={{
          fontSize: 9,
          color: '#6b7280',
          flexShrink: 0,
          cursor: 'default',
          paddingLeft: 3,
        }}
      >
        ?
      </span>
    );
  }

  return {
    content: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={raw}
        >
          {label}
        </span>
        {action}
      </span>
    ),
    title: raw,
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
  device_class: renderDeviceClass,
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

function getBadgeCellValue(context: NetworkTableCellRendererContext): unknown {
  if (context.column === 'threat') {
    return context.row.threat?.level ?? context.row.threat_level ?? context.value;
  }
  return context.value;
}

export const renderNetworkTableCell = (
  context: NetworkTableCellRendererContext,
  badgeConfigs?: Record<string, ColumnBadgeConfig>
): NetworkTableCellRendererResult => {
  const badgeCfg = badgeConfigs?.[context.column];
  if (badgeCfg?.enabled) {
    return {
      content: (
        <BadgeRenderer value={getBadgeCellValue(context)} config={badgeCfg} row={context.row} />
      ),
    };
  }

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
