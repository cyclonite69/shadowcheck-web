import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { NetworkRow, NetworkTag } from '../../types/network';

interface NetworkTagMenuProps {
  visible: boolean;
  network: NetworkRow | null;
  tag: NetworkTag | null;
  position: 'below' | 'above';
  x: number;
  y: number;
  tagLoading: boolean;
  contextMenuRef: React.RefObject<HTMLDivElement>;
  onTagAction: (action: string) => void;
  onTimeFrequency: () => void;
  onAddNote: () => void;
}

export const NetworkTagMenu = ({
  visible,
  network,
  tag,
  position,
  x,
  y,
  tagLoading,
  contextMenuRef,
  onTagAction,
  onTimeFrequency,
  onAddNote,
}: NetworkTagMenuProps) => {
  const { isAdmin } = useAuth();
  if (!visible || !network) return null;

  return (
    <div
      ref={contextMenuRef}
      style={{
        position: 'fixed',
        top: position === 'below' ? y : 'auto',
        bottom: position === 'above' ? window.innerHeight - y : 'auto',
        left: x,
        zIndex: 10000,
        background: '#1e293b',
        border: '1px solid #475569',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        minWidth: '200px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #475569',
          background: '#334155',
        }}
      >
        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
          {network.ssid || '<Hidden>'}
        </div>
        <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
          {network.bssid}
        </div>
      </div>

      {/* Current Status */}
      {tag?.exists && (
        <div
          style={{
            padding: '6px 12px',
            borderBottom: '1px solid #475569',
            background: '#334155',
            fontSize: '10px',
          }}
        >
          {tag.is_ignored && (
            <span style={{ color: '#94a3b8', marginRight: '8px' }}>✓ Ignored</span>
          )}
          {tag.threat_tag && (
            <span
              style={{
                color:
                  tag.threat_tag === 'THREAT'
                    ? '#ef4444'
                    : tag.threat_tag === 'SUSPECT'
                      ? '#f59e0b'
                      : tag.threat_tag === 'FALSE_POSITIVE'
                        ? '#22c55e'
                        : tag.threat_tag === 'INVESTIGATE'
                          ? '#3b82f6'
                          : '#94a3b8',
              }}
            >
              {tag.threat_tag}
            </span>
          )}
        </div>
      )}

      {/* Menu Items */}
      <div style={{ padding: '4px 0' }}>
        {isAdmin && (
          <>
            {/* Ignore/Unignore Toggle */}
            <button
              onClick={() => onTagAction('ignore')}
              disabled={tagLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: '#e2e8f0',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {tag?.is_ignored ? '👁️ Unignore (Show)' : '👁️‍🗨️ Ignore (Known/Friendly)'}
            </button>

            <div style={{ height: '1px', background: '#475569', margin: '4px 0' }} />

            {/* Threat Classification */}
            <button
              onClick={() => onTagAction('threat')}
              disabled={tagLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background: tag?.threat_tag === 'THREAT' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                border: 'none',
                color: '#ef4444',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  tag?.threat_tag === 'THREAT' ? 'rgba(239, 68, 68, 0.2)' : 'transparent')
              }
            >
              ⚠️ Mark as Threat
            </button>

            <button
              onClick={() => onTagAction('suspect')}
              disabled={tagLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background:
                  tag?.threat_tag === 'SUSPECT' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                border: 'none',
                color: '#f59e0b',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  tag?.threat_tag === 'SUSPECT' ? 'rgba(245, 158, 11, 0.2)' : 'transparent')
              }
            >
              🔶 Mark as Suspect
            </button>

            <button
              onClick={() => onTagAction('false_positive')}
              disabled={tagLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background:
                  tag?.threat_tag === 'FALSE_POSITIVE' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                border: 'none',
                color: '#22c55e',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34, 197, 94, 0.3)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  tag?.threat_tag === 'FALSE_POSITIVE' ? 'rgba(34, 197, 94, 0.2)' : 'transparent')
              }
            >
              ✓ Mark as False Positive
            </button>

            <div style={{ height: '1px', background: '#475569', margin: '4px 0' }} />

            {/* WiGLE Investigation */}
            <button
              onClick={() => onTagAction('investigate')}
              disabled={tagLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background:
                  tag?.threat_tag === 'INVESTIGATE' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: 'none',
                color: '#3b82f6',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  tag?.threat_tag === 'INVESTIGATE' ? 'rgba(59, 130, 246, 0.2)' : 'transparent')
              }
            >
              🔍 Investigate (WiGLE Lookup)
            </button>

            {/* Clear Tags */}
            {tag?.exists && (
              <>
                <div style={{ height: '1px', background: '#475569', margin: '4px 0' }} />
                <button
                  onClick={() => onTagAction('clear')}
                  disabled={tagLoading}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  🗑️ Clear All Tags
                </button>
              </>
            )}
            <div style={{ height: '1px', background: '#475569', margin: '4px 0' }} />
          </>
        )}

        {/* View Actions */}
        <button
          onClick={onTimeFrequency}
          style={{
            display: 'block',
            width: '100%',
            padding: '8px 12px',
            background: 'transparent',
            border: 'none',
            color: '#06b6d4',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          📡 Time-Frequency Grid
        </button>

        {isAdmin && (
          <button
            onClick={onAddNote}
            disabled={tagLoading}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              color: '#a78bfa',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            📝 Add Note
          </button>
        )}
      </div>

      {/* Loading Indicator */}
      {tagLoading && (
        <div
          style={{
            padding: '8px 12px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '11px',
          }}
        >
          Saving...
        </div>
      )}
    </div>
  );
};
