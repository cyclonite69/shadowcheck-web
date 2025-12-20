const { Pool } = require('pg');

const pool = new Pool({
  user: 'shadowcheck_user',
  // Try Unix socket by omitting host
  // host: '127.0.0.1',
  port: 5432,
  database: 'shadowcheck_db',
  connectionTimeoutMillis: 10000,
  ssl: false,
});

async function test() {
  console.log('Testing connection to PostgreSQL...');
  console.log('Config:', {
    host: '127.0.0.1',
    port: 5432,
    user: 'shadowcheck_user',
    database: 'shadowcheck_db',
  });

  try {
    const result = await pool.query('SELECT NOW(), current_database(), current_user');
    console.log('✓ Connected successfully!');
    console.log('Result:', result.rows[0]);
  } catch (err) {
    console.error('✗ Connection failed:', err.message);
    console.error('Error code:', err.code);
    console.error('Stack:', err.stack);
  } finally {
    await pool.end();
  }
}

test();
