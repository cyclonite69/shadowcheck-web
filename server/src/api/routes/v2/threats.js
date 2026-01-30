/**
 * Threats Routes (v2)
 * Handles threat detection endpoints
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');
const logger = require('../../../logging/logger');

/**
 * GET /api/v2/threats/severity-counts
 * Returns the count of networks by threat severity.
 */
router.get('/threats/severity-counts', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        CASE
          WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'
          WHEN nt.threat_tag = 'INVESTIGATE' THEN COALESCE(nts.final_threat_level, 'NONE')
          ELSE (
            CASE
              WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 80 THEN 'CRITICAL'
              WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 60 THEN 'HIGH'
              WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 40 THEN 'MED'
              WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 20 THEN 'LOW'
              ELSE 'NONE'
            END
          )
        END as severity,
        COUNT(DISTINCT ne.bssid) as unique_networks,
        SUM(ne.observations)::bigint as total_observations
      FROM app.api_network_explorer_mv ne
      LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
      LEFT JOIN app.network_tags nt ON nt.bssid = ne.bssid AND nt.threat_tag IS NOT NULL
      GROUP BY 1
    `);

    // Transform to standard format { critical: { unique_networks: N, total_observations: M }, ... }
    const counts = {
      critical: { unique_networks: 0, total_observations: 0 },
      high: { unique_networks: 0, total_observations: 0 },
      medium: { unique_networks: 0, total_observations: 0 },
      low: { unique_networks: 0, total_observations: 0 },
      none: { unique_networks: 0, total_observations: 0 },
    };

    result.rows.forEach((row) => {
      const sev = (row.severity || '').toLowerCase();
      const unique = parseInt(row.unique_networks, 10);
      const total = parseInt(row.total_observations, 10);

      // Handle 'med' vs 'medium' mismatch if any, map common variants
      if (sev === 'med' || sev === 'medium') {
        counts.medium.unique_networks += unique;
        counts.medium.total_observations += total;
      } else if (counts[sev]) {
        counts[sev].unique_networks += unique;
        counts[sev].total_observations += total;
      }
    });

    res.json({ counts });
  } catch (error) {
    logger.error(`Threat severity counts error: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
