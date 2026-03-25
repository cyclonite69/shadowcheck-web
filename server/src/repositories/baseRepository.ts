/**
 * Base repository class
 * Provides common database operations
 */

const { query } = require('../config/database');

export {};

// Allowlist of tables this repository may operate on.
// Prevents tableName injection if a subclass is misconfigured.
const ALLOWED_TABLES = new Set([
  'app.networks',
  'app.observations',
  'app.network_tags',
  'app.network_notes',
  'app.network_threat_scores',
  'app.users',
  'app.settings',
  'app.location_markers',
  'app.radio_manufacturers',
  'app.wigle_v3_observations',
  'app.wigle_v2_networks_search',
  'app.ml_training_history',
  'app.job_runs',
]);

class BaseRepository {
  tableName: string;
  // Subclasses must override to restrict which columns may be written.
  static ALLOWED_COLUMNS: Set<string> = new Set();

  constructor(tableName: string) {
    if (!ALLOWED_TABLES.has(tableName)) {
      throw new Error(`Table '${tableName}' is not in the allowed tables list`);
    }
    this.tableName = tableName;
  }

  /**
   * Filter data keys through the subclass ALLOWED_COLUMNS whitelist.
   * Falls back to all keys when the subclass has not defined a whitelist
   * (legacy behaviour — subclasses should always define ALLOWED_COLUMNS).
   */
  private filterColumns(data: Record<string, unknown>): Record<string, unknown> {
    const allowed = (this.constructor as typeof BaseRepository).ALLOWED_COLUMNS;
    if (allowed.size === 0) return data; // no whitelist defined — pass through
    return Object.fromEntries(Object.entries(data).filter(([k]) => allowed.has(k)));
  }

  private assertWritableColumns(
    original: Record<string, unknown>,
    filtered: Record<string, unknown>,
    operation: 'insert' | 'update'
  ): void {
    const originalKeys = Object.keys(original);
    const filteredKeys = Object.keys(filtered);

    if (originalKeys.length === 0) {
      throw new Error(`Cannot ${operation} into ${this.tableName}: no data provided`);
    }

    if (filteredKeys.length === 0) {
      const allowed = (this.constructor as typeof BaseRepository).ALLOWED_COLUMNS;
      const allowedList = allowed.size > 0 ? Array.from(allowed).join(', ') : 'none';
      throw new Error(
        `Cannot ${operation} into ${this.tableName}: no writable columns after filtering. Allowed columns: ${allowedList}`
      );
    }
  }

  /**
   * Execute a query with parameters
   */
  async query(text: string, params: unknown[] = []) {
    return query(text, params);
  }

  /**
   * Get a single row by condition
   * @param {string} whereClause - WHERE clause (e.g., "id = $1")
   * @param {Array} params - Query parameters
   */
  async findOne(whereClause: string, params: unknown[] = []) {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Get multiple rows by condition
   */
  async findMany(whereClause = '1=1', params = [], options: Record<string, unknown> = {}) {
    const { limit = 100, offset = 0, orderBy = 'id DESC' } = options as any;

    // Whitelist valid columns to prevent SQL injection via ORDER BY
    const validColumns = [
      'id',
      'created_at',
      'updated_at',
      'bssid',
      'ssid',
      'last_seen',
      'first_seen',
      'type',
      'signal',
    ];
    const validDirections = ['ASC', 'DESC'];

    const [column, direction = 'DESC'] = orderBy.trim().split(/\s+/);

    if (!validColumns.includes(column)) {
      throw new Error(
        `Invalid orderBy column: ${column}. Must be one of: ${validColumns.join(', ')}`
      );
    }

    if (!validDirections.includes(direction.toUpperCase())) {
      throw new Error(`Invalid orderBy direction: ${direction}. Must be ASC or DESC`);
    }

    const safeLimit = Math.min(Math.max(1, parseInt(limit) || 100), 1000);
    const safeOffset = Math.max(0, parseInt(offset) || 0);

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE ${whereClause}
      ORDER BY ${column} ${direction.toUpperCase()}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await this.query(sql, [...params, safeLimit, safeOffset]);
    return result.rows;
  }

  /**
   * Count rows by condition
   */
  async count(whereClause = '1=1', params = []) {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause}`;
    const result = await this.query(sql, params);
    return parseInt(result.rows[0]?.count || 0);
  }

  /**
   * Insert a new row — column names are filtered through ALLOWED_COLUMNS
   */
  async insert(data: any) {
    const filtered = this.filterColumns(data);
    this.assertWritableColumns(data, filtered, 'insert');
    const columns = Object.keys(filtered);
    const values = Object.values(filtered);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.query(sql, values);
    return result.rows[0];
  }

  /**
   * Update rows by condition — column names are filtered through ALLOWED_COLUMNS
   */
  async update(data: any, whereClause: string, whereParams: any[] = []) {
    const filtered = this.filterColumns(data);
    this.assertWritableColumns(data, filtered, 'update');
    const columns = Object.keys(filtered);
    const values = Object.values(filtered);

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING *
    `;

    const result = await this.query(sql, [...values, ...whereParams]);
    return result.rows;
  }

  /**
   * Delete rows by condition
   */
  async delete(whereClause: string, params: any[] = []) {
    const sql = `DELETE FROM ${this.tableName} WHERE ${whereClause}`;
    const result = await this.query(sql, params);
    return result.rowCount;
  }
}

module.exports = BaseRepository;
