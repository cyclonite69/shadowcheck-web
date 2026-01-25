import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { MessageSquare, Paperclip, Trash2, X } from 'lucide-react';

type Network = {
  bssid: string;
  ssid?: string | null;
  threat_level?: string | null;
};

type Note = {
  id: number | string;
  note_type: string;
  created_at: string;
  content: string;
};

type NotesByBssid = Record<string, Note[]>;

type ContextMenuState = {
  x: number;
  y: number;
};

type NetworkContextMenuProps = {
  networks?: Network[];
};

export default function NetworkContextMenu({ networks = [] }: NetworkContextMenuProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectedBSSID, setSelectedBSSID] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [notes, setNotes] = useState<NotesByBssid>({});
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      const response = await fetch('/api/admin/network-notes/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bssid: selectedBSSID,
          content: noteText,
          note_type: noteType,
          user_id: 'default_user',
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Upload media if attached
        for (const file of attachedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('bssid', selectedBSSID);

          await fetch(`/api/admin/network-notes/${data.note_id}/media`, {
            method: 'POST',
            body: formData,
          });
        }

        // Refresh notes
        const notesResponse = await fetch(`/api/admin/network-notes/${selectedBSSID}`);
        const notesData = (await notesResponse.json()) as { notes: Note[] };
        setNotes((prev) => ({ ...prev, [selectedBSSID]: notesData.notes }));

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

  // Delete note
  const handleDeleteNote = async (bssid: string, noteId: number | string) => {
    try {
      await fetch(`/api/admin/network-notes/${noteId}`, { method: 'DELETE' });
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
  };

  const selectedNotes = selectedBSSID ? notes[selectedBSSID] : undefined;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Network Threat Analysis</h1>

      {/* Network Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">BSSID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">SSID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Threat</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {networks.map((net) => (
              <tr
                key={net.bssid}
                onContextMenu={(e) => handleRightClick(e, net.bssid)}
                className="border-b hover:bg-gray-50 cursor-context-menu"
              >
                <td className="px-6 py-4 text-sm font-mono">{net.bssid}</td>
                <td className="px-6 py-4 text-sm">{net.ssid || '(hidden)'}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      net.threat_level === 'HIGH'
                        ? 'bg-red-100 text-red-800'
                        : net.threat_level === 'MED'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {net.threat_level || 'LOW'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {notes[net.bssid] && notes[net.bssid].length > 0 && (
                    <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                      <MessageSquare size={14} />
                      {notes[net.bssid].length}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white rounded-lg shadow-lg z-50 border border-gray-200"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <button
            onClick={() => {
              setShowNoteModal(true);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2 border-b"
          >
            <MessageSquare size={16} className="text-blue-600" />
            Add Note
          </button>
          <button
            onClick={() => {
              fileInputRef.current?.click();
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 flex items-center gap-2 border-b"
          >
            <Paperclip size={16} className="text-green-600" />
            Attach Media
          </button>
          <button
            onClick={() => setContextMenu(null)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600"
          >
            Close
          </button>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add Note</h2>
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteText('');
                  setAttachedFiles([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  BSSID: <span className="font-mono text-blue-600">{selectedBSSID}</span>
                </label>
              </div>

              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  htmlFor="context-note-type-select"
                >
                  Note Type
                </label>
                <select
                  id="context-note-type-select"
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general">General Observation</option>
                  <option value="threat">Threat Assessment</option>
                  <option value="location">Location Indicator</option>
                  <option value="device_info">Device Information</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Note</label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter your observation..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
                />
              </div>

              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  htmlFor="context-media-attachments"
                >
                  Media Attachments
                </label>
                <input
                  ref={fileInputRef}
                  id="context-media-attachments"
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf"
                  onChange={handleFileAttach}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-gray-700 font-semibold flex items-center justify-center gap-2"
                >
                  <Paperclip size={16} />
                  Click to attach files
                </button>
              </div>

              {attachedFiles.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-semibold">Attached ({attachedFiles.length})</p>
                  {attachedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white p-2 rounded border"
                    >
                      <span className="text-sm truncate">{file.name}</span>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddNote}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                Save Note
              </button>
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteText('');
                  setAttachedFiles([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Display */}
      {selectedBSSID && selectedNotes && selectedNotes.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-100 px-6 py-4 border-b">
            <h2 className="text-lg font-bold">Notes for {selectedBSSID}</h2>
          </div>
          <div className="divide-y">
            {selectedNotes.map((note) => (
              <div key={note.id} className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded mb-2">
                      {note.note_type}
                    </span>
                    <p className="text-xs text-gray-500">
                      {new Date(note.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNote(selectedBSSID, note.id)}
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
      )}
    </div>
  );
}
