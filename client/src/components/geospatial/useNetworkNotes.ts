import { useRef, useState } from 'react';
import { networkApi } from '../../api/networkApi';

type NetworkNotesProps = {
  logError: (message: string, error?: unknown) => void;
};

export const useNetworkNotes = ({ logError }: NetworkNotesProps) => {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedBssid, setSelectedBssid] = useState('');
  const [existingNoteId, setExistingNoteId] = useState<number | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [noteAttachments, setNoteAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteRequestBssidRef = useRef<string>('');

  const resetNoteState = () => {
    setShowNoteModal(false);
    setSelectedBssid('');
    setExistingNoteId(null);
    setNoteContent('');
    setNoteType('general');
    setNoteAttachments([]);
  };

  const openNoteModalForBssid = async (bssid: string) => {
    if (!bssid) return;

    noteRequestBssidRef.current = bssid;

    setSelectedBssid(bssid);
    setExistingNoteId(null);
    setNoteContent('');
    setNoteType('general');
    setNoteAttachments([]);
    setShowNoteModal(true);

    try {
      const notes = await networkApi.getNetworkNotes(bssid);
      if (noteRequestBssidRef.current !== bssid) return;
      const latest = notes[0];
      if (latest) {
        setExistingNoteId(Number(latest.id));
        setNoteContent(latest.content || '');
        setNoteType(latest.note_type || 'general');
      }
    } catch (err) {
      logError('Failed to load existing notes', err);
    }
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !selectedBssid) return;

    try {
      let noteId = existingNoteId;
      if (existingNoteId) {
        await networkApi.updateNetworkNote(selectedBssid, existingNoteId, noteContent);
      } else {
        const data = await networkApi.addNetworkNote({
          bssid: selectedBssid,
          content: noteContent,
          note_type: noteType,
          user_id: 'geospatial_user',
        });
        noteId = data.note_id;
      }

      // Upload attachments (new note or edit mode)
      if (noteAttachments.length > 0) {
        if (!noteId) {
          throw new Error('Unable to resolve note ID for media upload');
        }
        for (const file of noteAttachments) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('bssid', selectedBssid);

          try {
            await networkApi.addNoteMedia(noteId, formData);
          } catch {
            console.warn(`Failed to upload media: ${file.name}`);
          }
        }
      }

      resetNoteState();
    } catch (err) {
      logError('Failed to save note', err);
    }
  };

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNoteAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setNoteAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return {
    showNoteModal,
    setShowNoteModal,
    selectedBssid,
    setSelectedBssid,
    existingNoteId,
    hasExistingNote: existingNoteId !== null,
    noteContent,
    setNoteContent,
    noteType,
    setNoteType,
    noteAttachments,
    setNoteAttachments,
    fileInputRef,
    openNoteModalForBssid,
    resetNoteState,
    handleSaveNote,
    handleAddAttachment,
    removeAttachment,
  };
};
