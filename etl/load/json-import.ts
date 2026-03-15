#!/usr/bin/env tsx
/**
 * WiGLE V2 JSON Import Script
 *
 * Imports WiGLE API v2 JSON responses into PostgreSQL
 */

import * as fs from 'fs';
import * as path from 'path';
import { PoolClient } from 'pg';
import { createPool } from '../utils/db';

interface WigleNetwork {
  netid?: string | null;
  ssid?: string | null;
  qos?: number | null;
  transid?: string | number | null;
  firsttime?: string | null;
  lasttime?: string | null;
  lastupdt?: string | null;
  housenumber?: string | null;
  road?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalcode?: string | null;
  trilat?: string | number | null;
  trilong?: string | number | null;
  dhcp?: string | null;
  paynet?: string | null;
  userfound?: boolean | null;
  channel?: number | string | null;
  encryption?: string | null;
  freenet?: string | null;
  comment?: string | null;
  wep?: string | null;
  bcninterval?: number | string | null;
  type?: string | null;
}

interface WigleJsonData {
  results?: WigleNetwork[];
}

const pool = createPool({ max: 1 });

async function importWigleV2Json(jsonFilePath: string): Promise<number> {
  console.log(`Processing: ${jsonFilePath}`);

  try {
    const data: WigleJsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

    if (!data.results || !Array.isArray(data.results)) {
      console.log('No results array found in JSON');
      return 0;
    }

    const client: PoolClient = await pool.connect();
    let imported = 0;

    try {
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
              network.netid, // bssid
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
              parseFloat(String(network.trilat)) || 0,
              parseFloat(String(network.trilong)) || 0,
              network.dhcp,
              network.paynet, // paynet
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
          const error = err as Error;
          console.error(`Error inserting network ${network.netid}:`, error.message);
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    console.log(`Imported ${imported} networks from ${path.basename(jsonFilePath)}`);
    return imported;
  } catch (err) {
    const error = err as Error;
    console.error(`Error processing ${jsonFilePath}:`, error.message);
    return 0;
  }
}

async function main(): Promise<void> {
  const wigleDir = path.join(__dirname, '..', '..', 'wigle api v2 responses');

  if (!fs.existsSync(wigleDir)) {
    console.error(`Directory not found: ${wigleDir}`);
    process.exit(1);
  }

  console.log(`Scanning directory: ${wigleDir}`);

  const files = fs
    .readdirSync(wigleDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(wigleDir, file));

  if (files.length === 0) {
    console.log('No JSON files found');
    process.exit(0);
  }

  console.log(`Found ${files.length} JSON files`);

  let totalImported = 0;

  for (const file of files) {
    const imported = await importWigleV2Json(file);
    totalImported += imported;
  }

  console.log(`\nTotal imported: ${totalImported} networks`);
  await pool.end();
}

if (require.main === module) {
  main().catch(console.error);
}

export { importWigleV2Json };
