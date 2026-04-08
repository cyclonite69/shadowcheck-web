import { useRef, useState } from 'react';
import { networkApi, type NoteMediaItem } from '../../../api/networkApi';

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
  const [existingNoteMedia, setExistingNoteMedia] = useState<NoteMediaItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteRequestBssidRef = useRef<string>('');

  const resetNoteState = () => {
    setShowNoteModal(false);
    setSelectedBssid('');
    setExistingNoteId(null);
    setNoteContent('');
    setNoteType('general');
    setNoteAttachments([]);
    setExistingNoteMedia([]);
  };

  const openNoteModalForBssid = async (bssid: string) => {
    if (!bssid) return;

    noteRequestBssidRef.current = bssid;

    setSelectedBssid(bssid);
    setExistingNoteId(null);
    setNoteContent('');
    setNoteType('general');
    setNoteAttachments([]);
    setExistingNoteMedia([]);
    setShowNoteModal(true);

    try {
      const notes = await networkApi.getNetworkNotes(bssid);
      if (noteRequestBssidRef.current !== bssid) return;
      const latest = notes[0];
      if (latest) {
        const noteId = Number(latest.id);
        setExistingNoteId(noteId);
        setNoteContent(latest.content || '');
        setNoteType(latest.note_type || 'general');
        const media = await networkApi.getNoteMedia(noteId);
        if (noteRequestBssidRef.current !== bssid) return;
        setExistingNoteMedia(media);
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
      const uploadFailures: string[] = [];
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
          } catch (error) {
            uploadFailures.push(
              `${file.name}: ${error instanceof Error ? error.message : 'upload failed'}`
            );
          }
        }
      }

      if (!noteId) {
        throw new Error('Unable to resolve saved note');
      }

      const refreshedMedia = await networkApi.getNoteMedia(noteId);
      setExistingNoteId(noteId);
      setExistingNoteMedia(refreshedMedia);
      setNoteAttachments([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (uploadFailures.length > 0) {
        throw new Error(`Some attachments failed to upload: ${uploadFailures.join(', ')}`);
      }
    } catch (err) {
      logError('Failed to save note', err);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedBssid || !existingNoteId) return;

    try {
      await networkApi.deleteNetworkNote(selectedBssid, existingNoteId);
      resetNoteState();
    } catch (err) {
      logError('Failed to delete note', err);
    }
  };

  const handleDeleteExistingMedia = async (mediaId: number) => {
    try {
      await networkApi.deleteNoteMedia(mediaId);
      setExistingNoteMedia((prev) => prev.filter((media) => media.id !== mediaId));
    } catch (err) {
      logError('Failed to delete note attachment', err);
    }
  };

  const openExistingMedia = (mediaId: number) => {
    window.open(`/api/media/${mediaId}`, '_blank', 'noopener,noreferrer');
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
    existingNoteMedia,
    fileInputRef,
    openNoteModalForBssid,
    resetNoteState,
    handleSaveNote,
    handleDeleteNote,
    handleDeleteExistingMedia,
    openExistingMedia,
    handleAddAttachment,
    removeAttachment,
  };
};
