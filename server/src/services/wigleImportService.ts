const fs = require('fs');
const path = require('path');
const logger = require('../logging/logger');
const adminDb = require('./adminDbService');

export {};

async function importWigleV2Json(jsonFilePath: string) {
  const client = await adminDb.getAdminPool().connect();

  try {
    const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    let imported = 0;

    await client.query('BEGIN');

    for (const network of data.results) {
      // Use a SAVEPOINT per row: a failed INSERT rolls back only that row,
      // not the entire transaction (PostgreSQL aborts the txn on any error).
      await client.query('SAVEPOINT sp_network');
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
        await client.query('RELEASE SAVEPOINT sp_network');
        imported++;
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp_network');
        logger.error(`Error inserting network ${network.netid}: ${(err as any).message}`);
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

async function importWigleDirectory(importDir: string) {
  if (!fs.existsSync(importDir)) {
    throw new Error(`Directory not found: ${importDir}`);
  }

  const files = fs
    .readdirSync(importDir)
    .filter((file: any) => file.endsWith('.json'))
    .map((file: any) => path.join(importDir, file));

  let totalImported = 0;
  const results = [];

  for (const file of files) {
    try {
      const imported = await importWigleV2Json(file);
      totalImported += imported;
      results.push({ file: path.basename(file), imported, error: null });
    } catch (err) {
      results.push({ file: path.basename(file), imported: 0, error: (err as any).message });
    }
  }

  return { totalImported, results };
}

module.exports = { importWigleDirectory };
