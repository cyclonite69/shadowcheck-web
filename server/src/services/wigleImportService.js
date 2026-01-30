const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('../logging/logger');

const pool = new Pool({
  user: process.env.DB_USER || 'shadowcheck_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: process.env.DB_PASSWORD || 'changeme',
  port: process.env.DB_PORT || 5432,
  max: 1,
});

async function importWigleV2Json(jsonFilePath) {
  const client = await pool.connect();

  try {
    const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    let imported = 0;

    await client.query('BEGIN');

    for (const network of data.results) {
      try {
        await client.query(
          `
          INSERT INTO app.wigle_v2_networks_search (
            bssid, ssid, qos, transid, firsttime, lasttime, lastupdt,
            housenumber, road, city, region, country, postalcode,
            trilat, trilong, location, dhcp, paynet, userfound, channel,
            encryption, freenet, comment, wep, bcninterval, type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::double precision, $15::double precision, ST_SetSRID(ST_MakePoint($15::double precision, $14::double precision), 4326), $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        `,
          [
            network.netid,
            network.ssid,
            network.qos || 0,
            network.transid,
            network.firsttime,
            network.lasttime,
            network.lastupdt,
            network.housenumber,
            network.road,
            network.city,
            network.region,
            network.country,
            network.postalcode,
            parseFloat(network.trilat) || 0,
            parseFloat(network.trilong) || 0,
            network.dhcp,
            network.paynet,
            network.userfound === true,
            network.channel,
            network.encryption,
            network.freenet,
            network.comment,
            network.wep,
            network.bcninterval,
            network.type,
          ]
        );
        imported++;
      } catch (err) {
        logger.error(`Error inserting network ${network.netid}: ${err.message}`);
      }
    }

    await client.query('COMMIT');
    return imported;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function importWigleDirectory(importDir) {
  if (!fs.existsSync(importDir)) {
    throw new Error(`Directory not found: ${importDir}`);
  }

  const files = fs
    .readdirSync(importDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(importDir, file));

  let totalImported = 0;
  const results = [];

  for (const file of files) {
    try {
      const imported = await importWigleV2Json(file);
      totalImported += imported;
      results.push({ file: path.basename(file), imported, error: null });
    } catch (err) {
      results.push({ file: path.basename(file), imported: 0, error: err.message });
    }
  }

  return { totalImported, results };
}

module.exports = { importWigleDirectory };
