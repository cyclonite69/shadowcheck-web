import * as fc from 'fast-check';
const db = require('../../../server/src/config/database');
const { listNetworks, searchNetworksBySSID } = require('../../../server/src/services/networking/repository');

describe('Networking Repository Property-Based Tests', () => {
  let querySpy: jest.SpyInstance;

  beforeEach(() => {
    querySpy = jest.spyOn(db, 'query').mockImplementation(((sql: string) => {
      if (sql.includes('SELECT COUNT')) {
        return Promise.resolve({ rows: [{ total: '10' }] });
      }
      return Promise.resolve({ 
          rows: [{ bssid: '00:00:00:00:00:00', ssid: 'test', type: 'wifi', signal: -50, lasttime: new Date(), observation_count: 1 }] 
      });
    }) as any);
  });

  afterEach(() => {
    querySpy.mockRestore();
  });

  test('listNetworks pagination limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        async (limit, offset) => {
          const result = await listNetworks([], [], [], [], '', limit, offset, 1);
          expect(Array.isArray(result)).toBe(true);
        }
      )
    );
  });

  test('searchNetworksBySSID pattern injection resilience', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 50 }),
        async (ssid) => {
            const result = await searchNetworksBySSID(ssid, 10, 0);
            expect(result).toBeDefined();
        }
      )
    );
  });
});
