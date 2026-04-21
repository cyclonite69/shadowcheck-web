import { useRef, useState } from 'react';
import { networkApi } from '../../../api/networkApi';
import { wigleApi } from '../../../api/wigleApi';
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
    wigleObservations: { loading: false, bssid: null, bssids: [], observations: [] },
  });
  const [tagLoading, setTagLoading] = useState(false);
  const [wigleLookupDialog, setWigleLookupDialog] = useState<{
    visible: boolean;
    network: any | null;
    loading: boolean;
    result: { success: boolean; message: string; observationsImported?: number } | null;
  }>({
    visible: false,
    network: null,
    loading: false,
    result: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRequestIdRef = useRef(0);

  const closeContextMenu = () => {
    contextMenuRequestIdRef.current++;
    setContextMenu((prev: any) => ({ ...prev, visible: false }));
  };

  const loadWigleObservations = async (network: any) => {
    setTagLoading(true);
    try {
      const observations = await networkApi.getWigleObservationsBatch([network.bssid]);
      setContextMenu((prev: any) => ({
        ...prev,
        wigleObservations: {
          loading: false,
          bssid: network.bssid,
          bssids: [network.bssid],
          observations: observations || [],
        },
      }));
    } catch (err: any) {
      console.error('CRITICAL: WiGLE observation fetch failed', err);
      logError('Failed to load WiGLE observations', err);
    } finally {
      setTagLoading(false);
    }
  };

  const handleTagActionWrapper = async (
    action: 'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear'
  ) => {
    if (!contextMenu.network) return;

    if (action === 'investigate') {
      setWigleLookupDialog({
        visible: true,
        network: contextMenu.network,
        loading: false,
        result: null,
      });
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
    openContextMenu: async (e: any, n: any) => {
      setContextMenu({
        visible: true,
        x: e.originalEvent?.clientX ?? e.clientX,
        y: e.originalEvent?.clientY ?? e.clientY,
        network: n,
        tag: null,
        hasExistingNote: false,
        position: 'below',
        wigleObservations: contextMenu.wigleObservations,
      });
    },
    handleGenerateThreatReportPdf: async () => {},
    wigleLookupDialog,
    setWigleLookupDialog,
    closeWigleLookupDialog: () =>
      setWigleLookupDialog({
        visible: false,
        network: null,
        loading: false,
        result: null,
      }),
    handleWigleLookup: async (withLookup: boolean) => {
      const network = wigleLookupDialog.network;
      const bssid = network?.bssid;
      if (!bssid) {
        setWigleLookupDialog((prev) => ({
          ...prev,
          loading: false,
          result: { success: false, message: 'No BSSID available for investigate action.' },
        }));
        return;
      }

      setWigleLookupDialog((prev) => ({ ...prev, loading: true, result: null }));

      try {
        const investigateResult = await networkApi.investigateNetwork(bssid);
        if (!investigateResult?.ok) {
          throw new Error(investigateResult?.error || 'Failed to tag network as Investigate');
        }

        let observationsImported = 0;
        let message = 'Network tagged as Investigate.';

        if (withLookup) {
          const detailResult = await wigleApi.getWigleDetail(bssid, false, true);
          if (!detailResult?.ok) {
            throw new Error(detailResult?.details || detailResult?.error || 'WiGLE lookup failed');
          }

          observationsImported = Number(detailResult.importedObservations ?? 0);
          message =
            observationsImported > 0
              ? `Network tagged as Investigate. Imported ${observationsImported} observations from WiGLE.`
              : 'Network tagged as Investigate. No new WiGLE observations were imported.';

          await loadWigleObservations(network);
        }

        setWigleLookupDialog((prev) => ({
          ...prev,
          loading: false,
          result: { success: true, message, observationsImported },
        }));
      } catch (err: any) {
        logError('Failed to investigate network', err);
        setWigleLookupDialog((prev) => ({
          ...prev,
          loading: false,
          result: {
            success: false,
            message: err?.message || 'Failed to investigate network',
          },
        }));
      }
    },
    wigleObservations: contextMenu.wigleObservations,
    loadWigleObservations,
    loadBatchWigleObservations: async () => {},
    clearWigleObservations: () => {},
  };
};
