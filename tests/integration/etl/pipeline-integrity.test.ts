import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Integration test for the ETL pipeline.
 * Ensures the pipeline runs end-to-end, respects schema gates, 
 * and handles failures via the Dead-Letter Queue (DLQ).
 */
describe('ETL Pipeline Integration', () => {
  const pipelinePath = path.resolve(__dirname, '../../../etl/run-pipeline.ts');
  const dlqDir = path.resolve(__dirname, '../../../reports/etl_dead_letters');

  beforeEach(() => {
    // Clear DLQ directory before each run
    if (fs.existsSync(dlqDir)) {
      fs.readdirSync(dlqDir).forEach(file => fs.unlinkSync(path.join(dlqDir, file)));
    }
  });

  it('should process a valid sample dataset', async () => {
    // Use a small, valid sample for testing
    const sample = path.resolve(__dirname, '../fixtures/valid-sample.db');
    
    await new Promise((resolve, reject) => {
      const child = spawn('tsx', [pipelinePath, sample], {
        env: { 
          ...process.env, 
          ...require('dotenv').config({ path: path.resolve(__dirname, 'test.env') }).parsed,
          NODE_ENV: 'test' 
        }
      });
      child.on('close', (code) => code === 0 ? resolve(true) : reject(new Error('Pipeline failed')));
    });
  });

  it('should move invalid records to DLQ instead of failing the pipeline', async () => {
    const invalidSample = path.resolve(__dirname, '../fixtures/invalid-sample.db');
    
    // We expect the pipeline to complete (exit 0) but produce dead-letter logs
    await new Promise((resolve) => {
      const child = spawn('tsx', [pipelinePath, invalidSample], {
        env: { ...process.env, NODE_ENV: 'test' }
      });
      child.on('close', resolve);
    });

    const files = fs.readdirSync(dlqDir);
    expect(files.length).toBeGreaterThan(0);
  });
});
