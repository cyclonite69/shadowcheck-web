import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as https from 'https';
import '../loadEnv';

export interface ReverseGeocodeResult {
  address: string | null;
  venue: string | null;
}

export interface LocationData {
  bssid: string;
  lat: number;
  lon: number;
}

const CONCURRENT = 20;
const PRECISION = 4; // ~11m accuracy

export function roundCoord(val: number): string {
  return parseFloat(val.toString()).toFixed(PRECISION);
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  token: string
): Promise<ReverseGeocodeResult> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${token}&limit=1`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.features && json.features.length > 0) {
              const feature = json.features[0];
              resolve({
                address: feature.place_name,
                venue: feature.text,
              });
            } else {
              resolve({ address: null, venue: null });
            }
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

export async function main(): Promise<void> {
  const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
  const INPUT_FILE = process.argv[2] || 'locations_to_reverse_geocode.csv';
  const OUTPUT_FILE = process.argv[3] || 'locations_reverse_geocoded.csv';

  if (!MAPBOX_TOKEN) {
    console.error('❌ MAPBOX_TOKEN not found in .env');
    process.exit(1);
  }

  if (!existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  console.log('📥 Reading locations...');
  const input = readFileSync(INPUT_FILE, 'utf8');
  const lines = input.trim().split('\n');

  const locations: LocationData[] = lines
    .slice(1) // Skip header
    .map((line): LocationData | null => {
      const [bssid, lat, lon] = line.split(',');
      if (!bssid || !lat || !lon) {
        return null;
      }

      return {
        bssid: bssid.replace(/"/g, ''),
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      };
    })
    .filter((item): item is LocationData => item !== null);

  console.log(`🗺️  Reverse geocoding ${locations.length} locations (${CONCURRENT} concurrent)...`);

  const results: string[] = ['bssid,lat,lon,address,venue'];
  let processed = 0;
  let successful = 0;

  // Process in batches
  for (let i = 0; i < locations.length; i += CONCURRENT) {
    const batch = locations.slice(i, Math.min(i + CONCURRENT, locations.length));

    const promises = batch.map(async (location) => {
      try {
        const result = await reverseGeocode(location.lat, location.lon, MAPBOX_TOKEN);

        if (result.address) {
          successful++;
          return `"${location.bssid}",${location.lat},${location.lon},"${result.address}","${result.venue || ''}"`;
        } else {
          return `"${location.bssid}",${location.lat},${location.lon},,`;
        }
      } catch (error) {
        console.error(`Error geocoding ${location.bssid}:`, (error as Error).message);
        return `"${location.bssid}",${location.lat},${location.lon},,`;
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    processed += batch.length;

    console.log(`  ✓ ${processed}/${locations.length} (${successful} successful)`);

    // Rate limiting between batches
    if (i + CONCURRENT < locations.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  writeFileSync(OUTPUT_FILE, results.join('\n'));

  console.log(`\n✅ Complete: ${successful}/${locations.length} locations geocoded`);
  console.log(`📄 Results saved to: ${OUTPUT_FILE}`);
}

if (require.main === module) {
  main().catch(console.error);
}
