#!/usr/bin/env tsx
/**
 * Enrich observations geocoding cache.
 *
 * Runs the same backend geocoding-cache workflow used by the Admin UI
 * (`/api/admin/geocoding/run`) so ETL and UI behavior stay aligned.
 */

import '../loadEnv';

type GeocodeProvider = 'mapbox' | 'nominatim' | 'overpass' | 'opencage' | 'locationiq';
type GeocodeMode = 'address-only' | 'poi-only' | 'both';

interface EnrichOptions {
  provider: GeocodeProvider;
  mode: GeocodeMode;
  limit: number;
  precision: number;
  perMinute: number;
  permanent: boolean;
  dryRun: boolean;
}

interface GeocodingStats {
  observation_count: number | string;
  unique_blocks: number | string;
  cached_blocks: number | string;
  cached_with_address: number | string;
  cached_with_poi: number | string;
  distinct_addresses: number | string;
  missing_blocks: number | string;
}

interface GeocodeResult {
  provider: string;
  mode: GeocodeMode;
  processed: number;
  successful: number;
  poiHits: number;
  rateLimited: number;
  durationMs: number;
}

interface GeocodingService {
  runGeocodeCacheUpdate: (options: {
    provider: GeocodeProvider;
    mode: GeocodeMode;
    limit: number;
    precision: number;
    perMinute: number;
    permanent?: boolean;
  }) => Promise<GeocodeResult>;
  getGeocodingCacheStats: (precision: number) => Promise<GeocodingStats>;
}

function parseNumberArg(args: string[], prefix: string, fallback: number): number {
  const raw = args.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.split('=')[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStringArg(args: string[], prefix: string): string | null {
  const raw = args.find((arg) => arg.startsWith(prefix));
  if (!raw) return null;
  const value = raw.slice(prefix.length).trim();
  return value || null;
}

function parseArgs(args: string[]): EnrichOptions {
  const provider = (parseStringArg(args, '--provider=') || 'mapbox') as GeocodeProvider;
  const mode = (parseStringArg(args, '--mode=') || 'address-only') as GeocodeMode;
  const dryRun = args.includes('--dry-run') || !args.includes('--live');

  return {
    provider,
    mode,
    limit: parseNumberArg(args, '--limit=', 1000),
    precision: parseNumberArg(args, '--precision=', 5),
    perMinute: parseNumberArg(args, '--per-minute=', provider === 'mapbox' ? 200 : 60),
    permanent: args.includes('--permanent'),
    dryRun,
  };
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number.parseInt(value, 10) || 0;
}

function printStats(label: string, stats: GeocodingStats): void {
  console.log(`\n${label}`);
  console.log(`  Observations: ${toNumber(stats.observation_count).toLocaleString()}`);
  console.log(`  Unique blocks: ${toNumber(stats.unique_blocks).toLocaleString()}`);
  console.log(`  Cached blocks: ${toNumber(stats.cached_blocks).toLocaleString()}`);
  console.log(`  Cached with address: ${toNumber(stats.cached_with_address).toLocaleString()}`);
  console.log(`  POI hits: ${toNumber(stats.cached_with_poi).toLocaleString()}`);
  console.log(`  Distinct addresses: ${toNumber(stats.distinct_addresses).toLocaleString()}`);
  console.log(`  Missing blocks: ${toNumber(stats.missing_blocks).toLocaleString()}`);
}

async function enrichGeocoding(options: EnrichOptions): Promise<void> {
  const geocodingService =
    require('../../server/src/services/geocodingCacheService') as GeocodingService;
  const { runGeocodeCacheUpdate, getGeocodingCacheStats } = geocodingService;

  if (typeof runGeocodeCacheUpdate !== 'function' || typeof getGeocodingCacheStats !== 'function') {
    throw new Error(
      'Failed to load geocoding cache service. Expected runGeocodeCacheUpdate/getGeocodingCacheStats.'
    );
  }

  console.log('🌍 Geocoding cache ETL');
  console.log(`  Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Provider: ${options.provider}`);
  console.log(`  Pass: ${options.mode}`);
  console.log(`  Limit: ${options.limit}`);
  console.log(`  Precision: ${options.precision}`);
  console.log(`  Rate/min: ${options.perMinute}`);
  if (options.provider === 'mapbox') {
    console.log(`  Permanent: ${options.permanent ? 'true' : 'false'}`);
  }

  const before = await getGeocodingCacheStats(options.precision);
  printStats('Before:', before);

  if (options.dryRun) {
    console.log('\n[DRY RUN] No updates executed. Use --live to run.');
    return;
  }

  const result = await runGeocodeCacheUpdate({
    provider: options.provider,
    mode: options.mode,
    limit: options.limit,
    precision: options.precision,
    perMinute: options.perMinute,
    permanent: options.permanent,
  });

  const after = await getGeocodingCacheStats(options.precision);
  printStats('After:', after);

  console.log('\nRun result:');
  console.log(`  Provider label: ${result.provider}`);
  console.log(`  Processed: ${result.processed.toLocaleString()}`);
  console.log(`  Successful: ${result.successful.toLocaleString()}`);
  console.log(`  POI hits: ${result.poiHits.toLocaleString()}`);
  console.log(`  Rate limited: ${result.rateLimited.toLocaleString()}`);
  console.log(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(
    `  Missing blocks delta: ${(toNumber(before.missing_blocks) - toNumber(after.missing_blocks)).toLocaleString()}`
  );
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));

  enrichGeocoding(options).catch((error) => {
    const err = error as Error;
    console.error(`\n❌ Geocoding cache ETL failed: ${err.message}`);
    process.exit(1);
  });
}

export { enrichGeocoding };
