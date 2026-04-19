import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Log failed enrichment records to the dead-letter queue.
 */
export async function logDeadLetter(record: any, error: string): Promise<void> {
  const logDir = path.join(process.cwd(), 'reports', 'etl_dead_letters');
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `failure-${timestamp}-${Date.now()}.json`;
  const filePath = path.join(logDir, filename);

  const entry = {
    timestamp,
    error,
    record,
  };

  try {
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
  } catch (err) {
    console.error(`Failed to write dead-letter log: ${(err as Error).message}`);
  }
}
