const fs = require('fs');
const https = require('https');
require('dotenv').config();

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const INPUT_FILE = process.argv[2] || 'addresses.csv';
const OUTPUT_FILE = process.argv[3] || 'addresses_geocoded.csv';
const BATCH_SIZE = 50; // Mapbox recommends batching
const DELAY_MS = 200; // Rate limiting

if (!MAPBOX_TOKEN) {
  console.error('❌ MAPBOX_TOKEN not found in .env');
  process.exit(1);
}

async function geocodeAddress(address) {
  const encoded = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&permanent=true&limit=1`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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
    }).on('error', reject);
  });
}

async function processBatch(addresses) {
  const results = [];
  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    console.log(`[${i + 1}/${addresses.length}] Geocoding: ${addr.address}`);

    try {
      const geo = await geocodeAddress(addr.address);
      results.push({ ...addr, ...geo });
      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      results.push({ ...addr, lat: null, lon: null, full_address: null });
    }
  }
  return results;
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const input = fs.readFileSync(INPUT_FILE, 'utf8');
  const lines = input.trim().split('\n');
  const headers = lines[0].split(',');

  const addresses = lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim() || '');
    return obj;
  });

  console.log(`📍 Geocoding ${addresses.length} addresses...`);

  const results = await processBatch(addresses);

  const outputHeaders = [...headers, 'latitude', 'longitude', 'geocoded_address'];
  const outputLines = [
    outputHeaders.join(','),
    ...results.map(r => [
      ...headers.map(h => r[h] || ''),
      r.lat || '',
      r.lon || '',
      r.full_address ? `"${r.full_address}"` : '',
    ].join(',')),
  ];

  fs.writeFileSync(OUTPUT_FILE, outputLines.join('\n'));

  const success = results.filter(r => r.lat !== null).length;
  console.log(`\n✓ Complete: ${success}/${addresses.length} geocoded`);
  console.log(`✓ Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
