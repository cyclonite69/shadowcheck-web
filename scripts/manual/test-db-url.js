// Test connection URL format
const { Client } = require('pg');
require('dotenv').config();

async function testConnectionURL() {
  const connectionString = `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@127.0.0.1:5432/${process.env.DB_NAME}`;

  console.log('Testing connection URL format...');
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
    ssl: false,
  });

  try {
    console.log('Attempting connection...');
    await client.connect();
    console.log('✓ Connected successfully!');

    const result = await client.query('SELECT NOW()');
    console.log('✓ Query result:', result.rows[0]);

    await client.end();
    console.log('✓ Test passed!');
    process.exit(0);
  } catch (err) {
    console.error('✗ Connection failed:', err.message);
    console.error('✗ Error code:', err.code);
    process.exit(1);
  }
}

testConnectionURL();
