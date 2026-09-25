import {
  listTransactions,
  downloadKml,
  syncKmlTransactions,
} from '../../../server/src/services/wigle/wigleKmlSyncService';

// Setup Mock Modules
jest.mock('../../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock('../../../server/src/services/wigle/wigleGateway', () => ({
  wigleGatewayFetch: jest.fn(),
}));

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../server/src/repositories/kmlImportRepository', () => ({
  findKmlFilesByHashes: jest.fn(),
}));

jest.mock('../../../server/src/services/adminImportHistoryService', () => ({
  captureImportMetrics: jest.fn(),
  createImportHistoryEntry: jest.fn(),
  failImportHistory: jest.fn(),
  completeImportSuccess: jest.fn(),
}));

jest.mock('child_process', () => {
  const spawnMockFn = jest.fn();
  return {
    spawn: spawnMockFn,
  };
});

// Import mocked references for setup in tests
const secretsMock = require('../../../server/src/services/secretsManager').default;
const {
  wigleGatewayFetch: wigleGatewayFetchMock,
} = require('../../../server/src/services/wigle/wigleGateway');
const { query: queryMock } = require('../../../server/src/config/database');
const {
  findKmlFilesByHashes: findKmlFilesByHashesMock,
} = require('../../../server/src/repositories/kmlImportRepository');
const historyServiceMock = require('../../../server/src/services/adminImportHistoryService');
const { spawn: spawnMock } = require('child_process');
const { EventEmitter } = require('events');

describe('wigleKmlSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Bulletproof default mock setups to survive Jest resetMocks: true
    secretsMock.get.mockImplementation((key: string) => {
      if (key === 'wigle_api_name') {
        return 'test-user';
      }
      if (key === 'wigle_api_token') {
        return 'test-token';
      }
      return null;
    });

    // Default spawn returns a basic emitter (can be overridden per test)
    spawnMock.mockImplementation(() => {
      const mockChild = new EventEmitter();
      (mockChild as any).stdout = new EventEmitter();
      (mockChild as any).stderr = new EventEmitter();
      return mockChild;
    });
  });

  describe('listTransactions', () => {
    it('throws 503 error if WiGLE credentials are not configured', async () => {
      secretsMock.get.mockImplementation(() => null);

      await expect(listTransactions()).rejects.toThrow('WiGLE API credentials not configured');
    });

    it('returns json response if wigleGatewayFetch is successful and returns ok', async () => {
      const mockJson = jest.fn().mockResolvedValue({ success: true, results: [] });
      wigleGatewayFetchMock.mockResolvedValue({
        ok: true,
        response: {
          ok: true,
          json: mockJson,
        },
      });

      const result = await listTransactions(0, 100);
      expect(result).toEqual({ success: true, results: [] });
      expect(wigleGatewayFetchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'stats',
          endpointType: 'v2/file/transactions',
        })
      );
    });

    it('throws error if wigleGatewayFetch returns ok: false', async () => {
      wigleGatewayFetchMock.mockResolvedValue({
        ok: false,
        error: 'Blocked by gateway policy',
        status: 429,
      });

      await expect(listTransactions()).rejects.toThrow('Blocked by gateway policy');
    });

    it('throws error if response is not ok', async () => {
      wigleGatewayFetchMock.mockResolvedValue({
        ok: true,
        response: {
          ok: false,
          status: 400,
          json: jest.fn().mockResolvedValue({ message: 'Bad request details' }),
        },
      });

      await expect(listTransactions()).rejects.toThrow('Bad request details');
    });
  });

  describe('downloadKml', () => {
    it('throws 503 error if credentials missing', async () => {
      secretsMock.get.mockImplementation(() => null);
      await expect(downloadKml('tx-123')).rejects.toThrow('WiGLE API credentials not configured');
    });

    it('returns a Buffer on successful KML download', async () => {
      const arrayBuffer = new TextEncoder().encode('<kml>data</kml>').buffer;
      wigleGatewayFetchMock.mockResolvedValue({
        ok: true,
        response: {
          ok: true,
          arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
        },
      });

      const res = await downloadKml('tx-123');
      expect(res.toString()).toBe('<kml>data</kml>');
    });

    it('throws error if response is not ok', async () => {
      wigleGatewayFetchMock.mockResolvedValue({
        ok: true,
        response: {
          ok: false,
          status: 404,
          clone: jest.fn().mockReturnValue({
            text: jest.fn().mockResolvedValue('Transaction not found'),
          }),
        },
      });

      await expect(downloadKml('tx-123')).rejects.toThrow('Transaction not found');
    });
  });

  describe('syncKmlTransactions', () => {
    it('throws error if listing transactions fails', async () => {
      wigleGatewayFetchMock.mockResolvedValue({
        ok: false,
        error: 'Failed to fetch transactions list',
      });

      await expect(syncKmlTransactions()).rejects.toThrow('Failed to fetch transactions list');
    });

    it('returns early with skipped results if dryRun option is specified', async () => {
      const mockListJson = jest.fn().mockResolvedValue({
        success: true,
        results: [
          { transid: 'tx-001', fileName: 'test1.kml', status: 'SUCCESS' },
          { transid: 'tx-002', fileName: 'test2.kml', status: 'SUCCESS' },
        ],
      });
      wigleGatewayFetchMock.mockResolvedValue({
        ok: true,
        response: { ok: true, json: mockListJson },
      });

      queryMock.mockResolvedValue({ rows: [] });

      const result = await syncKmlTransactions({ dryRun: true });
      expect(result.ok).toBe(true);
      expect(result.syncedCount).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({
        transid: 'tx-001',
        fileName: 'test1.kml',
        status: 'skipped',
      });
    });

    it('skips transactions that already exist in DB by transid', async () => {
      const mockListJson = jest.fn().mockResolvedValue({
        success: true,
        results: [
          { transid: 'tx-001', fileName: 'test1.kml', status: 'SUCCESS' },
          { transid: 'tx-002', fileName: 'test2.kml', status: 'SUCCESS' },
        ],
      });
      wigleGatewayFetchMock.mockResolvedValue({
        ok: true,
        response: { ok: true, json: mockListJson },
      });

      // tx-001 already in DB
      queryMock.mockResolvedValue({
        rows: [{ wigle_transid: 'tx-001' }],
      });

      const result = await syncKmlTransactions({ dryRun: true });
      // Only tx-002 should remain as candidate
      expect(result.results).toHaveLength(1);
      expect(result.results[0].transid).toBe('tx-002');
    });

    it('skips download and associates metadata if new transaction has duplicate file hash and force is false', async () => {
      const mockListJson = jest.fn().mockResolvedValue({
        success: true,
        results: [{ transid: 'tx-hash-dup', fileName: 'dup.kml', status: 'SUCCESS' }],
      });
      wigleGatewayFetchMock.mockImplementation(async (req: any) => {
        if (req.url.includes('transactions')) {
          return { ok: true, response: { ok: true, json: mockListJson } };
        } else if (req.url.includes('kml/tx-hash-dup')) {
          const arrayBuffer = new TextEncoder().encode('<kml>duplicate</kml>').buffer;
          return {
            ok: true,
            response: {
              ok: true,
              arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
            },
          };
        }
        return { ok: false, error: 'Unknown request' };
      });

      queryMock
        .mockResolvedValueOnce({ rows: [] }) // existing transids query
        .mockResolvedValueOnce({ rows: [] }); // metadata update query (resolved)

      // Mock duplicate hash found
      findKmlFilesByHashesMock.mockResolvedValue([{ id: 123, source_file: 'existing.kml' }]);

      const result = await syncKmlTransactions();
      expect(result.skippedCount).toBe(1);
      expect(result.syncedCount).toBe(0);
      expect(result.results[0].status).toBe('skipped');
      expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('UPDATE app.kml_files'), [
        'tx-hash-dup',
        'dup.kml',
        expect.any(String),
        'SUCCESS',
        expect.any(String),
      ]);
    });

    it('downloads KML, imports via child process, completes history entry, and updates WiGLE fields on success', async () => {
      const mockListJson = jest.fn().mockResolvedValue({
        success: true,
        results: [
          {
            transid: 'tx-new',
            fileName: 'new.kml',
            status: 'SUCCESS',
            lastupdt: '2026-06-01T00:00:00Z',
          },
        ],
      });
      wigleGatewayFetchMock.mockImplementation(async (req: any) => {
        if (req.url.includes('transactions')) {
          return { ok: true, response: { ok: true, json: mockListJson } };
        } else if (req.url.includes('kml/tx-new')) {
          const arrayBuffer = new TextEncoder().encode('<kml>new</kml>').buffer;
          return {
            ok: true,
            response: {
              ok: true,
              arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
            },
          };
        }
        return { ok: false, error: 'Unknown request' };
      });

      queryMock
        .mockResolvedValueOnce({ rows: [] }) // existing transids
        .mockResolvedValueOnce({ rows: [] }); // update wigle fields

      findKmlFilesByHashesMock.mockResolvedValue([]); // No duplicate hash
      historyServiceMock.captureImportMetrics.mockResolvedValue({ kml_files: 0 });
      historyServiceMock.createImportHistoryEntry.mockResolvedValue(999);

      // Deterministic spawn simulation setup for this specific test
      spawnMock.mockImplementationOnce(() => {
        const mockChild = new EventEmitter();
        (mockChild as any).stdout = new EventEmitter();
        (mockChild as any).stderr = new EventEmitter();

        process.nextTick(() => {
          (mockChild as any).stdout.emit('data', 'Files: 1\nPoints: 25');
          mockChild.emit('close', 0);
        });

        return mockChild;
      });

      const result = await syncKmlTransactions();
      expect(result.syncedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.results[0]).toEqual({
        transid: 'tx-new',
        fileName: 'new.kml',
        status: 'imported',
        pointsImported: 25,
      });

      expect(spawnMock).toHaveBeenCalled();
      expect(historyServiceMock.completeImportSuccess).toHaveBeenCalledWith(
        999,
        25,
        0,
        expect.any(String),
        expect.any(Object)
      );
      expect(queryMock).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE app.kml_files'), [
        'tx-new',
        'new.kml',
        '2026-06-01T00:00:00Z',
        'SUCCESS',
        expect.any(String),
      ]);
    });

    it('fails import history and logs failure if importer script exits with code !== 0', async () => {
      const mockListJson = jest.fn().mockResolvedValue({
        success: true,
        results: [{ transid: 'tx-fail', fileName: 'fail.kml', status: 'SUCCESS' }],
      });
      wigleGatewayFetchMock.mockImplementation(async (req: any) => {
        if (req.url.includes('transactions')) {
          return { ok: true, response: { ok: true, json: mockListJson } };
        } else if (req.url.includes('kml/tx-fail')) {
          const arrayBuffer = new TextEncoder().encode('<kml>fail</kml>').buffer;
          return {
            ok: true,
            response: {
              ok: true,
              arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
            },
          };
        }
        return { ok: false, error: 'Unknown request' };
      });

      queryMock.mockResolvedValueOnce({ rows: [] });
      findKmlFilesByHashesMock.mockResolvedValue([]);
      historyServiceMock.captureImportMetrics.mockResolvedValue({});
      historyServiceMock.createImportHistoryEntry.mockResolvedValue(999);

      // Deterministic spawn simulation setup for this specific test
      spawnMock.mockImplementationOnce(() => {
        const mockChild = new EventEmitter();
        (mockChild as any).stdout = new EventEmitter();
        (mockChild as any).stderr = new EventEmitter();

        process.nextTick(() => {
          (mockChild as any).stderr.emit('data', 'Parser syntax error');
          mockChild.emit('close', 1);
        });

        return mockChild;
      });

      const result = await syncKmlTransactions();
      expect(result.failedCount).toBe(1);
      expect(result.syncedCount).toBe(0);
      expect(result.results[0].status).toBe('failed');
      expect(result.results[0].error).toContain('Parser syntax error');
      expect(historyServiceMock.failImportHistory).toHaveBeenCalledWith(
        999,
        'Parser syntax error',
        expect.any(String)
      );
    });

    it('redacts basic authorization credentials in error message if call fails', async () => {
      const mockListJson = jest.fn().mockResolvedValue({
        success: true,
        results: [{ transid: 'tx-cred-leak', fileName: 'leak.kml', status: 'SUCCESS' }],
      });
      wigleGatewayFetchMock.mockImplementation(async (req: any) => {
        if (req.url.includes('transactions')) {
          return { ok: true, response: { ok: true, json: mockListJson } };
        } else if (req.url.includes('kml/tx-cred-leak')) {
          // Force an error that mimics containing the auth header
          throw new Error('Connection failed at Authorization: Basic dGVzdC11c2VyOnRlc3QtdG9rZW4=');
        }
        return { ok: false, error: 'Unknown request' };
      });

      queryMock.mockResolvedValueOnce({ rows: [] });
      findKmlFilesByHashesMock.mockResolvedValue([]);

      const result = await syncKmlTransactions();
      expect(result.failedCount).toBe(1);
      expect(result.results[0].error).toBe('Connection failed at Authorization: Basic [REDACTED]');
    });

    it('handles the real response shape with status D and percentDone 100, maps CSV files to .kml, and runs sync successfully', async () => {
      const realResponse = {
        success: true,
        results: [
          {
            transid: '20260529-00225',
            username: 'Cyclonite01',
            firstTime: '2026-05-29T09:25:20.000Z',
            lastupdt: '2026-05-29T09:39:58.000Z',
            fileName: '1780046720_WigleWifi_20260529052514.csv',
            fileSize: 1986919,
            fileLines: 11762,
            status: 'D',
            percentDone: 100,
          },
        ],
        processingQueueDepth: 30,
        geoQueueDepth: 54,
        trilaterationQueueDepth: 3,
      };

      // 1. Prove listTransactions returns results
      const mockListJson = jest.fn().mockResolvedValue(realResponse);
      wigleGatewayFetchMock.mockImplementation(async (req: any) => {
        if (req.url.includes('transactions')) {
          return { ok: true, response: { ok: true, json: mockListJson } };
        } else if (req.url.includes('kml/20260529-00225')) {
          const arrayBuffer = new TextEncoder().encode('<kml>data</kml>').buffer;
          return {
            ok: true,
            response: {
              ok: true,
              arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
            },
          };
        }
        return { ok: false, error: 'Unknown request' };
      });

      const listRes = await listTransactions(0, 10);
      expect(listRes.results).toHaveLength(1);
      expect(listRes.results[0].status).toBe('D');

      // 2. Prove status "D" / percentDone 100 is completed/eligible and dryRun includes it
      queryMock
        .mockResolvedValueOnce({ rows: [] }) // existing transids
        .mockResolvedValueOnce({ rows: [] }); // update wigle fields

      const dryRunRes = await syncKmlTransactions({ dryRun: true });
      expect(dryRunRes.ok).toBe(true);
      expect(dryRunRes.results).toHaveLength(1);
      // Prove CSV fileName has been mapped to .kml extension
      expect(dryRunRes.results[0].fileName).toBe('1780046720_WigleWifi_20260529052514.kml');
      expect(dryRunRes.results[0].transid).toBe('20260529-00225');
      // Verify debug fields from STEP 7 are populated
      expect(dryRunRes.remoteCount).toBe(1);
      expect(dryRunRes.eligibleCount).toBe(1);
      expect(dryRunRes.skippedAlreadyImportedCount).toBe(0);
      expect(dryRunRes.skippedIncompleteCount).toBe(0);
      expect(dryRunRes.skippedReasons?.[0]).toContain(
        'Remote queue stats: processing=30, geo=54, trilateration=3'
      );

      // 3. Prove sync calls down to KML download endpoint and finishes successfully
      findKmlFilesByHashesMock.mockResolvedValue([]); // Not duplicate
      historyServiceMock.captureImportMetrics.mockResolvedValue({});
      historyServiceMock.createImportHistoryEntry.mockResolvedValue(1001);

      spawnMock.mockImplementationOnce(() => {
        const mockChild = new EventEmitter();
        (mockChild as any).stdout = new EventEmitter();
        (mockChild as any).stderr = new EventEmitter();
        process.nextTick(() => {
          (mockChild as any).stdout.emit('data', 'Files: 1\nPoints: 1000');
          mockChild.emit('close', 0);
        });
        return mockChild;
      });

      const syncRes = await syncKmlTransactions({ dryRun: false });
      expect(syncRes.ok).toBe(true);
      expect(syncRes.syncedCount).toBe(1);
      expect(syncRes.results[0].fileName).toBe('1780046720_WigleWifi_20260529052514.kml');
      expect(syncRes.results[0].transid).toBe('20260529-00225');
      expect(syncRes.results[0].status).toBe('imported');

      // Verify download endpoint URL matches
      expect(wigleGatewayFetchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.wigle.net/api/v2/file/kml/20260529-00225',
        })
      );
    });

    describe('Rate-limiting and quota exhaustion handling', () => {
      it('stops download loop and defers remaining transactions when WiGLE stats soft limit is reached', async () => {
        const mockListJson = jest.fn().mockResolvedValue({
          success: true,
          results: [
            { transid: 'tx-1', fileName: 'file1.kml', status: 'SUCCESS' },
            { transid: 'tx-2', fileName: 'file2.kml', status: 'SUCCESS' },
            { transid: 'tx-3', fileName: 'file3.kml', status: 'SUCCESS' },
            { transid: 'tx-4', fileName: 'file4.kml', status: 'SUCCESS' },
          ],
        });

        const arrayBuffer = new TextEncoder().encode('<kml>data</kml>').buffer;

        // Mock gateway fetch:
        // tx-1: success
        // tx-2: success
        // tx-3: soft limit error (status 429)
        wigleGatewayFetchMock.mockImplementation(async (req: any) => {
          if (req.url.includes('transactions')) {
            return { ok: true, response: { ok: true, json: mockListJson } };
          }
          if (req.url.includes('kml/tx-1') || req.url.includes('kml/tx-2')) {
            return {
              ok: true,
              response: {
                ok: true,
                arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
              },
            };
          }
          if (req.url.includes('kml/tx-3')) {
            return {
              ok: false,
              error: 'WiGLE stats soft limit reached (10/10).',
              status: 429,
            };
          }
          return { ok: false, error: 'Should not download past rate limit' };
        });

        queryMock.mockResolvedValue({ rows: [] }); // No existing records
        findKmlFilesByHashesMock.mockResolvedValue([]); // Not duplicate
        historyServiceMock.captureImportMetrics.mockResolvedValue({});
        historyServiceMock.createImportHistoryEntry.mockResolvedValue(2000);

        spawnMock.mockImplementation(() => {
          const mockChild = new EventEmitter();
          (mockChild as any).stdout = new EventEmitter();
          (mockChild as any).stderr = new EventEmitter();
          process.nextTick(() => {
            (mockChild as any).stdout.emit('data', 'Files: 1\nPoints: 100');
            mockChild.emit('close', 0);
          });
          return mockChild;
        });

        // Run sync with limit 4
        const result = await syncKmlTransactions({ limit: 4, dryRun: false });

        expect(result.ok).toBe(false);
        expect(result.syncedCount).toBe(2);
        expect(result.failedCount).toBe(0);
        expect(result.deferredCount).toBe(2); // tx-3 and tx-4
        expect(result.rateLimited).toBe(true);
        expect(result.rateLimitMessage).toContain('exhausted');

        expect(result.results[0].status).toBe('imported'); // tx-1
        expect(result.results[1].status).toBe('imported'); // tx-2
        expect(result.results[2].status).toBe('deferred'); // tx-3 (triggered limit)
        expect(result.results[3].status).toBe('deferred'); // tx-4 (deferred because limit was set)

        // Verify we never attempted to download tx-4
        const downloadCalls = wigleGatewayFetchMock.mock.calls.filter((c: any[]) =>
          c[0].url.includes('kml/')
        );
        expect(downloadCalls.some((c: any[]) => c[0].url.includes('tx-4'))).toBe(false);
      });

      it('counts normal KML parsing errors as failed and does not stop the loop', async () => {
        const mockListJson = jest.fn().mockResolvedValue({
          success: true,
          results: [
            { transid: 'tx-bad', fileName: 'bad.kml', status: 'SUCCESS' },
            { transid: 'tx-good', fileName: 'good.kml', status: 'SUCCESS' },
          ],
        });

        const arrayBuffer = new TextEncoder().encode('<kml>data</kml>').buffer;

        wigleGatewayFetchMock.mockImplementation(async (req: any) => {
          if (req.url.includes('transactions')) {
            return { ok: true, response: { ok: true, json: mockListJson } };
          }
          return {
            ok: true,
            response: {
              ok: true,
              arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
            },
          };
        });

        queryMock.mockResolvedValue({ rows: [] });
        findKmlFilesByHashesMock.mockResolvedValue([]);
        historyServiceMock.captureImportMetrics.mockResolvedValue({});
        historyServiceMock.createImportHistoryEntry.mockResolvedValue(2001);

        // Spawn mock: first call (tx-bad) fails with exit code 1
        spawnMock.mockImplementationOnce(() => {
          const mockChild = new EventEmitter();
          (mockChild as any).stdout = new EventEmitter();
          (mockChild as any).stderr = new EventEmitter();
          process.nextTick(() => {
            (mockChild as any).stderr.emit('data', 'Parser syntax error');
            mockChild.emit('close', 1);
          });
          return mockChild;
        });
        // second call (tx-good) succeeds with exit code 0
        spawnMock.mockImplementationOnce(() => {
          const mockChild = new EventEmitter();
          (mockChild as any).stdout = new EventEmitter();
          (mockChild as any).stderr = new EventEmitter();
          process.nextTick(() => {
            (mockChild as any).stdout.emit('data', 'Files: 1\nPoints: 100');
            mockChild.emit('close', 0);
          });
          return mockChild;
        });

        const result = await syncKmlTransactions({ limit: 2, dryRun: false });

        expect(result.ok).toBe(false);
        expect(result.syncedCount).toBe(1);
        expect(result.failedCount).toBe(1);
        expect(result.deferredCount).toBe(0);
        expect(result.rateLimited).toBe(false);

        expect(result.results[0].status).toBe('failed');
        expect(result.results[1].status).toBe('imported');
      });
    });
  });
});
