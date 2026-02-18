/**
 * Threats Routes (v2)
 * Handles threat detection endpoints
 */

import type { Request, Response } from 'express';

const express = require('express');
const router = express.Router();
const v2Service = require('../../../services/v2Service');
const logger = require('../../../logging/logger');

// Type definitions

type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MED' | 'LOW' | 'NONE';
type ThreatCategory = 'critical' | 'high' | 'medium' | 'low';

interface Filters {
  threatCategories?: ThreatCategory[];
  [key: string]: unknown;
}

interface EnabledFlags {
  threatCategories?: boolean;
  [key: string]: boolean | undefined;
}

interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number | null;
}

interface SeverityCountRow {
  severity: ThreatLevel | null;
  unique_networks: string;
  total_observations: string;
}

interface SeverityCounts {
  critical: { unique_networks: number; total_observations: number };
  high: { unique_networks: number; total_observations: number };
  medium: { unique_networks: number; total_observations: number };
  low: { unique_networks: number; total_observations: number };
  none: { unique_networks: number; total_observations: number };
}

const ThreatLevelMap: Record<ThreatCategory, ThreatLevel> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

/**
 * GET /api/v2/threats/severity-counts
 * Returns the count of networks by threat severity.
 * Respects current filters including threat level filtering.
 */
router.get('/threats/severity-counts', async (req: Request, res: Response) => {
  try {
    // Parse filters from query parameters
    const filtersParam = req.query.filters as string | undefined;
    const enabledParam = req.query.enabled as string | undefined;

    let filters: Filters = {};
    let enabled: EnabledFlags = {};

    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam) as Filters;
      } catch (_e) {
        logger.warn('Invalid filters parameter:', filtersParam);
      }
    }

    if (enabledParam) {
      try {
        enabled = JSON.parse(enabledParam) as EnabledFlags;
      } catch (_e) {
        logger.warn('Invalid enabled parameter:', enabledParam);
      }
    }

    // Build WHERE clause for threat level filtering
    let whereClause = '';
    const params: unknown[] = [];

    if (
      enabled.threatCategories &&
      Array.isArray(filters.threatCategories) &&
      filters.threatCategories.length > 0
    ) {
      const dbThreatLevels = filters.threatCategories
        .map((cat) => ThreatLevelMap[cat])
        .filter(Boolean);

      if (dbThreatLevels.length > 0) {
        whereClause = `WHERE (
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
          END
        ) = ANY($1)`;
        params.push(dbThreatLevels);
      }
    }

    const result: QueryResult<SeverityCountRow> = await v2Service.executeV2Query(
      `
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
      ${whereClause}
      GROUP BY 1
    `,
      params
    );

    // Transform to standard format { critical: { unique_networks: N, total_observations: M }, ... }
    const counts: SeverityCounts = {
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
      } else if (sev in counts) {
        const key = sev as keyof SeverityCounts;
        counts[key].unique_networks += unique;
        counts[key].total_observations += total;
      }
    });

    res.json({ counts });
  } catch (error) {
    const err = error as Error;
    logger.error(`Threat severity counts error: ${err.message}`, { error });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
