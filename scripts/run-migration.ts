#!/usr/bin/env node
/**
 * Run SQL migration using secretsManager for password
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import secretsManager from '../server/src/services/secretsManager';
import logger from '../server/src/logging/logger';

dotenv.config();

const migrationFile = process.argv[2];

if (!migrationFile) {
  logger.error('Usage: node run-migration.js <migration-file.sql>');
  process.exit(1);
}

const migrationPath = path.resolve(migrationFile);

if (!fs.existsSync(migrationPath)) {
  logger.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

async function runMigration(): Promise<void> {
  try {
    // Load secrets first
    await secretsManager.load();

    const pool = new Pool({
      user: process.env.DB_ADMIN_USER || 'shadowcheck_admin',
      password: secretsManager.getOrThrow('db_admin_password'),
      host: process.env.DB_HOST || '127.0.0.1',
      database: process.env.DB_NAME || 'shadowcheck',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      options: '-c search_path=app,public',
    });

    logger.info(`Running migration: ${path.basename(migrationPath)}`);
    await pool.query(sql);
    logger.info('✓ Migration completed successfully');
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error(`✗ Migration failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

runMigration();
