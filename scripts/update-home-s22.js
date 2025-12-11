const { Pool } = require('pg');
const secretsManager = require('../src/services/secretsManager');
require('dotenv').config();

async function updateHome() {
  await secretsManager.load();
  const pool = new Pool({
    user: process.env.DB_USER || 'shadowcheck',
    password: secretsManager.getOrThrow('db_password'),
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'shadowcheck',
    port: process.env.DB_PORT || 5432,
  });

  // Update laptop record to S22 Ultra with accurate coordinates
  await pool.query(`
    UPDATE app.location_markers 
    SET latitude=43.02994250, 
        longitude=-83.68801530, 
        location=ST_SetSRID(ST_MakePoint(-83.68801530, 43.02994250), 4326),
        device_id='S22Ultra',
        device_type='mobile'
    WHERE marker_type='home' AND device_id='laptop'
  `);

  // Delete NULL record
  await pool.query(
    "DELETE FROM app.location_markers WHERE marker_type='home' AND device_id IS NULL"
  );

  // Verify
  const result = await pool.query(
    "SELECT device_id, device_type, latitude, longitude FROM app.location_markers WHERE marker_type='home'"
  );
  console.log('Home location:', result.rows);

  await pool.end();
}

updateHome().catch(console.error);
