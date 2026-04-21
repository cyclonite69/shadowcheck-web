import fs from 'fs';
import path from 'path';

describe('ETL Pipeline Integrity', () => {
  const fixturesDir = path.join(__dirname, '../../fixtures/etl');

  test('should have valid WiGLE CSV fixture', () => {
    const csvPath = path.join(fixturesDir, 'wigle-sample.csv');
    expect(fs.existsSync(csvPath)).toBe(true);
    const content = fs.readFileSync(csvPath, 'utf-8');
    expect(content).toContain('MAC,SSID,AuthMode');
  });

  test('should have valid KML fixture', () => {
    const kmlPath = path.join(fixturesDir, 'sample.kml');
    expect(fs.existsSync(kmlPath)).toBe(true);
    const content = fs.readFileSync(kmlPath, 'utf-8');
    expect(content).toContain('<kml xmlns');
  });
});
