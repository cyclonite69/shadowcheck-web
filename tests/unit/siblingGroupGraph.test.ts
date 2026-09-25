import {
  addUndirectedEdge,
  buildPatternGroupsFromCanonicalMap,
  buildSiblingGroupMap,
  expandNetworksForSiblingSearch,
  mergeSiblingComponentsIntoGroupMap,
  hasPrecomputedSiblings,
  buildAdjacencyFromPrecomputed,
  generateHydrationKey,
  getUnresolvedSearchBssids,
} from '../../client/src/components/geospatial/utils/siblingGroupGraph';
import type { NetworkRow } from '../../client/src/types/network';

function row(bssid: string, ssid: string): NetworkRow {
  return { bssid, ssid } as NetworkRow;
}

describe('siblingGroupGraph', () => {
  describe('buildSiblingGroupMap', () => {
    it('merges off-list nodes reachable from visible seeds', () => {
      const visible = new Set(['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02']);
      const adjacency = new Map<string, Set<string>>();
      for (const b of visible) {
        adjacency.set(b, new Set());
      }
      addUndirectedEdge(adjacency, 'AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02');
      addUndirectedEdge(adjacency, 'AA:BB:CC:DD:EE:02', 'BE:61:A3:7C:BD:09');

      const groupMap = buildSiblingGroupMap(visible, adjacency);
      expect(groupMap.get('BE:61:A3:7C:BD:09')).toBe(groupMap.get('AA:BB:CC:DD:EE:01'));
      expect(groupMap.size).toBe(3);
    });
  });

  describe('mergeSiblingComponentsIntoGroupMap', () => {
    it('merges overlapping DB components into one group id', () => {
      const map = mergeSiblingComponentsIntoGroupMap([
        ['8C:61:A3:7C:BD:08', '8C:61:A3:7C:BD:09'],
        ['8C:61:A3:7C:BD:09', 'BE:61:A3:7C:BD:09'],
      ]);
      expect(map.get('8C:61:A3:7C:BD:08')).toBe(map.get('BE:61:A3:7C:BD:09'));
      expect(map.get('8C:61:A3:7C:BD:09')).toBe(map.get('BE:61:A3:7C:BD:09'));
      expect(new Set(map.values()).size).toBe(1);
    });
  });

  describe('buildPatternGroupsFromCanonicalMap', () => {
    it('keeps all canonical members even when only one row is hydrated', () => {
      const canonical = new Map<string, string>([
        ['8C:61:A3:7C:BD:08', 'S1'],
        ['BE:61:A3:7C:BD:09', 'S1'],
      ]);
      const { groupMap, groupMembers } = buildPatternGroupsFromCanonicalMap(canonical);
      expect(groupMap.size).toBe(2);
      expect(groupMembers.get('S1')).toEqual(
        expect.arrayContaining(['8C:61:A3:7C:BD:08', 'BE:61:A3:7C:BD:09'])
      );
    });
  });

  describe('expandNetworksForSiblingSearch', () => {
    const groupMap = new Map<string, string>([
      ['8C:61:A3:7C:BD:08', 'S1'],
      ['9E:61:A3:7C:BD:09', 'S1'],
      ['BE:61:A3:7C:BD:09', 'S1'],
    ]);

    it('expands search hits to full sibling group', () => {
      const searchResults = [
        row('8C:61:A3:7C:BD:08', 'undertaker'),
        row('8C:61:A3:7C:BD:07', 'undertaker'),
      ];
      const missing = [row('BE:61:A3:7C:BD:09', 'Xfinity')];

      const { networks: expanded, unresolvedBssids } = expandNetworksForSiblingSearch(
        searchResults,
        missing,
        groupMap,
        'undertaker'
      );

      const bssids = expanded.map((n) => n.bssid?.toUpperCase());
      expect(bssids).toContain('BE:61:A3:7C:BD:09');
      expect(bssids).toContain('8C:61:A3:7C:BD:08');
      expect(unresolvedBssids).toEqual(expect.arrayContaining(['9E:61:A3:7C:BD:09']));
      expect(unresolvedBssids).not.toContain('BE:61:A3:7C:BD:09');
    });

    it('expands from Xfinity search hit to undertaker siblings', () => {
      const searchResults = [row('BE:61:A3:7C:BD:09', 'Xfinity')];
      const missing = [
        row('8C:61:A3:7C:BD:08', 'undertaker'),
        row('9E:61:A3:7C:BD:09', 'undertaker'),
      ];

      const { networks: expanded } = expandNetworksForSiblingSearch(
        searchResults,
        missing,
        groupMap,
        'Xfinity'
      );

      const bssids = expanded.map((n) => n.bssid?.toUpperCase());
      expect(bssids).toContain('8C:61:A3:7C:BD:08');
      expect(bssids).toContain('BE:61:A3:7C:BD:09');
    });

    it('without search merges all missing siblings', () => {
      const searchResults = [row('8C:61:A3:7C:BD:08', 'undertaker')];
      const missing = [row('BE:61:A3:7C:BD:09', 'Xfinity')];

      const { networks: expanded } = expandNetworksForSiblingSearch(
        searchResults,
        missing,
        groupMap,
        ''
      );

      expect(expanded.map((n) => n.bssid?.toUpperCase())).toContain('BE:61:A3:7C:BD:09');
    });
  });

  describe('hasPrecomputedSiblings', () => {
    it('returns true if any network has non-empty sibling_bssids', () => {
      const networks = [
        { bssid: 'AA:BB:CC:DD:EE:01' } as unknown as NetworkRow,
        {
          bssid: 'AA:BB:CC:DD:EE:02',
          sibling_bssids: ['AA:BB:CC:DD:EE:03'],
        } as unknown as NetworkRow,
      ];
      expect(hasPrecomputedSiblings(networks)).toBe(true);
    });

    it('returns false if sibling_bssids are empty or undefined', () => {
      const networks = [
        { bssid: 'AA:BB:CC:DD:EE:01' } as unknown as NetworkRow,
        { bssid: 'AA:BB:CC:DD:EE:02', sibling_bssids: [] } as unknown as NetworkRow,
      ];
      expect(hasPrecomputedSiblings(networks)).toBe(false);
    });
  });

  describe('buildAdjacencyFromPrecomputed', () => {
    it('builds undirected adjacency correctly from precomputed sibling_bssids', () => {
      const visibleSet = new Set(['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02']);
      const networks = [
        {
          bssid: 'AA:BB:CC:DD:EE:01',
          sibling_bssids: ['AA:BB:CC:DD:EE:02'],
        } as unknown as NetworkRow,
      ];

      const adjacency = buildAdjacencyFromPrecomputed(visibleSet, networks);

      expect(adjacency.has('AA:BB:CC:DD:EE:01')).toBe(true);
      expect(adjacency.has('AA:BB:CC:DD:EE:02')).toBe(true);
      expect(adjacency.get('AA:BB:CC:DD:EE:01')?.has('AA:BB:CC:DD:EE:02')).toBe(true);
      expect(adjacency.get('AA:BB:CC:DD:EE:02')?.has('AA:BB:CC:DD:EE:01')).toBe(true);
    });
  });

  describe('generateHydrationKey', () => {
    it('generates correct key and does not mutate the input array', () => {
      const groupMap = new Map([
        ['AA:BB:CC:DD:EE:01', 'S1'],
        ['AA:BB:CC:DD:EE:02', 'S1'],
      ]);
      const missing = ['AA:BB:CC:DD:EE:04', 'AA:BB:CC:DD:EE:03'];
      const missingCopy = [...missing];

      const key = generateHydrationKey(groupMap, missing);
      expect(key).toBe(
        'AA:BB:CC:DD:EE:01:S1|AA:BB:CC:DD:EE:02:S1::AA:BB:CC:DD:EE:03,AA:BB:CC:DD:EE:04'
      );

      // Verify no mutation occurred on the original missing array
      expect(missing).toEqual(missingCopy);
      expect(missing[0]).toBe('AA:BB:CC:DD:EE:04');
    });
  });

  describe('getUnresolvedSearchBssids', () => {
    it('filters out BSSIDs that exist in hydrationFailed, nonRenderable, or missingDb lists', () => {
      const unresolved = [
        'AA:BB:CC:DD:EE:01',
        'AA:BB:CC:DD:EE:02',
        'AA:BB:CC:DD:EE:03',
        'AA:BB:CC:DD:EE:04',
      ];
      const hydrationFailed = ['AA:BB:CC:DD:EE:01'];
      const nonRenderable = ['AA:BB:CC:DD:EE:02'];
      const missingDb = ['AA:BB:CC:DD:EE:03'];

      const result = getUnresolvedSearchBssids(
        unresolved,
        hydrationFailed,
        nonRenderable,
        missingDb
      );
      expect(result).toEqual(['AA:BB:CC:DD:EE:04']);
    });

    it('returns original unresolvedBssids if all classification arrays are empty', () => {
      const unresolved = ['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02'];
      const result = getUnresolvedSearchBssids(unresolved, [], [], []);
      expect(result).toEqual(['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02']);
    });
  });
});
