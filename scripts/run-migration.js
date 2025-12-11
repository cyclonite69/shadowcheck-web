#!/usr/bin/env node
/**
 * Run SQL migration using secretsManager for password
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const secretsManager = require('../src/services/secretsManager');

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file.sql>');
  process.exit(1);
}

const migrationPath = path.resolve(migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

async function runMigration() {
  try {
    // Load secrets first
    await secretsManager.load();

    const pool = new Pool({
      user: process.env.DB_USER || 'shadowcheck',
      password: secretsManager.getOrThrow('db_password'),
      host: process.env.DB_HOST || '127.0.0.1',
      database: process.env.DB_NAME || 'shadowcheck',
      port: process.env.DB_PORT || 5432,
    });

    console.log(`Running migration: ${path.basename(migrationPath)}`);
    await pool.query(sql);
    console.log('✓ Migration completed successfully');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
