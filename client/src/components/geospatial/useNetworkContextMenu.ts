import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { NetworkRow, NetworkTag } from '../../types/network';
import { networkApi } from '../../api/networkApi';
import { wigleApi } from '../../api/wigleApi';

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  network: NetworkRow | null;
  tag: NetworkTag | null;
  position: 'below' | 'above';
};

type WigleLookupDialogState = {
  visible: boolean;
  network: NetworkRow | null;
  loading: boolean;
  result: { success: boolean; message: string; observationsImported?: number } | null;
};

export type WigleObservation = {
  lat: number;
  lon: number;
  time: number;
  level: number;
  ssid: string | null;
  frequency: number | null;
  channel: number | null;
  encryption: string | null;
  altitude: number | null;
  accuracy: number | null;
  source: 'matched' | 'wigle_unique';
  distance_from_our_center_m: number | null;
  bssid?: string; // For batch mode - to color by network
};

type WigleObservationsState = {
  bssid: string | null;
  bssids: string[]; // For batch mode
  observations: WigleObservation[];
  stats: {
    wigle_total: number;
    matched: number;
    unique: number;
    our_observations: number;
    max_distance_from_our_sightings_m: number;
  } | null;
  batchStats: {
    total_wigle: number;
    total_matched: number;
    total_unique: number;
    network_count: number;
  } | null;
  loading: boolean;
  error: string | null;
};

type NetworkContextMenuProps = {
  logError: (message: string, error?: unknown) => void;
  onTagUpdated?: () => void;
};

export const useNetworkContextMenu = ({ logError, onTagUpdated }: NetworkContextMenuProps) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    network: null,
    tag: null,
    position: 'below',
  });
  const [tagLoading, setTagLoading] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // WiGLE lookup dialog state
  const [wigleLookupDialog, setWigleLookupDialog] = useState<WigleLookupDialogState>({
    visible: false,
    network: null,
    loading: false,
    result: null,
  });

  // WiGLE observations layer state
  const [wigleObservations, setWigleObservations] = useState<WigleObservationsState>({
    bssid: null,
    bssids: [],
    observations: [],
    stats: null,
    batchStats: null,
    loading: false,
    error: null,
  });

  const openContextMenu = async (e: ReactMouseEvent, network: NetworkRow) => {
    e.preventDefault();
    e.stopPropagation();

    const menuHeight = 320; // Height of context menu in pixels
    const menuWidth = 200; // Width of context menu in pixels
    const padding = 10; // Padding from screen edge

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let posX = e.clientX;
    let posY = e.clientY;
    let position: 'below' | 'above' = 'below';

    // ========== VERTICAL POSITIONING ==========
    // Check if menu would go off bottom of screen
    if (posY + menuHeight + padding > viewportHeight) {
      // Flip menu upward
      posY = e.clientY - menuHeight;
      position = 'above';
    }

    // Ensure menu doesn't go above top of screen
    if (posY < padding) {
      posY = padding;
      position = 'below'; // Reset to below if we hit top
    }

    // ========== HORIZONTAL POSITIONING ==========
    // Check if menu would go off right side of screen
    if (posX + menuWidth + padding > viewportWidth) {
      posX = viewportWidth - menuWidth - padding;
    }

    // Check if menu would go off left side of screen
    if (posX - padding < 0) {
      posX = padding;
    }

    // Fetch current tag state for this network
    try {
      const tag = await networkApi.getNetworkTags(network.bssid);
      setContextMenu({
        visible: true,
        x: posX,
        y: posY,
        network,
        tag,
        position,
      });
    } catch (err) {
      logError('Failed to fetch network tag', err);
      setContextMenu({
        visible: true,
        x: posX,
        y: posY,
        network,
        tag: {
          bssid: network.bssid,
          is_ignored: false,
          ignore_reason: null,
          threat_tag: null,
          notes: null,
          exists: false,
        },
        position,
      });
    }
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleTagAction = async (
    action: 'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear'
  ) => {
    if (!contextMenu.network) return;
    setTagLoading(true);
    try {
      const bssid = contextMenu.network.bssid;
      let result;

      switch (action) {
        case 'ignore':
          result = await networkApi.ignoreNetwork(bssid);
          break;
        case 'threat':
          result = await networkApi.tagNetworkAsThreat(bssid, 'THREAT', 1.0);
          break;
        case 'suspect':
          result = await networkApi.tagNetworkAsThreat(bssid, 'SUSPECT', 0.7);
          break;
        case 'false_positive':
          result = await networkApi.falsePositiveNetwork(bssid);
          break;
        case 'investigate':
          // Show WiGLE lookup dialog instead of immediately tagging
          setWigleLookupDialog({
            visible: true,
            network: contextMenu.network,
            loading: false,
            result: null,
          });
          setTagLoading(false);
          closeContextMenu();
          return; // Exit early - dialog will handle the rest
        case 'clear':
          result = await networkApi.deleteNetworkTag(bssid);
          break;
      }

      if (result && result.ok) {
        // Success: the API call succeeded and returned the updated tag
        if (result.tag) {
          setContextMenu((prev) => ({ ...prev, tag: { ...result.tag, exists: true } }));
        } else if (result.deleted) {
          setContextMenu((prev) => ({
            ...prev,
            tag: {
              bssid: result.deleted,
              is_ignored: false,
              ignore_reason: null,
              threat_tag: null,
              notes: null,
              exists: false,
            },
          }));
        }

        // Trigger refresh if callback provided
        if (onTagUpdated) {
          onTagUpdated();
        }
      } else if (result && result.error) {
        throw new Error(result.error);
      }
    } catch (err: any) {
      logError('Failed to update network tag', err);
      alert(`Tagging failed: ${err.message}`);
    } finally {
      setTagLoading(false);
      closeContextMenu();
    }
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  // WiGLE lookup dialog handlers
  const closeWigleLookupDialog = () => {
    setWigleLookupDialog((prev) => ({ ...prev, visible: false, result: null }));
  };

  const handleWigleLookup = async (withLookup: boolean) => {
    if (!wigleLookupDialog.network) return;

    const bssid = wigleLookupDialog.network.bssid;
    setWigleLookupDialog((prev) => ({ ...prev, loading: true }));

    try {
      // Always tag as INVESTIGATE first
      await networkApi.investigateNetwork(bssid);

      if (withLookup) {
        const isBluetooth =
          wigleLookupDialog.network?.type === 'B' || wigleLookupDialog.network?.type === 'E';

        // Call WiGLE v3 detail endpoint with import flag
        const result = await wigleApi.getWigleDetail(bssid, isBluetooth, true);

        if (result.ok) {
          const newCount: number = result.importedObservations ?? 0;
          const totalCount: number = result.totalObservations ?? newCount;
          const alreadyHad = totalCount - newCount;
          const message =
            newCount > 0
              ? alreadyHad > 0
                ? `Imported ${newCount} new records (had ${alreadyHad}, now ${totalCount} total)`
                : `Imported ${newCount} records from WiGLE`
              : totalCount > 0
                ? `No new records — all ${totalCount} already imported`
                : 'Network found in WiGLE but contains no observation records';
          setWigleLookupDialog((prev) => ({
            ...prev,
            loading: false,
            result: {
              success: true,
              message,
              observationsImported: newCount,
            },
          }));
        } else {
          // Handle both simple {error: "string"} and structured {error: {message, code, statusCode}} formats
          const errorMessage =
            typeof result.error === 'string'
              ? result.error
              : result.error?.message ||
                'WiGLE lookup failed - network may not exist in WiGLE database';
          setWigleLookupDialog((prev) => ({
            ...prev,
            loading: false,
            result: {
              success: false,
              message: errorMessage,
            },
          }));
        }
      } else {
        // Just tagged, close dialog
        setWigleLookupDialog((prev) => ({
          ...prev,
          loading: false,
          result: { success: true, message: 'Tagged as INVESTIGATE' },
        }));
        setTimeout(closeWigleLookupDialog, 1500);
      }
    } catch (err) {
      logError('WiGLE lookup failed', err);
      setWigleLookupDialog((prev) => ({
        ...prev,
        loading: false,
        result: { success: false, message: 'Network error during lookup' },
      }));
    }
  };

  // Load WiGLE observations for a single network (to display on map)
  const loadWigleObservations = async (network: NetworkRow) => {
    if (!network?.bssid) return;

    setWigleObservations({
      bssid: network.bssid,
      bssids: [network.bssid],
      observations: [],
      stats: null,
      batchStats: null,
      loading: true,
      error: null,
    });

    try {
      const data = await wigleApi.getNetworkWigleObservations(network.bssid);

      if (data.ok) {
        setWigleObservations({
          bssid: network.bssid,
          bssids: [network.bssid],
          observations: data.observations || [],
          stats: data.stats || null,
          batchStats: null,
          loading: false,
          error: null,
        });
      } else {
        const errorMsg =
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || data.message || 'Failed to load WiGLE observations';
        setWigleObservations((prev) => ({
          ...prev,
          loading: false,
          error: errorMsg,
        }));
      }
    } catch (err) {
      logError('Failed to load WiGLE observations', err);
      setWigleObservations((prev) => ({
        ...prev,
        loading: false,
        error: 'Network error loading WiGLE observations',
      }));
    }
  };

  // Load WiGLE observations for multiple networks (batch mode)
  const loadBatchWigleObservations = async (bssids: string[]) => {
    if (!bssids || bssids.length === 0) return;

    setWigleObservations({
      bssid: null,
      bssids: bssids,
      observations: [],
      stats: null,
      batchStats: null,
      loading: true,
      error: null,
    });

    try {
      const data = await networkApi.getWigleObservationsBatch(bssids);

      if (data.ok) {
        // Flatten all observations from all networks, adding bssid to each
        const allObservations: WigleObservation[] = [];
        for (const network of data.networks || []) {
          for (const obs of network.observations || []) {
            allObservations.push({
              ...obs,
              bssid: network.bssid,
            });
          }
        }

        setWigleObservations({
          bssid: null,
          bssids: bssids,
          observations: allObservations,
          stats: null,
          batchStats: data.stats || null,
          loading: false,
          error: null,
        });
      } else {
        const errorMsg =
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || data.message || 'Failed to load WiGLE observations';
        setWigleObservations((prev) => ({
          ...prev,
          loading: false,
          error: errorMsg,
        }));
      }
    } catch (err) {
      logError('Failed to load batch WiGLE observations', err);
      setWigleObservations((prev) => ({
        ...prev,
        loading: false,
        error: 'Network error loading WiGLE observations',
      }));
    }
  };

  const clearWigleObservations = () => {
    setWigleObservations({
      bssid: null,
      bssids: [],
      observations: [],
      stats: null,
      batchStats: null,
      loading: false,
      error: null,
    });
  };

  return {
    contextMenu,
    tagLoading,
    contextMenuRef,
    openContextMenu,
    closeContextMenu,
    handleTagAction,
    // WiGLE lookup dialog
    wigleLookupDialog,
    closeWigleLookupDialog,
    handleWigleLookup,
    // WiGLE observations layer
    wigleObservations,
    loadWigleObservations,
    loadBatchWigleObservations,
    clearWigleObservations,
  };
};
