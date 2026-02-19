import { useState, useCallback } from 'react';
import { adminApi } from '../api/adminApi';

type Note = {
  id: number;
  note_type: string;
  created_at: string;
  content: string;
};

type NotesByBssid = Record<string, Note[]>;

interface UseNetworkNotesReturn {
  notes: NotesByBssid;
  loading: boolean;
  error: string | null;
  addNote: (
    bssid: string,
    noteText: string,
    noteType: string,
    userId: string,
    files?: File[]
  ) => Promise<boolean>;
  deleteNote: (bssid: string, noteId: number) => Promise<void>;
  getNotesForBssid: (bssid: string) => Note[] | undefined;
}

export function useNetworkNotes(): UseNetworkNotesReturn {
  const [notes, setNotes] = useState<NotesByBssid>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async (bssid: string) => {
    try {
      const notesData = await adminApi.getNetworkNotes(bssid);
      return notesData.notes || [];
    } catch (err) {
      console.error('Error fetching notes:', err);
      return [];
    }
  }, []);

  const addNote = useCallback(
    async (
      bssid: string,
      noteText: string,
      noteType: string,
      userId: string,
      files?: File[]
    ): Promise<boolean> => {
      if (!noteText.trim() || !bssid) return false;

      setLoading(true);
      setError(null);

      try {
        const data = await adminApi.addNetworkNote(bssid, noteText, noteType, userId);

        if (data) {
          // Upload media if attached
          if (files && files.length > 0) {
            for (const file of files) {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('bssid', bssid);
              await adminApi.addNetworkNoteMedia(data.note_id, formData);
            }
          }

          // Refresh notes
          const notesData = await fetchNotes(bssid);
          setNotes((prev) => ({ ...prev, [bssid]: notesData }));
          return true;
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error saving note');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchNotes]
  );

  const deleteNote = useCallback(async (bssid: string, noteId: number) => {
    try {
      await adminApi.deleteNetworkNote(noteId);
      setNotes((prev) => {
        const current = prev[bssid] ?? [];
        return {
          ...prev,
          [bssid]: current.filter((n) => n.id !== noteId),
        };
      });
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  }, []);

  const getNotesForBssid = useCallback(
    (bssid: string): Note[] | undefined => {
      return notes[bssid];
    },
    [notes]
  );

  return {
    notes,
    loading,
    error,
    addNote,
    deleteNote,
    getNotesForBssid,
  };
}
