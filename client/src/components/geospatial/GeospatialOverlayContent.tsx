import React from 'react';
import { GeospatialOverlays } from './GeospatialOverlays';
import { WigleLookupDialog } from './WigleLookupDialog';
import { WigleObservationsPanel } from './WigleObservationsPanel';
import { NearestAgenciesPanel } from './NearestAgenciesPanel';

interface GeospatialOverlayContentProps {
  state: any;
  contextMenu: any;
  tagLoading: boolean;
  contextMenuRef: React.RefObject<HTMLDivElement | null>;
  handleTagAction: (action: string) => void;
  closeContextMenu: () => void;
  openTimeFrequency: (params: { bssid: string; ssid: string }) => void;
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
  noteType: string;
  noteContent: string;
  noteAttachments: any[];
  existingNoteMedia: any[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setNoteType: (type: string) => void;
  setNoteContent: (content: string) => void;
  handleAddAttachment: (files: FileList | null) => void;
  removeAttachment: (index: number) => void;
  resetNoteState: () => void;
  handleSaveNote: () => void;
  handleDeleteNote: () => void;
  handleDeleteExistingMedia: (mediaId: number) => void;
  openExistingMedia: (mediaId: number) => void;
  closeTimeFrequency: () => void;
  wigleLookupDialog: any;
  handleWigleLookup: (bssid: string) => void;
  closeWigleLookupDialog: () => void;
  clearWigleObservations: () => void;
  agencies: any[];
  agenciesLoading: boolean;
  agenciesError: any;
}

const GeospatialOverlayContentComponent: React.FC<GeospatialOverlayContentProps> = ({
  state,
  contextMenu,
  tagLoading,
  contextMenuRef,
  handleTagAction,
  closeContextMenu,
  openTimeFrequency,
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
  agencies,
  agenciesLoading,
  agenciesError,
}) => (
  <>
    <GeospatialOverlays
      contextMenu={contextMenu}
      tagLoading={tagLoading}
      contextMenuRef={contextMenuRef}
      onTagAction={handleTagAction}
      onCloseContextMenu={closeContextMenu}
      onOpenTimeFrequency={() => {
        const n = contextMenu.network;
        if (n) openTimeFrequency({ bssid: String(n.bssid || ''), ssid: String(n.ssid || '') });
        closeContextMenu();
      }}
      onOpenNote={() => {
        void openNoteModalForBssid(contextMenu.network?.bssid || '');
        closeContextMenu();
      }}
      hasExistingNote={contextMenu.hasExistingNote}
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
      showNoteModal={showNoteModal}
      isEditNoteMode={contextMenu.hasExistingNote}
      selectedBssid={selectedBssid}
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
      onCloseNoteOverlay={() => setShowNoteModal(false)}
      onCloseNote={resetNoteState}
      onCancelNote={resetNoteState}
      onDeleteNote={handleDeleteNote}
      onSaveNote={handleSaveNote}
      timeFreqModal={state.timeFreqModal}
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
    {state.showAgenciesPanel && (
      <NearestAgenciesPanel
        agencies={agencies}
        loading={agenciesLoading}
        error={agenciesError}
        networkCount={selectedNetworks.size}
      />
    )}
  </>
);

export const GeospatialOverlayContent = React.memo(GeospatialOverlayContentComponent);
