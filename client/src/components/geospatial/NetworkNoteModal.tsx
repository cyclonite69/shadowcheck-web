import React from 'react';
import type { NoteMediaItem } from '../../api/networkApi';

interface NetworkNoteModalProps {
  open: boolean;
  isEditMode: boolean;
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
  onOverlayClose: () => void;
  onCloseButton: () => void;
  onCancel: () => void;
  onDeleteNote: () => void;
  onSave: () => void;
}

export const NetworkNoteModal = ({
  open,
  isEditMode,
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
  onOverlayClose,
  onCloseButton,
  onCancel,
  onDeleteNote,
  onSave,
}: NetworkNoteModalProps) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onOverlayClose}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #475569',
          borderRadius: '8px',
          padding: '24px',
          width: '90%',
          maxWidth: '550px',
          color: '#e2e8f0',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            {isEditMode ? 'Edit Note & Media' : 'Add Note & Media'}
          </h3>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onCloseButton}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* BSSID Display */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            BSSID:{' '}
            <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{selectedBssid}</span>
          </label>
        </div>

        {/* Note Type Selector */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="note-type-select"
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            Note Type
          </label>
          <select
            id="note-type-select"
            value={noteType}
            onChange={(e) => onNoteTypeChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#334155',
              border: '1px solid #475569',
              borderRadius: '4px',
              color: '#e2e8f0',
              fontSize: '14px',
            }}
          >
            <option value="general">General Observation</option>
            <option value="threat">Threat Assessment</option>
            <option value="location">Location Indicator</option>
            <option value="device_info">Device Information</option>
          </select>
        </div>

        {/* Note Content */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            Note Content
          </label>
          <textarea
            value={noteContent}
            onChange={(e) => onNoteContentChange(e.target.value)}
            placeholder="Enter your observation..."
            style={{
              width: '100%',
              height: '100px',
              padding: '8px 12px',
              background: '#334155',
              border: '1px solid #475569',
              borderRadius: '4px',
              color: '#e2e8f0',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Media Attachments */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="note-attachments"
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            📎 Attach Media (Optional)
          </label>
          <input
            ref={fileInputRef}
            id="note-attachments"
            type="file"
            multiple
            accept="image/*,video/*,.pdf"
            onChange={onAddAttachment}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%',
              padding: '12px',
              background: '#334155',
              border: '2px dashed #475569',
              borderRadius: '4px',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4ade80';
              e.currentTarget.style.color = '#4ade80';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#475569';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            Click to attach files (Images, Videos, PDF)
          </button>
        </div>

        {existingNoteMedia.length > 0 && (
          <div
            style={{
              marginBottom: '16px',
              background: '#334155',
              padding: '12px',
              borderRadius: '4px',
            }}
          >
            <p
              style={{
                margin: '0 0 12px 0',
                fontSize: '13px',
                fontWeight: '600',
                color: '#94a3b8',
              }}
            >
              Saved Attachments ({existingNoteMedia.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {existingNoteMedia.map((media) => (
                <div
                  key={media.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#1e293b',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#e2e8f0', flex: 1 }}>
                    📎 {media.file_name} ({(media.file_size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenExistingMedia(media.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '4px 8px',
                    }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteExistingMedia(media.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #7f1d1d',
                      borderRadius: '4px',
                      color: '#f87171',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '4px 8px',
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attached Files List */}
        {noteAttachments.length > 0 && (
          <div
            style={{
              marginBottom: '20px',
              background: '#334155',
              padding: '12px',
              borderRadius: '4px',
            }}
          >
            <p
              style={{
                margin: '0 0 12px 0',
                fontSize: '13px',
                fontWeight: '600',
                color: '#94a3b8',
              }}
            >
              Attached Files ({noteAttachments.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {noteAttachments.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#1e293b',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
                    📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove attachment ${file.name}`}
                    title={`Remove attachment ${file.name}`}
                    onClick={() => onRemoveAttachment(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '0 4px',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#ef4444')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {isEditMode && (
            <button
              onClick={onDeleteNote}
              style={{
                flex: '1 1 100%',
                padding: '10px 20px',
                background: '#7f1d1d',
                border: '1px solid #991b1b',
                borderRadius: '4px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Delete Note
            </button>
          )}
          <button
            onClick={onSave}
            disabled={!noteContent.trim()}
            style={{
              flex: 1,
              padding: '10px 20px',
              background: noteContent.trim() ? '#a78bfa' : '#475569',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: noteContent.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              if (noteContent.trim()) {
                e.currentTarget.style.background = '#c4b5fd';
              }
            }}
            onMouseLeave={(e) => {
              if (noteContent.trim()) {
                e.currentTarget.style.background = '#a78bfa';
              }
            }}
          >
            {isEditMode ? 'Save Changes' : 'Save Note'}{' '}
            {noteAttachments.length > 0 &&
              `+ ${noteAttachments.length} File${noteAttachments.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: '4px',
              color: '#94a3b8',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#475569';
              e.currentTarget.style.color = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
