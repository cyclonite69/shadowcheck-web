import React from 'react';
import type { MouseEvent } from 'react';
import type { Network, NotesByBssid } from './types';
import { MessageSquare } from './icons';

interface NetworkContextMenuTableProps {
  networks: Network[];
  notes: NotesByBssid;
  onContextMenu: (e: MouseEvent<HTMLTableRowElement>, bssid: string) => void;
}

export const NetworkContextMenuTable = ({
  networks,
  notes,
  onContextMenu,
}: NetworkContextMenuTableProps) => (
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
            onContextMenu={(e) => onContextMenu(e as MouseEvent<HTMLTableRowElement>, net.bssid)}
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
);
