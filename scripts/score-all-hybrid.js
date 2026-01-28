require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'shadowcheck_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

const BATCH_SIZE = 2000;

// Helper to determine threat level
const determineThreatLevel = (score) => {
  if (score >= 80) {return 'CRITICAL';}
  if (score >= 60) {return 'HIGH';}
  if (score >= 40) {return 'MED';}
  if (score >= 20) {return 'LOW';}
  return 'NONE';
};

async function scoreAll() {
  const client = await pool.connect();
  try {
    console.log('Starting full scoring run...');

    // 1. Load Model
    const modelResult = await client.query(
      `SELECT coefficients, intercept, feature_names
       FROM app.ml_model_config
       WHERE model_type = 'threat_logistic_regression'`
    );

    if (modelResult.rows.length === 0) {
      console.error('No model found!');
      return;
    }

    const model = modelResult.rows[0];
    const coefficients = Array.isArray(model.coefficients)
      ? model.coefficients.map(c => parseFloat(c))
      : JSON.parse(JSON.stringify(model.coefficients)).map(c => parseFloat(c));
    const intercept = parseFloat(model.intercept) || 0;
    const featureNames = Array.isArray(model.feature_names)
      ? model.feature_names
      : JSON.parse(JSON.stringify(model.feature_names));

    console.log('Model loaded.');

    // 2. Process in batches using keyset pagination (bssid)
    let lastBssid = '00:00:00:00:00:00';
    let totalProcessed = 0;

    while (true) {
      const networkResult = await client.query(
        `
        SELECT 
          ap.bssid,
          mv.observations as observation_count,
          mv.unique_days,
          mv.unique_locations,
          mv.signal as max_signal,
          mv.max_distance_meters / 1000.0 as max_distance_km,
          mv.distance_from_home_km,
          (mv.distance_from_home_km < 0.1) as seen_at_home,
          (mv.distance_from_home_km > 0.5) as seen_away_from_home,
          COALESCE(nts.rule_based_score, (mv.threat->>'score')::numeric * 100, 0) AS rule_based_score
        FROM public.access_points ap
        LEFT JOIN public.api_network_explorer_mv mv ON ap.bssid = mv.bssid
        LEFT JOIN app.network_threat_scores nts ON ap.bssid = nts.bssid
        WHERE ap.bssid > $1
          AND ap.bssid IS NOT NULL
          AND LENGTH(ap.bssid) <= 17
          AND mv.observations > 0
        ORDER BY ap.bssid
        LIMIT $2
        `,
        [lastBssid, BATCH_SIZE]
      );

      if (networkResult.rows.length === 0) {
        break;
      }

      const scores = [];

      for (const net of networkResult.rows) {
        lastBssid = net.bssid;

        // Feature Stats (Normalization)
        const featureStats = {
          distance_range_km: { min: 0, max: 9.29 },
          unique_days: { min: 1, max: 222 },
          observation_count: { min: 1, max: 2260 },
          max_signal: { min: -149, max: 127 },
          unique_locations: { min: 1, max: 213 },
          seen_both_locations: { min: 0, max: 1 },
        };

        const normalize = (value, min, max) => {
          if (max === min) {return 0;}
          return (value - min) / (max - min);
        };

        const rawFeatures = {
          distance_range_km: parseFloat(net.max_distance_km || 0),
          unique_days: parseInt(net.unique_days || 0),
          observation_count: parseInt(net.observation_count || 0),
          max_signal: parseInt(net.max_signal || -100),
          unique_locations: parseInt(net.unique_locations || 0),
          seen_both_locations: net.seen_at_home && net.seen_away_from_home ? 1 : 0,
        };

        const features = {};
        for (const [key, value] of Object.entries(rawFeatures)) {
          const stats = featureStats[key];
          features[key] = stats ? normalize(value, stats.min, stats.max) : value;
        }

        let z = intercept;
        for (let i = 0; i < coefficients.length && i < featureNames.length; i++) {
          const featureName = featureNames[i];
          const featureValue = features[featureName] || 0;
          if (!isNaN(featureValue)) {
            z += coefficients[i] * featureValue;
          }
        }

        let probability;
        if (z > 500) {probability = 1.0;} else if (z < -500) {probability = 0.0;} else {probability = 1 / (1 + Math.exp(-z));}

        if (isNaN(probability) || !isFinite(probability)) {probability = 0.5;}

        const threatScore = probability * 100;
        const ruleScore = parseFloat(net.rule_based_score || 0);

        // --- HYBRID GATED FORMULA (MATCHING API) ---
        const obsCount = parseInt(net.observation_count || 0);
        const uniqueDays = parseInt(net.unique_days || 0);
        const uniqueLocs = parseInt(net.unique_locations || 0);

        let evidenceWeight = 0;
        if (obsCount >= 3 && uniqueDays >= 2) {
          evidenceWeight = Math.min(
            1.0,
            Math.log1p(obsCount) / Math.log1p(30),
            uniqueDays / 7.0,
            uniqueLocs / 5.0
          );
        }

        const mlBoost = evidenceWeight * Math.max(0, threatScore - ruleScore);
        const hybridScore = ruleScore + mlBoost;

        // We always overwrite final score in this script
        const finalScore = hybridScore;
        const threatLevel = determineThreatLevel(finalScore);

        scores.push({
          bssid: net.bssid,
          ml_threat_score: parseFloat(threatScore.toFixed(2)),
          ml_threat_probability: parseFloat(probability.toFixed(3)),
          ml_primary_class: threatScore >= 50 ? 'THREAT' : 'LEGITIMATE',
          ml_feature_values: {
            rule_score: parseFloat(ruleScore.toFixed(2)),
            ml_score: parseFloat(threatScore.toFixed(2)),
            evidence_weight: parseFloat(evidenceWeight.toFixed(3)),
            ml_boost: parseFloat(mlBoost.toFixed(2)),
            features: rawFeatures,
          },
          rule_based_score: ruleScore,
          final_threat_score: parseFloat(finalScore.toFixed(2)),
          final_threat_level: threatLevel,
          model_version: '1.0.0',
        });
      }

      // Batch Update
      for (const score of scores) {
        await client.query(
          `
          INSERT INTO app.network_threat_scores 
            (bssid, ml_threat_score, ml_threat_probability, ml_primary_class,
             ml_feature_values, rule_based_score, final_threat_score, final_threat_level, model_version)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (bssid) DO UPDATE SET
            ml_threat_score = EXCLUDED.ml_threat_score,
            ml_threat_probability = EXCLUDED.ml_threat_probability,
            ml_primary_class = EXCLUDED.ml_primary_class,
            ml_feature_values = EXCLUDED.ml_feature_values,
            rule_based_score = EXCLUDED.rule_based_score,
            final_threat_score = EXCLUDED.final_threat_score,
            final_threat_level = EXCLUDED.final_threat_level,
            model_version = EXCLUDED.model_version,
            scored_at = NOW(),
            updated_at = NOW()
        `,
          [
            score.bssid,
            score.ml_threat_score,
            score.ml_threat_probability,
            score.ml_primary_class,
            JSON.stringify(score.ml_feature_values),
            score.rule_based_score,
            score.final_threat_score,
            score.final_threat_level,
            score.model_version,
          ]
        );
      }

      totalProcessed += scores.length;
      process.stdout.write(`\rProcessed ${totalProcessed} networks... (Last: ${lastBssid})`);
    }

    console.log('\nDone! All networks scored.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

scoreAll();
