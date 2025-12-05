const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function getStats() {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_networks,
      COUNT(trilat_address) as with_address,
      COUNT(venue_name) as with_venue,
      COUNT(venue_category) as with_category,
      COUNT(*) - COUNT(venue_name) as missing_venue,
      ROUND(100.0 * COUNT(venue_name) / NULLIF(COUNT(trilat_address), 0), 1) as enrichment_pct
    FROM app.networks_legacy
    WHERE is_mobile_network = FALSE;
  `);

  const categories = await pool.query(`
    SELECT venue_category, COUNT(*) as count
    FROM app.networks_legacy
    WHERE venue_category IS NOT NULL
    GROUP BY venue_category
    ORDER BY count DESC
    LIMIT 10;
  `);

  const recent = await pool.query(`
    SELECT venue_name, venue_category, trilat_address
    FROM app.networks_legacy
    WHERE venue_name IS NOT NULL
    ORDER BY unified_id DESC
    LIMIT 5;
  `);

  return { stats: result.rows[0], categories: categories.rows, recent: recent.rows };
}

async function monitor() {
  console.clear();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🏢 ShadowCheck Address Enrichment Monitor');
  console.log('═══════════════════════════════════════════════════════════\n');

  const data = await getStats();
  const s = data.stats;

  console.log('📊 Overall Progress:');
  console.log(`  Total Networks:      ${s.total_networks.toLocaleString()}`);
  console.log(`  With Address:        ${s.with_address.toLocaleString()}`);
  console.log(`  With Venue Name:     ${s.with_venue.toLocaleString()} (${s.enrichment_pct}%)`);
  console.log(`  Missing Venue:       ${s.missing_venue.toLocaleString()}`);

  const progress = Math.floor(s.enrichment_pct / 2);
  const bar = '█'.repeat(progress) + '░'.repeat(50 - progress);
  console.log(`\n  Progress: [${bar}] ${s.enrichment_pct}%\n`);

  console.log('📈 Top Venue Categories:');
  data.categories.forEach((cat, i) => {
    console.log(`  ${i + 1}. ${cat.venue_category || 'unknown'}: ${cat.count}`);
  });

  console.log('\n🆕 Recently Enriched:');
  data.recent.forEach((r, i) => {
    const addr = r.trilat_address?.substring(0, 40) || 'N/A';
    console.log(`  ${i + 1}. ${r.venue_name} (${r.venue_category || 'unknown'})`);
    console.log(`     ${addr}...`);
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Last updated: ${new Date().toLocaleTimeString()}`);
  console.log('  Press Ctrl+C to exit');
  console.log('═══════════════════════════════════════════════════════════');
}

async function main() {
  const interval = parseInt(process.argv[2]) || 5000; // Default 5 seconds

  await monitor();
  setInterval(monitor, interval);
}

main().catch(console.error);
