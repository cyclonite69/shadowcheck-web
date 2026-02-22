export {};
/**
 * AI Insights Service
 *
 * Persists and retrieves Claude/Bedrock network analysis history.
 * Writes use adminDbService (write role); reads use the default query helper.
 */

const adminDbService = require('./adminDbService');
const { query } = require('../config/database');
const logger = require('../logging/logger');

interface SaveInsightParams {
  userId?: string | null;
  question: string;
  filteredNetworks: object[];
  claudeResponse: string;
  suggestions: string[];
  tags?: string[];
}

interface Insight {
  id: number;
  user_id: string | null;
  question: string;
  filtered_networks: object[];
  claude_response: string;
  suggestions: string[];
  tags: string[];
  useful: boolean | null;
  created_at: string;
  updated_at: string;
}

/**
 * Persist a completed analysis to app.ai_insights.
 * Returns the new row id.
 */
async function saveInsight(params: SaveInsightParams): Promise<number> {
  const {
    userId = null,
    question,
    filteredNetworks,
    claudeResponse,
    suggestions,
    tags = [],
  } = params;

  const result = await adminDbService.query(
    `INSERT INTO app.ai_insights
       (user_id, question, filtered_networks, claude_response, suggestions, tags)
     VALUES ($1, $2, $3::jsonb, $4, $5::text[], $6::text[])
     RETURNING id`,
    [userId, question, JSON.stringify(filteredNetworks), claudeResponse, suggestions, tags]
  );

  const id: number = result.rows[0].id;
  logger.info(`[AiInsights] Saved insight id=${id}`);
  return id;
}

/**
 * Retrieve recent analysis history, optionally filtered by userId.
 */
async function getInsightHistory(userId: string | null, limit = 20): Promise<Insight[]> {
  const clampedLimit = Math.min(Math.max(1, limit), 100);

  let sql: string;
  let params: unknown[];

  if (userId) {
    sql = `SELECT id, user_id, question, filtered_networks, claude_response,
                  suggestions, tags, useful, created_at, updated_at
           FROM app.ai_insights
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2`;
    params = [userId, clampedLimit];
  } else {
    sql = `SELECT id, user_id, question, filtered_networks, claude_response,
                  suggestions, tags, useful, created_at, updated_at
           FROM app.ai_insights
           ORDER BY created_at DESC
           LIMIT $1`;
    params = [clampedLimit];
  }

  const result = await query(sql, params);
  return result.rows as Insight[];
}

/**
 * Record user feedback (thumbs up/down) on an insight.
 */
async function markInsightUseful(insightId: number, useful: boolean): Promise<void> {
  await adminDbService.query(
    `UPDATE app.ai_insights
     SET useful = $1, updated_at = NOW()
     WHERE id = $2`,
    [useful, insightId]
  );
  logger.info(`[AiInsights] Marked insight id=${insightId} useful=${useful}`);
}

module.exports = { saveInsight, getInsightHistory, markInsightUseful };
