import { useMemo } from 'react';
import type { NetworkRow, Observation } from '../../../types/network';

type ObservationSet = {
  bssid: string;
  observations: Observation[];
};

type ObservationSummaryProps = {
  selectedNetworks: Set<string>;
  observationsByBssid: Record<string, Observation[]>;
  networks: NetworkRow[];
};

export const useObservationSummary = ({
  selectedNetworks,
  observationsByBssid,
  networks,
}: ObservationSummaryProps) => {
  const activeObservationSets = useMemo<ObservationSet[]>(
    () =>
      Array.from(selectedNetworks).map((bssid) => {
        const normalizedBssid = String(bssid).toUpperCase();
        return {
          bssid: normalizedBssid,
          observations: observationsByBssid[normalizedBssid] || observationsByBssid[bssid] || [],
        };
      }),
    [observationsByBssid, selectedNetworks]
  );

  const observationCount = useMemo(
    () => activeObservationSets.reduce((acc, set) => acc + set.observations.length, 0),
    [activeObservationSets]
  );

  const networkLookup = useMemo(() => {
    const map = new Map<string, NetworkRow>();
    networks.forEach((net) => {
      map.set(String(net.bssid), net);
      map.set(String(net.bssid).toUpperCase(), net);
    });
    return map;
  }, [networks]);

  return {
    activeObservationSets,
    observationCount,
    networkLookup,
  };
};
