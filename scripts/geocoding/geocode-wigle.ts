#!/usr/bin/env tsx
import * as fs from 'fs';
import * as https from 'https';
import '../loadEnv';

interface GeocodeResult {
  lat: number | null;
  lon: number | null;
}

interface AddressRecord {
  address: string;
  mac?: string;
  ssid?: string;
  authmode?: string;
  firstseen?: string;
  channel?: string;
  rssi?: string;
  altitude?: string;
  accuracy?: string;
  type?: string;
  [key: string]: string | undefined;
}

interface MapboxResponse {
  features?: Array<{
    center: [number, number];
  }>;
}

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const INPUT_FILE = process.argv[2] || 'addresses.csv';
const OUTPUT_FILE = process.argv[3] || 'wigle_geocoded.csv';
const DELAY_MS = 200;

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
            const json: MapboxResponse = JSON.parse(data);
            if (json.features && json.features.length > 0) {
              const [lon, lat] = json.features[0].center;
              resolve({ lat, lon });
            } else {
              resolve({ lat: null, lon: null });
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
    console.log('Create a CSV with: address column');
    process.exit(1);
  }

  const input = fs.readFileSync(INPUT_FILE, 'utf8');
  const lines = input.trim().split('\n');
  const headers = lines[0].split(',');

  const addresses: AddressRecord[] = lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = line.split(',');
      const obj: AddressRecord = { address: '' };
      headers.forEach((h, i) => (obj[h.trim()] = values[i]?.trim() || ''));
      return obj;
    });

  if (addresses.length === 0) {
    console.error('❌ No addresses found in CSV');
    process.exit(1);
  }

  console.log(`📍 Geocoding ${addresses.length} addresses to WiGLE format...`);

  const wigleHeaders =
    'MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type';
  const wigleLines = [wigleHeaders];

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    console.log(`[${i + 1}/${addresses.length}] Geocoding: ${addr.address}`);

    try {
      const geo = await geocodeAddress(addr.address);

      // WiGLE format: MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type
      const wigleLine = [
        addr.mac || '00:00:00:00:00:00',
        addr.ssid || addr.address.substring(0, 32),
        addr.authmode || '[OPEN]',
        addr.firstseen || new Date().toISOString().replace('T', ' ').substring(0, 19),
        addr.channel || '6',
        addr.rssi || '-70',
        geo.lat || '0.0',
        geo.lon || '0.0',
        addr.altitude || '0',
        addr.accuracy || '10',
        addr.type || 'WIFI',
      ].join(',');

      wigleLines.push(wigleLine);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    } catch (err) {
      const error = err as Error;
      console.error(`  ✗ Error: ${error.message}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, wigleLines.join('\n'));

  console.log(`\n✓ Complete: ${wigleLines.length - 1} records`);
  console.log(`✓ Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
