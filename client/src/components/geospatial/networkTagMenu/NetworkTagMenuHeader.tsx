import React from 'react';
import type { NetworkRow } from '../../types/network';

interface NetworkTagMenuHeaderProps {
  network: NetworkRow;
}

export const NetworkTagMenuHeader = ({ network }: NetworkTagMenuHeaderProps) => (
  <div
    style={{
      padding: '8px 12px',
      borderBottom: '1px solid #475569',
      background: '#334155',
    }}
  >
    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
      {network.ssid || '(hidden)'}
    </div>
    <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
      {network.bssid}
    </div>
  </div>
);
