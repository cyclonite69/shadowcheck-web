#!/usr/bin/env tsx
const limit = parseInt(process.argv[2] || '200', 10);
const precision = parseInt(process.argv[3] || '5', 10);
const perMinute = parseInt(process.argv[4] || '200', 10);
const provider = (process.argv[5] || 'mapbox') as
  | 'mapbox'
  | 'nominatim'
  | 'overpass'
  | 'opencage'
  | 'locationiq';
const mode = (process.argv[6] || 'address-only') as 'address-only' | 'poi-only' | 'both';
const permanent = process.argv.includes('--permanent');

const main = async () => {
  const secretsManager = require('../../server/src/services/secretsManager');
  if (typeof secretsManager.load === 'function') {
    await secretsManager.load();
  }
  const { runGeocodeCacheUpdate } = require('../../server/src/services/geocodingCacheService');
  const result = await runGeocodeCacheUpdate({
    precision,
    limit,
    perMinute,
    provider,
    mode,
    permanent,
  });

  console.log(JSON.stringify(result, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
