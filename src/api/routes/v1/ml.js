/**
 * Machine Learning Routes
 * Handles ML model training and status
 */

const express = require('express');
const router = express.Router();
const { query, CONFIG } = require('../../../config/database');

// Load ML model with error handling
let ThreatMLModel, mlModel;
try {
  ThreatMLModel = require('../../../../scripts/ml/ml-trainer');
  mlModel = new ThreatMLModel();
  console.log('✓ ML model module loaded successfully');
} catch (err) {
  console.warn('⚠️  ML model module not found or failed to load:', err.message);
  console.warn('⚠️  ML training endpoints will be disabled');
  mlModel = null;
}

// POST /api/ml/train - Train ML model on tagged networks
router.post('/ml/train', async (req, res, next) => {
  try {
    if (!mlModel) {
      return res.status(503).json({
        ok: false,
        error: 'ML model module not available. Check server logs for details.',
      });
    }

    console.log('🤖 Training ML model on tagged networks...');

    const { rows } = await query(
      `
      WITH home_location AS (
        SELECT location::geography as home_point
        FROM app.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
      )
      SELECT
        nt.bssid,
        nt.tag_type,
        n.type,
        COUNT(DISTINCT l.unified_id) as observation_count,
        COUNT(DISTINCT DATE(to_timestamp(EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 / 1000.0))) as unique_days,
        COUNT(DISTINCT ST_SnapToGrid(ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geometry, 0.001)) as unique_locations,
        MAX(l.signal_dbm) as max_signal,
        MAX(ST_Distance(
          ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
          h.home_point
        )) / 1000.0 - MIN(ST_Distance(
          ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
          h.home_point
        )) / 1000.0 as distance_range_km,
        BOOL_OR(ST_Distance(
          ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
          h.home_point
        ) < 100) as seen_at_home,
        BOOL_OR(ST_Distance(
          ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
          h.home_point
        ) > 500) as seen_away_from_home
      FROM app.network_tags nt
      JOIN app.networks n ON nt.bssid = n.bssid
      JOIN app.observations l ON n.bssid = l.bssid
      CROSS JOIN home_location h
      WHERE nt.tag_type IN ('THREAT', 'FALSE_POSITIVE')
        AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
        AND EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 >= $1
      GROUP BY nt.bssid, nt.tag_type, n.type
    `,
      [CONFIG.MIN_VALID_TIMESTAMP]
    );

    if (rows.length < 10) {
      return res.status(400).json({
        ok: false,
        error: 'Need at least 10 tagged networks to train model',
        currentCount: rows.length,
      });
    }

    const trainingResult = await mlModel.train(rows);
    const sqlFormula = mlModel.generateSQLFormula();

    // Store model coefficients in database for persistence
    await query(
      `
      INSERT INTO app.ml_model_config (model_type, coefficients, intercept, feature_names, created_at)
      VALUES ('threat_logistic_regression', $1, $2, $3, NOW())
      ON CONFLICT (model_type) DO UPDATE
      SET coefficients = $1, intercept = $2, feature_names = $3, updated_at = NOW()
    `,
      [
        JSON.stringify(trainingResult.coefficients),
        trainingResult.intercept,
        JSON.stringify(trainingResult.featureNames),
      ]
    );

    console.log('✓ ML model trained successfully');
    console.log('  Features:', trainingResult.featureNames.join(', '));
    console.log('  Training samples:', trainingResult.trainingSamples);
    console.log('  Threats:', trainingResult.threatCount, 'Safe:', trainingResult.safeCount);

    res.json({
      ok: true,
      message: 'Model trained successfully',
      ...trainingResult,
      sqlFormula: sqlFormula,
    });
  } catch (err) {
    console.error('✗ ML training error:', err);
    next(err);
  }
});

// GET /api/ml/status - Get ML model status
router.get('/ml/status', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT model_type, feature_names, created_at, updated_at
      FROM app.ml_model_config
      WHERE model_type = 'threat_logistic_regression'
    `);

    const tagCount = await query(`
      SELECT tag_type, COUNT(*) as count
      FROM app.network_tags
      WHERE tag_type IN ('THREAT', 'FALSE_POSITIVE')
      GROUP BY tag_type
    `);

    res.json({
      ok: true,
      modelTrained: rows.length > 0,
      modelInfo: rows[0] || null,
      taggedNetworks: tagCount.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ml/reassess - Reassess all networks with trained model
router.post('/ml/reassess', async (req, res, next) => {
  try {
    console.log('🔄 Starting network reassessment...');

    // Get WiFi networks with behavioral stats
    const { rows: networks } = await query(`
      WITH home_location AS (
        SELECT location::geography as home_point
        FROM app.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
      )
      SELECT
        n.bssid,
        n.type,
        n.ssid,
        n.encryption,
        COUNT(DISTINCT l.unified_id) as observation_count,
        COUNT(DISTINCT DATE(l.observed_at)) as unique_days,
        COUNT(DISTINCT ST_SnapToGrid(ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geometry, 0.001)) as unique_locations,
        MAX(l.signal_dbm) as max_signal,
        MIN(l.signal_dbm) as min_signal,
        COALESCE(MAX(ST_Distance(
          ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
          h.home_point
        )) / 1000.0, 0) as max_distance_km,
        COALESCE(MIN(ST_Distance(
          ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
          h.home_point
        )) / 1000.0, 0) as min_distance_km,
        BOOL_OR(ST_Distance(
          ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
          h.home_point
        ) < 100) as seen_at_home,
        BOOL_OR(ST_Distance(
          ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
          h.home_point
        ) > 500) as seen_away
      FROM app.networks n
      JOIN app.observations l ON n.bssid = l.bssid
      CROSS JOIN home_location h
      WHERE l.latitude IS NOT NULL 
        AND l.longitude IS NOT NULL
        AND n.type = 'W'
      GROUP BY n.bssid, n.type, n.ssid, n.encryption
      HAVING COUNT(DISTINCT l.unified_id) >= 3
      LIMIT 5000
    `);

    console.log(`Found ${networks.length} WiFi networks to reassess`);

    let updated = 0;

    for (const net of networks) {
      try {
        let score = 0;
        const reasons = [];

        // MOBILITY INDICATORS (40 points max)
        const distanceRange = net.max_distance_km - net.min_distance_km;
        if (distanceRange > 10) {
          score += 40;
          reasons.push('high_mobility');
        } else if (distanceRange > 5) {
          score += 25;
          reasons.push('moderate_mobility');
        } else if (distanceRange > 2) {
          score += 15;
          reasons.push('local_mobility');
        }

        // PERSISTENCE (30 points max)
        if (net.unique_days >= 7) {
          score += 30;
          reasons.push('persistent_tracking');
        } else if (net.unique_days >= 3) {
          score += 20;
          reasons.push('multi_day_presence');
        } else if (net.unique_days >= 2) {
          score += 10;
          reasons.push('repeated_sighting');
        }

        // FOLLOWING BEHAVIOR (20 points)
        if (net.seen_at_home && net.seen_away && distanceRange > 1) {
          score += 20;
          reasons.push('follows_home_location');
        }

        // SIGNAL STRENGTH ANOMALIES (10 points)
        if (net.max_signal > -40) {
          score += 10;
          reasons.push('very_close_proximity');
        } else if (net.max_signal > -50) {
          score += 5;
          reasons.push('close_proximity');
        }

        // SUSPICIOUS CHARACTERISTICS
        // Hidden SSID
        if (!net.ssid || net.ssid.trim() === '') {
          score += 5;
          reasons.push('hidden_ssid');
        }

        // Open network (unusual for surveillance but possible)
        if (net.encryption === 'OPEN' && net.observation_count > 5) {
          score += 5;
          reasons.push('open_network_mobile');
        }

        // Multiple unique locations (geographic spread)
        if (net.unique_locations > 10) {
          score += 10;
          reasons.push('high_location_diversity');
        } else if (net.unique_locations > 5) {
          score += 5;
          reasons.push('moderate_location_diversity');
        }

        const mlScore = Math.min(score, 100);

        await query(
          `
          UPDATE app.networks 
          SET 
            ml_threat_score = $1, 
            threat_indicators = $2,
            updated_at = NOW()
          WHERE bssid = $3
        `,
          [mlScore, JSON.stringify(reasons), net.bssid]
        );

        updated++;
      } catch (err) {
        console.warn(`Failed to score ${net.bssid}:`, err.message);
      }
    }

    console.log(`✓ Successfully updated ${updated} WiFi networks`);

    res.json({
      ok: true,
      message: 'WiFi networks reassessed successfully',
      networksUpdated: updated,
      modelUsed: {
        type: 'wifi_behavioral_scoring',
        features: [
          'distance_range',
          'unique_days',
          'follows_home',
          'signal_strength',
          'hidden_ssid',
          'location_diversity',
        ],
        thresholds: {
          critical: '≥80 (persistent mobile tracking)',
          high: '60-79 (suspicious mobility)',
          medium: '40-59 (unusual behavior)',
          low: '20-39 (minor anomalies)',
        },
      },
    });
  } catch (err) {
    console.error('✗ Reassessment error:', err);
    next(err);
  }
});

module.exports = router;
