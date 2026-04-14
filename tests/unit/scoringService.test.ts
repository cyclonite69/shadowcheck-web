/**
 * ML Scoring Service Unit Tests
 */

import { scoreAllNetworks } from '../../server/src/services/ml/scoringService';
const scoringRepository = require('../../server/src/services/ml/repository');
import * as modelScoring from '../../server/src/services/ml/modelScoring';
const logger = require('../../server/src/logging/logger');
const schemas = require('../../server/src/validation/schemas');

jest.mock('../../server/src/logging/logger');
jest.mock('../../server/src/services/ml/repository');
jest.mock('../../server/src/validation/schemas', () => ({
  validateIntegerRange: jest.fn(),
}));

describe('ML Scoring Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    schemas.validateIntegerRange.mockReturnValue({ valid: true, value: 10 });

    // Mock model scoring function
    jest.spyOn(modelScoring, 'scoreNetworkWithModel').mockImplementation(
      (net: any) =>
        ({
          bssid: net.bssid,
          threat_score: 50.0,
          threat_category: 'moderate',
        }) as any
    );
  });

  describe('scoreAllNetworks', () => {
    it('should score networks successfully', async () => {
      // Mock repository responses
      scoringRepository.loadThreatModelConfig.mockResolvedValueOnce({
        coefficients: ['0.5', '0.3'],
        intercept: '0.1',
        feature_names: ['feat1', 'feat2'],
      });

      scoringRepository.loadNetworksForLegacyScoring.mockResolvedValueOnce([
        { bssid: 'AA:BB:CC:DD:EE:01' },
        { bssid: 'AA:BB:CC:DD:EE:02' },
      ]);

      const result = await scoreAllNetworks({ limit: 10 });

      expect(result.scored).toBe(2);
      expect(scoringRepository.loadThreatModelConfig).toHaveBeenCalledTimes(1);
      expect(scoringRepository.loadNetworksForLegacyScoring).toHaveBeenCalledWith(10);
      expect(scoringRepository.upsertLegacyThreatScore).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Scored 2 networks'),
        expect.any(Object)
      );
    });

    it('should throw an error if limit validation fails', async () => {
      schemas.validateIntegerRange.mockReturnValueOnce({ valid: false, error: 'Invalid limit' });

      await expect(scoreAllNetworks({ limit: -1 })).rejects.toThrow('Invalid limit');
      expect(scoringRepository.loadThreatModelConfig).not.toHaveBeenCalled();
    });

    it('should throw an error if no model is found', async () => {
      scoringRepository.loadThreatModelConfig.mockResolvedValueOnce(null);

      await expect(scoreAllNetworks({})).rejects.toThrow(
        'No trained model found. Train first with POST /api/ml/train'
      );
      expect(scoringRepository.loadNetworksForLegacyScoring).not.toHaveBeenCalled();
    });

    it('should handle array-like properties in model config', async () => {
      // Mock an object that passes `Array.isArray(x) === false`
      // but has toJSON so JSON.parse(JSON.stringify(x)) becomes an array.
      const fakeCoeffs = { toJSON: () => ['0.5', '0.3'] };
      const fakeFeatures = { toJSON: () => ['feat1', 'feat2'] };

      scoringRepository.loadThreatModelConfig.mockResolvedValueOnce({
        coefficients: fakeCoeffs,
        intercept: '0.1',
        feature_names: fakeFeatures,
      });

      scoringRepository.loadNetworksForLegacyScoring.mockResolvedValueOnce([
        { bssid: 'AA:BB:CC:DD:EE:01' },
      ]);

      const result = await scoreAllNetworks({});

      expect(result.scored).toBe(1);
      expect(modelScoring.scoreNetworkWithModel).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          coefficients: [0.5, 0.3],
          featureNames: ['feat1', 'feat2'],
        })
      );
    });

    it('should handle errors when scoring individual networks and continue', async () => {
      scoringRepository.loadThreatModelConfig.mockResolvedValueOnce({
        coefficients: ['0.5'],
        intercept: '0.1',
        feature_names: ['feat1'],
      });

      scoringRepository.loadNetworksForLegacyScoring.mockResolvedValueOnce([
        { bssid: 'AA:BB:CC:DD:EE:01' },
        { bssid: 'AA:BB:CC:DD:EE:02' },
      ]);

      // Make the first scoring fail, second succeed
      jest
        .spyOn(modelScoring, 'scoreNetworkWithModel')
        .mockImplementationOnce(() => {
          throw new Error('Scoring failed');
        })
        .mockImplementationOnce(
          (net: any) =>
            ({
              bssid: net.bssid,
              threat_score: 50.0,
              threat_category: 'moderate',
            }) as any
        );

      const result = await scoreAllNetworks({});

      expect(result.scored).toBe(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error scoring network AA:BB:CC:DD:EE:01: Scoring failed')
      );
      expect(scoringRepository.upsertLegacyThreatScore).toHaveBeenCalledTimes(1); // Only the successful one
    });

    it('should not call upsert if no networks were successfully scored', async () => {
      scoringRepository.loadThreatModelConfig.mockResolvedValueOnce({
        coefficients: ['0.5'],
        intercept: '0.1',
        feature_names: ['feat1'],
      });

      scoringRepository.loadNetworksForLegacyScoring.mockResolvedValueOnce([
        { bssid: 'AA:BB:CC:DD:EE:01' },
      ]);

      jest.spyOn(modelScoring, 'scoreNetworkWithModel').mockImplementationOnce(() => {
        throw new Error('Scoring failed');
      });

      const result = await scoreAllNetworks({});

      expect(result.scored).toBe(0);
      expect(scoringRepository.upsertLegacyThreatScore).not.toHaveBeenCalled();
    });
  });
});
