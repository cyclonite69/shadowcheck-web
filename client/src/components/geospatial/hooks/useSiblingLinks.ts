import { useState, useEffect } from 'react';
import { networkApi } from '../../../api/networkApi';
import { logError } from '../../../logging/clientLogger';
import { NetworkRow } from '../../../types/network';

interface UseSiblingLinksProps {
  isAdmin: boolean;
  selectedAnchorBssid: string | null;
  networks: NetworkRow[];
}

export const useSiblingLinks = ({
  isAdmin,
  selectedAnchorBssid,
  networks,
}: UseSiblingLinksProps) => {
  const [linkedSiblingBssids, setLinkedSiblingBssids] = useState<Set<string>>(new Set());
  const [visibleSiblingGroupMap, setVisibleSiblingGroupMap] = useState<Map<string, string>>(
    new Map()
  );

  useEffect(() => {
    if (!isAdmin || !selectedAnchorBssid) {
      setLinkedSiblingBssids(new Set());
      return;
    }

    let cancelled = false;
    const loadSiblingLinks = async () => {
      try {
        const result = await networkApi.getNetworkSiblingLinks(selectedAnchorBssid);
        if (cancelled) return;
        const nextSet = new Set<string>(
          Array.isArray(result?.links)
            ? result.links
                .map((row: any) =>
                  String(row?.sibling_bssid || '')
                    .trim()
                    .toUpperCase()
                )
                .filter(Boolean)
            : []
        );
        setLinkedSiblingBssids(nextSet);
      } catch (error) {
        if (!cancelled) {
          logError('Failed to load sibling links', error);
          setLinkedSiblingBssids(new Set());
        }
      }
    };

    void loadSiblingLinks();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, selectedAnchorBssid]);

  useEffect(() => {
    if (!isAdmin || networks.length === 0) {
      setVisibleSiblingGroupMap(new Map());
      return;
    }

    let cancelled = false;
    const loadVisibleSiblingGroups = async () => {
      try {
        const visibleBssids = networks
          .map((network) =>
            String(network.bssid || '')
              .trim()
              .toUpperCase()
          )
          .filter(Boolean);
        const result = await networkApi.getNetworkSiblingLinksBatch(visibleBssids);
        if (cancelled) return;

        const edges = Array.isArray(result?.links) ? result.links : [];
        const visibleSet = new Set(visibleBssids);
        const adjacency = new Map<string, Set<string>>();

        for (const bssid of visibleSet) adjacency.set(bssid, new Set());

        for (const edge of edges) {
          const a = String(edge?.bssid_a || '')
            .trim()
            .toUpperCase();
          const b = String(edge?.bssid_b || '')
            .trim()
            .toUpperCase();
          if (!visibleSet.has(a) || !visibleSet.has(b) || a === b) continue;
          adjacency.get(a)?.add(b);
          adjacency.get(b)?.add(a);
        }

        const groupMap = new Map<string, string>();
        const visited = new Set<string>();
        let groupCounter = 1;

        const sortedVisible = Array.from(visibleSet).sort();
        for (const start of sortedVisible) {
          if (visited.has(start)) continue;
          const neighbors = adjacency.get(start);
          if (!neighbors || neighbors.size === 0) continue;

          const stack = [start];
          const component: string[] = [];
          while (stack.length > 0) {
            const current = stack.pop() as string;
            if (visited.has(current)) continue;
            visited.add(current);
            component.push(current);
            for (const next of adjacency.get(current) || []) {
              if (!visited.has(next)) stack.push(next);
            }
          }

          if (component.length < 2) continue;
          const groupId = `S${groupCounter}`;
          groupCounter += 1;
          for (const bssid of component) groupMap.set(bssid, groupId);
        }

        setVisibleSiblingGroupMap(groupMap);
      } catch (error) {
        if (!cancelled) {
          logError('Failed to load visible sibling groups', error);
          setVisibleSiblingGroupMap(new Map());
        }
      }
    };

    void loadVisibleSiblingGroups();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, networks]);

  return { linkedSiblingBssids, visibleSiblingGroupMap, setLinkedSiblingBssids };
};
