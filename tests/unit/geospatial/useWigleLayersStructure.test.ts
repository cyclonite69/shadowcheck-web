/**
 * Stage 1 structural role lock for
 * client/src/components/geospatial/hooks/useWigleLayers.ts.
 *
 * This Mapbox-bound hook has no public return object. The lock preserves its
 * typed input boundary plus WiGLE source, layer, interaction, and lifecycle
 * wiring without attempting WebGL rendering under JSDOM.
 */

export {};

import fs from 'fs';
import path from 'path';

describe('useWigleLayers hook structure — Stage 1 role lock', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useWigleLayers.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports the WiGLE observation types and side-effect hook', () => {
    expect(source).toContain('export type WigleObservation = {');
    expect(source).toContain('export type WigleObservationsState = {');
    expect(source).toContain('export const useWigleLayers = ({');
    expect(source).not.toContain('return {');
  });

  test('accepts the complete WiGLE-layer input contract', () => {
    const signature = source.match(
      /export const useWigleLayers = \(\{([\s\S]*?)\}: WigleLayerProps\) => \{/
    );
    expect(signature).not.toBeNull();
    const inputBlock = signature![1];

    [
      'mapReady',
      'mapRef',
      'mapboxRef',
      'mapStyle',
      'networkLookup',
      'wigleObservations',
      'isViewportLocked = false',
      'onOpenContextMenu',
      'homeLat',
      'homeLon',
    ].forEach((property) => expect(inputBlock).toContain(property));
  });

  test('keeps callback and network lookup refs current for layer handlers', () => {
    expect(source).toContain('const onOpenContextMenuRef = useRef(onOpenContextMenu);');
    expect(source).toContain('const networkLookupRef = useRef(networkLookup);');
    expect(source).toContain('onOpenContextMenuRef.current = onOpenContextMenu;');
    expect(source).toContain('networkLookupRef.current = networkLookup;');
    expect(source).toContain('onOpenContextMenuRef.current(mockEvent, network);');
  });

  test('registers the WiGLE source and unique and matched layers by identity', () => {
    expect(source).toContain("map.addSource('wigle-observations', {");
    expect(source).toContain("id: 'wigle-unique-points'");
    expect(source).toContain("id: 'wigle-matched-points'");
    expect(source).toContain("source: 'wigle-observations'");
    expect(source).toContain("filter: ['==', ['get', 'source'], 'wigle_unique']");
    expect(source).toContain("filter: ['==', ['get', 'source'], 'matched']");
  });

  test('maps observation coordinates and source identity into the GeoJSON payload', () => {
    expect(source).toContain('coordinates: [obs.lon, obs.lat]');
    expect(source).toContain('source: obs.source,');
    expect(source).toContain('bssid: obs.bssid || wigleObservations.bssid,');
    expect(source).toContain('features: features as any,');
  });

  test('clears the WiGLE source when no observations remain', () => {
    expect(source).toContain('if (wigleObservations.observations.length > 0) {');
    expect(source).toMatch(
      /else\s*\{\s*wigleSource\.setData\(\{\s*type:\s*'FeatureCollection',\s*features:\s*\[\],\s*\}\);/s
    );
  });

  test('binds and cleans up the exact WiGLE layer interaction handlers', () => {
    [
      "map.on('click', 'wigle-unique-points', handleUniqueClick);",
      "map.on('click', 'wigle-matched-points', handleMatchedClick);",
      "map.on('contextmenu', 'wigle-unique-points', handleContextMenu);",
      "map.on('contextmenu', 'wigle-matched-points', handleContextMenu);",
      "map.on('mouseenter', 'wigle-unique-points', handleUniqueEnter);",
      "map.on('mouseleave', 'wigle-unique-points', handleUniqueLeave);",
      "map.on('mouseenter', 'wigle-matched-points', handleMatchedEnter);",
      "map.on('mouseleave', 'wigle-matched-points', handleMatchedLeave);",
      "map.off('click', 'wigle-unique-points', handleUniqueClick);",
      "map.off('click', 'wigle-matched-points', handleMatchedClick);",
      "map.off('contextmenu', 'wigle-unique-points', handleContextMenu);",
      "map.off('contextmenu', 'wigle-matched-points', handleContextMenu);",
      "map.off('mouseenter', 'wigle-unique-points', handleUniqueEnter);",
      "map.off('mouseleave', 'wigle-unique-points', handleUniqueLeave);",
      "map.off('mouseenter', 'wigle-matched-points', handleMatchedEnter);",
      "map.off('mouseleave', 'wigle-matched-points', handleMatchedLeave);",
    ].forEach((handlerWiring) => expect(source).toContain(handlerWiring));
  });

  test('retries on style load and removes the same retry handler', () => {
    expect(source).toContain('const handleStyleLoad = () => {');
    expect(source).toContain("map.once('style.load', handleStyleLoad);");
    expect(source).toContain("map.off('style.load', handleStyleLoad);");
  });
});
