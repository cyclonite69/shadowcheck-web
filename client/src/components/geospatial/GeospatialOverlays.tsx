import React from 'react';
import type { NetworkRow, NetworkTag } from '../../types/network';
import NetworkTimeFrequencyModal from '../modals/NetworkTimeFrequencyModal';
import { NetworkNoteModal } from './NetworkNoteModal';
import { NetworkTagMenu } from './NetworkTagMenu';

interface GeospatialOverlaysProps {
  contextMenu: {
    visible: boolean;
    network: NetworkRow | null;
    tag: NetworkTag | null;
    position?: 'below' | 'above';
    x: number;
    y: number;
  };
  tagLoading: boolean;
  contextMenuRef: React.RefObject<HTMLDivElement>;
  onTagAction: (
    action: 'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear'
  ) => Promise<void>;
  onCloseContextMenu: () => void;
  onOpenTimeFrequency: () => void;
  onOpenNote: () => void;
  onMapWigleObservations?: () => void;
  wigleObservationsLoading?: boolean;
  showNoteModal: boolean;
  selectedBssid: string;
  noteType: string;
  noteContent: string;
  noteAttachments: File[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onNoteTypeChange: (value: string) => void;
  onNoteContentChange: (value: string) => void;
  onAddAttachment: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (index: number) => void;
  onCloseNoteOverlay: () => void;
  onCloseNote: () => void;
  onCancelNote: () => void;
  onSaveNote: () => void;
  timeFreqModal: { bssid: string; ssid: string } | null;
  onCloseTimeFrequency: () => void;
}

export const GeospatialOverlays = ({
  contextMenu,
  tagLoading,
  contextMenuRef,
  onTagAction,
  onOpenTimeFrequency,
  onOpenNote,
  onMapWigleObservations,
  wigleObservationsLoading,
  showNoteModal,
  selectedBssid,
  noteType,
  noteContent,
  noteAttachments,
  fileInputRef,
  onNoteTypeChange,
  onNoteContentChange,
  onAddAttachment,
  onRemoveAttachment,
  onCloseNoteOverlay,
  onCloseNote,
  onCancelNote,
  onSaveNote,
  timeFreqModal,
  onCloseTimeFrequency,
}: GeospatialOverlaysProps) => {
  return (
    <>
      <NetworkTagMenu
        visible={contextMenu.visible}
        network={contextMenu.network}
        tag={contextMenu.tag}
        position={contextMenu.position || 'below'}
        x={contextMenu.x}
        y={contextMenu.y}
        tagLoading={tagLoading}
        contextMenuRef={contextMenuRef}
        onTagAction={onTagAction}
        onTimeFrequency={onOpenTimeFrequency}
        onAddNote={onOpenNote}
        onMapWigleObservations={onMapWigleObservations}
        wigleObservationsLoading={wigleObservationsLoading}
      />

      <NetworkNoteModal
        open={showNoteModal}
        selectedBssid={selectedBssid}
        noteType={noteType}
        noteContent={noteContent}
        noteAttachments={noteAttachments}
        fileInputRef={fileInputRef}
        onNoteTypeChange={onNoteTypeChange}
        onNoteContentChange={onNoteContentChange}
        onAddAttachment={onAddAttachment}
        onRemoveAttachment={onRemoveAttachment}
        onOverlayClose={onCloseNoteOverlay}
        onCloseButton={onCloseNote}
        onCancel={onCancelNote}
        onSave={onSaveNote}
      />

      {timeFreqModal && (
        <NetworkTimeFrequencyModal
          bssid={timeFreqModal.bssid}
          ssid={timeFreqModal.ssid}
          onClose={onCloseTimeFrequency}
        />
      )}
    </>
  );
};
