export {};

import { SqlFragmentLibrary } from '../../server/src/services/filterQueryBuilder/SqlFragmentLibrary';

describe('SqlFragmentLibrary', () => {
  test('selectNetwork projection fragments include schema-compatible fields', () => {
    const manufacturer = SqlFragmentLibrary.selectManufacturerFields('rm');
    const tags = SqlFragmentLibrary.selectThreatTagFields('nt');

    expect(manufacturer).toContain("to_jsonb(rm)->>'organization_name'");
    expect(manufacturer).toContain('AS manufacturer');
    expect(tags).toContain("to_jsonb(nt)->>'threat_tag'");
    expect(tags).toContain('AS is_ignored');
  });

  test('network tags lateral join binds caller alias', () => {
    const join = SqlFragmentLibrary.joinNetworkTagsLateral('ne', 'nt');
    expect(join).toContain('LEFT JOIN LATERAL');
    expect(join).toContain('UPPER(ne.bssid)');
    expect(join).toContain(') nt ON TRUE');
  });

  test('radio manufacturer join composes expected OUI expression', () => {
    const join = SqlFragmentLibrary.joinRadioManufacturers('l', 'rm');
    expect(join).toContain('app.radio_manufacturers rm');
    expect(join).toContain("SUBSTRING(l.bssid, 1, 8)");
  });

  test('observation coordinate fields use geometry fallback', () => {
    const fields = SqlFragmentLibrary.selectObservationCoordinateFields('o');
    expect(fields).toContain('COALESCE(o.lat, ST_Y(o.geom::geometry)) AS lat');
    expect(fields).toContain('COALESCE(o.lon, ST_X(o.geom::geometry)) AS lon');
  });
});
