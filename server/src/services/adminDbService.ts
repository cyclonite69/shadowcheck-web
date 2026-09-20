/**
 * Admin Database Service
 * Uses shadowcheck_admin credentials for sensitive administrative operations
 */

import { Pool, QueryResult } from 'pg';
import '../config/loadEnv';
import secretsManager from './secretsManager';
import logger from '../logging/logger';

// Admin connection settings
const DB_ADMIN_USER = process.env.DB_ADMIN_USER || 'shadowcheck_admin';
const DB_NAME = process.env.DB_NAME || 'shadowcheck_db';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_APP_NAME = `${process.env.DB_APP_NAME || 'shadowcheck-web'}-admin`;
const DB_SEARCH_PATH = process.env.DB_SEARCH_PATH || 'app,public';

let adminPool: Pool | null = null;
let longRunningAdminPool: Pool | null = null;

function guardPool(pool: Pool): Pool {
  if (typeof pool.connect === 'function') {
    const originalConnect = pool.connect.bind(pool);
    pool.connect = ((callback?: Parameters<Pool['connect']>[0]) => {
      if (typeof callback === 'function') {
        return originalConnect((err, client, release) => {
          callback(err, client, release);
        });
      }

      return originalConnect();
    }) as Pool['connect'];
  }
  return pool;
}

/**
 * Initialize the admin connection pool
 */
function getAdminPool(): Pool | null {
  if (adminPool) {
    return adminPool;
  }

  const adminPassword = process.env.DB_ADMIN_PASSWORD || secretsManager.get('db_admin_password');
  const allowPasswordlessLocalAdmin =
    !adminPassword && DB_HOST === 'postgres' && process.env.DB_SSL !== 'true';

  if (!adminPassword && !allowPasswordlessLocalAdmin) {
    logger.error('db_admin_password not available. Admin operations will fail.');
    return null;
  }

  if (allowPasswordlessLocalAdmin) {
    logger.warn(
      'db_admin_password not available; using passwordless local admin connection against compose postgres.'
    );
  }

  adminPool = guardPool(
    new Pool({
      user: DB_ADMIN_USER,
      password: adminPassword || '',
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      max: 2, // Keep admin connections low
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      statement_timeout: 300000, // 5 minutes for heavy admin tasks
      application_name: DB_APP_NAME,
      options: `-c search_path=${DB_SEARCH_PATH}`,
      ssl:
        process.env.DB_SSL === 'true'
          ? {
              rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
              ca: process.env.DB_SSL_CA || undefined,
            }
          : false,
    })
  );

  if (typeof (adminPool as any).on === 'function') {
    adminPool.on('error', (err: Error) => {
      logger.error(`Unexpected error on admin pool idle client: ${err.message}`, { error: err });
    });
  }

  return adminPool;
}

/**
 * Initialize the long-running admin connection pool
 * No statement timeout for batch operations like sibling detection
 */
function getLongRunningAdminPool(): Pool | null {
  if (longRunningAdminPool) {
    return longRunningAdminPool;
  }

  const adminPassword = process.env.DB_ADMIN_PASSWORD || secretsManager.get('db_admin_password');
  const allowPasswordlessLocalAdmin =
    !adminPassword && DB_HOST === 'postgres' && process.env.DB_SSL !== 'true';

  if (!adminPassword && !allowPasswordlessLocalAdmin) {
    logger.error('db_admin_password not available. Admin operations will fail.');
    return null;
  }

  longRunningAdminPool = guardPool(
    new Pool({
      user: DB_ADMIN_USER,
      password: adminPassword || '',
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      max: 3, // Low concurrency for long-running jobs
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      statement_timeout: 0, // No timeout — for long-running admin batch jobs only
      application_name: `${DB_APP_NAME}_long_running`,
      options: `-c search_path=${DB_SEARCH_PATH}`,
      ssl:
        process.env.DB_SSL === 'true'
          ? {
              rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
              ca: process.env.DB_SSL_CA || undefined,
            }
          : false,
    })
  );

  if (typeof (longRunningAdminPool as any).on === 'function') {
    longRunningAdminPool.on('error', (err: Error) => {
      logger.error(`Unexpected error on long-running admin pool idle client: ${err.message}`, {
        error: err,
      });
    });
  }

  return longRunningAdminPool;
}

/**
 * Administrative query wrapper
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<QueryResult<any>>} Query result
 */
async function adminQuery(text: string, params: any[] = []): Promise<QueryResult<any>> {
  const pool = getAdminPool();
  if (!pool) {
    throw new Error('Admin database pool not initialized (check DB_ADMIN_PASSWORD)');
  }
  return pool.query(text, params);
}

/**
 * Forensic-grade read-only query wrapper.
 * Enforces READ ONLY transaction state and executes a ROLLBACK at the end.
 * Guaranteed to prevent mutations at the database engine level.
 */
async function forensicQuery(text: string, params: any[] = []): Promise<QueryResult<any>> {
  const pool = getAdminPool();
  if (!pool) {
    throw new Error('Admin database pool not initialized (check DB_ADMIN_PASSWORD)');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');
    const result = await client.query(text, params);
    await client.query('ROLLBACK');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Long-running administrative query wrapper (no statement timeout)
 * Use for batch operations like sibling detection that may take extended time
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<QueryResult<any>>} Query result
 */
async function longRunningAdminQuery(text: string, params: any[] = []): Promise<QueryResult<any>> {
  const pool = getLongRunningAdminPool();
  if (!pool) {
    throw new Error('Long-running admin database pool not initialized (check DB_ADMIN_PASSWORD)');
  }
  return pool.query(text, params);
}

/**
 * Close admin database connection pool
 * @returns {Promise<void>}
 */
async function closeAdminPool() {
  if (adminPool) {
    await adminPool.end();
    adminPool = null;
    logger.info('Admin database pool closed');
  }
  if (longRunningAdminPool) {
    await longRunningAdminPool.end();
    longRunningAdminPool = null;
    logger.info('Long-running admin database pool closed');
  }
}

export {
  adminQuery,
  forensicQuery,
  longRunningAdminQuery,
  getAdminPool,
  getLongRunningAdminPool,
  closeAdminPool,
};

export default {
  adminQuery,
  forensicQuery,
  longRunningAdminQuery,
  getAdminPool,
  getLongRunningAdminPool,
  closeAdminPool,
};
