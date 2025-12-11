const fs = require('fs');
const https = require('https');
require('dotenv').config();

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

async function geocodeAddress(address) {
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

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const input = fs.readFileSync(INPUT_FILE, 'utf8');
  const lines = input.trim().split('\n');
  const headers = lines[0].split(',');

  const addresses = lines.slice(1).map((line) => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => (obj[h.trim()] = values[i]?.trim() || ''));
    return obj;
  });

  const total = Math.min(addresses.length, PER_MINUTE * MINUTES);
  console.log(`📍 Geocoding ${total} addresses (${PER_MINUTE}/min for ${MINUTES} min)...`);

  const results = [];
  const startTime = Date.now();

  for (let min = 0; min < MINUTES; min++) {
    const start = min * PER_MINUTE;
    const end = Math.min(start + PER_MINUTE, total);
    if (start >= addresses.length) {
      break;
    }

    console.log(`\n⏱️  Minute ${min + 1}/${MINUTES} - Processing ${start}-${end}...`);

    for (let i = start; i < end && i < addresses.length; i++) {
      const addr = addresses[i];

      try {
        const geo = await geocodeAddress(addr.address);
        results.push({ ...addr, ...geo });
        if ((i + 1) % 100 === 0) {
          console.log(`  ✓ ${i + 1}/${total}`);
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      } catch (err) {
        results.push({ ...addr, lat: null, lon: null, full_address: null });
      }
    }
  }

  const outputHeaders = [...headers, 'latitude', 'longitude', 'geocoded_address'];
  const outputLines = [
    outputHeaders.join(','),
    ...results.map((r) =>
      [
        ...headers.map((h) => r[h] || ''),
        r.lat || '',
        r.lon || '',
        r.full_address ? `"${r.full_address}"` : '',
      ].join(',')
    ),
  ];

  fs.writeFileSync(OUTPUT_FILE, outputLines.join('\n'));

  const success = results.filter((r) => r.lat !== null).length;
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✓ Complete: ${success}/${results.length} geocoded in ${elapsed} min`);
  console.log(`✓ Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
