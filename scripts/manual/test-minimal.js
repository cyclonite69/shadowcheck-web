const { Client } = require('pg');
const secretsManager = require('../server/src/services/secretsManager');

(async () => {
  await secretsManager.load();

  const config = {
    user: 'shadowcheck_user',
    password: secretsManager.get('db_password'),
    host: '127.0.0.1',
    port: 5432,
    database: 'shadowcheck_db',
    connectionTimeoutMillis: 5000,
  };

  console.log('Config:', config);
  const client = new Client(config);
  client.connect((err) => {
    if (err) {
      console.error('Connection error:', err.message);
      process.exit(1);
    }
    console.log('✓ Connected!');
    console.log('Host:', client.host);
    console.log('Port:', client.port);
    client.end();
  });
})();
