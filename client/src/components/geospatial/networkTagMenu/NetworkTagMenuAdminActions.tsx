import React from 'react';
import type { NetworkTag } from '../../types/network';
import type { NetworkTagMenuAdminActionProps } from './types';
import { NetworkTagMenuActionButton } from './NetworkTagMenuActionButton';

const Divider = () => <div style={{ height: '1px', background: '#475569', margin: '4px 0' }} />;

const manualSiblingText = (isLinked?: boolean, targetId?: string, ssid?: string | null) => {
  if (!targetId) return '🔗 Manage sibling pair';
  if (isLinked) return `⛓️ Unlink these sibs: ${ssid || targetId}`;
  return `🔗 Link these sibs: ${ssid || targetId}`;
};

export const NetworkTagMenuAdminActions = ({
  tag,
  tagLoading,
  onTagAction,
  manualSiblingTarget,
  onMarkSiblingPair,
  siblingPairLoading,
}: NetworkTagMenuAdminActionProps) => (
  <>
    <NetworkTagMenuActionButton
      label={tag?.is_ignored ? '👁️ Unignore (Show)' : '👁️‍🗨️ Ignore (Known/Friendly)'}
      onClick={() => onTagAction('ignore')}
      disabled={tagLoading}
    />
    <Divider />
    <NetworkTagMenuActionButton
      label="⚠️ Mark as Threat"
      onClick={() => onTagAction('threat')}
      disabled={tagLoading}
      textColor="#ef4444"
      background={tag?.threat_tag === 'THREAT' ? 'rgba(239, 68, 68, 0.2)' : 'transparent'}
      activeBackground={tag?.threat_tag === 'THREAT' ? 'rgba(239, 68, 68, 0.2)' : undefined}
      hoverBackground="rgba(239, 68, 68, 0.3)"
    />
    <NetworkTagMenuActionButton
      label="🔶 Mark as Suspect"
      onClick={() => onTagAction('suspect')}
      disabled={tagLoading}
      textColor="#f59e0b"
      background={tag?.threat_tag === 'SUSPECT' ? 'rgba(245, 158, 11, 0.2)' : 'transparent'}
      activeBackground={tag?.threat_tag === 'SUSPECT' ? 'rgba(245, 158, 11, 0.2)' : undefined}
      hoverBackground="rgba(245, 158, 11, 0.3)"
    />
    <NetworkTagMenuActionButton
      label="✓ Mark as False Positive"
      onClick={() => onTagAction('false_positive')}
      disabled={tagLoading}
      textColor="#22c55e"
      background={tag?.threat_tag === 'FALSE_POSITIVE' ? 'rgba(34, 197, 94, 0.2)' : 'transparent'}
      activeBackground={tag?.threat_tag === 'FALSE_POSITIVE' ? 'rgba(34, 197, 94, 0.2)' : undefined}
      hoverBackground="rgba(34, 197, 94, 0.3)"
    />
    <Divider />
    <NetworkTagMenuActionButton
      label="🔍 Investigate (WiGLE Lookup)"
      onClick={() => onTagAction('investigate')}
      disabled={tagLoading}
      textColor="#3b82f6"
      background={tag?.threat_tag === 'INVESTIGATE' ? 'rgba(59, 130, 246, 0.2)' : 'transparent'}
      activeBackground={tag?.threat_tag === 'INVESTIGATE' ? 'rgba(59, 130, 246, 0.2)' : undefined}
      hoverBackground="rgba(59, 130, 246, 0.3)"
    />
    {manualSiblingTarget && onMarkSiblingPair && (
      <NetworkTagMenuActionButton
        label={manualSiblingText(
          manualSiblingTarget.isLinked,
          manualSiblingTarget.bssid,
          manualSiblingTarget.ssid
        )}
        onClick={onMarkSiblingPair}
        disabled={tagLoading || siblingPairLoading}
        textColor="#38bdf8"
        cursor={tagLoading || siblingPairLoading ? 'wait' : 'pointer'}
        hoverBackground="rgba(56, 189, 248, 0.2)"
      />
    )}
    {tag?.exists && (
      <>
        <Divider />
        <NetworkTagMenuActionButton
          label="🗑️ Clear All Tags"
          onClick={() => onTagAction('clear')}
          disabled={tagLoading}
          textColor="#94a3b8"
          hoverBackground="#475569"
        />
      </>
    )}
    <Divider />
  </>
);
