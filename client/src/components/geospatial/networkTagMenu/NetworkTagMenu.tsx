import React, { useLayoutEffect, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../hooks/useAuth';
import type { NetworkRow, NetworkTag } from '../../../types/network';
import { NetworkTagMenuAdminActions } from './NetworkTagMenuAdminActions';
import { NetworkTagMenuHeader } from './NetworkTagMenuHeader';
import { NetworkTagMenuLoading } from './NetworkTagMenuLoading';
import { NetworkTagMenuStatus } from './NetworkTagMenuStatus';
import { NetworkTagMenuViewActions } from './NetworkTagMenuViewActions';

interface NetworkTagMenuProps {
  visible: boolean;
  network: NetworkRow | null;
  tag: NetworkTag | null;
  position: 'below' | 'above';
  x: number;
  y: number;
  tagLoading: boolean;
  contextMenuRef: React.RefObject<HTMLDivElement | null>;
  onTagAction: (
    action: 'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear',
    notes?: string
  ) => void;
  onTimeFrequency: () => void;
  onAddNote: () => void;
  hasExistingNote: boolean;
  onGenerateThreatReport: () => void;
  onMapWigleObservations?: () => void;
  wigleObservationsLoading?: boolean;
  manualSiblingTarget?: {
    bssid: string;
    ssid?: string | null;
    isLinked?: boolean;
  } | null;
  onMarkSiblingPair?: () => void;
  siblingPairLoading?: boolean;
  onClose?: () => void;
}

export const NetworkTagMenu = ({
  visible,
  network,
  tag,
  position: _position,
  x,
  y,
  tagLoading,
  contextMenuRef,
  onTagAction,
  onTimeFrequency,
  onAddNote,
  hasExistingNote,
  onGenerateThreatReport,
  onMapWigleObservations,
  wigleObservationsLoading,
  manualSiblingTarget,
  onMarkSiblingPair,
  siblingPairLoading,
  onClose,
}: NetworkTagMenuProps) => {
  const { isAdmin } = useAuth();
  const [menuSize, setMenuSize] = useState({ width: 200, height: 0 });

  useLayoutEffect(() => {
    if (!visible || !contextMenuRef.current) return;

    setMenuSize({
      width: contextMenuRef.current.offsetWidth || 200,
      height: contextMenuRef.current.offsetHeight || 0,
    });
  }, [
    visible,
    contextMenuRef,
    network,
    tagLoading,
    wigleObservationsLoading,
    manualSiblingTarget,
    siblingPairLoading,
    hasExistingNote,
    isAdmin,
  ]);

  useEffect(() => {
    if (!visible || !onClose) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose, contextMenuRef]);

  if (!visible || !network || typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  const maxX = Math.max(8, window.innerWidth - menuSize.width - 8);
  const maxY = Math.max(8, window.innerHeight - menuSize.height - 8);
  const clampedX = Math.min(Math.max(8, x), maxX);
  const clampedY = Math.min(Math.max(8, y), maxY);

  return createPortal(
    <div
      ref={contextMenuRef}
      style={{
        position: 'fixed',
        top: clampedY,
        left: clampedX,
        zIndex: 10000,
        background: '#1e293b',
        border: '1px solid #475569',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        minWidth: '200px',
        maxHeight: 'calc(100vh - 20px)',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      <NetworkTagMenuHeader network={network} />
      <NetworkTagMenuStatus tag={tag} />
      <div style={{ padding: '4px 0' }}>
        {isAdmin && (
          <NetworkTagMenuAdminActions
            tag={tag}
            tagLoading={tagLoading}
            onTagAction={onTagAction}
            manualSiblingTarget={manualSiblingTarget}
            onMarkSiblingPair={onMarkSiblingPair}
            siblingPairLoading={siblingPairLoading}
          />
        )}
        <NetworkTagMenuViewActions
          onGenerateThreatReport={onGenerateThreatReport}
          onTimeFrequency={onTimeFrequency}
          onMapWigleObservations={onMapWigleObservations}
          wigleObservationsLoading={wigleObservationsLoading}
          onAddNote={onAddNote}
          hasExistingNote={hasExistingNote}
          isAdmin={isAdmin}
          tagLoading={tagLoading}
        />
      </div>
      {tagLoading && <NetworkTagMenuLoading />}
    </div>,
    document.body
  );
};
