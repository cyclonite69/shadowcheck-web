/**
 * ML Repository Unit Tests
 */
export {};

const { query } = require('../../server/src/config/database');
const mlRepository = require('../../server/src/services/ml/repository');

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('ML Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadThreatModelConfig', () => {
    it('should return model config if found', async () => {
      const mockConfig = { coefficients: [0.5], intercept: 0.1, feature_names: ['feat'] };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockConfig] });

      const result = await mlRepository.loadThreatModelConfig();

      expect(result).toEqual(mockConfig);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("model_type = 'threat_logistic_regression'")
      );
    });

    it('should return null if no config found', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await mlRepository.loadThreatModelConfig();

      expect(result).toBeNull();
    });
  });

  describe('loadNetworksForLegacyScoring', () => {
    it('should load networks with the specified limit', async () => {
      const mockNetworks = [{ bssid: 'AA:BB:CC' }, { bssid: 'DD:EE:FF' }];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockNetworks });

      const result = await mlRepository.loadNetworksForLegacyScoring(5);

      expect(result).toEqual(mockNetworks);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1'), [5]);
    });
  });

  describe('upsertLegacyThreatScore', () => {
    const mockScore = {
      bssid: 'AA:BB:CC',
      ml_threat_score: 50.0,
      ml_threat_probability: 0.8,
      ml_primary_class: 'moderate',
      ml_feature_values: { feat1: 1 },
      rule_based_score: 10,
      rule_based_flags: { flag1: true },
      final_threat_score: 60.0,
      final_threat_level: 'High',
      model_version: '1.0.0',
    };

    it('should upsert score with overwriteFinal = true', async () => {
      (query as jest.Mock).mockResolvedValueOnce({});

      await mlRepository.upsertLegacyThreatScore(mockScore, true);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_threat_scores'),
        [
          mockScore.bssid,
          mockScore.ml_threat_score,
          mockScore.ml_threat_probability,
          mockScore.ml_primary_class,
          JSON.stringify(mockScore.ml_feature_values),
          mockScore.rule_based_score,
          JSON.stringify(mockScore.rule_based_flags),
          mockScore.final_threat_score,
          mockScore.final_threat_level,
          mockScore.model_version,
        ]
      );
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('scored_at = NOW()'),
        expect.any(Array)
      );
    });

    it('should upsert score with missing optional fields', async () => {
      const minimalScore = {
        bssid: 'AA:BB:CC',
        ml_threat_score: 50.0,
        ml_threat_probability: 0.8,
        ml_primary_class: 'moderate',
        rule_based_score: 10,
        final_threat_score: 60.0,
        final_threat_level: 'High',
      };
      (query as jest.Mock).mockResolvedValueOnce({});

      await mlRepository.upsertLegacyThreatScore(minimalScore, true);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.network_threat_scores'),
        expect.arrayContaining([
          JSON.stringify({}), // ml_feature_values
          JSON.stringify({}), // rule_based_flags
          null, // model_version
        ])
      );
    });
  });

  describe('getMLModelStatus', () => {
    it('should return ML model status', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ model_type: 'test' }] }) // modelRows
        .mockResolvedValueOnce({ rows: [{ tag_type: 'THREAT', count: '10' }] }) // tagRows
        .mockResolvedValueOnce({ rows: [{ count: '15' }] }); // scoreRows

      const result = await mlRepository.getMLModelStatus();

      expect(result).toEqual({
        modelTrained: true,
        modelInfo: { model_type: 'test' },
        taggedNetworks: [{ tag_type: 'THREAT', count: '10' }],
        mlScoresCount: 15,
      });
    });

    it('should handle missing count gracefully', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ model_type: 'test' }] }) // modelRows
        .mockResolvedValueOnce({ rows: [] }) // tagRows
        .mockResolvedValueOnce({ rows: [{ something_else: 'no_count' }] }); // scoreRows without count

      const result = await mlRepository.getMLModelStatus();

      expect(result.mlScoresCount).toBe(0);
    });

    it('should handle missing scores gracefully', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // modelRows
        .mockResolvedValueOnce({ rows: [] }) // tagRows
        .mockResolvedValueOnce({ rows: [] }); // scoreRows

      const result = await mlRepository.getMLModelStatus();

      expect(result).toEqual({
        modelTrained: false,
        modelInfo: null,
        taggedNetworks: [],
        mlScoresCount: 0,
      });
    });
  });

  describe('getMLTrainingData', () => {
    it('should return training data', async () => {
      const mockData = [{ bssid: 'AA:BB:CC', tag_type: 'THREAT' }];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockData });

      const result = await mlRepository.getMLTrainingData();

      expect(result).toEqual(mockData);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("nt.threat_tag IN ('THREAT', 'FALSE_POSITIVE')")
      );
    });
  });

  describe('getMLScoreForNetwork', () => {
    it('should return score for network', async () => {
      const mockScore = { bssid: 'AA:BB:CC', ml_threat_score: 50.0 };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockScore] });

      const result = await mlRepository.getMLScoreForNetwork('AA:BB:CC');

      expect(result).toEqual(mockScore);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('bssid = $1'), ['AA:BB:CC']);
    });

    it('should return null if score not found', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await mlRepository.getMLScoreForNetwork('AA:BB:CC');

      expect(result).toBeNull();
    });
  });

  describe('getNetworksByThreatLevel', () => {
    it('should return networks by level with limit', async () => {
      const mockNetworks = [{ bssid: 'AA:BB:CC' }];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockNetworks });

      const result = await mlRepository.getNetworksByThreatLevel('High', 10);

      expect(result).toEqual(mockNetworks);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('final_threat_level = $1'), [
        'High',
        10,
      ]);
    });
  });

  describe('getNetworksForBehavioralScoring', () => {
    it('should return networks with parameters', async () => {
      const mockNetworks = [{ bssid: 'AA:BB:CC' }];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockNetworks });

      const result = await mlRepository.getNetworksForBehavioralScoring(100, 5, 20);

      expect(result).toEqual(mockNetworks);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $3'), [20, 5, 100]);
    });
  });

  describe('bulkUpsertThreatScores', () => {
    it('should bulk upsert scores', async () => {
      const mockScores = [
        {
          bssid: 'AA:BB:CC',
          ml_threat_score: 50.0,
          ml_threat_probability: 0.8,
          ml_primary_class: 'moderate',
          rule_based_score: 10,
          final_threat_score: 60.0,
          final_threat_level: 'High',
          model_version: '1.0.0',
        },
        {
          bssid: 'DD:EE:FF',
          ml_threat_score: 10.0,
          ml_threat_probability: 0.1,
          ml_primary_class: 'low',
          rule_based_score: 0,
          final_threat_score: 10.0,
          final_threat_level: 'Low',
        },
      ];

      (query as jest.Mock).mockResolvedValue({});

      const inserted = await mlRepository.bulkUpsertThreatScores(mockScores);

      expect(inserted).toBe(2);
      expect(query).toHaveBeenCalledTimes(2);
    });
  });
});
