import { parseArgs, parseGeoJsonFeature } from '../../../scripts/alpr/ingest-national-osm';

describe('national OSM ALPR ingestion helpers', () => {
  it('accepts surveillance, ALPR, and camera-tagged nodes', () => {
    const makeFeature = (id: string, properties: Record<string, unknown>) => ({
      type: 'Feature',
      id,
      properties,
      geometry: { type: 'Point', coordinates: [-74, 40.7] },
    });

    expect(parseGeoJsonFeature(makeFeature('n1001', { man_made: 'surveillance' }))?.osmId).toBe(
      '1001'
    );
    expect(parseGeoJsonFeature(makeFeature('n1002', { 'surveillance:type': 'ALPR' }))?.osmId).toBe(
      '1002'
    );
    expect(
      parseGeoJsonFeature(makeFeature('n1003', { 'surveillance:type': 'camera' }))?.osmId
    ).toBe('1003');
    expect(parseGeoJsonFeature(makeFeature('n1004', { 'camera:type': 'fixed' }))?.osmId).toBe(
      '1004'
    );
  });

  it('rejects invalid IDs, unsupported tags, and invalid point coordinates', () => {
    expect(
      parseGeoJsonFeature({
        id: 'way/1001',
        properties: { 'camera:type': 'fixed' },
        geometry: { type: 'Point', coordinates: [-74, 40.7] },
      })
    ).toBeNull();
    expect(
      parseGeoJsonFeature({
        id: 'n1002',
        properties: { surveillance: 'public' },
        geometry: { type: 'Point', coordinates: [-74, 40.7] },
      })
    ).toBeNull();
    expect(
      parseGeoJsonFeature({
        id: 'n1003',
        properties: { man_made: 'surveillance' },
        geometry: { type: 'Point', coordinates: [181, 40.7] },
      })
    ).toBeNull();
  });

  it('requires an explicit national PBF path and bounds batch sizes', () => {
    expect(() => parseArgs([])).toThrow('--pbf=');
    expect(parseArgs(['--pbf=/data/us-latest.osm.pbf']).batchSize).toBe(2000);
    expect(parseArgs(['--pbf=/data/us-latest.osm.pbf', '--batch-size=5000']).batchSize).toBe(5000);
    expect(() => parseArgs(['--pbf=/data/us-latest.osm.pbf', '--batch-size=500'])).toThrow(
      '1000 through 5000'
    );
  });
});
