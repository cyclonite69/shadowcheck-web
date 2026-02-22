export {};
/**
 * Claude / Bedrock Routes
 *
 * POST /api/claude/analyze-networks  — analyze networks, persist result, return history
 * GET  /api/claude/insights          — retrieve analysis history
 * PATCH /api/claude/insights/:id/useful — record user feedback
 * GET  /api/claude/test              — connectivity check
 */

const express = require('express');
const router = express.Router();
const { bedrockService, aiInsightsService } = require('../../../config/container');
const logger = require('../../../logging/logger');

// ============================================
// POST /api/claude/analyze-networks
// ============================================
router.post('/claude/analyze-networks', async (req: any, res: any, next: any) => {
  try {
    const { networks, question } = req.body ?? {};

    if (!Array.isArray(networks) || networks.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'networks must be a non-empty array',
      });
    }

    const userQuestion =
      typeof question === 'string' && question.trim().length > 0
        ? question.trim()
        : 'Identify the highest-risk networks and explain why they may be surveillance threats.';

    // Optional user context from auth middleware (may be undefined)
    const userId: string | null = req.user?.id ?? null;

    logger.info(
      `[Claude] analyze-networks: ${networks.length} networks, userId=${userId ?? 'anon'}`
    );

    // 1. Call Bedrock
    const { analysis, suggestions } = await bedrockService.analyzeNetworks(networks, userQuestion);

    // 2. Persist the insight
    let insightId: number | null = null;
    try {
      insightId = await aiInsightsService.saveInsight({
        userId,
        question: userQuestion,
        filteredNetworks: networks,
        claudeResponse: analysis,
        suggestions,
      });
    } catch (persistErr: any) {
      // Persistence failure should not break the response — log and continue
      logger.error(`[Claude] Failed to persist insight: ${persistErr.message}`, {
        error: persistErr,
      });
    }

    // 3. Fetch recent history (last 10)
    let history: object[] = [];
    try {
      history = await aiInsightsService.getInsightHistory(userId, 10);
    } catch (histErr: any) {
      logger.warn(`[Claude] Failed to fetch history: ${histErr.message}`);
    }

    return res.json({
      ok: true,
      analysis,
      suggestions,
      insightId,
      history,
      meta: {
        networksAnalyzed: networks.length,
        model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      },
    });
  } catch (err: any) {
    logger.error(`[Claude] analyze-networks error: ${err.message}`, { error: err });
    next(err);
  }
});

// ============================================
// GET /api/claude/insights
// ============================================
router.get('/claude/insights', async (req: any, res: any, next: any) => {
  try {
    const userId: string | null = req.user?.id ?? null;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

    const history = await aiInsightsService.getInsightHistory(userId, limit);

    return res.json({ ok: true, history, count: history.length });
  } catch (err: any) {
    next(err);
  }
});

// ============================================
// PATCH /api/claude/insights/:id/useful
// ============================================
router.patch('/claude/insights/:id/useful', async (req: any, res: any, next: any) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ ok: false, error: 'Invalid insight id' });
    }

    const { useful } = req.body ?? {};
    if (typeof useful !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'useful must be a boolean' });
    }

    await aiInsightsService.markInsightUseful(id, useful);
    return res.json({ ok: true, id, useful });
  } catch (err: any) {
    next(err);
  }
});

// ============================================
// GET /api/claude/test
// ============================================
router.get('/claude/test', async (_req: any, res: any, next: any) => {
  try {
    const connected = await bedrockService.testConnection();
    return res.json({ ok: true, connected });
  } catch (err: any) {
    logger.error(`[Claude] test error: ${err.message}`, { error: err });
    next(err);
  }
});

module.exports = router;
