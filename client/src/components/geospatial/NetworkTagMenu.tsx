import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { NetworkRow, NetworkTag } from '../../types/network';
import { NetworkTagMenuAdminActions } from './networkTagMenu/NetworkTagMenuAdminActions';
import { NetworkTagMenuHeader } from './networkTagMenu/NetworkTagMenuHeader';
import { NetworkTagMenuLoading } from './networkTagMenu/NetworkTagMenuLoading';
import { NetworkTagMenuStatus } from './networkTagMenu/NetworkTagMenuStatus';
import { NetworkTagMenuViewActions } from './networkTagMenu/NetworkTagMenuViewActions';

interface NetworkTagMenuProps {
  visible: boolean;
  network: NetworkRow | null;
  tag: NetworkTag | null;
  position: 'below' | 'above';
  x: number;
  y: number;
  tagLoading: boolean;
  contextMenuRef: React.RefObject<HTMLDivElement>;
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
  hasExistingNote,
  onGenerateThreatReport,
  onMapWigleObservations,
  wigleObservationsLoading,
  manualSiblingTarget,
  onMarkSiblingPair,
  siblingPairLoading,
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
    </div>
  );
};
