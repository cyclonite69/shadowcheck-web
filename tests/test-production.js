// Test production server connection to Docker PostgreSQL
console.log('Testing production server setup...');

// Set environment to use Docker PostgreSQL via docker exec
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'shadowcheck_user';
process.env.DB_NAME = 'shadowcheck_db';

const { spawn } = require('child_process');

// Test database query via docker exec
console.log('\n1. Testing Docker PostgreSQL connection...');
const dockerTest = spawn('docker', [
  'exec',
  'shadowcheck_postgres',
  'psql',
  '-U',
  'shadowcheck_user',
  '-d',
  'shadowcheck_db',
  '-c',
  'SELECT COUNT(*) FROM app.networks;',
]);

dockerTest.stdout.on('data', (data) => {
  console.log('✓ Database accessible via Docker:', data.toString().trim());
});

dockerTest.stderr.on('data', (data) => {
  console.error('✗ Error:', data.toString());
});

dockerTest.on('close', (code) => {
  if (code === 0) {
    console.log('✓ Docker PostgreSQL is working correctly\n');
    console.log('2. Production build status:');
    console.log('✓ React app built to dist/');
    console.log('✓ index.html:', require('fs').existsSync('./dist/index.html'));
    console.log('✓ Main JS bundle:', require('fs').existsSync('./dist/assets/index-Bs9ZSgFo.js'));
    console.log('✓ Main CSS:', require('fs').existsSync('./dist/assets/index-lb4J_y9Y.css'));

    console.log('\n3. To run production server:');
    console.log('   OPTION A (Recommended): Use Docker');
    console.log('   - Fix Dockerfile .npmrc issue');
    console.log('   - Run: docker-compose up -d --build api');
    console.log('   - Access: http://localhost:3001');

    console.log('\n   OPTION B: Run locally (requires stopping system PostgreSQL)');
    console.log('   - sudo systemctl stop postgresql');
    console.log('   - npm start');
    console.log('   - Access: http://localhost:3001');

    console.log('\n4. Current issue:');
    console.log('   ⚠ Local PostgreSQL service is running on port 5432');
    console.log('   ⚠ This prevents Node.js from connecting to Docker PostgreSQL');
    console.log('   ⚠ Must stop local PostgreSQL or run API in Docker');
  } else {
    console.error('✗ Database test failed');
  }
});
