import React from 'react';
import type { NetworkRow } from '../../types/network';
import { NETWORK_COLUMNS } from '../../constants/network';
import { macColor } from '../../utils/mapHelpers';
import { TypeBadge, ThreatBadge } from '../badges';

interface NetworkTableRowProps {
  net: NetworkRow;
  index: number;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  isSelected: boolean;
  onSelectExclusive: (bssid: string) => void;
  onOpenContextMenu: (event: React.MouseEvent<HTMLTableRowElement>, net: NetworkRow) => void;
  onToggleSelectNetwork: (bssid: string) => void;
  style?: React.CSSProperties;
}

export const NetworkTableRow = ({
  net,
  index: _index,
  visibleColumns,
  isSelected,
  onSelectExclusive,
  onOpenContextMenu,
  onToggleSelectNetwork,
  style,
}: NetworkTableRowProps) => {
  return (
    <tr
      style={{
        ...style,
        borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
        background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        cursor: 'pointer',
      }}
      onClick={() => onSelectExclusive(net.bssid)}
      onContextMenu={(e) => onOpenContextMenu(e, net)}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = isSelected
          ? 'rgba(59, 130, 246, 0.15)'
          : 'rgba(71, 85, 105, 0.1)')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent')
      }
    >
      {visibleColumns.map((col) => {
        const column = NETWORK_COLUMNS[col as keyof typeof NETWORK_COLUMNS];
        // CRASH-PROOF: Skip unknown columns (stale localStorage keys)
        if (!column) return null;
        const value = net[col as keyof NetworkRow];
        let content: React.ReactNode =
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? (value as any)
            : value == null
              ? 'N/A'
              : '—';

        if (col === 'select') {
          const ssidOrHidden = net.ssid || '(hidden)';
          return (
            <td
              key={col}
              style={{
                width: column.width,
                minWidth: column.width,
                maxWidth: column.width,
                padding: '5px 8px',
                boxSizing: 'border-box',
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                aria-label={`Select row ${ssidOrHidden} ${net.bssid}`}
                title={`Select row ${ssidOrHidden} ${net.bssid}`}
                onChange={() => onToggleSelectNetwork(net.bssid)}
                style={{ cursor: 'pointer' }}
                onClick={(e) => e.stopPropagation()}
              />
            </td>
          );
        }
        if (col === 'type') {
          content = <TypeBadge type={(value as NetworkRow['type']) || '?'} />;
        } else if (col === 'threat') {
          content = (
            <ThreatBadge
              threat={net.threat || undefined}
              reasons={net.threatReasons}
              evidence={net.threatEvidence}
            />
          );
        } else if (col === 'signal') {
          const signalValue = value as number | null;
          let color = '#6b7280';
          if (signalValue != null && signalValue !== 0) {
            if (signalValue >= -50) color = '#10b981';
            else if (signalValue >= -70) color = '#f59e0b';
            else color = '#ef4444';
          }
          content = (
            <span style={{ color, fontWeight: 600 }}>
              {signalValue != null && signalValue !== 0 ? `${signalValue} dBm` : 'N/A'}
            </span>
          );
        } else if (col === 'observations') {
          content = (
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
          );
        } else if (col === 'is_sentinel') {
          // Boolean badge for sentinel flag
          const isSentinel = value as boolean | null;
          content = isSentinel ? (
            <span
              style={{
                background: 'rgba(234, 179, 8, 0.2)',
                color: '#facc15',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '500',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                display: 'inline-block',
              }}
            >
              YES
            </span>
          ) : null;
        } else if (col === 'timespanDays') {
          const days = value as number | null;
          if (days !== null && days >= 0) {
            content = (
              <span
                style={{
                  background:
                    days > 30
                      ? 'rgba(239, 68, 68, 0.2)'
                      : days > 7
                        ? 'rgba(251, 191, 36, 0.2)'
                        : 'rgba(34, 197, 94, 0.2)',
                  color: days > 30 ? '#f87171' : days > 7 ? '#fbbf24' : '#4ade80',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '500',
                  border: `1px solid ${days > 30 ? 'rgba(239, 68, 68, 0.3)' : days > 7 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                  display: 'inline-block',
                }}
              >
                {days === 0 ? 'Same day' : `${days} days`}
              </span>
            );
          } else {
            content = 'Not computed';
          }
        } else if (
          [
            'stationaryConfidence',
            'min_altitude_m',
            'max_altitude_m',
            'altitude_span_m',
            'max_distance_meters',
            'last_altitude_m',
          ].includes(col as string)
        ) {
          content = (value == null ? 'Not computed' : value) as React.ReactNode;
        } else if (col === 'channel') {
          // Only show channel for WiFi networks
          const channelValue = value as number | null;
          const networkType = net.type;
          if (networkType === 'W' && channelValue !== null && channelValue !== 0) {
            content = (
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
          } else {
            content = networkType === 'W' ? 'N/A' : '—'; // Show dash for non-WiFi
          }
        } else if (col === 'frequency') {
          // Show frequency for all network types, but format differently
          const freqValue = value as number | null;
          if (freqValue !== null && freqValue !== 0) {
            const isWiFi = net.type === 'W';
            content = (
              <span
                style={{
                  color: isWiFi ? '#10b981' : '#94a3b8',
                  fontWeight: isWiFi ? '600' : '400',
                }}
              >
                {freqValue} MHz
              </span>
            );
          } else {
            content = 'N/A';
          }
        } else if (col === 'stationaryConfidence') {
          const conf = value as number | null;
          content = conf !== null && conf !== undefined ? `${(conf * 100).toFixed(0)}%` : 'N/A';
        } else if (col === 'max_distance_meters') {
          // Format distance in meters or km
          const distValue = value as number | null;
          if (distValue != null) {
            content =
              distValue >= 1000
                ? `${(distValue / 1000).toFixed(2)} km`
                : `${distValue.toFixed(0)} m`;
          } else {
            content = 'N/A';
          }
        } else if (col === 'distanceFromHome') {
          const distValue = value as number | null;
          if (distValue !== null) {
            content = `${Math.round(distValue)} m`;
          } else {
            content = 'Not computed';
          }
        } else if (
          ['threat_rule_score', 'threat_ml_score', 'threat_ml_boost', 'threat_score'].includes(
            col as string
          )
        ) {
          const val = value as number | null;
          content = val !== null ? val.toFixed(1) : 'N/A';
        } else if (col === 'threat_ml_weight') {
          const val = value as number | null;
          content = val !== null ? `${(val * 100).toFixed(0)}%` : 'N/A';
        }

        return (
          <td
            key={col}
            style={{
              width: column.width,
              minWidth: column.width,
              maxWidth: column.width,
              padding: '5px 8px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              borderRight: '1px solid rgba(71, 85, 105, 0.1)',
              color: col === 'bssid' ? macColor(net.bssid) : '#f1f5f9',
              fontFamily: col === 'bssid' ? 'monospace' : 'inherit',
              fontSize: '11px',
              boxSizing: 'border-box',
            }}
          >
            {content}
          </td>
        );
      })}
    </tr>
  );
};
