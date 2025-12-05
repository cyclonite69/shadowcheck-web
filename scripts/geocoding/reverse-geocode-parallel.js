const fs = require('fs');
const https = require('https');
require('dotenv').config();

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const INPUT_FILE = process.argv[2] || 'locations_to_reverse_geocode.csv';
const OUTPUT_FILE = process.argv[3] || 'locations_reverse_geocoded.csv';
const CONCURRENT = 10;
const PER_MINUTE = 1000;
const MINUTES = 10;

if (!MAPBOX_TOKEN) {
  console.error('❌ MAPBOX_TOKEN not found in .env');
  process.exit(1);
}

async function reverseGeocode(lat, lon) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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
    }).on('error', reject);
  });
}

async function processBatch(locations, startIdx, endIdx) {
  const results = [];
  const promises = [];

  for (let i = startIdx; i < endIdx && i < locations.length; i++) {
    const loc = locations[i];
    const promise = reverseGeocode(loc.lat, loc.lon)
      .then(geo => ({ ...loc, ...geo, index: i }))
      .catch(() => ({ ...loc, address: null, index: i }));

    promises.push(promise);

    if (promises.length >= CONCURRENT) {
      const batch = await Promise.all(promises);
      results.push(...batch);
      promises.length = 0;
    }
  }

  if (promises.length > 0) {
    const batch = await Promise.all(promises);
    results.push(...batch);
  }

  return results.sort((a, b) => a.index - b.index);
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const input = fs.readFileSync(INPUT_FILE, 'utf8');
  const lines = input.trim().split('\n');
  const headers = lines[0].split(',');

  const locations = lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim() || '');
    return obj;
  });

  const total = Math.min(locations.length, PER_MINUTE * MINUTES);
  console.log(`📍 Reverse geocoding ${total} locations (${CONCURRENT} concurrent, ${PER_MINUTE}/min for ${MINUTES} min)...`);

  const allResults = [];
  const startTime = Date.now();

  for (let min = 0; min < MINUTES; min++) {
    const start = min * PER_MINUTE;
    const end = Math.min(start + PER_MINUTE, total);
    if (start >= locations.length) {break;}

    console.log(`\n⏱️  Minute ${min + 1}/${MINUTES} - Processing ${start}-${end}...`);
    const minStart = Date.now();

    const results = await processBatch(locations, start, end);
    allResults.push(...results);

    const elapsed = (Date.now() - minStart) / 1000;
    console.log(`  ✓ ${end} complete in ${elapsed.toFixed(1)}s`);

    const remaining = 60 - elapsed;
    if (remaining > 0 && min < MINUTES - 1) {
      await new Promise(r => setTimeout(r, remaining * 1000));
    }
  }

  const outputHeaders = [...headers, 'address'];
  const outputLines = [
    outputHeaders.join(','),
    ...allResults.map(r => [
      ...headers.map(h => r[h] || ''),
      r.address ? `"${r.address}"` : '',
    ].join(',')),
  ];

  fs.writeFileSync(OUTPUT_FILE, outputLines.join('\n'));

  const success = allResults.filter(r => r.address !== null).length;
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✓ Complete: ${success}/${allResults.length} reverse geocoded in ${elapsed} min`);
  console.log(`✓ Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
