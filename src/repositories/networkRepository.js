/**
 * Network repository
 * Handles all database operations for networks
 */

const BaseRepository = require('./baseRepository');
const { CONFIG } = require('../config/database');

class NetworkRepository extends BaseRepository {
  constructor() {
    super('app.networks');
  }

  /**
   * Get dashboard metrics
   * @returns {Promise<Object>} Dashboard statistics
   */
  async getDashboardMetrics() {
    const queries = {
      totalNetworks: 'SELECT COUNT(*) as count FROM app.networks',
      threatsCount: `
        SELECT COUNT(DISTINCT bssid) as count
        FROM app.observations
        WHERE observed_at_epoch >= ${CONFIG.MIN_VALID_TIMESTAMP}
        GROUP BY bssid
        HAVING COUNT(*) >= ${CONFIG.MIN_OBSERVATIONS}
      `,
      surveillanceCount: 'SELECT COUNT(*) as count FROM app.network_tags WHERE tag_type IN (\'INVESTIGATE\', \'THREAT\')',
      enrichedCount: 'SELECT COUNT(*) as count FROM app.wigle_networks_enriched',
      radioTypes: `
        SELECT
          CASE
            WHEN type = 'W' THEN 'WiFi'
            WHEN type = 'E' THEN 'BLE'
            WHEN type = 'B' THEN 'BT'
            WHEN type = 'L' THEN 'LTE'
            WHEN type = 'N' THEN 'LTE'
            WHEN type = 'G' THEN 'GSM'
            ELSE 'Other'
          END as radio_type,
          COUNT(*) as count
        FROM app.networks
        WHERE type IS NOT NULL
        GROUP BY radio_type
      `,
    };

    try {
      const [totalNetworks, threatsResult, surveillanceCount, enrichedCount, radioTypes] = await Promise.all([
        this.query(queries.totalNetworks),
        this.query(queries.threatsCount),
        this.query(queries.surveillanceCount),
        this.query(queries.enrichedCount),
        this.query(queries.radioTypes),
      ]);

      const radioCounts = {};
      radioTypes.rows.forEach(row => {
        radioCounts[row.radio_type] = parseInt(row.count);
      });

      return {
        totalNetworks: parseInt(totalNetworks.rows[0]?.count || 0),
        threatsCount: threatsResult.rows.length || 0,
        surveillanceCount: parseInt(surveillanceCount.rows[0]?.count || 0),
        enrichedCount: parseInt(enrichedCount.rows[0]?.count || 0),
        wifiCount: radioCounts.WiFi || 0,
        btCount: radioCounts.BT || 0,
        bleCount: radioCounts.BLE || 0,
        lteCount: radioCounts.LTE || 0,
        gsmCount: radioCounts.GSM || 0,
      };
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
      throw err;
    }
  }

  /**
   * Get network by BSSID
   * @param {string} bssid - MAC address or tower ID
   * @returns {Promise<Object|null>}
   */
  async getByBSSID(bssid) {
    return this.findOne('bssid = $1', [bssid.toUpperCase()]);
  }

  /**
   * Search networks by SSID
   * @param {string} ssid - SSID to search (supports wildcards)
   * @returns {Promise<Array>}
   */
  async searchBySSID(ssid) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE ssid ILIKE $1
      ORDER BY last_seen DESC
      LIMIT 100
    `;
    const result = await this.query(sql, [`%${ssid}%`]);
    return result.rows;
  }

  /**
   * Get networks with pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated results
   */
  async getPaginated(options = {}) {
    const {
      page = 1,
      limit = CONFIG.DEFAULT_PAGE_SIZE,
      sort = 'last_seen',
      order = 'DESC',
    } = options;

    const offset = (page - 1) * limit;
    const validLimit = Math.min(limit, CONFIG.MAX_PAGE_SIZE);

    const sql = `
      SELECT *
      FROM ${this.tableName}
      ORDER BY ${sort} ${order}
      LIMIT $1 OFFSET $2
    `;

    const countSql = `SELECT COUNT(*) as total FROM ${this.tableName}`;

    const [dataResult, countResult] = await Promise.all([
      this.query(sql, [validLimit, offset]),
      this.query(countSql),
    ]);

    const total = parseInt(countResult.rows[0].total);

    return {
      networks: dataResult.rows,
      total,
      page: parseInt(page),
      limit: validLimit,
      totalPages: Math.ceil(total / validLimit),
    };
  }

  /**
   * Get network types distribution
   * @returns {Promise<Array>}
   */
  async getNetworkTypesDistribution() {
    const sql = `
      SELECT
        type,
        CASE type
          WHEN 'W' THEN 'WiFi'
          WHEN 'E' THEN 'BLE'
          WHEN 'B' THEN 'Bluetooth'
          WHEN 'L' THEN 'LTE'
          WHEN 'N' THEN '5G NR'
          WHEN 'G' THEN 'GSM'
          ELSE type
        END as type_name,
        COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY type
      ORDER BY count DESC
    `;

    const result = await this.query(sql);
    return result.rows;
  }

  /**
   * Get manufacturer for a BSSID
   * @param {string} bssid - MAC address
   * @returns {Promise<Object|null>}
   */
  async getManufacturer(bssid) {
    const prefix = bssid.substring(0, 8).toUpperCase(); // First 3 octets
    const sql = `
      SELECT manufacturer, category
      FROM app.radio_manufacturers
      WHERE mac_prefix = $1
      LIMIT 1
    `;

    const result = await this.query(sql, [prefix]);
    return result.rows[0] || null;
  }
}

module.exports = NetworkRepository;
