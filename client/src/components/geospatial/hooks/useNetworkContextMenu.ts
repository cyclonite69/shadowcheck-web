import { useRef, useState } from 'react';
import { networkApi } from '../../../api/networkApi';
import { wigleApi } from '../../../api/wigleApi';
import { handleTagAction } from './contextMenu/actions';

const emptyWigleObservations = {
  loading: false,
  bssid: null,
  bssids: [],
  observations: [],
  error: null,
  stats: null,
  batchStats: null,
};

export const useNetworkContextMenu = ({ logError, onTagUpdated }: any) => {
  const [contextMenu, setContextMenu] = useState<any>({
    visible: false,
    x: 0,
    y: 0,
    network: null,
    tag: null,
    hasExistingNote: false,
    position: 'below',
    wigleObservations: emptyWigleObservations,
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
    const normalizedBssid = String(network?.bssid || '')
      .trim()
      .toUpperCase();
    if (!normalizedBssid) return;

    setContextMenu((prev: any) => ({
      ...prev,
      wigleObservations: {
        ...emptyWigleObservations,
        loading: true,
        bssid: normalizedBssid,
        bssids: [normalizedBssid],
      },
    }));

    try {
      const result = await networkApi.getWigleObservations(normalizedBssid);
      setContextMenu((prev: any) => ({
        ...prev,
        wigleObservations: {
          loading: false,
          bssid: result?.bssid || normalizedBssid,
          bssids: [result?.bssid || normalizedBssid],
          observations: Array.isArray(result?.observations)
            ? result.observations.map((observation: any) => ({
                ...observation,
                bssid: result?.bssid || normalizedBssid,
              }))
            : [],
          error: null,
          stats: result?.stats || null,
          batchStats: null,
        },
      }));
    } catch (err: any) {
      console.error('CRITICAL: WiGLE observation fetch failed', err);
      logError('Failed to load WiGLE observations', err);
      setContextMenu((prev: any) => ({
        ...prev,
        wigleObservations: {
          ...emptyWigleObservations,
          bssid: normalizedBssid,
          bssids: [normalizedBssid],
          error: err?.message || 'Failed to load WiGLE observations',
        },
      }));
    }
  };

  const loadBatchWigleObservations = async (bssids: string[]) => {
    const normalizedBssids = Array.from(
      new Set(
        bssids
          .map((bssid) =>
            String(bssid || '')
              .trim()
              .toUpperCase()
          )
          .filter(Boolean)
      )
    );
    if (normalizedBssids.length === 0) return;

    setContextMenu((prev: any) => ({
      ...prev,
      wigleObservations: {
        ...emptyWigleObservations,
        loading: true,
        bssid: normalizedBssids.length === 1 ? normalizedBssids[0] : null,
        bssids: normalizedBssids,
      },
    }));

    try {
      const result = await networkApi.getWigleObservationsBatch(normalizedBssids);
      const networks = Array.isArray(result?.networks) ? result.networks : [];
      const observations = networks.flatMap((entry: any) =>
        Array.isArray(entry?.observations)
          ? entry.observations.map((observation: any) => ({
              ...observation,
              bssid: entry?.bssid || null,
            }))
          : []
      );

      setContextMenu((prev: any) => ({
        ...prev,
        wigleObservations: {
          loading: false,
          bssid: normalizedBssids.length === 1 ? normalizedBssids[0] : null,
          bssids: normalizedBssids,
          observations,
          error: null,
          stats: null,
          batchStats: result?.stats || null,
        },
      }));
    } catch (err: any) {
      console.error('CRITICAL: WiGLE batch observation fetch failed', err);
      logError('Failed to load WiGLE batch observations', err);
      setContextMenu((prev: any) => ({
        ...prev,
        wigleObservations: {
          ...emptyWigleObservations,
          bssid: normalizedBssids.length === 1 ? normalizedBssids[0] : null,
          bssids: normalizedBssids,
          error: err?.message || 'Failed to load WiGLE batch observations',
        },
      }));
    }
  };

  const clearWigleObservations = () => {
    setContextMenu((prev: any) => ({
      ...prev,
      wigleObservations: emptyWigleObservations,
    }));
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
    loadBatchWigleObservations,
    clearWigleObservations,
  };
};
