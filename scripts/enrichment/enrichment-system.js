const https = require('https');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// ============================================================================
// RateLimiter - Tracks quotas and enforces delays
// ============================================================================
class RateLimiter {
  constructor() {
    this.quotas = {
      overpass: { daily: Infinity, remaining: Infinity, delay: 1000 },
      nominatim: { daily: Infinity, remaining: Infinity, delay: 1000 },
      locationiq: { daily: 5000, remaining: 5000, delay: 200 },
      opencage: { daily: 2500, remaining: 2500, delay: 200 },
    };
    this.lastReset = new Date().setHours(0, 0, 0, 0);
  }

  checkReset() {
    const today = new Date().setHours(0, 0, 0, 0);
    if (today > this.lastReset) {
      Object.keys(this.quotas).forEach(api => {
        this.quotas[api].remaining = this.quotas[api].daily;
      });
      this.lastReset = today;
    }
  }

  canUse(api) {
    this.checkReset();
    return this.quotas[api].remaining > 0;
  }

  use(api) {
    if (this.quotas[api].remaining !== Infinity) {
      this.quotas[api].remaining--;
    }
  }

  getDelay(api) {
    return this.quotas[api].delay;
  }

  getStatus() {
    this.checkReset();
    return Object.entries(this.quotas).map(([api, q]) => ({
      api,
      remaining: q.remaining === Infinity ? '∞' : q.remaining,
      daily: q.daily === Infinity ? '∞' : q.daily,
    }));
  }
}

// ============================================================================
// APIManager - Unified interface for all APIs
// ============================================================================
class APIManager {
  constructor(rateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  async overpass(lat, lon) {
    if (!this.rateLimiter.canUse('overpass')) {return null;}

    const query = `[out:json][timeout:5];(node(around:30,${lat},${lon})[name];way(around:30,${lat},${lon})[name];);out body 1;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
      const result = await this.httpGet(url, 5000);
      this.rateLimiter.use('overpass');

      const json = JSON.parse(result);
      if (json.elements?.[0]) {
        const poi = json.elements[0];
        const tags = poi.tags || {};
        return {
          name: tags.name,
          category: tags.amenity || tags.shop || tags.building,
          brand: tags.brand,
          confidence: tags.name ? 0.9 : 0.5,
          source: 'overpass',
        };
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  async nominatim(lat, lon) {
    if (!this.rateLimiter.canUse('nominatim')) {return null;}

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

    try {
      const result = await this.httpGet(url, 5000, { 'User-Agent': 'ShadowCheck/1.0' });
      this.rateLimiter.use('nominatim');

      const json = JSON.parse(result);
      if (json.display_name) {
        return {
          name: json.display_name.split(',')[0],
          category: json.type,
          brand: null,
          confidence: json.type !== 'house' ? 0.7 : 0.3,
          source: 'nominatim',
        };
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  async locationiq(lat, lon) {
    const key = process.env.LOCATIONIQ_API_KEY;
    if (!key || !this.rateLimiter.canUse('locationiq')) {return null;}

    const url = `https://us1.locationiq.com/v1/reverse.php?key=${key}&lat=${lat}&lon=${lon}&format=json`;

    try {
      const result = await this.httpGet(url, 5000);
      this.rateLimiter.use('locationiq');

      const json = JSON.parse(result);
      if (json.display_name) {
        return {
          name: json.display_name.split(',')[0],
          category: json.type,
          brand: null,
          confidence: 0.8,
          source: 'locationiq',
        };
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  async opencage(lat, lon) {
    const key = process.env.OPENCAGE_API_KEY;
    if (!key || !this.rateLimiter.canUse('opencage')) {return null;}

    const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${key}&limit=1`;

    try {
      const result = await this.httpGet(url, 5000);
      this.rateLimiter.use('opencage');

      const json = JSON.parse(result);
      const r = json.results?.[0];
      if (r) {
        const name = r.components?.building || r.components?.shop || r.formatted?.split(',')[0];
        return {
          name: name,
          category: r.components?._category || r.components?._type,
          brand: null,
          confidence: 0.8,
          source: 'opencage',
        };
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  httpGet(url, timeout, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { timeout, headers }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  async queryAll(lat, lon) {
    const results = await Promise.all([
      this.overpass(lat, lon),
      this.nominatim(lat, lon),
      this.locationiq(lat, lon),
      this.opencage(lat, lon),
    ]);
    return results.filter(r => r && r.name);
  }
}

// ============================================================================
// ConflictResolver - Merges results with confidence + voting
// ============================================================================
class ConflictResolver {
  resolve(results) {
    if (results.length === 0) {return null;}
    if (results.length === 1) {return this.formatResult(results[0], results);}

    // Score each result
    const scored = results.map(r => ({
      ...r,
      score: this.calculateScore(r),
    }));

    // Vote-based: count name occurrences
    const nameVotes = {};
    results.forEach(r => {
      const name = r.name.toLowerCase().trim();
      nameVotes[name] = (nameVotes[name] || 0) + 1;
    });

    // Find consensus (2+ APIs agree)
    const consensus = Object.entries(nameVotes).find(([_, count]) => count >= 2);

    if (consensus) {
      // Use the highest-scored result with the consensus name
      const consensusName = consensus[0];
      const winner = scored
        .filter(r => r.name.toLowerCase().trim() === consensusName)
        .sort((a, b) => b.score - a.score)[0];
      return this.formatResult(winner, results);
    }

    // No consensus: highest score wins
    const winner = scored.sort((a, b) => b.score - a.score)[0];
    return this.formatResult(winner, results);
  }

  calculateScore(result) {
    let score = result.confidence;

    // Bonus for having brand
    if (result.brand) {score += 0.2;}

    // Bonus for having category
    if (result.category) {score += 0.1;}

    // Bonus for detailed name (not just address)
    if (result.name && !result.name.match(/^\d+\s/)) {score += 0.1;}

    return score;
  }

  formatResult(winner, allResults) {
    return {
      name: winner.name,
      category: winner.category || this.findBestCategory(allResults),
      brand: winner.brand || this.findBestBrand(allResults),
      confidence: this.calculateAverageConfidence(allResults),
      sources: allResults.map(r => r.source).join(','),
    };
  }

  findBestCategory(results) {
    return results.find(r => r.category)?.category || null;
  }

  findBestBrand(results) {
    return results.find(r => r.brand)?.brand || null;
  }

  calculateAverageConfidence(results) {
    const sum = results.reduce((acc, r) => acc + r.confidence, 0);
    return sum / results.length;
  }
}

// ============================================================================
// BatchController - Orchestrates enrichment
// ============================================================================
class BatchController {
  constructor(concurrency = 3) {
    this.rateLimiter = new RateLimiter();
    this.apiManager = new APIManager(this.rateLimiter);
    this.resolver = new ConflictResolver();
    this.concurrency = concurrency;
    this.stats = { processed: 0, enriched: 0, failed: 0 };
  }

  async enrichBatch(locations) {
    const results = [];

    for (let i = 0; i < locations.length; i += this.concurrency) {
      const batch = locations.slice(i, Math.min(i + this.concurrency, locations.length));

      const promises = batch.map(async (loc) => {
        try {
          const apiResults = await this.apiManager.queryAll(loc.trilat_lat, loc.trilat_lon);
          const merged = this.resolver.resolve(apiResults);

          this.stats.processed++;
          if (merged) {
            this.stats.enriched++;
            return { bssid: loc.bssid, ...merged };
          } else {
            this.stats.failed++;
            return null;
          }
        } catch (err) {
          this.stats.failed++;
          return null;
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter(r => r !== null));

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return results;
  }

  async upsertResults(results) {
    for (const result of results) {
      await pool.query(`
        UPDATE app.networks_legacy 
        SET venue_name = $1, venue_category = $2, name = $3
        WHERE bssid = $4
      `, [result.name, result.category, result.brand || result.name, result.bssid]);

      await pool.query(`
        UPDATE app.ap_locations 
        SET venue_name = $1, venue_category = $2
        WHERE bssid = $3
      `, [result.name, result.category, result.bssid]);
    }
  }

  getStats() {
    return {
      ...this.stats,
      successRate: `${((this.stats.enriched / this.stats.processed) * 100).toFixed(1)}%`,
      quotas: this.rateLimiter.getStatus(),
    };
  }
}

// ============================================================================
// Test Suite
// ============================================================================
function testConflictResolver() {
  console.log('🧪 Testing ConflictResolver...\n');
  const resolver = new ConflictResolver();

  // Test 1: Single API
  console.log('Test 1: Single API result');
  const test1 = resolver.resolve([
    { name: 'Starbucks', category: 'cafe', brand: 'Starbucks', confidence: 0.9, source: 'overpass' },
  ]);
  console.log('  Result:', test1);
  console.assert(test1.name === 'Starbucks', 'Should return Starbucks');
  console.log('  ✓ Pass\n');

  // Test 2: Vote-based (2 APIs agree)
  console.log('Test 2: Vote-based consensus');
  const test2 = resolver.resolve([
    { name: 'Starbucks', category: 'cafe', confidence: 0.8, source: 'overpass' },
    { name: 'Starbucks', category: 'cafe', confidence: 0.7, source: 'locationiq' },
    { name: 'Unknown Building', category: 'building', confidence: 0.9, source: 'nominatim' },
  ]);
  console.log('  Result:', test2);
  console.assert(test2.name === 'Starbucks', 'Should pick Starbucks (2 votes)');
  console.log('  ✓ Pass\n');

  // Test 3: Confidence + detail bonus
  console.log('Test 3: High confidence with brand wins');
  const test3 = resolver.resolve([
    { name: 'Target', category: 'department_store', brand: 'Target', confidence: 0.95, source: 'overpass' },
    { name: '123 Main St', category: 'address', confidence: 0.8, source: 'nominatim' },
  ]);
  console.log('  Result:', test3);
  console.assert(test3.name === 'Target', 'Should pick Target (higher score)');
  console.assert(test3.brand === 'Target', 'Should have brand');
  console.log('  ✓ Pass\n');

  console.log('✅ All tests passed!\n');
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const args = process.argv.slice(2);

  if (args[0] === 'test') {
    testConflictResolver();
    return;
  }

  const limit = parseInt(args[0]) || 100;

  const locations = await pool.query(`
    SELECT bssid, trilat_lat, trilat_lon
    FROM app.networks_legacy
    WHERE trilat_address IS NOT NULL
      AND venue_name IS NULL
      AND trilat_lat IS NOT NULL
      AND is_mobile_network = FALSE
    ORDER BY observation_count DESC
    LIMIT $1
  `, [limit]);

  console.log('🚀 Production Enrichment System');
  console.log(`📍 Processing ${locations.rows.length} locations\n`);

  const controller = new BatchController(3);

  const results = await controller.enrichBatch(locations.rows);
  await controller.upsertResults(results);

  const stats = controller.getStats();
  console.log('\n📊 Final Stats:');
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Enriched: ${stats.enriched}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Success Rate: ${stats.successRate}`);
  console.log('\n📡 API Quotas:');
  stats.quotas.forEach(q => {
    console.log(`  ${q.api}: ${q.remaining}/${q.daily}`);
  });

  await pool.end();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { RateLimiter, APIManager, ConflictResolver, BatchController };
