import { Pool } from 'pg';
import { SqliteReader } from './reader';
import { ObservationLoader } from './loader';
import { validateAndEnrich } from './transformer';
import { SqliteNetworkRow } from './types';

// Configuration interface
export interface ImportConfig {
  BATCH_SIZE: number;
  DEBUG: boolean;
}

export class WiGLEImporter {
  private sqliteFile: string;
  private sourceTag: string;
  private pool: Pool;
  private config: ImportConfig;

  private imported = 0;
  private failed = 0;
  private errors: string[] = [];

  constructor(sqliteFile: string, sourceTag: string, pool: Pool, config: ImportConfig) {
    this.sqliteFile = sqliteFile;
    this.sourceTag = sourceTag;
    this.pool = pool;
    this.config = config;
  }

  async start(
    latestTimeMs: number
  ): Promise<{ imported: number; failed: number; errors: string[] }> {
    const reader = new SqliteReader(this.sqliteFile);
    const loader = new ObservationLoader(this.pool);

    console.log('\n📡 Loading network metadata...');
    const networkCache = await reader.loadNetworkCache();

    console.log('\n⚡ Importing new observations...');
    const rows = await reader.fetchNewObservations(latestTimeMs);

    console.log(`   Fetched ${rows.length.toLocaleString()} records from SQLite`);

    const startTime = Date.now();
    let batch: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const validated = validateAndEnrich(row, networkCache, this.sourceTag);

      if (!validated) {
        this.failed++;
        continue;
      }

      batch.push(validated);

      if (batch.length >= this.config.BATCH_SIZE) {
        this.imported += await loader.insertBatch(batch);
        batch = [];
        this.printProgress(i, rows.length, startTime);
      }
    }

    if (batch.length > 0) {
      this.imported += await loader.insertBatch(batch);
    }

    console.log('');
    return { imported: this.imported, failed: this.failed, errors: this.errors };
  }

  private printProgress(current: number, total: number, startTime: number) {
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = elapsed > 0 ? Math.round(this.imported / elapsed) : 0;
    const percent = Math.round(((current + 1) / total) * 100);
    process.stdout.write(
      `\r   Progress: ${this.imported.toLocaleString()}/${total.toLocaleString()} (${percent}%) | ${speed.toLocaleString()} rec/s`
    );
  }
}
