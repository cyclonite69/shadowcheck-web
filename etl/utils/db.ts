/**
 * Database connection utilities for ETL scripts
 */

import { Pool, PoolConfig, QueryResult } from 'pg';
import '../loadEnv';

interface DatabaseConfig extends PoolConfig {
  user: string;
  host: string;
  database: string;
  password?: string;
  port: number;
}

const defaultConfig: DatabaseConfig = {
  user: process.env.DB_ADMIN_USER || 'shadowcheck_admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
};

/**
 * Create a new database pool
 * @param options - Pool options to override defaults
 * @returns Pool instance
 */
export function createPool(options: PoolConfig = {}): Pool {
  return new Pool({
    ...defaultConfig,
    ...options,
  });
}

/**
 * Execute a query with a temporary connection
 * @param sql - SQL query
 * @param params - Query parameters
 * @returns Query result
 */
export async function query(sql: string, params: unknown[] = []): Promise<QueryResult> {
  const pool = createPool();
  try {
    const result = await pool.query(sql, params);
    return result;
  } finally {
    await pool.end();
  }
}

/**
 * Execute multiple queries in a transaction
 * @param queries - Array of SQL queries with parameters
 * @returns Array of query results
 */
export async function transaction(
  queries: Array<{ sql: string; params?: unknown[] }>
): Promise<QueryResult[]> {
  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const results: QueryResult[] = [];

    for (const { sql, params = [] } of queries) {
      const result = await client.query(sql, params);
      results.push(result);
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
