import { jest } from '@jest/globals';

const mockSecretsManager = {
  get: jest.fn(),
};

jest.mock(
  '../../server/src/config/container',
  () => ({
    secretsManager: mockSecretsManager,
  }),
  { virtual: true }
);

jest.mock('../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock(
  '../../server/src/services/wigleEnrichment/repositories/enrichmentReadRepository',
  () => ({
    getPendingEnrichmentCount: jest.fn(),
    getEnrichmentCatalog: jest.fn(),
    getNextEnrichmentBatch: jest.fn(),
    getActiveEnrichmentRunId: jest.fn(),
    getRunStatus: jest.fn(),
  })
);

jest.mock('../../server/src/repositories/wigleEnrichmentRepository', () => ({
  setRunTotalItems: jest.fn(),
  incrementRunProgress: jest.fn(),
  resetRunForResume: jest.fn(),
  forceClearRun: jest.fn(),
  refreshWigleNetworksMv: jest.fn(),
}));

jest.mock('../../server/src/services/wigleEnrichment/repositories/wigleApiCreditGateway', () => ({
  fetchWigleApiCreditSnapshot: jest.fn(),
}));

jest.mock('../../server/src/services/wigleImport/runRepository', () => ({
  createImportRun: jest.fn(),
  getImportRun: jest.fn(),
  markRunControlStatus: jest.fn(),
  markRunFailure: jest.fn(),
  completeRun: jest.fn(),
}));

jest.mock('../../server/src/services/wigleEnrichmentFetcher', () => ({
  fetchAndImportDetail: jest.fn(),
}));

jest.mock('../../server/src/services/wigleRequestLedger', () => ({
  assertCanRequest: jest.fn(),
}));

import {
  runEnrichmentLoop,
  startBatchEnrichment,
  validateWigleApiCredit,
} from '../../server/src/services/wigleEnrichmentService';
import logger from '../../server/src/logging/logger';
import * as readRepo from '../../server/src/services/wigleEnrichment/repositories/enrichmentReadRepository';
import * as writeRepo from '../../server/src/repositories/wigleEnrichmentRepository';
import * as runRepo from '../../server/src/services/wigleImport/runRepository';
import { fetchAndImportDetail } from '../../server/src/services/wigleEnrichmentFetcher';
import { fetchWigleApiCreditSnapshot } from '../../server/src/services/wigleEnrichment/repositories/wigleApiCreditGateway';

type ImportRun = Awaited<ReturnType<typeof runRepo.getImportRun>>;

const makeImportRun = (overrides: Partial<ImportRun> = {}): ImportRun => ({
  id: 1,
  source: 'v3_batch',
  apiVersion: 'v3',
  searchTerm: 'Full Catalog Enrichment',
  state: null,
  requestFingerprint: null,
  requestParams: {},
  status: 'running',
  apiCursor: null,
  lastError: null,
  startedAt: null,
  lastAttemptedAt: null,
  completedAt: null,
  lastSuccessfulPage: 0,
  nextPage: 1,
  apiTotalResults: null,
  totalPages: null,
  pageSize: 100,
  pagesFetched: 0,
  rowsReturned: 0,
  rowsInserted: 0,
  rowCompletenessPct: null,
  insertedRowCompletenessPct: null,
  pageCompletenessPct: null,
  rowCompletenessNote:
    'rowsReturned tracks API rows successfully paged; rowsInserted can be lower because duplicate-safe upserts skip already imported rows.',
  pages: [],
  ...overrides,
});

describe('WiGLE Enrichment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runEnrichmentLoop', () => {
    const runId = 123;

    it('should return early if run is already completed', async () => {
      jest
        .mocked(runRepo.getImportRun)
        .mockResolvedValue(makeImportRun({ id: runId, status: 'completed' }));
      await runEnrichmentLoop(runId);
      expect(readRepo.getNextEnrichmentBatch).not.toHaveBeenCalled();
    });

    it('should mark manual run as failed if no matching networks are found initially', async () => {
      jest.mocked(runRepo.getImportRun).mockResolvedValue(makeImportRun({ id: runId }));
      jest.mocked(readRepo.getRunStatus).mockResolvedValue('running');
      jest.mocked(readRepo.getNextEnrichmentBatch).mockResolvedValue([]);

      const manualList = ['AA:BB:CC:DD:EE:FF'];
      await runEnrichmentLoop(runId, manualList);

      expect(runRepo.markRunFailure).toHaveBeenCalledWith(
        runId,
        'No matching networks found in catalog for provided BSSIDs'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Manual run #123 failed: No matching networks found')
      );
    });

    it('should complete run if batch is empty and it is not a fresh manual run', async () => {
      jest.mocked(runRepo.getImportRun).mockResolvedValue(makeImportRun());
      jest.mocked(readRepo.getRunStatus).mockResolvedValue('running');
      jest.mocked(readRepo.getNextEnrichmentBatch).mockResolvedValue([]);

      await runEnrichmentLoop(runId);

      expect(runRepo.completeRun).toHaveBeenCalledWith(runId);
      expect(writeRepo.refreshWigleNetworksMv).toHaveBeenCalled();
    });

    it('should process items in batch and increment progress', async () => {
      jest.mocked(runRepo.getImportRun).mockResolvedValue(makeImportRun());
      jest
        .mocked(readRepo.getRunStatus)
        .mockResolvedValueOnce('running')
        .mockResolvedValueOnce('running')
        .mockResolvedValueOnce('paused');

      jest
        .mocked(readRepo.getNextEnrichmentBatch)
        .mockResolvedValueOnce([{ bssid: 'AA:BB:CC:DD:EE:FF', type: 'W' }]);

      jest.mocked(fetchAndImportDetail).mockResolvedValue({
        bssid: 'AA:BB:CC:DD:EE:FF',
        obsCount: 10,
      });

      await runEnrichmentLoop(runId);

      expect(fetchAndImportDetail).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', 'W');
      expect(writeRepo.incrementRunProgress).toHaveBeenCalledWith(runId);
    });

    it('does not abort after eight consecutive BSSIDs have no v3 detail', async () => {
      jest.mocked(runRepo.getImportRun).mockResolvedValue(makeImportRun());
      jest.mocked(readRepo.getRunStatus).mockResolvedValue('running');
      const batch = Array.from({ length: 8 }, (_, index) => ({
        bssid: `AA:BB:CC:DD:EE:${String(index).padStart(2, '0')}`,
        type: 'W',
      }));
      jest
        .mocked(readRepo.getNextEnrichmentBatch)
        .mockResolvedValueOnce(batch)
        .mockResolvedValue([]);
      jest.mocked(fetchAndImportDetail).mockResolvedValue(null);

      await runEnrichmentLoop(runId);

      expect(fetchAndImportDetail).toHaveBeenCalledTimes(8);
      expect(writeRepo.incrementRunProgress).not.toHaveBeenCalled();
      expect(runRepo.markRunFailure).not.toHaveBeenCalled();
      expect(runRepo.completeRun).toHaveBeenCalledWith(runId);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('WiGLE has no v3 detail for AA:BB:CC:DD:EE:00')
      );
    });

    it('continues after six no-hits and increments progress for a later hit', async () => {
      jest.mocked(runRepo.getImportRun).mockResolvedValue(makeImportRun());
      jest.mocked(readRepo.getRunStatus).mockResolvedValue('running');
      const noHitBatch = Array.from({ length: 6 }, (_, index) => ({
        bssid: `AA:BB:CC:DD:EE:${String(index).padStart(2, '0')}`,
        type: 'W',
      }));
      jest
        .mocked(readRepo.getNextEnrichmentBatch)
        .mockResolvedValueOnce([...noHitBatch, { bssid: 'AA:BB:CC:DD:EE:99', type: 'W' }])
        .mockResolvedValue([]);
      jest
        .mocked(fetchAndImportDetail)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ bssid: 'AA:BB:CC:DD:EE:99', obsCount: 1 });

      await runEnrichmentLoop(runId);

      expect(fetchAndImportDetail).toHaveBeenCalledTimes(7);
      expect(writeRepo.incrementRunProgress).toHaveBeenCalledTimes(1);
      expect(writeRepo.incrementRunProgress).toHaveBeenCalledWith(runId);
      expect(runRepo.markRunFailure).not.toHaveBeenCalled();
    });

    it('fetches all remaining targeted BSSIDs in one batch (up to manual limit)', async () => {
      const manual = ['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02', 'AA:BB:CC:DD:EE:03'];
      jest.mocked(runRepo.getImportRun).mockResolvedValue(makeImportRun());
      jest.mocked(readRepo.getRunStatus).mockResolvedValue('running');
      jest
        .mocked(readRepo.getNextEnrichmentBatch)
        .mockResolvedValueOnce([
          { bssid: manual[0], type: 'W' },
          { bssid: manual[1], type: 'W' },
          { bssid: manual[2], type: 'W' },
        ])
        .mockResolvedValue([]);
      jest.mocked(fetchAndImportDetail).mockResolvedValue({ bssid: 'x', obsCount: 1 });

      await runEnrichmentLoop(runId, manual);

      expect(readRepo.getNextEnrichmentBatch).toHaveBeenCalledWith(3, manual);
      expect(fetchAndImportDetail).toHaveBeenCalledTimes(3);
      expect(runRepo.completeRun).toHaveBeenCalledWith(runId);
    });

    it('should mark manual run failed when every targeted BSSID fails', async () => {
      jest.mocked(runRepo.getImportRun).mockResolvedValue(makeImportRun());
      jest.mocked(readRepo.getRunStatus).mockResolvedValue('running');
      jest
        .mocked(readRepo.getNextEnrichmentBatch)
        .mockResolvedValueOnce([{ bssid: 'FA:D0:0E:A3:42:21', type: 'W' }])
        .mockResolvedValue([]);
      jest
        .mocked(fetchAndImportDetail)
        .mockRejectedValue(new Error('WiGLE has no v3 detail for FA:D0:0E:A3:42:21'));

      await runEnrichmentLoop(runId, ['FA:D0:0E:A3:42:21']);

      expect(writeRepo.incrementRunProgress).not.toHaveBeenCalled();
      expect(runRepo.markRunFailure).toHaveBeenCalledWith(
        runId,
        'WiGLE has no v3 detail for FA:D0:0E:A3:42:21'
      );
      expect(runRepo.completeRun).not.toHaveBeenCalled();
    });

    it('should mark manual run failed when every targeted BSSID has no v3 detail', async () => {
      jest.mocked(runRepo.getImportRun).mockResolvedValue(makeImportRun());
      jest.mocked(readRepo.getRunStatus).mockResolvedValue('running');
      jest
        .mocked(readRepo.getNextEnrichmentBatch)
        .mockResolvedValueOnce([{ bssid: 'FA:D0:0E:A3:42:21', type: 'W' }])
        .mockResolvedValue([]);
      jest.mocked(fetchAndImportDetail).mockResolvedValue(null);

      await runEnrichmentLoop(runId, ['FA:D0:0E:A3:42:21']);

      expect(writeRepo.incrementRunProgress).not.toHaveBeenCalled();
      expect(runRepo.markRunFailure).toHaveBeenCalledWith(
        runId,
        'WiGLE has no v3 detail for FA:D0:0E:A3:42:21'
      );
      expect(runRepo.completeRun).not.toHaveBeenCalled();
    });

    it('should pause run if WiGLE rate limit is reached (429)', async () => {
      jest.mocked(runRepo.getImportRun).mockResolvedValue(makeImportRun());
      jest.mocked(readRepo.getRunStatus).mockResolvedValue('running');
      jest.mocked(readRepo.getNextEnrichmentBatch).mockResolvedValue([{ bssid: 'B1', type: 'W' }]);

      const error = Object.assign(new Error('Too Many Requests'), { status: 429 });
      jest.mocked(fetchAndImportDetail).mockRejectedValue(error);

      await runEnrichmentLoop(runId);

      expect(runRepo.markRunControlStatus).toHaveBeenCalledWith(runId, 'paused');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('WiGLE blocked/throttled'));
    });

    it('should abort run after multiple consecutive failures', async () => {
      jest.mocked(runRepo.getImportRun).mockResolvedValue(makeImportRun());
      jest.mocked(readRepo.getRunStatus).mockResolvedValue('running');

      const batch = Array.from({ length: 6 }, (_, i) => ({ bssid: `B${i}`, type: 'W' }));
      jest.mocked(readRepo.getNextEnrichmentBatch).mockResolvedValue(batch);

      jest.mocked(fetchAndImportDetail).mockRejectedValue(new Error('API Error'));

      await runEnrichmentLoop(runId);

      expect(runRepo.markRunFailure).toHaveBeenCalledWith(
        runId,
        expect.stringContaining('5 consecutive failures')
      );
    });
  });

  describe('startBatchEnrichment', () => {
    it('should throw if no pending items found', async () => {
      jest.mocked(readRepo.getPendingEnrichmentCount).mockResolvedValue(0);
      await expect(startBatchEnrichment()).rejects.toThrow('No networks found in v2 catalog');
    });

    it('should throw if another enrichment run is active', async () => {
      jest.mocked(readRepo.getPendingEnrichmentCount).mockResolvedValue(10);
      jest.mocked(readRepo.getActiveEnrichmentRunId).mockResolvedValue(999);

      await expect(startBatchEnrichment()).rejects.toMatchObject({ status: 409 });
    });

    it('should throw if concurrent run is active', async () => {
      jest.mocked(readRepo.getPendingEnrichmentCount).mockResolvedValue(5);
      jest.mocked(readRepo.getActiveEnrichmentRunId).mockResolvedValue(1);
      await expect(startBatchEnrichment()).rejects.toThrow(/already active/);
    });

    it('should handle manual bssid list correctly', async () => {
      const bssids = ['AA:BB:CC:DD:EE:FF'];
      jest.mocked(readRepo.getActiveEnrichmentRunId).mockResolvedValue(null);
      jest.mocked(runRepo.createImportRun).mockResolvedValue(makeImportRun({ id: 99 }));

      const result = await startBatchEnrichment(bssids);
      expect(result.id).toBe(99);
      expect(runRepo.createImportRun).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'v3_manual' }),
        expect.anything()
      );
    });
  });

  describe('validateWigleApiCredit', () => {
    it('should handle API errors gracefully', async () => {
      jest.mocked(fetchWigleApiCreditSnapshot).mockResolvedValue({
        ok: false,
        status: 500,
        message: 'Credit check unavailable',
      });

      const result = await validateWigleApiCredit();
      expect(result.hasCredit).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
