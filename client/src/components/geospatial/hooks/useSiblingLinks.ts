import { useState, useEffect, useRef } from 'react';
import { networkApi } from '../../../api/networkApi';
import { mapApiRowToNetwork } from '../../../utils/networkDataTransformation';
import { logError } from '../../../logging/clientLogger';
import { NetworkRow } from '../../../types/network';
import {
  buildSiblingGroupMap,
  normalizeBssid,
  filterNetworksBySearch,
  processHydrationSettledResults,
  hasPrecomputedSiblings,
  buildAdjacencyFromPrecomputed,
  generateHydrationKey,
  buildAdjacencyFromApiLinks,
  getMissingSiblingBssids,
  chunkBssids,
} from '../utils/siblingGroupGraph';
import { componentSizesFromGroupMap, logSiblingTopology } from '../utils/siblingTopologyDebug';

interface UseSiblingLinksProps {
  isAdmin: boolean;
  selectedAnchorBssid: string | null;
  networks: NetworkRow[];
  /** When set, load full DB components (not page-local edge union). */
  quickSearch?: string;
}

export const useSiblingLinks = ({
  isAdmin,
  selectedAnchorBssid,
  networks,
  quickSearch = '',
}: UseSiblingLinksProps) => {
  const [linkedSiblingBssids, setLinkedSiblingBssids] = useState<Set<string>>(new Set());
  const [visibleSiblingGroupMap, setVisibleSiblingGroupMap] = useState<Map<string, string>>(
    new Map()
  );
  const [missingSiblingNetworks, setMissingSiblingNetworks] = useState<NetworkRow[]>([]);
  const [hydrationFailedBssids, setHydrationFailedBssids] = useState<string[]>([]);
  const [nonRenderableBssids, setNonRenderableBssids] = useState<string[]>([]);
  const [missingDbBssids, setMissingDbBssids] = useState<string[]>([]);
  const [siblingHydrating, setSiblingHydrating] = useState(false);
  const prevHydrationKeyRef = useRef('');

  useEffect(() => {
    if (!isAdmin || !selectedAnchorBssid) {
      setLinkedSiblingBssids(new Set());
      return;
    }

    // Immediately clear stale selected anchor links when anchor changes
    setLinkedSiblingBssids(new Set());

    let cancelled = false;
    const loadSiblingLinks = async () => {
      try {
        const result = await networkApi.getNetworkSiblingLinks(selectedAnchorBssid);
        if (cancelled) {
          return;
        }
        const nextSet = new Set<string>(
          Array.isArray(result?.links)
            ? result.links.map((row: any) => normalizeBssid(row?.sibling_bssid)).filter(Boolean)
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
      setMissingSiblingNetworks([]);
      setHydrationFailedBssids([]);
      setNonRenderableBssids([]);
      setMissingDbBssids([]);
      prevHydrationKeyRef.current = '';
      setSiblingHydrating(false);
      return;
    }

    // Immediately clear previous sibling link groupings and hydrated arrays to prevent stale flash
    setVisibleSiblingGroupMap(new Map());
    setMissingSiblingNetworks([]);
    setHydrationFailedBssids([]);
    setNonRenderableBssids([]);
    setMissingDbBssids([]);
    prevHydrationKeyRef.current = '';
    setSiblingHydrating(true);

    let cancelled = false;
    const loadVisibleSiblingGroups = async () => {
      try {
        const visibleBssids = networks
          .map((network) => normalizeBssid(network.bssid))
          .filter(Boolean);
        const visibleSet = new Set(visibleBssids);
        const searchStr = quickSearch.trim().toLowerCase();
        const hasSearch = searchStr.length > 0;

        if (hasSearch && visibleBssids.length > 0) {
          const searchHits = filterNetworksBySearch(networks, quickSearch);

          if (searchHits.length === 0) {
            setVisibleSiblingGroupMap(new Map());
            setMissingSiblingNetworks([]);
            if (!cancelled) {
              setSiblingHydrating(false);
            }
            return;
          }

          // Build sibling graph from ALL matching search hits' precomputed sibling_bssids.
          // This keeps independent pairs isolated rather than merging them through a single
          // anchor's recursive DB component.
          let searchAdjacency: Map<string, Set<string>>;

          if (hasPrecomputedSiblings(searchHits)) {
            searchAdjacency = buildAdjacencyFromPrecomputed(visibleSet, searchHits);
          } else {
            // Fallback: batch + per-hit API calls when sibling_bssids are missing.
            const searchHitBssids = searchHits
              .map((n) => normalizeBssid(n.bssid))
              .filter(Boolean) as string[];

            const batchResult = await networkApi.getNetworkSiblingLinksBatch(searchHitBssids);
            if (cancelled) {
              return;
            }

            const anchorResults = await Promise.all(
              searchHitBssids.map((bssid) => networkApi.getNetworkSiblingLinks(bssid))
            );
            if (cancelled) {
              return;
            }

            const anchorLinks = searchHitBssids.map((anchor, idx) => ({
              anchor,
              links: anchorResults[idx]?.links,
            }));

            searchAdjacency = buildAdjacencyFromApiLinks(
              visibleSet,
              batchResult?.links,
              anchorLinks
            );
          }

          const groupMap = buildSiblingGroupMap(visibleSet, searchAdjacency);
          const missing = getMissingSiblingBssids(groupMap, visibleSet);

          logSiblingTopology('useSiblingLinks.searchComponent', {
            quickSearch: quickSearch.trim(),
            visibleBssids,
            componentSizes: componentSizesFromGroupMap(groupMap),
            graphMapSize: groupMap.size,
            missingHydrationBssids: missing,
          });

          setVisibleSiblingGroupMap(groupMap);

          const hydrationKey = generateHydrationKey(groupMap, missing);
          if (hydrationKey === prevHydrationKeyRef.current) {
            if (!cancelled) {
              setSiblingHydrating(false);
            }
            return;
          }
          prevHydrationKeyRef.current = hydrationKey;

          if (missing.length > 0) {
            try {
              const chunks = chunkBssids(missing);

              const results = await Promise.allSettled(
                chunks.map((chunk) => networkApi.getNetworksByBssids(chunk))
              );

              if (!cancelled) {
                const hydrationRes = processHydrationSettledResults(
                  results,
                  chunks,
                  0,
                  mapApiRowToNetwork
                );

                // Log any chunk failures
                results.forEach((res, idx) => {
                  if (res.status === 'rejected') {
                    logError(`Batch sibling hydration chunk ${idx} failed`, res.reason);
                  }
                });

                setMissingSiblingNetworks(hydrationRes.hydrated);
                setHydrationFailedBssids(hydrationRes.failed);
                setNonRenderableBssids(hydrationRes.nonRenderable);
                setMissingDbBssids(hydrationRes.missingDb);

                logSiblingTopology('useSiblingLinks.hydration', {
                  requested: missing.length,
                  successCount: hydrationRes.hydrated.length,
                  failedBssids: hydrationRes.failed,
                  hydratedBssids: hydrationRes.hydrated.map((n: NetworkRow) =>
                    normalizeBssid(n.bssid)
                  ),
                });
              }
            } catch (err) {
              if (!cancelled) {
                logError('Sibling batch hydration crash', err);
                setMissingSiblingNetworks([]);
                setHydrationFailedBssids(missing);
                setNonRenderableBssids([]);
                setMissingDbBssids([]);
              }
            } finally {
              if (!cancelled) {
                setSiblingHydrating(false);
              }
            }
          } else {
            setMissingSiblingNetworks([]);
            setHydrationFailedBssids([]);
            setNonRenderableBssids([]);
            setMissingDbBssids([]);
            if (!cancelled) {
              setSiblingHydrating(false);
            }
          }
          return;
        }

        let adjacency: Map<string, Set<string>>;

        if (hasPrecomputedSiblings(networks)) {
          // Build adjacency locally from precomputed sibling_bssids (NO network requests!)
          adjacency = buildAdjacencyFromPrecomputed(visibleSet, networks);
        } else {
          // Fallback: Legacy API requests when precomputed sibling_bssids are missing
          const batchResult = await networkApi.getNetworkSiblingLinksBatch(visibleBssids);
          if (cancelled) {
            return;
          }

          // Full star per visible row — batch OR-query can miss transitive/off-filter siblings.
          const anchorResults = await Promise.all(
            visibleBssids.map((bssid) => networkApi.getNetworkSiblingLinks(bssid))
          );
          if (cancelled) {
            return;
          }

          const anchorLinks = visibleBssids.map((anchor, idx) => ({
            anchor,
            links: anchorResults[idx]?.links,
          }));

          adjacency = buildAdjacencyFromApiLinks(visibleSet, batchResult?.links, anchorLinks);
        }

        const edgeCount = [...adjacency.values()].reduce((sum, s) => sum + s.size, 0) / 2;
        const groupMap = buildSiblingGroupMap(visibleSet, adjacency);
        const missing = getMissingSiblingBssids(groupMap, visibleSet);

        logSiblingTopology('useSiblingLinks', {
          visibleBssids,
          edgeCount,
          graphMapSize: groupMap.size,
          componentSizes: componentSizesFromGroupMap(groupMap),
          missingHydrationBssids: missing,
        });

        setVisibleSiblingGroupMap(groupMap);

        const hydrationKey = generateHydrationKey(groupMap, missing);
        if (hydrationKey === prevHydrationKeyRef.current) {
          if (!cancelled) {
            setSiblingHydrating(false);
          }
          return;
        }
        prevHydrationKeyRef.current = hydrationKey;

        if (missing.length > 0) {
          try {
            const chunks = chunkBssids(missing);

            const results = await Promise.allSettled(
              chunks.map((chunk) => networkApi.getNetworksByBssids(chunk))
            );

            if (!cancelled) {
              const hydrationRes = processHydrationSettledResults(
                results,
                chunks,
                0,
                mapApiRowToNetwork
              );

              // Log any chunk failures
              results.forEach((res, idx) => {
                if (res.status === 'rejected') {
                  logError(`Batch sibling hydration chunk ${idx} failed`, res.reason);
                }
              });

              setMissingSiblingNetworks(hydrationRes.hydrated);
              setHydrationFailedBssids(hydrationRes.failed);
              setNonRenderableBssids(hydrationRes.nonRenderable);
              setMissingDbBssids(hydrationRes.missingDb);

              logSiblingTopology('useSiblingLinks.hydration', {
                requested: missing.length,
                successCount: hydrationRes.hydrated.length,
                failedBssids: hydrationRes.failed,
                hydratedBssids: hydrationRes.hydrated.map((n: NetworkRow) =>
                  normalizeBssid(n.bssid)
                ),
              });
            }
          } catch (err) {
            if (!cancelled) {
              logError('Sibling batch hydration crash', err);
              setMissingSiblingNetworks([]);
              setHydrationFailedBssids(missing);
              setNonRenderableBssids([]);
              setMissingDbBssids([]);
            }
          } finally {
            if (!cancelled) {
              setSiblingHydrating(false);
            }
          }
        } else {
          setMissingSiblingNetworks([]);
          setHydrationFailedBssids([]);
          setNonRenderableBssids([]);
          setMissingDbBssids([]);
          if (!cancelled) {
            setSiblingHydrating(false);
          }
        }
      } catch (error) {
        if (!cancelled) {
          logError('Failed to load visible sibling groups', error);
          setVisibleSiblingGroupMap(new Map());
          setMissingSiblingNetworks([]);
          setHydrationFailedBssids([]);
          prevHydrationKeyRef.current = '';
          setSiblingHydrating(false);
        }
      }
    };

    void loadVisibleSiblingGroups();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, networks, quickSearch]);

  return {
    linkedSiblingBssids,
    visibleSiblingGroupMap,
    setLinkedSiblingBssids,
    missingSiblingNetworks,
    hydrationFailedBssids,
    nonRenderableBssids,
    missingDbBssids,
    siblingHydrating,
  };
};
