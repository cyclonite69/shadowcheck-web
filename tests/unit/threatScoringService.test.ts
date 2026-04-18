export {};

const {
  createThreatScoringService,
} = require('../../server/src/services/threatScoringService') as {
  createThreatScoringService: Function;
};

describe('ThreatScoringService', () => {
  const createLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  const createRepository = () => ({
    upsertRuleBasedThreatScores: jest.fn(),
    getBehavioralScoringCandidatesByBssids: jest.fn(),
    upsertBehavioralThreatScores: jest.fn(),
    getQuickThreats: jest.fn(),
    getDetailedThreats: jest.fn(),
  });

  const createNetworkTagService = () => ({
    getManualThreatTags: jest.fn(),
  });

  describe('computeThreatScores', () => {
    it('orchestrates rule-based and behavioral scoring successfully', async () => {
      const logger = createLogger();
      const repository = createRepository();
      const networkTagService = createNetworkTagService();
      const scoreBehavioralThreats = jest.fn().mockReturnValue({
        scores: [
          {
            bssid: 'B1',
            ml_threat_score: 42,
            ml_threat_probability: 0.42,
            ml_primary_class: 'LEGITIMATE',
            model_version: '2.0.0',
          },
        ],
      });

      repository.upsertRuleBasedThreatScores.mockResolvedValue({
        processedBssids: ['B1', 'B2'],
        processedCount: 2,
      });
      repository.getBehavioralScoringCandidatesByBssids.mockResolvedValue([
        { bssid: 'B1', observationCount: 5, uniqueDays: 4, maxDistanceKm: 2.5 },
      ]);
      networkTagService.getManualThreatTags.mockResolvedValue([]);
      repository.upsertBehavioralThreatScores.mockResolvedValue(1);

      const service = createThreatScoringService({
        logger,
        threatRepository: repository,
        networkTagService,
        scoreBehavioralThreats,
      });

      const result = await service.computeThreatScores(10, 24);

      expect(result).toEqual({
        success: true,
        processed: 2,
        updated: 2,
        executionTimeMs: expect.any(Number),
      });
      expect(repository.upsertRuleBasedThreatScores).toHaveBeenCalledWith({
        batchSize: 10,
        maxAgeHours: 24,
      });
      expect(repository.getBehavioralScoringCandidatesByBssids).toHaveBeenCalledWith({
        bssids: ['B1', 'B2'],
        minObservations: 2,
        maxBssidLength: 17,
      });
      expect(scoreBehavioralThreats).toHaveBeenCalledWith(
        [{ bssid: 'B1', observationCount: 5, uniqueDays: 4, maxDistanceKm: 2.5 }],
        []
      );
      expect(repository.upsertBehavioralThreatScores).toHaveBeenCalledWith([
        {
          bssid: 'B1',
          mlThreatScore: 42,
          mlThreatProbability: 0.42,
          mlPrimaryClass: 'LEGITIMATE',
          modelVersion: '2.0.0',
        },
      ]);
      expect(logger.info).toHaveBeenCalledWith('Starting unified threat score computation', {
        batchSize: 10,
        maxAgeHours: 24,
      });
      expect(logger.info).toHaveBeenCalledWith('Unified threat score computation completed', {
        processed: 2,
        updated: 2,
        behavioralUpdated: 1,
        executionTimeMs: expect.any(Number),
        totalProcessed: 2,
      });
    });

    it('skips when already running', async () => {
      const logger = createLogger();
      const repository = createRepository();
      const networkTagService = createNetworkTagService();

      let resolveRulePass:
        | ((value: { processedBssids: string[]; processedCount: number }) => void)
        | undefined;
      repository.upsertRuleBasedThreatScores.mockReturnValue(
        new Promise((resolve) => {
          resolveRulePass = resolve;
        })
      );

      const service = createThreatScoringService({
        logger,
        threatRepository: repository,
        networkTagService,
        scoreBehavioralThreats: jest.fn(),
      });

      const firstCall = service.computeThreatScores(10, 24);
      const secondCall = await service.computeThreatScores(10, 24);

      expect(secondCall).toEqual({ skipped: true });
      expect(logger.warn).toHaveBeenCalledWith('Threat scoring already running, skipping');

      resolveRulePass?.({ processedBssids: [], processedCount: 0 });
      repository.getBehavioralScoringCandidatesByBssids.mockResolvedValue([]);
      await firstCall;
    });

    it('records errors in stats', async () => {
      const logger = createLogger();
      const repository = createRepository();
      const error = new Error('DB Error');
      repository.upsertRuleBasedThreatScores.mockRejectedValue(error);

      const service = createThreatScoringService({
        logger,
        threatRepository: repository,
        networkTagService: createNetworkTagService(),
        scoreBehavioralThreats: jest.fn(),
      });

      await expect(service.computeThreatScores()).rejects.toThrow('DB Error');

      const stats = service.getStats();
      expect(stats.lastError).toBe('DB Error');
      expect(logger.error).toHaveBeenCalledWith('Threat score computation failed', {
        error: 'DB Error',
      });
    });

    it('skips behavioral upsert when no candidates qualify', async () => {
      const logger = createLogger();
      const repository = createRepository();
      repository.upsertRuleBasedThreatScores.mockResolvedValue({
        processedBssids: ['B1'],
        processedCount: 1,
      });
      repository.getBehavioralScoringCandidatesByBssids.mockResolvedValue([]);

      const service = createThreatScoringService({
        logger,
        threatRepository: repository,
        networkTagService: createNetworkTagService(),
        scoreBehavioralThreats: jest.fn(),
      });

      await service.computeThreatScores();

      expect(repository.upsertBehavioralThreatScores).not.toHaveBeenCalled();
    });
  });

  describe('markAllForRecompute', () => {
    it('reuses computeThreatScores with the full-batch arguments', async () => {
      const repository = createRepository();
      repository.upsertRuleBasedThreatScores.mockResolvedValue({
        processedBssids: ['B1'],
        processedCount: 1,
      });
      repository.getBehavioralScoringCandidatesByBssids.mockResolvedValue([]);

      const service = createThreatScoringService({
        logger: createLogger(),
        threatRepository: repository,
        networkTagService: createNetworkTagService(),
        scoreBehavioralThreats: jest.fn(),
      });

      const result = await service.markAllForRecompute();

      expect(result).toEqual({ success: true, rowsAffected: 1 });
      expect(repository.upsertRuleBasedThreatScores).toHaveBeenCalledWith({
        batchSize: 1000000,
        maxAgeHours: 0,
      });
    });
  });

  describe('getStats', () => {
    it('returns service stats', () => {
      const service = createThreatScoringService({
        logger: createLogger(),
        threatRepository: createRepository(),
        networkTagService: createNetworkTagService(),
        scoreBehavioralThreats: jest.fn(),
      });

      const stats = service.getStats();
      expect(stats).toHaveProperty('isRunning');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('totalUpdated');
    });
  });

  describe('getQuickThreats', () => {
    it('maps repository records to the existing API DTO shape', async () => {
      const repository = createRepository();
      repository.getQuickThreats.mockResolvedValue({
        records: [
          {
            bssid: 'B1',
            ssid: null,
            radioType: null,
            channel: 6,
            signalDbm: -55,
            encryption: 'WPA2',
            latitude: 45,
            longitude: -75,
            firstSeen: '2026-04-01T00:00:00Z',
            lastSeen: '2026-04-02T00:00:00Z',
            observations: 8,
            uniqueDays: 4,
            uniqueLocations: 3,
            distanceRangeKm: 1.234,
            threatScore: 88.8,
            threatLevel: 'HIGH',
          },
        ],
        totalCount: 1,
      });

      const service = createThreatScoringService({
        logger: createLogger(),
        threatRepository: repository,
        networkTagService: createNetworkTagService(),
        scoreBehavioralThreats: jest.fn(),
      });

      const result = await service.getQuickThreats({
        limit: 10,
        offset: 0,
        minObservations: 5,
        minUniqueDays: 2,
        minUniqueLocations: 1,
        minRangeKm: 0.1,
        minThreatScore: 30,
        minTimestamp: 0,
      });

      expect(result).toEqual({
        threats: [
          {
            bssid: 'B1',
            ssid: '<Hidden>',
            radioType: 'wifi',
            type: 'wifi',
            channel: 6,
            signal: -55,
            signalDbm: -55,
            maxSignal: -55,
            encryption: 'WPA2',
            latitude: 45,
            longitude: -75,
            firstSeen: '2026-04-01T00:00:00Z',
            lastSeen: '2026-04-02T00:00:00Z',
            observations: 8,
            totalObservations: 8,
            uniqueDays: 4,
            uniqueLocations: 3,
            distanceRangeKm: '1.23',
            threatScore: 88.8,
            threatLevel: 'high',
          },
        ],
        totalCount: 1,
      });
    });
  });

  describe('getDetailedThreats', () => {
    it('maps repository records to the detailed API DTO shape', async () => {
      const repository = createRepository();
      repository.getDetailedThreats.mockResolvedValue([
        {
          bssid: 'B1',
          ssid: 'ThreatNet',
          type: 'wifi',
          encryption: 'WPA2',
          frequency: 2437,
          signalDbm: -50,
          latitude: 45,
          longitude: -75,
          totalObservations: 10,
          finalThreatScore: 85.5,
          finalThreatLevel: 'HIGH',
          ruleBasedFlags: {
            summary: 'High risk detected',
            confidence: '0.95',
            metrics: { observations: 10 },
            factors: { mobility: 'high' },
            flags: ['MOCK_FLAG'],
          },
        },
      ]);

      const service = createThreatScoringService({
        logger: createLogger(),
        threatRepository: repository,
        networkTagService: createNetworkTagService(),
        scoreBehavioralThreats: jest.fn(),
      });

      const result = await service.getDetailedThreats();

      expect(result).toEqual([
        {
          bssid: 'B1',
          ssid: 'ThreatNet',
          type: 'wifi',
          encryption: 'WPA2',
          channel: 2437,
          signal: -50,
          signalDbm: -50,
          latitude: 45,
          longitude: -75,
          totalObservations: 10,
          observations: 10,
          threatScore: 85.5,
          threatType: 'High risk detected',
          threatLevel: 'high',
          confidence: '95',
          patterns: {
            metrics: { observations: 10 },
            factors: { mobility: 'high' },
            flags: ['MOCK_FLAG'],
          },
        },
      ]);
    });
  });
});
