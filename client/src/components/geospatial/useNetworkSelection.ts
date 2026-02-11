import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { NetworkRow } from '../../types/network';

type NetworkSelectionProps = {
  networks: NetworkRow[];
  onSelectionChange?: (selected: Set<string>) => void;
};

export const useNetworkSelection = ({ networks, onSelectionChange }: NetworkSelectionProps) => {
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());

  // Track previous selection to detect changes
  const prevSelectedRef = useRef<string | null>(null);

  // Notify when selection changes to a different network
  const notifySelectionChange = useCallback(
    (current: Set<string>) => {
      if (onSelectionChange) {
        const currentBssid = current.size > 0 ? Array.from(current)[0] : null;
        // Only trigger if selection changed to a different network
        if (currentBssid !== prevSelectedRef.current) {
          prevSelectedRef.current = currentBssid;
          onSelectionChange(current);
        }
      }
    },
    [onSelectionChange]
  );

  // Clear previous selection ref when selection is cleared
  useEffect(() => {
    if (selectedNetworks.size === 0) {
      prevSelectedRef.current = null;
    }
  }, [selectedNetworks]);

  const toggleSelectNetwork = (bssid: string) => {
    setSelectedNetworks((prev) => {
      const ns = new Set(prev);
      ns.has(bssid) ? ns.delete(bssid) : ns.add(bssid);
      notifySelectionChange(ns);
      return ns;
    });
  };

  const selectNetworkExclusive = (bssid: string) => {
    const newSet = new Set([bssid]);
    setSelectedNetworks(newSet);
    notifySelectionChange(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedNetworks.size === networks.length) {
      // All selected, deselect all
      setSelectedNetworks(new Set());
      notifySelectionChange(new Set());
    } else {
      // Some or none selected, select all visible
      const newSet = new Set(networks.map((n) => n.bssid));
      setSelectedNetworks(newSet);
      notifySelectionChange(newSet);
    }
  };

  const allSelected = useMemo(
    () => networks.length > 0 && selectedNetworks.size === networks.length,
    [networks.length, selectedNetworks]
  );
  const someSelected = useMemo(
    () => selectedNetworks.size > 0 && selectedNetworks.size < networks.length,
    [networks.length, selectedNetworks]
  );

  return {
    selectedNetworks,
    toggleSelectNetwork,
    selectNetworkExclusive,
    toggleSelectAll,
    allSelected,
    someSelected,
    setSelectedNetworks,
  };
};
