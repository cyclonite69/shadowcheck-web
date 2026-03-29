import React from 'react';
import { Paperclip, X } from './icons';

interface NetworkContextNoteModalProps {
  selectedBSSID: string | null;
  noteText: string;
  onNoteTextChange: (value: string) => void;
  noteType: string;
  onNoteTypeChange: (value: string) => void;
  attachedFiles: File[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileAttach: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (idx: number) => void;
  onClose: () => void;
  onSave: () => void;
}

export const NetworkContextNoteModal = ({
  selectedBSSID,
  noteText,
  onNoteTextChange,
  noteType,
  onNoteTypeChange,
  attachedFiles,
  fileInputRef,
  onFileAttach,
  onRemoveAttachment,
  onClose,
  onSave,
}: NetworkContextNoteModalProps) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Add Note</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
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
          <label className="block text-sm font-semibold mb-2" htmlFor="context-note-type-select">
            Note Type
          </label>
          <select
            id="context-note-type-select"
            value={noteType}
            onChange={(e) => onNoteTypeChange(e.target.value)}
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
            onChange={(e) => onNoteTextChange(e.target.value)}
            placeholder="Enter your observation..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2" htmlFor="context-media-attachments">
            Media Attachments
          </label>
          <input
            ref={fileInputRef}
            id="context-media-attachments"
            type="file"
            multiple
            accept="image/*,video/*,.pdf"
            onChange={onFileAttach}
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
                  onClick={() => onRemoveAttachment(idx)}
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
          onClick={onSave}
          className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
        >
          Save Note
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);
