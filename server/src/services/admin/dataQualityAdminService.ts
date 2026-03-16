import { Pool } from 'pg';
const logger = require('../../logging/logger');

interface QualityFilterStats {
  totalObservations: number;
  temporalClusters: number;
  duplicateCoords: number;
  extremeSignals: number;
  totalFiltered: number;
  lastApplied: Date | null;
}

interface QualityFilterConfig {
  enabled: boolean;
  temporalThreshold: number; // observations at same time/location
  duplicateThreshold: number; // observations at same location
  signalMin: number;
  signalMax: number;
}

export class DataQualityAdminService {
  constructor(private pool: Pool) {}

  private async refreshExplorerMv(): Promise<void> {
    await this.pool.query('REFRESH MATERIALIZED VIEW app.api_network_explorer_mv');
    logger.info('[DataQualityAdmin] Refreshed app.api_network_explorer_mv');
  }

  async getQualityStats(): Promise<QualityFilterStats> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_observations,
        COUNT(*) FILTER (WHERE is_temporal_cluster = true) as temporal_clusters,
        COUNT(*) FILTER (WHERE is_duplicate_coord = true) as duplicate_coords,
        COUNT(*) FILTER (WHERE is_extreme_signal = true) as extreme_signals,
        COUNT(*) FILTER (WHERE is_quality_filtered = true) as total_filtered,
        MAX(quality_filter_applied_at) as last_applied
      FROM observations
    `);

    const row = result.rows[0];
    return {
      totalObservations: parseInt(row.total_observations),
      temporalClusters: parseInt(row.temporal_clusters || '0'),
      duplicateCoords: parseInt(row.duplicate_coords || '0'),
      extremeSignals: parseInt(row.extreme_signals || '0'),
      totalFiltered: parseInt(row.total_filtered || '0'),
      lastApplied: row.last_applied,
    };
  }

  async getQualityConfig(): Promise<QualityFilterConfig> {
    const result = await this.pool.query(`
      SELECT config_value 
      FROM app.settings 
      WHERE config_key = 'quality_filter_config'
    `);

    if (result.rows.length === 0) {
      return {
        enabled: false,
        temporalThreshold: 50,
        duplicateThreshold: 1000,
        signalMin: -120,
        signalMax: 0,
      };
    }

    return JSON.parse(result.rows[0].config_value);
  }

  async updateQualityConfig(config: QualityFilterConfig): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO app.settings (config_key, config_value)
      VALUES ('quality_filter_config', $1)
      ON CONFLICT (config_key) 
      DO UPDATE SET config_value = $1, updated_at = NOW()
    `,
      [JSON.stringify(config)]
    );

    logger.info('[DataQualityAdmin] Quality filter config updated', config);
  }

  async applyQualityFilters(): Promise<QualityFilterStats> {
    const config = await this.getQualityConfig();

    if (!config.enabled) {
      throw new Error('Quality filters are disabled');
    }

    logger.info('[DataQualityAdmin] Applying quality filters...', config);

    // Mark temporal clusters
    await this.pool.query(
      `
      UPDATE observations o
      SET 
        is_temporal_cluster = true,
        is_quality_filtered = true,
        quality_filter_applied_at = NOW()
      WHERE (time, lat, lon) IN (
        SELECT time, lat, lon 
        FROM observations 
        GROUP BY time, lat, lon 
        HAVING COUNT(*) > $1
      )
    `,
      [config.temporalThreshold]
    );

    // Mark duplicate coordinates
    await this.pool.query(
      `
      UPDATE observations o
      SET 
        is_duplicate_coord = true,
        is_quality_filtered = true,
        quality_filter_applied_at = NOW()
      WHERE (lat, lon) IN (
        SELECT lat, lon 
        FROM observations 
        GROUP BY lat, lon 
        HAVING COUNT(*) > $1
      )
    `,
      [config.duplicateThreshold]
    );

    // Mark extreme signals
    await this.pool.query(
      `
      UPDATE observations
      SET 
        is_extreme_signal = true,
        is_quality_filtered = true,
        quality_filter_applied_at = NOW()
      WHERE level NOT BETWEEN $1 AND $2
    `,
      [config.signalMin, config.signalMax]
    );

    await this.refreshExplorerMv();
    logger.info('[DataQualityAdmin] Quality filters applied');

    return this.getQualityStats();
  }

  async clearQualityFlags(): Promise<void> {
    await this.pool.query(`
      UPDATE observations
      SET 
        is_temporal_cluster = false,
        is_duplicate_coord = false,
        is_extreme_signal = false,
        is_quality_filtered = false,
        quality_filter_applied_at = NULL
    `);

    await this.refreshExplorerMv();
    logger.info('[DataQualityAdmin] Quality flags cleared');
  }
}
