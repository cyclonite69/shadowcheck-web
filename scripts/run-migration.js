#!/usr/bin/env node
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'shadowcheck_user',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'shadowcheck_db',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync('/home/cyclonite01/ShadowCheckStatic/sql/migrations/01_add_minimum_required_columns.sql', 'utf8');

    console.log('🔄 Running migration...\n');
    await client.query(sql);
    console.log('\n✅ Migration completed successfully!');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('Details:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
