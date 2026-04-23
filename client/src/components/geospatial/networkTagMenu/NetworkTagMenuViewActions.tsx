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
      hoverBackground="#475569"
    />
    <NetworkTagMenuActionButton
      label="📡 Temporal Heatmap"
      onClick={onTimeFrequency}
      textColor="#06b6d4"
      hoverBackground="#475569"
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
        hoverBackground="#475569"
      />
    )}
  </>
);
