import { useRef, useState } from 'react';
import { handleTagAction } from './contextMenu/actions';

export const useNetworkContextMenu = ({ logError, onTagUpdated }: any) => {
  const [contextMenu, setContextMenu] = useState<any>({
    visible: false,
    x: 0,
    y: 0,
    network: null,
    tag: null,
    hasExistingNote: false,
    position: 'below',
  });
  const [tagLoading, setTagLoading] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRequestIdRef = useRef(0);

  const closeContextMenu = () => {
    contextMenuRequestIdRef.current++;
    setContextMenu((prev: any) => ({ ...prev, visible: false }));
  };

  const handleTagActionWrapper = async (
    action: 'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear'
  ) => {
    if (!contextMenu.network) return;

    if (action === 'investigate') {
      // ... (simplified for stability)
      closeContextMenu();
      return;
    }

    setTagLoading(true);
    try {
      const result = await handleTagAction(action, contextMenu.network);
      if (result.error) throw new Error(result.error);

      if (result.tag) {
        setContextMenu((prev: any) => ({ ...prev, tag: { ...result.tag!, exists: true } }));
      } else if (result.deleted) {
        setContextMenu((prev: any) => ({
          ...prev,
          tag: { bssid: result.deleted!, exists: false } as any,
        }));
      }
      if (onTagUpdated) onTagUpdated();
    } catch (err: any) {
      logError('Failed to update network tag', err);
    } finally {
      setTagLoading(false);
      closeContextMenu();
    }
  };

  return {
    contextMenu,
    tagLoading,
    contextMenuRef,
    handleTagAction: handleTagActionWrapper,
    closeContextMenu,
    openContextMenu: async (_e: any, _n: any) => {},
    handleGenerateThreatReportPdf: async () => {},
    wigleLookupDialog: { visible: false },
    setWigleLookupDialog: () => {},
    closeWigleLookupDialog: () => {},
    handleWigleLookup: async () => {},
    wigleObservations: { loading: false, bssid: null, bssids: [], observations: [] },
    loadWigleObservations: async (network: any) => {
      console.log('loadWigleObservations called for', network);
    },
    loadBatchWigleObservations: async (bssids: string[]) => {
      console.log('loadBatchWigleObservations called for', bssids);
    },
    clearWigleObservations: () => {},
  };
};
