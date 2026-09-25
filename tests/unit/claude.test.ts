import request from 'supertest';
import express from 'express';

jest.mock('../../server/src/config/container', () => ({
  bedrockService: {
    analyzeNetworks: jest.fn(),
    testConnection: jest.fn(),
  },
  aiInsightsService: {
    saveInsight: jest.fn(),
    getInsightHistory: jest.fn(),
    markInsightUseful: jest.fn(),
  },
}));

jest.mock('../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../../server/src/utils/validators', () => ({
  validators: {
    limit: jest.fn((val, min, max, def) => (val ? parseInt(val, 10) : def)),
  },
}));

const { bedrockService, aiInsightsService } = require('../../server/src/config/container');
const claudeRouter = require('../../server/src/api/routes/v1/claude');

const app = express();
app.use(express.json());
app.use((req: any, res: any, next: any) => {
  req.user = { id: 'user123' };
  next();
});
app.use('/api', claudeRouter);
// Fallback error handler
app.use((err: any, req: any, res: any, _next: any) => {
  res.status(500).json({ error: err.message });
});

describe('claude routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/claude/analyze-networks', () => {
    it('should return 400 if networks is missing or empty', async () => {
      const res = await request(app).post('/api/claude/analyze-networks').send({});
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('networks must be a non-empty array');
    });

    it('should successfully analyze networks', async () => {
      bedrockService.analyzeNetworks.mockResolvedValueOnce({
        analysis: 'Test Analysis',
        suggestions: ['Test Suggestion'],
      });
      aiInsightsService.saveInsight.mockResolvedValueOnce(1);
      aiInsightsService.getInsightHistory.mockResolvedValueOnce([{ id: 1 }]);

      const res = await request(app)
        .post('/api/claude/analyze-networks')
        .send({ networks: ['net1'], question: 'Test Question' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.analysis).toBe('Test Analysis');
      expect(res.body.suggestions).toEqual(['Test Suggestion']);
      expect(res.body.insightId).toBe(1);
      expect(res.body.history).toEqual([{ id: 1 }]);

      expect(bedrockService.analyzeNetworks).toHaveBeenCalledWith(['net1'], 'Test Question');
      expect(aiInsightsService.saveInsight).toHaveBeenCalledWith({
        userId: 'user123',
        question: 'Test Question',
        filteredNetworks: ['net1'],
        claudeResponse: 'Test Analysis',
        suggestions: ['Test Suggestion'],
      });
    });

    it('should handle persist errors gracefully', async () => {
      bedrockService.analyzeNetworks.mockResolvedValueOnce({
        analysis: 'Test Analysis',
        suggestions: [],
      });
      aiInsightsService.saveInsight.mockRejectedValueOnce(new Error('Persist Error'));
      aiInsightsService.getInsightHistory.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/claude/analyze-networks')
        .send({ networks: ['net1'] });

      expect(res.status).toBe(200);
      expect(res.body.insightId).toBeNull();
    });

    it('should pass error to next handler if analyzeNetworks fails', async () => {
      bedrockService.analyzeNetworks.mockRejectedValueOnce(new Error('Bedrock Error'));
      const res = await request(app)
        .post('/api/claude/analyze-networks')
        .send({ networks: ['net1'] });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Bedrock Error');
    });
  });

  describe('GET /api/claude/insights', () => {
    it('should return insight history', async () => {
      aiInsightsService.getInsightHistory.mockResolvedValueOnce([{ id: 1 }]);
      const res = await request(app).get('/api/claude/insights');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.history).toEqual([{ id: 1 }]);
      expect(res.body.count).toBe(1);
    });

    it('should handle error', async () => {
      aiInsightsService.getInsightHistory.mockRejectedValueOnce(new Error('DB Error'));
      const res = await request(app).get('/api/claude/insights');
      expect(res.status).toBe(500);
    });
  });

  describe('PATCH /api/claude/insights/:id/useful', () => {
    it('should return 400 for invalid id', async () => {
      const res = await request(app).patch('/api/claude/insights/abc/useful');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid useful boolean', async () => {
      const res = await request(app).patch('/api/claude/insights/1/useful').send({ useful: 'yes' });
      expect(res.status).toBe(400);
    });

    it('should mark insight useful successfully', async () => {
      aiInsightsService.markInsightUseful.mockResolvedValueOnce();
      const res = await request(app).patch('/api/claude/insights/1/useful').send({ useful: true });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.id).toBe(1);
      expect(res.body.useful).toBe(true);
      expect(aiInsightsService.markInsightUseful).toHaveBeenCalledWith(1, true);
    });

    it('should handle error', async () => {
      aiInsightsService.markInsightUseful.mockRejectedValueOnce(new Error('DB Error'));
      const res = await request(app).patch('/api/claude/insights/1/useful').send({ useful: true });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/claude/test', () => {
    it('should return connection test result', async () => {
      bedrockService.testConnection.mockResolvedValueOnce(true);
      const res = await request(app).get('/api/claude/test');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.connected).toBe(true);
    });

    it('should handle error', async () => {
      bedrockService.testConnection.mockRejectedValueOnce(new Error('Test Error'));
      const res = await request(app).get('/api/claude/test');
      expect(res.status).toBe(500);
    });
  });
});
