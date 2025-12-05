const fs = require('fs');
const https = require('https');
require('dotenv').config();

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const INPUT_FILE = process.argv[2] || 'locations_to_reverse_geocode.csv';
const OUTPUT_FILE = process.argv[3] || 'locations_reverse_geocoded.csv';
const CONCURRENT = 20;
const PRECISION = 4; // ~11m accuracy

if (!MAPBOX_TOKEN) {
  console.error('❌ MAPBOX_TOKEN not found in .env');
  process.exit(1);
}

function roundCoord(val) {
  return parseFloat(val).toFixed(PRECISION);
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

  console.log(`📍 Total locations: ${locations.length}`);

  // Deduplicate by rounded coordinates
  const uniqueCoords = new Map();
  locations.forEach(loc => {
    const key = `${roundCoord(loc.lat)},${roundCoord(loc.lon)}`;
    if (!uniqueCoords.has(key)) {
      uniqueCoords.set(key, { lat: loc.lat, lon: loc.lon });
    }
  });

  const unique = Array.from(uniqueCoords.values());
  console.log(`📍 Unique coordinates (${PRECISION} decimals): ${unique.length}`);
  console.log(`📊 Reduction: ${((1 - unique.length / locations.length) * 100).toFixed(1)}%`);

  // Geocode unique coordinates
  const geocodeCache = new Map();
  const startTime = Date.now();

  console.log(`\n🚀 Geocoding ${unique.length} unique locations...`);

  for (let i = 0; i < unique.length; i += CONCURRENT) {
    const batch = unique.slice(i, Math.min(i + CONCURRENT, unique.length));
    const promises = batch.map(loc =>
      reverseGeocode(loc.lat, loc.lon)
        .then(result => {
          const key = `${roundCoord(loc.lat)},${roundCoord(loc.lon)}`;
          geocodeCache.set(key, result.address);
        })
        .catch(() => {
          const key = `${roundCoord(loc.lat)},${roundCoord(loc.lon)}`;
          geocodeCache.set(key, null);
        })
    );

    await Promise.all(promises);

    if ((i + CONCURRENT) % 100 === 0 || i + CONCURRENT >= unique.length) {
      console.log(`  ✓ ${Math.min(i + CONCURRENT, unique.length)}/${unique.length}`);
    }
  }

  // Apply cached results to all locations
  const results = locations.map(loc => {
    const key = `${roundCoord(loc.lat)},${roundCoord(loc.lon)}`;
    return { ...loc, address: geocodeCache.get(key) };
  });

  const outputHeaders = [...headers, 'address'];
  const outputLines = [
    outputHeaders.join(','),
    ...results.map(r => [
      ...headers.map(h => r[h] || ''),
      r.address ? `"${r.address}"` : '',
    ].join(',')),
  ];

  fs.writeFileSync(OUTPUT_FILE, outputLines.join('\n'));

  const success = results.filter(r => r.address !== null).length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ Complete: ${success}/${results.length} reverse geocoded in ${elapsed}s`);
  console.log(`✓ API calls: ${unique.length} (saved ${locations.length - unique.length})`);
  console.log(`✓ Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
