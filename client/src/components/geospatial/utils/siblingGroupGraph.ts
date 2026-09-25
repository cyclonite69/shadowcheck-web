import type { NetworkRow } from '../../../types/network';

export function normalizeBssid(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase();
}

export function addUndirectedEdge(
  adjacency: Map<string, Set<string>>,
  aRaw: unknown,
  bRaw: unknown
): void {
  const a = normalizeBssid(aRaw);
  const b = normalizeBssid(bRaw);
  if (!a || !b || a === b) {
    return;
  }
  if (!adjacency.has(a)) {
    adjacency.set(a, new Set());
  }
  if (!adjacency.has(b)) {
    adjacency.set(b, new Set());
  }
  adjacency.get(a)?.add(b);
  adjacency.get(b)?.add(a);
}

/**
 * Connected components (size >= 2) seeded from visible BSSIDs.
 * Off-list nodes are included when reachable via adjacency edges.
 */
export function buildSiblingGroupMap(
  visibleSet: Set<string>,
  adjacency: Map<string, Set<string>>
): Map<string, string> {
  const groupMap = new Map<string, string>();
  const visited = new Set<string>();
  let groupCounter = 1;

  const sortedVisible = Array.from(visibleSet).sort();
  for (const start of sortedVisible) {
    if (visited.has(start)) {
      continue;
    }
    const neighbors = adjacency.get(start);
    if (!neighbors || neighbors.size === 0) {
      continue;
    }

    const stack = [start];
    const component: string[] = [];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      component.push(current);
      for (const next of adjacency.get(current) || []) {
        if (!visited.has(next)) {
          stack.push(next);
        }
      }
    }

    if (component.length < 2) {
      continue;
    }
    const groupId = `S${groupCounter}`;
    groupCounter += 1;
    for (const bssid of component) {
      groupMap.set(bssid, groupId);
    }
  }

  return groupMap;
}

export function serializeGroupMap(groupMap: Map<string, string>): string {
  return [...groupMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bssid, gid]) => `${bssid}:${gid}`)
    .join('|');
}

export interface PatternGroupsResult {
  groupMap: Map<string, string>;
  groupMembers: Map<string, string[]>;
}

function lastOctet(bssid: string): number {
  const parts = bssid.split(':');
  return parseInt(parts[parts.length - 1] ?? '00', 16);
}

/**
 * Display grouping from canonical siblingGroupMap only — no intersection with visible rows.
 */
/**
 * Merge one or more DB component BSSID lists into a single group map (union overlapping components).
 */
export function mergeSiblingComponentsIntoGroupMap(components: string[][]): Map<string, string> {
  const groupMap = new Map<string, string>();
  let groupCounter = 1;

  const assignGroup = (members: string[], preferredGid?: string) => {
    const gid = preferredGid ?? `S${groupCounter++}`;
    for (const bssid of members) {
      groupMap.set(bssid, gid);
    }
    return gid;
  };

  for (const raw of components) {
    const members = raw.map((b) => normalizeBssid(b)).filter(Boolean);
    if (members.length < 2) {
      continue;
    }

    const existingGids = new Set(
      members.map((b) => groupMap.get(b)).filter((g): g is string => Boolean(g))
    );

    if (existingGids.size === 0) {
      assignGroup(members);
      continue;
    }

    const gid = [...existingGids][0];
    assignGroup(members, gid);
    for (const otherGid of existingGids) {
      if (otherGid === gid) {
        continue;
      }
      for (const [bssid, mapped] of groupMap) {
        if (mapped === otherGid) {
          groupMap.set(bssid, gid);
        }
      }
    }
  }

  return groupMap;
}

export function buildPatternGroupsFromCanonicalMap(
  siblingGroupMap: Map<string, string>
): PatternGroupsResult {
  const groupMap = new Map<string, string>();
  const groupMembers = new Map<string, string[]>();

  if (siblingGroupMap.size === 0) {
    return { groupMap, groupMembers };
  }

  for (const [bssid, groupId] of siblingGroupMap) {
    const bssidUpper = normalizeBssid(bssid);
    if (!bssidUpper) {
      continue;
    }
    groupMap.set(bssidUpper, groupId);
    const arr = groupMembers.get(groupId) ?? [];
    arr.push(bssidUpper);
    groupMembers.set(groupId, arr);
  }

  for (const [groupId, members] of groupMembers) {
    if (members.length >= 2) {
      members.sort((a, b) => lastOctet(a) - lastOctet(b));
    } else {
      for (const m of members) {
        groupMap.delete(m);
      }
      groupMembers.delete(groupId);
    }
  }

  return { groupMap, groupMembers };
}

export interface ExpandSiblingSearchResult {
  networks: NetworkRow[];
  unresolvedBssids: string[];
}

/**
 * When a quick-search is active, include every member of a sibling group if any member
 * matched the API filter (present in `searchResultNetworks`).
 */
export function expandNetworksForSiblingSearch(
  searchResultNetworks: NetworkRow[],
  missingSiblingNetworks: NetworkRow[],
  visibleSiblingGroupMap: Map<string, string>,
  quickSearch: string
): ExpandSiblingSearchResult {
  const searchHits = new Set(
    searchResultNetworks.map((n) => normalizeBssid(n.bssid)).filter(Boolean)
  );

  const includeBssids = new Set(searchHits);
  const hasSearch = quickSearch.trim().length > 0;

  if (hasSearch && visibleSiblingGroupMap.size > 0 && searchHits.size > 0) {
    const groupsWithHit = new Set<string>();
    for (const bssid of searchHits) {
      const gid = visibleSiblingGroupMap.get(bssid);
      if (gid) {
        groupsWithHit.add(gid);
      }
    }
    for (const [bssid, gid] of visibleSiblingGroupMap) {
      if (groupsWithHit.has(gid)) {
        includeBssids.add(bssid);
      }
    }
  } else if (!hasSearch) {
    for (const bssid of visibleSiblingGroupMap.keys()) {
      includeBssids.add(bssid);
    }
  }

  const byBssid = new Map<string, NetworkRow>();
  for (const net of searchResultNetworks) {
    const bssid = normalizeBssid(net.bssid);
    if (!bssid) {
      continue;
    }
    if (!hasSearch || includeBssids.has(bssid)) {
      byBssid.set(bssid, net);
    }
  }

  for (const net of missingSiblingNetworks) {
    const bssid = normalizeBssid(net.bssid);
    if (!bssid || byBssid.has(bssid)) {
      continue;
    }
    if (!hasSearch || includeBssids.has(bssid)) {
      byBssid.set(bssid, net);
    }
  }

  const unresolvedBssids: string[] = [];
  for (const bssid of includeBssids) {
    if (!byBssid.has(bssid)) {
      unresolvedBssids.push(bssid);
    }
  }

  let networks: NetworkRow[];

  if (!hasSearch) {
    let allNetworks = searchResultNetworks;
    if (missingSiblingNetworks.length > 0) {
      const loaded = new Set(searchResultNetworks.map((n) => normalizeBssid(n.bssid)));
      const extras = missingSiblingNetworks.filter(
        (n) => n.bssid && !loaded.has(normalizeBssid(n.bssid))
      );
      if (extras.length > 0) {
        allNetworks = [...searchResultNetworks, ...extras];
      }
    }
    networks = regroupSiblingNetworks(allNetworks, visibleSiblingGroupMap);
  } else {
    const expanded: NetworkRow[] = [];
    for (const bssid of includeBssids) {
      const row = byBssid.get(bssid);
      if (row) {
        expanded.push(row);
      }
    }
    networks =
      visibleSiblingGroupMap.size === 0
        ? expanded
        : regroupSiblingNetworks(expanded, visibleSiblingGroupMap);
  }

  return { networks, unresolvedBssids };
}

export function regroupSiblingNetworks(
  networks: NetworkRow[],
  visibleSiblingGroupMap: Map<string, string>
): NetworkRow[] {
  if (visibleSiblingGroupMap.size === 0) {
    return networks;
  }

  const grouped: NetworkRow[] = [];
  const emitted = new Set<string>();

  for (const net of networks) {
    const bssid = normalizeBssid(net.bssid);
    const gid = bssid ? visibleSiblingGroupMap.get(bssid) : undefined;
    if (!gid) {
      grouped.push(net);
      continue;
    }
    if (emitted.has(gid)) {
      continue;
    }
    emitted.add(gid);
    networks
      .filter((n) => {
        const nb = normalizeBssid(n.bssid);
        return nb && visibleSiblingGroupMap.get(nb) === gid;
      })
      .forEach((n) => grouped.push(n));
  }

  return grouped;
}

export interface ParsedSearch {
  matchField: 'ssid' | 'bssid' | 'manufacturer';
  matchStr: string;
}

export function parseQuickSearch(quickSearch: string): ParsedSearch {
  const searchStr = quickSearch.trim().toLowerCase();
  const prefixMatch = quickSearch.trim().match(/^([sbm]):\s*(.+)$/i);
  let matchField: 'ssid' | 'bssid' | 'manufacturer' = 'ssid';
  let matchStr = searchStr;

  if (prefixMatch) {
    const prefix = prefixMatch[1].toLowerCase();
    matchStr = prefixMatch[2].trim().toLowerCase();
    if (prefix === 'm') {
      matchField = 'manufacturer';
    } else if (prefix === 'b') {
      matchField = 'bssid';
    }
  }

  return { matchField, matchStr };
}

export function filterNetworksBySearch(networks: NetworkRow[], quickSearch: string): NetworkRow[] {
  const searchStr = quickSearch.trim();
  if (searchStr.length === 0) {
    return networks;
  }

  const { matchField, matchStr } = parseQuickSearch(quickSearch);

  return networks.filter((n) => {
    switch (matchField) {
      case 'manufacturer':
        return n.manufacturer?.toLowerCase().includes(matchStr);
      case 'bssid':
        return n.bssid.toLowerCase().includes(matchStr);
      default:
        return n.ssid?.toLowerCase().includes(matchStr) || n.bssid.toLowerCase().includes(matchStr);
    }
  });
}

export interface HydrationResults {
  hydrated: NetworkRow[];
  failed: string[];
  nonRenderable: string[];
  missingDb: string[];
}

export function processHydrationSettledResults(
  results: PromiseSettledResult<{ data: any[]; unresolved?: Record<string, string> }>[],
  chunks: string[][],
  existingHydratedCount: number,
  mapApiRowToNetwork: (row: any, fallbackId: number) => NetworkRow
): HydrationResults {
  const hydrated: NetworkRow[] = [];
  const failed: string[] = [];
  const nonRenderable: string[] = [];
  const missingDb: string[] = [];

  results.forEach((res, idx) => {
    const chunkBssids = chunks[idx];
    if (res.status === 'fulfilled' && res.value) {
      const { data, unresolved } = res.value;
      const returnedBssids = new Set((data || []).map((row: any) => normalizeBssid(row.bssid)));

      if (Array.isArray(data)) {
        for (const row of data) {
          if (row) {
            hydrated.push(mapApiRowToNetwork(row, 50000 + existingHydratedCount + hydrated.length));
          }
        }
      }

      for (const bssid of chunkBssids) {
        const norm = normalizeBssid(bssid);
        if (!norm) {
          continue;
        }
        if (!returnedBssids.has(norm)) {
          const type = unresolved ? unresolved[norm] : undefined;
          if (type === 'non_renderable') {
            nonRenderable.push(norm);
          } else if (type === 'missing') {
            missingDb.push(norm);
          } else {
            missingDb.push(norm);
          }
        }
      }
    } else {
      for (const bssid of chunkBssids) {
        const norm = normalizeBssid(bssid);
        if (norm) {
          failed.push(norm);
        }
      }
    }
  });

  return { hydrated, failed, nonRenderable, missingDb };
}

export function hasPrecomputedSiblings(networks: NetworkRow[]): boolean {
  return networks.some((n) => Array.isArray(n.sibling_bssids) && n.sibling_bssids.length > 0);
}

export function buildAdjacencyFromPrecomputed(
  visibleSet: Set<string>,
  targetNetworks: NetworkRow[]
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const bssid of visibleSet) {
    adjacency.set(bssid, new Set());
  }

  for (const network of targetNetworks) {
    const anchor = normalizeBssid(network.bssid);
    if (!anchor) {
      continue;
    }

    const siblings = Array.isArray(network.sibling_bssids) ? network.sibling_bssids : [];
    for (const sibling of siblings) {
      const normalizedSibling = normalizeBssid(sibling);
      if (!normalizedSibling) {
        continue;
      }

      addUndirectedEdge(adjacency, anchor, normalizedSibling);
    }
  }

  return adjacency;
}

export function generateHydrationKey(groupMap: Map<string, string>, missing: string[]): string {
  const sortedMissing = [...missing].sort().join(',');
  return `${serializeGroupMap(groupMap)}::${sortedMissing}`;
}

export function getUnresolvedSearchBssids(
  unresolvedBssids: string[],
  hydrationFailed: string[],
  nonRenderable: string[],
  missingDb: string[]
): string[] {
  const classified = new Set<string>([
    ...(hydrationFailed || []),
    ...(nonRenderable || []),
    ...(missingDb || []),
  ]);
  return unresolvedBssids.filter((bssid) => !classified.has(bssid));
}

export function buildAdjacencyFromApiLinks(
  visibleSet: Set<string>,
  batchLinks: unknown,
  anchorLinks: { anchor: string; links: unknown }[]
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const bssid of visibleSet) {
    adjacency.set(bssid, new Set());
  }

  const batchEdges = Array.isArray(batchLinks) ? batchLinks : [];
  for (const edge of batchEdges) {
    addUndirectedEdge(adjacency, edge?.bssid_a, edge?.bssid_b);
  }

  for (const item of anchorLinks) {
    const anchor = normalizeBssid(item.anchor);
    if (!anchor) {
      continue;
    }
    const links = Array.isArray(item.links) ? item.links : [];
    for (const row of links) {
      addUndirectedEdge(adjacency, anchor, row?.sibling_bssid);
    }
  }

  return adjacency;
}

export function getMissingSiblingBssids(
  groupMap: Map<string, string>,
  visibleSet: Set<string>
): string[] {
  return [...groupMap.keys()].filter((bssid) => !visibleSet.has(bssid)).sort();
}

export function chunkBssids(bssids: string[], chunkSize = 100): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < bssids.length; i += chunkSize) {
    chunks.push(bssids.slice(i, i + chunkSize));
  }
  return chunks;
}
