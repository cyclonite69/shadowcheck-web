import React from 'react';
import { MessageSquare, Paperclip } from './icons';
import type { ContextMenuState } from './types';

interface NetworkContextMenuMenuProps {
  contextMenu: ContextMenuState;
  onTagNetwork: (tag: 'threat' | 'investigate' | 'false_positive' | 'ignore') => void;
  onAddNoteClick: () => void;
  onAttachMedia: () => void;
  onCloseMenu: () => void;
}

export const NetworkContextMenuMenu = ({
  contextMenu,
  onTagNetwork,
  onAddNoteClick,
  onAttachMedia,
  onCloseMenu,
}: NetworkContextMenuMenuProps) => (
  <div
    className="fixed bg-white rounded-lg shadow-lg z-50 border border-gray-200"
    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
  >
    <button
      onClick={() => onTagNetwork('threat')}
      className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 border-b"
    >
      ⚠️ Mark as Threat
    </button>
    <button
      onClick={() => onTagNetwork('investigate')}
      className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2 border-b"
    >
      🔍 Mark as Investigate
    </button>
    <button
      onClick={() => onTagNetwork('false_positive')}
      className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 text-green-600 flex items-center gap-2 border-b"
    >
      ✓ Mark as False Positive
    </button>
    <button
      onClick={() => onTagNetwork('ignore')}
      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-600 flex items-center gap-2 border-b"
    >
      👁️‍🗨️ Ignore (Known/Friendly)
    </button>
    <button
      onClick={onAddNoteClick}
      className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2 border-b"
    >
      <MessageSquare size={16} className="text-blue-600" />
      Add Note
    </button>
    <button
      onClick={onAttachMedia}
      className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 flex items-center gap-2 border-b"
    >
      <Paperclip size={16} className="text-green-600" />
      Attach Media
    </button>
    <button
      onClick={onCloseMenu}
      className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600"
    >
      Close
    </button>
  </div>
);
