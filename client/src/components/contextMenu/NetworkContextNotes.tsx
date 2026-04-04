import React from 'react';
import { Trash2 } from './icons';
import type { NetworkNote } from './types';
import { formatShortDate } from '../../utils/formatDate';

interface NetworkContextNotesProps {
  selectedBSSID: string;
  notes: NetworkNote[];
  onDeleteNote: (bssid: string, noteId: number) => void;
}

export const NetworkContextNotes = ({
  selectedBSSID,
  notes,
  onDeleteNote,
}: NetworkContextNotesProps) => (
  <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
    <div className="bg-gray-100 px-6 py-4 border-b">
      <h2 className="text-lg font-bold">Notes for {selectedBSSID}</h2>
    </div>
    <div className="divide-y">
      {notes.map((note) => (
        <div key={note.id} className="p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded mb-2">
                {note.note_type}
              </span>
              {(note.attachment_count || 0) > 0 && (
                <span className="ml-2 inline-block px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded mb-2">
                  {(note.image_count || 0) > 0 ? 'Image attached' : 'Attachment attached'}
                </span>
              )}
              <p className="text-xs text-gray-500">{formatShortDate(note.created_at)}</p>
            </div>
            <button
              onClick={() => onDeleteNote(selectedBSSID, note.id)}
              className="text-red-600 hover:text-red-800"
            >
              <Trash2 size={18} />
            </button>
          </div>
          <p className="text-gray-900 mb-3">{note.content}</p>
        </div>
      ))}
    </div>
  </div>
);
