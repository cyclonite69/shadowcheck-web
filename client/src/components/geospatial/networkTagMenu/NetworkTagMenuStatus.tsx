import React from 'react';
import type { NetworkTag } from '../../../types/network';

interface NetworkTagMenuStatusProps {
  tag: NetworkTag | null;
}

export const NetworkTagMenuStatus = ({ tag }: NetworkTagMenuStatusProps) => {
  if (!tag?.exists) return null;
  return (
    <div
      style={{
        padding: '6px 12px',
        borderBottom: '1px solid #475569',
        background: '#334155',
        fontSize: '10px',
      }}
    >
      {tag.is_ignored && <span style={{ color: '#94a3b8', marginRight: '8px' }}>✓ Ignored</span>}
      {tag.threat_tag && (
        <span
          style={{
            color:
              tag.threat_tag === 'THREAT'
                ? '#ef4444'
                : tag.threat_tag === 'SUSPECT'
                  ? '#f59e0b'
                  : tag.threat_tag === 'FALSE_POSITIVE'
                    ? '#22c55e'
                    : tag.threat_tag === 'INVESTIGATE'
                      ? '#3b82f6'
                      : '#94a3b8',
          }}
        >
          {tag.threat_tag}
        </span>
      )}
    </div>
  );
};
