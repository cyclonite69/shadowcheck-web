const fs = require('fs');
const https = require('https');
require('dotenv').config();

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const INPUT_FILE = process.argv[2] || 'locations_to_reverse_geocode.csv';
const OUTPUT_FILE = process.argv[3] || 'locations_reverse_geocoded.csv';
const PER_MINUTE = 1000;
const MINUTES = 10;
const DELAY_MS = 60;

if (!MAPBOX_TOKEN) {
  console.error('❌ MAPBOX_TOKEN not found in .env');
  process.exit(1);
}

async function reverseGeocode(lat, lon) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.features && json.features.length > 0) {
              resolve({ address: json.features[0].place_name });
            } else {
              resolve({ address: null });
            }
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const input = fs.readFileSync(INPUT_FILE, 'utf8');
  const lines = input.trim().split('\n');
  const headers = lines[0].split(',');

  const locations = lines.slice(1).map((line) => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => (obj[h.trim()] = values[i]?.trim() || ''));
    return obj;
  });

  const total = Math.min(locations.length, PER_MINUTE * MINUTES);
  console.log(`📍 Reverse geocoding ${total} locations (${PER_MINUTE}/min for ${MINUTES} min)...`);

  const results = [];
  const startTime = Date.now();

  for (let min = 0; min < MINUTES; min++) {
    const start = min * PER_MINUTE;
    const end = Math.min(start + PER_MINUTE, total);
    if (start >= locations.length) {
      break;
    }

    console.log(`\n⏱️  Minute ${min + 1}/${MINUTES} - Processing ${start}-${end}...`);

    for (let i = start; i < end && i < locations.length; i++) {
      const loc = locations[i];

      try {
        const geo = await reverseGeocode(loc.lat, loc.lon);
        results.push({ ...loc, ...geo });
        if ((i + 1) % 100 === 0) {
          console.log(`  ✓ ${i + 1}/${total}`);
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      } catch {
        results.push({ ...loc, address: null });
      }
    }
  }

  const outputHeaders = [...headers, 'address'];
  const outputLines = [
    outputHeaders.join(','),
    ...results.map((r) =>
      [...headers.map((h) => r[h] || ''), r.address ? `"${r.address}"` : ''].join(',')
    ),
  ];

  fs.writeFileSync(OUTPUT_FILE, outputLines.join('\n'));

  const success = results.filter((r) => r.address !== null).length;
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✓ Complete: ${success}/${results.length} reverse geocoded in ${elapsed} min`);
  console.log(`✓ Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
