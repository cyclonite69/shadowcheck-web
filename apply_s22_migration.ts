import secretsManager from './server/src/services/secretsManager';
import { execSync } from 'child_process';

async function runMigrations() {
  // Force local mode if AWS is unreachable
  process.env.NODE_ENV = 'test';
  process.env.DB_PASSWORD = 'local_dev_nopass'; // dummy since trust is on
  process.env.DB_ADMIN_PASSWORD = 'local_dev_nopass';

  try {
    console.log('Loading secrets (local fallback enabled)...');
    await secretsManager.load();

    const dbHost = process.env.DB_HOST || 'localhost';
    const dbName = process.env.DB_NAME || 'shadowcheck_db';
    const dbUser = 'shadowcheck_admin';

    console.log(`Applying migrations to ${dbName} as ${dbUser} on ${dbHost}...`);

    // Use the migration runner script
    const shellCmd = `MIGRATION_DB_USER=${dbUser} DB_NAME=${dbName} MIGRATIONS_DIR=sql/migrations bash sql/run-migrations.sh`;

    console.log('Executing migration runner...');
    const output = execSync(shellCmd, { encoding: 'utf-8' });
    console.log(output);

    console.log('Updating S22 home location...');
    const homeCmd = `npx tsx scripts/update-home-s22.ts`;
    const homeOutput = execSync(homeCmd, { encoding: 'utf-8' });
    console.log(homeOutput);
  } catch (error) {
    console.error('Operation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runMigrations();
