import { Pool } from 'pg';
import { SqliteReader } from './reader';
import { ObservationLoader } from './loader';
import { validateAndEnrich } from './transformer';

export class WiGLEImporter {
  private reader: SqliteReader;
  private loader: ObservationLoader;
  private sourceTag: string;
  private batchSize: number;

  constructor(sqliteFile: string, pool: Pool, sourceTag: string, batchSize: number = 1000) {
    this.reader = new SqliteReader(sqliteFile);
    this.loader = new ObservationLoader(pool);
    this.sourceTag = sourceTag;
    this.batchSize = batchSize;
  }

  async run(latestTimeMs: number): Promise<{ imported: number; failed: number }> {
    const networkCache = await this.reader.loadNetworkCache();
    const rows = await this.reader.fetchNewObservations(latestTimeMs);

    let imported = 0;
    let failed = 0;
    let batch: any[] = [];

    for (const row of rows) {
      const validated = validateAndEnrich(row, networkCache, this.sourceTag);
      if (!validated) {
        failed++;
        continue;
      }
      batch.push(validated);
      if (batch.length >= this.batchSize) {
        imported += await this.loader.insertBatch(batch);
        batch = [];
      }
    }
    if (batch.length > 0) {
      imported += await this.loader.insertBatch(batch);
    }
    return { imported, failed };
  }
}
