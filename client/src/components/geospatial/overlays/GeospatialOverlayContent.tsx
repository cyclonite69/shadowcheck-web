import React, { useState, useCallback } from 'react';
import { GeospatialOverlays } from './GeospatialOverlays';
import { WigleLookupDialog } from '../modals/WigleLookupDialog';
import { BatchWigleLookupDialog } from '../modals/BatchWigleLookupDialog';
import { WigleObservationsPanel } from '../panels/WigleObservationsPanel';

interface GeospatialOverlayContentProps {
  state: any;
  contextMenu: any;
  tagLoading: boolean;
  contextMenuRef: React.RefObject<HTMLDivElement | null>;
  handleTagAction: (
    action:
      'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear' | 'clear-threat'
  ) => Promise<void>;
  closeContextMenu: () => void;
  openTimeFrequency: (params: { bssid: string; ssid: string }) => void;
  timeFreqModal: { bssid: string; ssid: string } | null;
  openNoteModalForBssid: (bssid: string) => void;
  handleGenerateThreatReportPdf: () => void;
  toggleWigleForBssids: (bssids: string[]) => void;
  wigleObservations: any;
  selectedNetworks: Set<string>;
  manualSiblingTarget: any;
  handleMarkSiblingPair: () => void;
  siblingPairLoading: boolean;
  showNoteModal: boolean;
  setShowNoteModal: (show: boolean) => void;
  selectedBssid: string;
  hasExistingNote: boolean;
  noteSaving: boolean;
  noteDeleting: boolean;
  noteError: string | null;
  clearNoteError: () => void;
  noteType: string;
  noteContent: string;
  noteAttachments: any[];
  existingNoteMedia: any[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setNoteType: (type: string) => void;
  setNoteContent: (content: string) => void;
  handleAddAttachment: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeAttachment: (index: number) => void;
  resetNoteState: () => void;
  handleSaveNote: () => void;
  handleDeleteNote: () => void;
  handleDeleteExistingMedia: (mediaId: number) => void;
  openExistingMedia: (mediaId: number) => void;
  closeTimeFrequency: () => void;
  wigleLookupDialog: any;
  handleWigleLookup: (withLookup: boolean) => void;
  closeWigleLookupDialog: () => void;
  clearWigleObservations: () => void;
}

const GeospatialOverlayContentComponent: React.FC<GeospatialOverlayContentProps> = ({
  state: _state,
  contextMenu,
  tagLoading,
  contextMenuRef,
  handleTagAction,
  closeContextMenu,
  openTimeFrequency,
  timeFreqModal,
  openNoteModalForBssid,
  handleGenerateThreatReportPdf,
  toggleWigleForBssids,
  wigleObservations,
  selectedNetworks,
  manualSiblingTarget,
  handleMarkSiblingPair,
  siblingPairLoading,
  showNoteModal,
  setShowNoteModal,
  selectedBssid,
  hasExistingNote,
  noteSaving,
  noteDeleting,
  noteError,
  clearNoteError,
  noteType,
  noteContent,
  noteAttachments,
  existingNoteMedia,
  fileInputRef,
  setNoteType,
  setNoteContent,
  handleAddAttachment,
  removeAttachment,
  resetNoteState,
  handleSaveNote,
  handleDeleteNote,
  handleDeleteExistingMedia,
  openExistingMedia,
  closeTimeFrequency,
  wigleLookupDialog,
  handleWigleLookup,
  closeWigleLookupDialog,
  clearWigleObservations,
}) => {
  const [batchDialogBssids, setBatchDialogBssids] = useState<string[]>([]);

  const handleBatchInvestigate = useCallback(() => {
    setBatchDialogBssids(Array.from(selectedNetworks));
    closeContextMenu();
  }, [selectedNetworks, closeContextMenu]);

  const handleBatchComplete = useCallback(() => {
    toggleWigleForBssids(batchDialogBssids);
  }, [batchDialogBssids, toggleWigleForBssids]);

  return (
    <>
      <GeospatialOverlays
        contextMenu={contextMenu}
        tagLoading={tagLoading}
        contextMenuRef={contextMenuRef}
        onTagAction={handleTagAction}
        onCloseContextMenu={closeContextMenu}
        onOpenTimeFrequency={() => {
          const n = contextMenu.network;
          if (n) {
            openTimeFrequency({
              bssid: String(n.bssid || ''),
              ssid: String(n.ssid || ''),
            });
          }
          closeContextMenu();
        }}
        onOpenNote={() => {
          const bssid = contextMenu.network?.bssid || '';
          closeContextMenu();
          void openNoteModalForBssid(bssid);
        }}
        hasExistingNote={hasExistingNote && selectedBssid === contextMenu.network?.bssid}
        onGenerateThreatReport={handleGenerateThreatReportPdf}
        onMapWigleObservations={() => {
          const selectedBssids = Array.from(selectedNetworks);
          const contextBssid = contextMenu.network?.bssid;
          const targetBssids =
            contextBssid && selectedBssids.includes(contextBssid)
              ? selectedBssids
              : contextBssid
                ? [contextBssid]
                : selectedBssids;
          toggleWigleForBssids(targetBssids);
          closeContextMenu();
        }}
        wigleObservationsLoading={wigleObservations.loading}
        manualSiblingTarget={manualSiblingTarget}
        onMarkSiblingPair={handleMarkSiblingPair}
        siblingPairLoading={siblingPairLoading}
        selectedCount={selectedNetworks.size}
        onBatchInvestigate={handleBatchInvestigate}
        showNoteModal={showNoteModal}
        isEditNoteMode={hasExistingNote}
        selectedBssid={selectedBssid}
        noteSaving={noteSaving}
        noteDeleting={noteDeleting}
        noteError={noteError}
        noteType={noteType}
        noteContent={noteContent}
        noteAttachments={noteAttachments}
        existingNoteMedia={existingNoteMedia}
        fileInputRef={fileInputRef}
        onNoteTypeChange={setNoteType}
        onNoteContentChange={setNoteContent}
        onAddAttachment={handleAddAttachment}
        onRemoveAttachment={removeAttachment}
        onOpenExistingMedia={openExistingMedia}
        onDeleteExistingMedia={handleDeleteExistingMedia}
        onCloseNoteOverlay={() => {
          clearNoteError();
          setShowNoteModal(false);
        }}
        onCloseNote={resetNoteState}
        onCancelNote={resetNoteState}
        onDeleteNote={handleDeleteNote}
        onSaveNote={handleSaveNote}
        timeFreqModal={timeFreqModal}
        onCloseTimeFrequency={closeTimeFrequency}
      />
      <WigleLookupDialog
        visible={wigleLookupDialog.visible}
        network={wigleLookupDialog.network}
        loading={wigleLookupDialog.loading}
        result={wigleLookupDialog.result}
        onLookup={handleWigleLookup}
        onClose={closeWigleLookupDialog}
      />
      <WigleObservationsPanel
        bssid={wigleObservations.bssid}
        bssids={wigleObservations.bssids}
        loading={wigleObservations.loading}
        error={wigleObservations.error}
        stats={wigleObservations.stats}
        batchStats={wigleObservations.batchStats}
        onClose={clearWigleObservations}
      />
      <BatchWigleLookupDialog
        visible={batchDialogBssids.length > 0}
        bssids={batchDialogBssids}
        onComplete={handleBatchComplete}
        onClose={() => setBatchDialogBssids([])}
      />
    </>
  );
};

export const GeospatialOverlayContent = React.memo(GeospatialOverlayContentComponent);
