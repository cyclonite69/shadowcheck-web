#!/usr/bin/env node
/**
 * ETL Pipeline Runner
 *
 * Runs the complete ETL pipeline:
 * 1. Load (if source file provided)
 * 2. Transform (normalize, deduplicate)
 * 3. Promote (validate, refresh MVs, scoring)
 *
 * Usage:
 *   node etl/run-pipeline.js                    # Run transform + promote only
 *   node etl/run-pipeline.js /path/to/wigle.db  # Run full pipeline with load
 *   node etl/run-pipeline.js --stage=promote    # Run promote stage only
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface StageScript {
  script: string;
  requiresArg?: boolean;
}

interface StageConfig {
  [key: string]: StageScript[];
}

const STAGES: StageConfig = {
  load: [{ script: 'load/sqlite-import.js', requiresArg: true }],
  transform: [
    { script: 'transform/normalize-observations.ts' },
    { script: 'transform/deduplicate.ts' },
  ],
  promote: [
    { script: 'promote/validate-data.ts' },
    { script: 'promote/refresh-mviews.ts' },
    { script: 'promote/run-scoring.ts' },
  ],
};

/**
 * Execute a script with optional arguments
 */
function runScript(scriptPath: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, scriptPath);
    console.log(`🚀 Running: ${scriptPath}${args.length ? ` ${args.join(' ')}` : ''}`);

    // Use tsx for TypeScript files, node for JavaScript files
    const runner = scriptPath.endsWith('.ts') ? 'tsx' : 'node';
    const child: ChildProcess = spawn(runner, [fullPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Completed: ${scriptPath}\n`);
        resolve();
      } else {
        console.error(`❌ Failed: ${scriptPath} (exit code: ${code})\n`);
        reject(new Error(`Script failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Error running ${scriptPath}:`, error);
      reject(error);
    });
  });
}

/**
 * Run all scripts in a stage
 */
async function runStage(stageName: string, sourceFile?: string): Promise<void> {
  const scripts = STAGES[stageName];
  if (!scripts) {
    throw new Error(`Unknown stage: ${stageName}`);
  }

  console.log(`📋 Starting stage: ${stageName.toUpperCase()}`);

  for (const { script, requiresArg } of scripts) {
    const args: string[] = [];
    if (requiresArg && sourceFile) {
      args.push(sourceFile);
    } else if (requiresArg && !sourceFile) {
      console.log(`⏭️  Skipping ${script} (requires source file argument)`);
      continue;
    }

    await runScript(script, args);
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  let sourceFile: string | undefined;
  let targetStage: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--stage=')) {
      targetStage = arg.split('=')[1];
    } else if (!arg.startsWith('--')) {
      sourceFile = arg;
    }
  }

  try {
    if (targetStage) {
      // Run specific stage only
      await runStage(targetStage, sourceFile);
    } else {
      // Run full pipeline
      const stagesToRun = sourceFile ? ['load', 'transform', 'promote'] : ['transform', 'promote'];

      for (const stage of stagesToRun) {
        await runStage(stage, sourceFile);
      }
    }

    console.log('🎉 ETL Pipeline completed successfully!');
  } catch (error) {
    console.error('💥 ETL Pipeline failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
