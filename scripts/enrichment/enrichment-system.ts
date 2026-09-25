import axios from 'axios';
import * as pg from 'pg';

// ============================================================================
// TYPES
// ============================================================================

interface EnrichedLocation {
  name: string;
  category: string;
  brand?: string;
  confidence: number;
  source: string;
}

interface APIResponse {
  name?: string;
  category?: string;
  brand?: string;
  confidence: number;
}

interface APIConfig {
  name: string;
  dailyLimit: number;
  rateLimit: number; // ms between requests
  timeout: number; // ms
  enabled: boolean;
}

interface EnrichmentResult {
  network_id: string;
  venue_name: string | null;
  venue_category: string | null;
  venue_brand: string | null;
  enrichment_confidence: number;
  enrichment_sources: string;
  enrichment_timestamp: Date;
}

interface QuotaState {
  [apiName: string]: { used: number; limit: number; resetTime: Date };
}

interface LocationRecord {
  bssid: string;
  trilat_lat: number;
  trilat_lon: number;
}

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private quotas: QuotaState = {};
  private lastRequestTime: Map<string, number> = new Map();
  private configs: Map<string, APIConfig>;

  constructor(configs: APIConfig[]) {
    this.configs = new Map(configs.map((c) => [c.name, c]));
    configs.forEach((c) => {
      this.quotas[c.name] = {
        used: 0,
        limit: c.dailyLimit,
        resetTime: this.getNextMidnight(),
      };
    });
  }

  private getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private resetQuotaIfNeeded(apiName: string): void {
    const quota = this.quotas[apiName];
    if (new Date() >= quota.resetTime) {
      quota.used = 0;
      quota.resetTime = this.getNextMidnight();
    }
  }

  async waitForSlot(apiName: string): Promise<void> {
    this.resetQuotaIfNeeded(apiName);
    const quota = this.quotas[apiName];
    const config = this.configs.get(apiName);

    if (!config) {
      throw new Error(`Unknown API: ${apiName}`);
    }
    if (quota.used >= quota.limit) {
      throw new Error(`${apiName} quota exceeded (${quota.used}/${quota.limit})`);
    }

    // Rate limiting: respect per-request delay
    const lastTime = this.lastRequestTime.get(apiName) || 0;
    const timeSinceLastRequest = Date.now() - lastTime;
    if (timeSinceLastRequest < config.rateLimit) {
      await new Promise((resolve) => setTimeout(resolve, config.rateLimit - timeSinceLastRequest));
    }

    this.lastRequestTime.set(apiName, Date.now());
    quota.used++;
  }

  getQuotaStatus(): Record<string, { used: number; remaining: number; resetTime: string }> {
    return Object.entries(this.quotas).reduce(
      (acc, [api, quota]) => {
        acc[api] = {
          used: quota.used,
          remaining: quota.limit - quota.used,
          resetTime: quota.resetTime.toISOString(),
        };
        return acc;
      },
      {} as Record<string, { used: number; remaining: number; resetTime: string }>
    );
  }
}

// ============================================================================
// API MANAGER
// ============================================================================

class APIManager {
  private rateLimiter: RateLimiter;
  private configs: Map<string, APIConfig>;
  private apiKeys: { locationiq?: string; opencage?: string; here?: string };

  constructor(
    configs: APIConfig[],
    apiKeys: { locationiq?: string; opencage?: string; here?: string }
  ) {
    this.rateLimiter = new RateLimiter(configs);
    this.configs = new Map(configs.map((c) => [c.name, c]));
    this.apiKeys = apiKeys;
  }

  async enrichFromOverpass(lat: number, lon: number): Promise<APIResponse | null> {
    await this.rateLimiter.waitForSlot('Overpass');
    try {
      const query = `[out:json][timeout:5];(node(around:30,${lat},${lon})[name];way(around:30,${lat},${lon})[name];);out body 1;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const res = await axios.get(url, { timeout: 5000 });

      if (res.data.elements?.length > 0) {
        const elem = res.data.elements[0];
        const tags = elem.tags || {};
        return {
          name: tags.name,
          category: tags.amenity || tags.shop || tags.building,
          brand: tags.brand,
          confidence: tags.name ? 0.9 : 0.5,
        };
      }
    } catch (_err) {
      return null;
    }
    return null;
  }

  async enrichFromNominatim(lat: number, lon: number): Promise<APIResponse | null> {
    await this.rateLimiter.waitForSlot('Nominatim');
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
      const res = await axios.get(url, {
        timeout: 5000,
        headers: { 'User-Agent': 'ShadowCheck/1.0' },
      });

      if (res.data.display_name) {
        return {
          name: res.data.display_name.split(',')[0],
          category: res.data.type,
          confidence: res.data.type !== 'house' ? 0.7 : 0.3,
        };
      }
    } catch (_err) {
      return null;
    }
    return null;
  }

  async enrichFromLocationIQ(lat: number, lon: number): Promise<APIResponse | null> {
    if (!this.apiKeys.locationiq) {
      return null;
    }
    await this.rateLimiter.waitForSlot('LocationIQ');
    try {
      const url = `https://us1.locationiq.com/v1/reverse.php?key=${this.apiKeys.locationiq}&lat=${lat}&lon=${lon}&format=json`;
      const res = await axios.get(url, { timeout: 5000 });

      if (res.data.display_name) {
        return {
          name: res.data.display_name.split(',')[0],
          category: res.data.type,
          confidence: 0.8,
        };
      }
    } catch (_err) {
      return null;
    }
    return null;
  }

  async enrichFromOpenCage(lat: number, lon: number): Promise<APIResponse | null> {
    if (!this.apiKeys.opencage) {
      return null;
    }
    await this.rateLimiter.waitForSlot('OpenCage');
    try {
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${this.apiKeys.opencage}&limit=1`;
      const res = await axios.get(url, { timeout: 5000 });

      const result = res.data.results?.[0];
      if (result) {
        const name =
          result.components?.building || result.components?.shop || result.formatted?.split(',')[0];
        return {
          name: name,
          category: result.components?._category || result.components?._type,
          confidence: 0.8,
        };
      }
    } catch (_err) {
      return null;
    }
    return null;
  }

  async enrichFromHERE(lat: number, lon: number, apiKey: string): Promise<APIResponse | null> {
    if (!apiKey) {
      return null;
    }
    await this.rateLimiter.waitForSlot('HERE');
    try {
      const url = `https://revgeocode.search.hereapi.com/v1/revgeocode?at=${lat},${lon}&apiKey=${apiKey}&limit=1`;
      const res = await axios.get(url, { timeout: 5000 });

      const item = res.data.items?.[0];
      if (item) {
        return {
          name: item.title || item.address?.label?.split(',')[0],
          category: item.resultType,
          brand: item.categories?.[0]?.name,
          confidence: 0.85,
        };
      }
    } catch (_err) {
      return null;
    }
    return null;
  }

  async enrichLocation(lat: number, lon: number): Promise<EnrichedLocation[]> {
    const results = await Promise.all([
      this.enrichFromOverpass(lat, lon),
      this.enrichFromNominatim(lat, lon),
      this.enrichFromLocationIQ(lat, lon),
      this.enrichFromOpenCage(lat, lon),
      this.apiKeys.here ? this.enrichFromHERE(lat, lon, this.apiKeys.here) : null,
    ]);

    const sources = ['Overpass', 'Nominatim', 'LocationIQ', 'OpenCage', 'HERE'];
    return results
      .map((r, i) => (r ? ({ ...r, source: sources[i] } as EnrichedLocation) : null))
      .filter((r): r is EnrichedLocation => r !== null && Boolean(r.name));
  }

  getQuotaStatus() {
    return this.rateLimiter.getQuotaStatus();
  }
}

// ============================================================================
// CONFLICT RESOLVER
// ============================================================================

class ConflictResolver {
  resolve(results: EnrichedLocation[]): EnrichmentResult | null {
    if (results.length === 0) {
      return null;
    }
    if (results.length === 1) {
      return this.formatResult(results[0], results);
    }

    // Score each result
    const scored = results.map((r) => ({
      ...r,
      score: this.calculateScore(r),
    }));

    // Vote-based: count name occurrences
    const nameVotes = new Map<string, number>();
    results.forEach((r) => {
      const name = r.name.toLowerCase().trim();
      nameVotes.set(name, (nameVotes.get(name) || 0) + 1);
    });

    // Find consensus (2+ APIs agree)
    const consensus = Array.from(nameVotes.entries()).find(([_, count]) => count >= 2);

    if (consensus) {
      const consensusName = consensus[0];
      const winner = scored
        .filter((r) => r.name.toLowerCase().trim() === consensusName)
        .sort((a, b) => b.score - a.score)[0];
      return this.formatResult(winner, results);
    }

    // No consensus: highest score wins
    const winner = scored.sort((a, b) => b.score - a.score)[0];
    return this.formatResult(winner, results);
  }

  private calculateScore(result: EnrichedLocation): number {
    let score = result.confidence;
    if (result.brand) {
      score += 0.2;
    }
    if (result.category) {
      score += 0.1;
    }
    if (result.name && !result.name.match(/^\d+\s/)) {
      score += 0.1;
    }
    return score;
  }

  private formatResult(winner: EnrichedLocation, allResults: EnrichedLocation[]): EnrichmentResult {
    return {
      network_id: '', // Set by caller
      venue_name: winner.name,
      venue_category: winner.category || this.findBestCategory(allResults),
      venue_brand: winner.brand || this.findBestBrand(allResults),
      enrichment_confidence: this.calculateAverageConfidence(allResults),
      enrichment_sources: allResults.map((r) => r.source).join(','),
      enrichment_timestamp: new Date(),
    };
  }

  private findBestCategory(results: EnrichedLocation[]): string | null {
    return results.find((r) => r.category)?.category || null;
  }

  private findBestBrand(results: EnrichedLocation[]): string | null {
    return results.find((r) => r.brand)?.brand || null;
  }

  private calculateAverageConfidence(results: EnrichedLocation[]): number {
    const sum = results.reduce((acc, r) => acc + r.confidence, 0);
    return sum / results.length;
  }
}

// ============================================================================
// BATCH CONTROLLER
// ============================================================================

class BatchController {
  private apiManager: APIManager;
  private resolver: ConflictResolver;
  private pool: pg.Pool;
  private concurrency: number;
  private stats = { processed: 0, enriched: 0, failed: 0 };

  constructor(
    pool: pg.Pool,
    apiConfigs: APIConfig[],
    apiKeys: { locationiq?: string; opencage?: string; here?: string },
    concurrency = 3
  ) {
    this.pool = pool;
    this.apiManager = new APIManager(apiConfigs, apiKeys);
    this.resolver = new ConflictResolver();
    this.concurrency = concurrency;
  }

  async enrichBatch(locations: LocationRecord[]): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = [];

    for (let i = 0; i < locations.length; i += this.concurrency) {
      const batch = locations.slice(i, Math.min(i + this.concurrency, locations.length));

      const promises = batch.map(async (loc) => {
        try {
          const apiResults = await this.apiManager.enrichLocation(loc.trilat_lat, loc.trilat_lon);
          const merged = this.resolver.resolve(apiResults);

          this.stats.processed++;
          if (merged) {
            this.stats.enriched++;
            return { ...merged, network_id: loc.bssid };
          } else {
            this.stats.failed++;
            return null;
          }
        } catch (_err) {
          this.stats.failed++;
          return null;
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter((r): r is EnrichmentResult => r !== null));

      // Rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Progress update
      if ((i + this.concurrency) % 50 === 0) {
        console.log(
          `  ✓ ${Math.min(i + this.concurrency, locations.length)}/${locations.length} (${this.stats.enriched} enriched)`
        );
      }
    }

    return results;
  }

  async upsertResults(results: EnrichmentResult[]): Promise<void> {
    for (const result of results) {
      await this.pool.query(
        `
        UPDATE app.networks_legacy 
        SET venue_name = $1, venue_category = $2, name = $3
        WHERE bssid = $4
      `,
        [
          result.venue_name,
          result.venue_category,
          result.venue_brand || result.venue_name,
          result.network_id,
        ]
      );

      await this.pool.query(
        `
        UPDATE app.ap_locations 
        SET venue_name = $1, venue_category = $2
        WHERE bssid = $3
      `,
        [result.venue_name, result.venue_category, result.network_id]
      );
    }
  }

  getStats() {
    return {
      ...this.stats,
      successRate: `${((this.stats.enriched / this.stats.processed) * 100).toFixed(1)}%`,
      quotas: this.apiManager.getQuotaStatus(),
    };
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
  });

  const apiConfigs: APIConfig[] = [
    { name: 'Overpass', dailyLimit: Infinity, rateLimit: 1000, timeout: 5000, enabled: true },
    { name: 'Nominatim', dailyLimit: Infinity, rateLimit: 1000, timeout: 5000, enabled: true },
    {
      name: 'LocationIQ',
      dailyLimit: 5000,
      rateLimit: 200,
      timeout: 5000,
      enabled: Boolean(process.env.LOCATIONIQ_API_KEY),
    },
    {
      name: 'OpenCage',
      dailyLimit: 2500,
      rateLimit: 200,
      timeout: 5000,
      enabled: Boolean(process.env.OPENCAGE_API_KEY),
    },
    {
      name: 'HERE',
      dailyLimit: 250000,
      rateLimit: 100,
      timeout: 5000,
      enabled: Boolean(process.env.HERE_API_KEY),
    },
  ];

  const apiKeys = {
    locationiq: process.env.LOCATIONIQ_API_KEY,
    opencage: process.env.OPENCAGE_API_KEY,
    here: process.env.HERE_API_KEY,
  };

  const limit = parseInt(process.argv[2]) || 100;

  const result = await pool.query<LocationRecord>(
    `
    SELECT bssid, trilat_lat, trilat_lon
    FROM app.networks_legacy
    WHERE trilat_address IS NOT NULL
      AND venue_name IS NULL
      AND trilat_lat IS NOT NULL
      AND is_mobile_network = FALSE
    ORDER BY observation_count DESC
    LIMIT $1
  `,
    [limit]
  );

  console.log('🚀 TypeScript Production Enrichment System');
  console.log(`📍 Processing ${result.rows.length} locations\n`);

  const controller = new BatchController(pool, apiConfigs, apiKeys, 3);

  const enriched = await controller.enrichBatch(result.rows);
  await controller.upsertResults(enriched);

  const stats = controller.getStats();
  console.log('\n📊 Final Stats:');
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Enriched: ${stats.enriched}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Success Rate: ${stats.successRate}`);
  console.log('\n📡 API Quotas:');
  Object.entries(stats.quotas).forEach(([api, quota]) => {
    console.log(`  ${api}: ${quota.remaining}/${quota.used + quota.remaining}`);
  });

  await pool.end();
}

if (require.main === module) {
  main().catch(console.error);
}

export { RateLimiter, APIManager, ConflictResolver, BatchController };
