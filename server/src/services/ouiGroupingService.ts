const { query } = require('../config/database');
const logger = require('../logging/logger');

class OUIGroupingService {
  /**
   * Group networks by OUI and calculate collective threat
   */
  static async generateOUIGroups() {
    try {
      logger.info('[OUI Grouping] Starting OUI grouping analysis...');

      // Get all networks with threat scores
      const networks = await query(`
        SELECT 
          ap.bssid,
          SUBSTRING(ap.bssid, 1, 8) as oui,
          nts.final_threat_score,
          nts.final_threat_level,
          mv.observations,
          mv.unique_days,
          mv.max_distance_meters / 1000.0 as max_distance_km,
          mv.distance_from_home_km
        FROM app.access_points ap
        LEFT JOIN app.network_threat_scores nts ON ap.bssid = nts.bssid
        LEFT JOIN app.api_network_explorer_mv mv ON ap.bssid = mv.bssid
        WHERE ap.bssid IS NOT NULL
        ORDER BY SUBSTRING(ap.bssid, 1, 8), nts.final_threat_score DESC
      `);

      const ouiGroups = {};

      // Group by OUI
      for (const net of networks.rows) {
        if (!ouiGroups[net.oui]) {
          ouiGroups[net.oui] = {
            oui: net.oui,
            bssids: [],
            threatScores: [],
            maxDistance: 0,
            observations: 0,
            uniqueDays: 0,
          };
        }

        ouiGroups[net.oui].bssids.push(net.bssid);
        ouiGroups[net.oui].threatScores.push(net.final_threat_score || 0);
        ouiGroups[net.oui].maxDistance = Math.max(
          ouiGroups[net.oui].maxDistance,
          net.max_distance_km || 0
        );
        ouiGroups[net.oui].observations += net.observations || 0;
        ouiGroups[net.oui].uniqueDays = Math.max(
          ouiGroups[net.oui].uniqueDays,
          net.unique_days || 0
        );
      }

      // Calculate collective threat and insert
      for (const [oui, group] of Object.entries(ouiGroups)) {
        if (group.bssids.length < 2) {
          continue;
        } // Skip single BSSIDs

        // Collective threat = max of all BSSIDs
        const collectiveThreat = Math.max(...group.threatScores);
        let threatLevel = 'NONE';
        if (collectiveThreat >= 80) {
          threatLevel = 'CRITICAL';
        } else if (collectiveThreat >= 60) {
          threatLevel = 'HIGH';
        } else if (collectiveThreat >= 40) {
          threatLevel = 'MED';
        } else if (collectiveThreat >= 20) {
          threatLevel = 'LOW';
        }

        // Insert group
        await query(
          `
          INSERT INTO app.oui_device_groups
            (oui, device_count, collective_threat_score, threat_level, primary_bssid, secondary_bssids)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (oui) DO UPDATE SET
            device_count = $2,
            collective_threat_score = $3,
            threat_level = $4,
            primary_bssid = $5,
            secondary_bssids = $6,
            last_updated = NOW()
        `,
          [
            oui,
            group.bssids.length,
            collectiveThreat,
            threatLevel,
            group.bssids[0], // Primary (highest threat)
            group.bssids.slice(1), // Secondary
          ]
        );

        logger.info(
          `[OUI Grouping] ${oui}: ${group.bssids.length} BSSIDs, threat=${collectiveThreat.toFixed(2)}`
        );
      }

      logger.info(`[OUI Grouping] Completed: ${Object.keys(ouiGroups).length} groups`);
    } catch (err) {
      logger.error('[OUI Grouping] Failed:', err);
    }
  }

  /**
   * Detect MAC randomization (walked BSSIDs)
   */
  static async detectMACRandomization() {
    try {
      logger.info('[MAC Randomization] Starting detection...');

      // Get BSSIDs grouped by OUI with temporal/spatial data - simplified approach
      const macSequences = await query(`
        SELECT 
          SUBSTRING(ap.bssid, 1, 8) as oui,
          COUNT(DISTINCT ap.bssid) as mac_count,
          ARRAY_AGG(DISTINCT ap.bssid) as mac_sequence,
          AVG(obs.lat) as avg_lat,
          AVG(obs.lon) as avg_lon,
          MIN(obs.observed_at) as first_seen,
          MAX(obs.observed_at) as last_seen
        FROM app.access_points ap
        LEFT JOIN app.observations obs ON ap.bssid = obs.bssid
        WHERE obs.id IS NOT NULL
          AND obs.lat IS NOT NULL 
          AND obs.lon IS NOT NULL
        GROUP BY SUBSTRING(ap.bssid, 1, 8)
        HAVING COUNT(DISTINCT ap.bssid) >= 3
        ORDER BY COUNT(DISTINCT ap.bssid) DESC
        LIMIT 100
      `);

      for (const row of macSequences.rows) {
        const macs = row.mac_sequence || [];
        const macCount = row.mac_count || 0;

        if (macCount < 3) {
          continue;
        }

        // Simple heuristics for MAC randomization detection
        const timeDelta =
          row.last_seen && row.first_seen
            ? (new Date(row.last_seen) - new Date(row.first_seen)) / (1000 * 60 * 60) // hours
            : 0;

        // Estimate movement based on time span and MAC count
        const avgSpeed = timeDelta > 0 ? (macCount * 2) / timeDelta : 0; // rough estimate

        // Confidence based on MAC count and time patterns
        const macCountConfidence = macCount >= 5 ? 0.8 : macCount >= 3 ? 0.6 : 0.3;
        const timeConfidence = timeDelta > 24 && timeDelta < 720 ? 0.8 : 0.4; // 1-30 days
        const confidenceScore = (macCountConfidence + timeConfidence) / 2;

        // Only flag if confidence is reasonable
        if (confidenceScore >= 0.5) {
          await query(
            `
            INSERT INTO app.mac_randomization_suspects
              (oui, mac_sequence, avg_distance_km, movement_speed_kmh, confidence_score, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (oui) DO UPDATE SET
              mac_sequence = $2,
              avg_distance_km = $3,
              movement_speed_kmh = $4,
              confidence_score = $5,
              status = $6
          `,
            [
              row.oui,
              macs,
              (macCount * 0.5).toFixed(2), // rough distance estimate
              avgSpeed.toFixed(2),
              confidenceScore.toFixed(2),
              confidenceScore >= 0.7 ? 'confirmed' : 'suspected',
            ]
          );

          logger.info(
            `[MAC Randomization] ${row.oui}: ${macCount} MACs, confidence=${confidenceScore.toFixed(2)}, speed=${avgSpeed.toFixed(1)}km/h`
          );
        }
      }

      logger.info('[MAC Randomization] Detection complete');
    } catch (err) {
      logger.error('[MAC Randomization] Failed:', err);
    }
  }
}

module.exports = OUIGroupingService;
