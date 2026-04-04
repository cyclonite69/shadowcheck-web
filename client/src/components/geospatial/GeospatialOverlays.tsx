import React from 'react';
import type { NetworkRow, NetworkTag } from '../../types/network';
import type { NoteMediaItem } from '../../api/networkApi';
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
  showNoteModal: boolean;
  isEditNoteMode: boolean;
  selectedBssid: string;
  noteType: string;
  noteContent: string;
  noteAttachments: File[];
  existingNoteMedia: NoteMediaItem[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onNoteTypeChange: (value: string) => void;
  onNoteContentChange: (value: string) => void;
  onAddAttachment: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (index: number) => void;
  onOpenExistingMedia: (mediaId: number) => void;
  onDeleteExistingMedia: (mediaId: number) => void;
  onCloseNoteOverlay: () => void;
  onCloseNote: () => void;
  onCancelNote: () => void;
  onDeleteNote: () => void;
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
  hasExistingNote,
  onGenerateThreatReport,
  onMapWigleObservations,
  wigleObservationsLoading,
  manualSiblingTarget,
  onMarkSiblingPair,
  siblingPairLoading,
  showNoteModal,
  isEditNoteMode,
  selectedBssid,
  noteType,
  noteContent,
  noteAttachments,
  existingNoteMedia,
  fileInputRef,
  onNoteTypeChange,
  onNoteContentChange,
  onAddAttachment,
  onRemoveAttachment,
  onOpenExistingMedia,
  onDeleteExistingMedia,
  onCloseNoteOverlay,
  onCloseNote,
  onCancelNote,
  onDeleteNote,
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
        hasExistingNote={hasExistingNote}
        onGenerateThreatReport={onGenerateThreatReport}
        onMapWigleObservations={onMapWigleObservations}
        wigleObservationsLoading={wigleObservationsLoading}
        manualSiblingTarget={manualSiblingTarget}
        onMarkSiblingPair={onMarkSiblingPair}
        siblingPairLoading={siblingPairLoading}
      />

      <NetworkNoteModal
        open={showNoteModal}
        isEditMode={isEditNoteMode}
        selectedBssid={selectedBssid}
        noteType={noteType}
        noteContent={noteContent}
        noteAttachments={noteAttachments}
        existingNoteMedia={existingNoteMedia}
        fileInputRef={fileInputRef}
        onNoteTypeChange={onNoteTypeChange}
        onNoteContentChange={onNoteContentChange}
        onAddAttachment={onAddAttachment}
        onRemoveAttachment={onRemoveAttachment}
        onOpenExistingMedia={onOpenExistingMedia}
        onDeleteExistingMedia={onDeleteExistingMedia}
        onOverlayClose={onCloseNoteOverlay}
        onCloseButton={onCloseNote}
        onCancel={onCancelNote}
        onDeleteNote={onDeleteNote}
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
