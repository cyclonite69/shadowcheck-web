import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { useNetworkNotes } from '../hooks/useNetworkNotes';
import { networkApi } from '../api/networkApi';
import { NetworkContextMenuTable } from './contextMenu/NetworkContextMenuTable';
import { NetworkContextMenuMenu } from './contextMenu/NetworkContextMenuMenu';
import { NetworkContextNoteModal } from './contextMenu/NetworkContextNoteModal';
import { NetworkContextNotes } from './contextMenu/NetworkContextNotes';
import type { NetworkContextMenuProps, ContextMenuState, NotesByBssid } from './contextMenu/types';

export default function NetworkContextMenu({ networks = [] }: NetworkContextMenuProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectedBSSID, setSelectedBSSID] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { notes, addNote, deleteNote } = useNetworkNotes();

  // Handle right-click
  const handleRightClick = (e: MouseEvent<HTMLTableRowElement>, bssid: string) => {
    e.preventDefault();
    setSelectedBSSID(bssid);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Close menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Save note to database
  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedBSSID) return;

    try {
      const success = await addNote(
        selectedBSSID,
        noteText,
        noteType,
        'default_user',
        attachedFiles
      );

      if (success) {
        setNoteText('');
        setNoteType('general');
        setAttachedFiles([]);
        setShowNoteModal(false);
      }
    } catch (err) {
      console.error('Error saving note:', err);
    }
  };

  // Handle file attachment
  const handleFileAttach = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachedFiles((prev) => [...prev, ...files]);
  };

  // Remove attachment
  const removeAttachment = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Apply a threat tag classification
  const handleTagNetwork = async (tag: 'threat' | 'investigate' | 'false_positive' | 'ignore') => {
    if (!selectedBSSID) return;
    try {
      if (tag === 'threat') await networkApi.tagNetworkAsThreat(selectedBSSID, 'THREAT', 1.0);
      else if (tag === 'investigate') await networkApi.investigateNetwork(selectedBSSID);
      else if (tag === 'false_positive') await networkApi.falsePositiveNetwork(selectedBSSID);
      else if (tag === 'ignore') await networkApi.ignoreNetwork(selectedBSSID);
    } catch (err) {
      console.error('Error tagging network:', err);
    }
    setContextMenu(null);
  };

  // Delete note
  const handleDeleteNote = async (bssid: string, noteId: number | string) => {
    try {
      await deleteNote(bssid, noteId as number);
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const selectedNotes = selectedBSSID ? notes[selectedBSSID] : undefined;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Network Threat Analysis</h1>

      {/* Network Table */}
      <NetworkContextMenuTable networks={networks} notes={notes} onContextMenu={handleRightClick} />

      {/* Context Menu */}
      {contextMenu && (
        <NetworkContextMenuMenu
          contextMenu={contextMenu}
          onTagNetwork={handleTagNetwork}
          onAddNoteClick={() => {
            setShowNoteModal(true);
            setContextMenu(null);
          }}
          onAttachMedia={() => {
            fileInputRef.current?.click();
            setContextMenu(null);
          }}
          onCloseMenu={() => setContextMenu(null)}
        />
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <NetworkContextNoteModal
          selectedBSSID={selectedBSSID}
          noteText={noteText}
          onNoteTextChange={(value) => setNoteText(value)}
          noteType={noteType}
          onNoteTypeChange={(value) => setNoteType(value)}
          attachedFiles={attachedFiles}
          fileInputRef={fileInputRef}
          onFileAttach={handleFileAttach}
          onRemoveAttachment={removeAttachment}
          onClose={() => {
            setShowNoteModal(false);
            setNoteText('');
            setAttachedFiles([]);
          }}
          onSave={handleAddNote}
        />
      )}

      {/* Notes Display */}
      {selectedBSSID && selectedNotes && selectedNotes.length > 0 && (
        <NetworkContextNotes
          selectedBSSID={selectedBSSID}
          notes={selectedNotes}
          onDeleteNote={handleDeleteNote}
        />
      )}
    </div>
  );
}
