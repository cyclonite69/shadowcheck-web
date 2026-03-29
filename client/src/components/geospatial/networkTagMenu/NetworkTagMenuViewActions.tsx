import React from 'react';
import { NetworkTagMenuActionButton } from './NetworkTagMenuActionButton';
import type { NetworkTagMenuViewActionProps } from './types';

export const NetworkTagMenuViewActions = ({
  onGenerateThreatReport,
  onTimeFrequency,
  onMapWigleObservations,
  wigleObservationsLoading,
  onAddNote,
  hasExistingNote,
  isAdmin,
  tagLoading,
}: NetworkTagMenuViewActionProps) => (
  <>
    <NetworkTagMenuActionButton
      label="Generate Threat Report (PDF)"
      onClick={onGenerateThreatReport}
      textColor="#22d3ee"
    />
    <NetworkTagMenuActionButton
      label="📡 Temporal Heatmap"
      onClick={onTimeFrequency}
      textColor="#06b6d4"
    />
    {onMapWigleObservations && (
      <NetworkTagMenuActionButton
        label={wigleObservationsLoading ? '🌐 Loading WiGLE...' : '🌐 Map WiGLE Sightings'}
        onClick={onMapWigleObservations}
        textColor="#f59e0b"
        disabled={wigleObservationsLoading}
        hoverBackground={wigleObservationsLoading ? undefined : '#475569'}
      />
    )}
    {isAdmin && (
      <NetworkTagMenuActionButton
        label={`📝 ${hasExistingNote ? 'Edit Note' : 'Add Note'}`}
        onClick={onAddNote}
        textColor="#a78bfa"
        disabled={tagLoading}
      />
    )}
  </>
);
