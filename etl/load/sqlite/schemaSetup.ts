import { Pool } from 'pg';

export async function ensureDeviceSource(pool: Pool, sourceTag: string): Promise<void> {
  console.log('\n📱 Ensuring device source exists...');

  await pool.query(
    `INSERT INTO app.device_sources (code, label) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
    [sourceTag, `WiGLE Import: ${sourceTag}`]
  );

  console.log(`   Device source '${sourceTag}' ready`);
}

export async function ensureNetworksOrphansTable(pool: Pool): Promise<void> {
  console.log('\n🧱 Ensuring orphan holding table exists...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app.networks_orphans (
      LIKE app.networks INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING CONSTRAINTS
    )
  `);

  await pool.query(`
    ALTER TABLE app.networks_orphans
      ADD COLUMN IF NOT EXISTS moved_at timestamptz NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS move_reason text NOT NULL DEFAULT 'orphan_after_import'
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'networks_orphans_pkey'
          AND conrelid = 'app.networks_orphans'::regclass
      ) THEN
        ALTER TABLE app.networks_orphans
          ADD CONSTRAINT networks_orphans_pkey PRIMARY KEY (bssid);
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_networks_orphans_moved_at
      ON app.networks_orphans (moved_at DESC)
  `);

  await pool.query(`ALTER TABLE app.networks_orphans OWNER TO shadowcheck_admin`);
  await pool.query(`GRANT SELECT ON app.networks_orphans TO shadowcheck_user`);
  await pool.query(`GRANT ALL PRIVILEGES ON app.networks_orphans TO shadowcheck_admin`);

  console.log('   Orphan holding table ready');
}
