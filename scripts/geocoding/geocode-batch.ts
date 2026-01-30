import * as fs from 'fs';
import * as https from 'https';
import * as dotenv from 'dotenv';

dotenv.config();

interface GeocodeResult {
  lat: number | null;
  lon: number | null;
  full_address: string | null;
}

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const INPUT_FILE = process.argv[2] || 'addresses.csv';
const OUTPUT_FILE = process.argv[3] || 'addresses_geocoded.csv';
const PER_MINUTE = 1000;
const MINUTES = 10;
const DELAY_MS = 60;

if (!MAPBOX_TOKEN) {
  console.error('❌ MAPBOX_TOKEN not found in .env');
  process.exit(1);
}

async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const encoded = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&permanent=true&limit=1`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.features && json.features.length > 0) {
              const [lon, lat] = json.features[0].center;
              resolve({ lat, lon, full_address: json.features[0].place_name });
            } else {
              resolve({ lat: null, lon: null, full_address: null });
            }
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function main(): Promise<void> {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const addresses = fs
    .readFileSync(INPUT_FILE, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.trim());

  console.log(`🗺️  Geocoding ${addresses.length} addresses...`);
  console.log(`   Rate limit: ${PER_MINUTE}/min for ${MINUTES} minutes`);
  console.log(`   Output: ${OUTPUT_FILE}\n`);

  const results: string[] = ['address,lat,lon,full_address'];
  let processed = 0;
  let successful = 0;

  for (const address of addresses) {
    try {
      const result = await geocodeAddress(address);

      if (result.lat && result.lon) {
        successful++;
        results.push(`"${address}",${result.lat},${result.lon},"${result.full_address}"`);
      } else {
        results.push(`"${address}",,,`);
      }

      processed++;

      if (processed % 100 === 0) {
        console.log(`  ✓ ${processed}/${addresses.length} (${successful} successful)`);
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    } catch (error) {
      console.error(`Error geocoding "${address}":`, (error as Error).message);
      results.push(`"${address}",,,`);
      processed++;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, results.join('\n'));

  console.log(`\n✅ Complete: ${successful}/${addresses.length} addresses geocoded`);
  console.log(`📄 Results saved to: ${OUTPUT_FILE}`);
}

main().catch(console.error);
