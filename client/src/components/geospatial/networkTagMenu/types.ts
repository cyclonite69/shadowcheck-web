import type { NetworkTag } from '../../types/network';

export interface NetworkTagMenuAdminActionProps {
  tag: NetworkTag | null;
  tagLoading: boolean;
  onTagAction: (
    action: 'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear'
  ) => void;
  manualSiblingTarget?: {
    bssid: string;
    ssid?: string | null;
    isLinked?: boolean;
  } | null;
  onMarkSiblingPair?: () => void;
  siblingPairLoading?: boolean;
}

export interface NetworkTagMenuViewActionProps {
  onGenerateThreatReport: () => void;
  onTimeFrequency: () => void;
  onMapWigleObservations?: () => void;
  wigleObservationsLoading?: boolean;
  onAddNote: () => void;
  hasExistingNote: boolean;
  isAdmin: boolean;
  tagLoading: boolean;
}
