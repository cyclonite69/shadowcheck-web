import fs from 'fs';
import path from 'path';
import { ROUTE_CONFIG } from '../../server/src/config/routeConfig';

const read = (relPath: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');

describe('route cap config drift guards', () => {
  test('ROUTE_CONFIG exposes centralized explorer/network cap values', () => {
    expect(ROUTE_CONFIG.explorer.defaultLimit).toBe(500);
    expect(ROUTE_CONFIG.explorer.maxLimit).toBe(5000);
    expect(ROUTE_CONFIG.explorer.maxOffset).toBe(1000000);
    expect(ROUTE_CONFIG.explorer.maxPage).toBe(1000000);

    expect(ROUTE_CONFIG.networks.maxLimit).toBe(1000);
    expect(ROUTE_CONFIG.networks.maxOffset).toBe(10000000);
    expect(ROUTE_CONFIG.networks.maxObservationCount).toBe(100000000);
    expect(ROUTE_CONFIG.networks.maxBulkBssids).toBe(10000);
  });

  test('explorer/networks route references ROUTE_CONFIG caps', () => {
    const source = read('server/src/api/routes/v1/explorer/networks.ts');
    expect(source).toContain('ROUTE_CONFIG.explorer.defaultLimit');
    expect(source).toContain('ROUTE_CONFIG.explorer.maxLimit');
    expect(source).toContain('ROUTE_CONFIG.explorer.maxOffset');
    expect(source).toContain('ROUTE_CONFIG.explorer.maxPage');
  });

  test('network routes reference ROUTE_CONFIG caps', () => {
    const search = read('server/src/api/routes/v1/networks/search.ts');
    const manufacturer = read('server/src/api/routes/v1/networks/manufacturer.ts');
    const tags = read('server/src/api/routes/v1/networks/tags.ts');
    const list = read('server/src/api/routes/v1/networks/list.ts');

    expect(search).toContain('ROUTE_CONFIG.explorer.maxLimit');
    expect(search).toContain('ROUTE_CONFIG.networks.maxOffset');
    expect(manufacturer).toContain('ROUTE_CONFIG.explorer.maxLimit');
    expect(manufacturer).toContain('ROUTE_CONFIG.networks.maxOffset');
    expect(tags).toContain('ROUTE_CONFIG.networks.maxLimit');
    expect(tags).toContain('ROUTE_CONFIG.networks.maxBulkBssids');
    expect(list).toContain('ROUTE_CONFIG.networks.maxLimit');
    expect(list).toContain('ROUTE_CONFIG.networks.maxOffset');
    expect(list).toContain('ROUTE_CONFIG.networks.maxObservationCount');
  });

  test('legacy hardcoded cap literals are not used in migrated routes', () => {
    const files = [
      read('server/src/api/routes/v1/explorer/networks.ts'),
      read('server/src/api/routes/v1/networks/search.ts'),
      read('server/src/api/routes/v1/networks/manufacturer.ts'),
      read('server/src/api/routes/v1/networks/list.ts'),
    ];
    for (const source of files) {
      expect(source.includes('validateIntegerRange(value, 1, 5000')).toBe(false);
      expect(source.includes('validateIntegerRange(value, 0, 10000000')).toBe(false);
    }
  });
});
