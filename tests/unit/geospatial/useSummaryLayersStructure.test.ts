/**
 * Stage 1 structural role lock for
 * client/src/components/geospatial/hooks/useSummaryLayers.ts.
 *
 * This Mapbox-bound hook has no public return surface. Its observable contract
 * is the summary source/layer structure, marker distinction, and safe retry
 * lifecycle. Runtime rendering remains outside JSDOM's reliable scope.
 */

export {};

import fs from 'fs';
import path from 'path';

describe('useSummaryLayers hook structure — Stage 1 role lock', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useSummaryLayers.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports the side-effect hook as its sole named export', () => {
    expect(source).toContain('export const useSummaryLayers = ({');
    expect(source).not.toContain('return {');
    const exportLines = source.split('\n').filter((line) => line.startsWith('export '));
    expect(exportLines).toHaveLength(1);
  });

  test('accepts the complete summary-layer input contract', () => {
    const signature = source.match(
      /export const useSummaryLayers = \(\{([\s\S]*?)\}: SummaryLayerProps\) => \{/
    );
    expect(signature).not.toBeNull();
    const inputBlock = signature![1];

    [
      'mapReady',
      'mapRef',
      'mapboxRef',
      'mapStyle',
      'activeObservationSets',
      'networkLookup',
      'showNetworkSummaries = false',
    ].forEach((property) => expect(inputBlock).toContain(property));
  });

  test('keeps the network lookup current without recreating map layers', () => {
    expect(source).toContain('const networkLookupRef = useRef(networkLookup);');
    expect(source).toContain('networkLookupRef.current = networkLookup;');
    expect(source).toContain('const network = networkLookupRef.current.get(set.bssid);');
  });

  test('registers the summary source and all three marker layers by identity', () => {
    expect(source).toContain("map.addSource('network-summaries', {");
    expect(source).toContain("id: 'network-centroid-markers'");
    expect(source).toContain("id: 'network-weighted-markers'");
    expect(source).toContain("id: 'network-marker-labels'");
    expect(source).toContain("source: 'network-summaries'");
  });

  test('preserves centroid and weighted marker distinctions', () => {
    expect(source).toContain("filter: ['==', ['get', 'markerType'], 'centroid']");
    expect(source).toContain("filter: ['==', ['get', 'markerType'], 'weighted']");
    expect(source).toContain('coordinates: [network.centroid_lon, network.centroid_lat]');
    expect(source).toContain('coordinates: [network.weighted_lon, network.weighted_lat]');
    expect(source).toContain("markerType: 'centroid'");
    expect(source).toContain("markerType: 'weighted'");
    expect(source).toContain(
      "'text-field': ['case', ['==', ['get', 'markerType'], 'centroid'], '◊', '▲']"
    );
  });

  test('clears summary data when the markers are disabled', () => {
    expect(source).toContain('if (showNetworkSummaries && activeObservationSets.length > 0) {');
    expect(source).toMatch(
      /else\s*\{\s*(?:\/\/[^\n]*\s*)?source\.setData\(\{\s*type:\s*'FeatureCollection',\s*features:\s*\[\],\s*\}\);/s
    );
  });

  test('retries after style loading and unregisters the exact retry handler', () => {
    expect(source).toContain('const handleStyleLoad = () => {');
    expect(source).toContain("map.once('style.load', handleStyleLoad);");
    expect(source).toContain("map.off('style.load', handleStyleLoad);");
  });
});
