import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { NetworkRow, NetworkTag } from '../../types/network';

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
};

export const useNetworkContextMenu = ({ logError }: NetworkContextMenuProps) => {
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
      const response = await fetch(`/api/network-tags/${encodeURIComponent(network.bssid)}`);
      const tag = await response.json();
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
    action: 'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear',
    notes?: string
  ) => {
    if (!contextMenu.network) return;
    setTagLoading(true);
    try {
      const bssid = encodeURIComponent(contextMenu.network.bssid);
      let response;

      switch (action) {
        case 'ignore':
          response = await fetch(`/api/network-tags/${bssid}/ignore`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ignore_reason: 'known_friend' }),
          });
          break;
        case 'threat':
          response = await fetch(`/api/network-tags/${bssid}/threat`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threat_tag: 'THREAT', threat_confidence: 1.0 }),
          });
          break;
        case 'suspect':
          response = await fetch(`/api/network-tags/${bssid}/threat`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threat_tag: 'SUSPECT', threat_confidence: 0.7 }),
          });
          break;
        case 'false_positive':
          response = await fetch(`/api/network-tags/${bssid}/threat`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threat_tag: 'FALSE_POSITIVE', threat_confidence: 1.0 }),
          });
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
          response = await fetch(`/api/network-tags/${bssid}`, { method: 'DELETE' });
          break;
      }

      if (response?.ok) {
        const result = await response.json();
        setContextMenu((prev) => ({ ...prev, tag: result.tag || { ...prev.tag, exists: false } }));
      }
    } catch (err) {
      logError('Failed to update network tag', err);
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
      await fetch(`/api/network-tags/${encodeURIComponent(bssid)}/investigate`, {
        method: 'PATCH',
      });

      if (withLookup) {
        const isBluetooth =
          wigleLookupDialog.network?.type === 'B' || wigleLookupDialog.network?.type === 'E';
        const endpoint = isBluetooth
          ? `/api/wigle/detail/bt/${encodeURIComponent(bssid)}`
          : `/api/wigle/detail/${encodeURIComponent(bssid)}`;

        // Call WiGLE v3 detail endpoint with import flag
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ import: true }),
        });
        const result = await response.json();

        if (response.ok && result.ok) {
          const obsCount = result.importedObservations || result.data?.observations?.length || 0;
          setWigleLookupDialog((prev) => ({
            ...prev,
            loading: false,
            result: {
              success: true,
              message:
                obsCount > 0
                  ? `Imported ${obsCount} observations from WiGLE`
                  : 'Network found but no new observations to import',
              observationsImported: obsCount,
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
      const response = await fetch(
        `/api/networks/${encodeURIComponent(network.bssid)}/wigle-observations`
      );
      const data = await response.json();

      if (response.ok && data.ok) {
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
        setWigleObservations((prev) => ({
          ...prev,
          loading: false,
          error: data.error || 'Failed to load WiGLE observations',
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
      const response = await fetch('/api/networks/wigle-observations/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bssids }),
      });
      const data = await response.json();

      if (response.ok && data.ok) {
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
        setWigleObservations((prev) => ({
          ...prev,
          loading: false,
          error: data.error || 'Failed to load WiGLE observations',
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
