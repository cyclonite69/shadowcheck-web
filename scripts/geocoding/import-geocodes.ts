import { Pool } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

interface GeocodeData {
  bssid: string;
  lat: number;
  lon: number;
  address: string;
  venue: string;
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function importGeocodes(): Promise<void> {
  const INPUT_FILE = process.argv[2] || 'locations_reverse_geocoded.csv';

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ File not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  console.log('📥 Reading CSV...');
  const input = fs.readFileSync(INPUT_FILE, 'utf8');
  const lines = input.trim().split('\n');

  const data: GeocodeData[] = lines
    .slice(1)
    .map((line): GeocodeData | null => {
      const match = line.match(/^([^,]+),([^,]+),([^,]+),([^,]*),(.*)$/);
      if (!match) {
        return null;
      }

      const [, bssid, lat, lon, address, venue] = match;
      return {
        bssid: bssid.replace(/"/g, ''),
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        address: address.replace(/"/g, ''),
        venue: venue.replace(/"/g, ''),
      };
    })
    .filter((item): item is GeocodeData => item !== null);

  console.log(`📊 Parsed ${data.length} geocoded locations`);

  let updated = 0;
  for (const item of data) {
    try {
      if (item.address) {
        await pool.query('UPDATE app.networks_legacy SET trilat_address = $1 WHERE bssid = $2', [
          item.address,
          item.bssid,
        ]);
      }

      if (item.venue) {
        await pool.query('UPDATE app.networks_legacy SET venue_name = $1 WHERE bssid = $2', [
          item.venue,
          item.bssid,
        ]);
      }

      updated++;
      if (updated % 1000 === 0) {
        console.log(`  ✓ ${updated}/${data.length} updated`);
      }
    } catch (error) {
      console.error(`Error updating ${item.bssid}:`, (error as Error).message);
    }
  }

  console.log(`\n✅ Import complete: ${updated}/${data.length} records updated`);
  await pool.end();
}

importGeocodes().catch(console.error);
