const dns = require('dns');
const { Client } = require('pg');

// Force IPv4
dns.setDefaultResultOrder('ipv4first');

const config = {
  user: 'shadowcheck_user',
  password: 'DJvHRxGZ2e+rDgkO4LWXZG1np80rU4daQNQpQ3PwvZ8=',
  host: '127.0.0.1',
  port: 5432,
  database: 'shadowcheck',
  connectionTimeoutMillis: 5000,
};

console.log('Testing with IPv4 first...');

const client = new Client(config);

client.connect((err) => {
  if (err) {
    console.error('✗ Connection error:', err.message);
    process.exit(1);
  }
  console.log('✓ Connected!');
  client.end();
});
