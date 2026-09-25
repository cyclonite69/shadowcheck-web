/**
 * MapRadiusContextMenu
 *
 * Small context menu shown on empty-space right-click on the map.
 * Portaled to document.body, same pattern as NetworkTagMenu.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { RadiusContextMenuState } from './hooks/useRadiusPinDrop';
import { useCurrentEnabled } from '../../stores/filterStore';

interface MapRadiusContextMenuProps {
  menu: RadiusContextMenuState;
  onSetCenter: () => void;
  onClear: () => void;
  onClose: () => void;
}

export const MapRadiusContextMenu: React.FC<MapRadiusContextMenuProps> = ({
  menu,
  onSetCenter,
  onClear,
  onClose,
}) => {
  const enabled = useCurrentEnabled();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu.visible) {
      return;
    }
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu.visible, onClose]);

  if (!menu.visible || typeof document === 'undefined') {
    return null;
  }

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '7px 14px',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    color: '#e2e8f0',
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: menu.y,
        left: menu.x,
        zIndex: 10000,
        background: '#1e293b',
        border: '1px solid #475569',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        minWidth: '200px',
        padding: '4px 0',
      }}
    >
      <div style={{ padding: '4px 14px 6px', borderBottom: '1px solid #334155' }}>
        <div
          style={{
            fontSize: '11px',
            color: '#64748b',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Map Location
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: 2 }}>
          {menu.lat.toFixed(5)}, {menu.lng.toFixed(5)}
        </div>
      </div>

      <button
        style={itemStyle}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#334155')}
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
        }
        onClick={onSetCenter}
      >
        📍 Set as radius filter center
      </button>

      {enabled.radiusFilter && (
        <button
          style={{ ...itemStyle, color: '#94a3b8' }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = '#334155')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
          }
          onClick={onClear}
        >
          ✕ Clear radius filter
        </button>
      )}
    </div>,
    document.body
  );
};
