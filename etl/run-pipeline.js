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

const { spawn } = require('child_process');
const path = require('path');

const STAGES = {
  load: [{ script: 'load/sqlite-import.js', requiresArg: true }],
  transform: [
    { script: 'transform/normalize-observations.js' },
    { script: 'transform/deduplicate.js' },
  ],
  promote: [
    { script: 'promote/validate-data.js' },
    { script: 'promote/refresh-mviews.js' },
    { script: 'promote/run-scoring.js' },
  ],
};

function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, scriptPath);
    const proc = spawn('node', [fullPath, ...args], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function runStage(stageName, args = []) {
  const stage = STAGES[stageName];
  if (!stage) {
    throw new Error(`Unknown stage: ${stageName}`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  STAGE: ${stageName.toUpperCase()}`);
  console.log(`${'═'.repeat(60)}\n`);

  for (const step of stage) {
    if (step.requiresArg && args.length === 0) {
      console.log(`  ⏭️  Skipping ${step.script} (requires argument)`);
      continue;
    }

    console.log(`\n▶ Running ${step.script}...\n`);
    await runScript(step.script, step.requiresArg ? args : []);
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let sourceFile = null;
  let stageOnly = null;

  for (const arg of args) {
    if (arg.startsWith('--stage=')) {
      stageOnly = arg.split('=')[1];
    } else if (!arg.startsWith('--')) {
      sourceFile = arg;
    }
  }

  console.log('━'.repeat(60));
  console.log('  ETL PIPELINE');
  console.log('━'.repeat(60));
  console.log(`  Source: ${sourceFile || '(none - skip load stage)'}`);
  console.log(`  Stage:  ${stageOnly || 'all'}`);
  console.log('━'.repeat(60));

  const startTime = Date.now();

  try {
    if (stageOnly) {
      // Run single stage
      await runStage(stageOnly, sourceFile ? [sourceFile] : []);
    } else {
      // Run all stages
      if (sourceFile) {
        await runStage('load', [sourceFile]);
      }
      await runStage('transform');
      await runStage('promote');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${'═'.repeat(60)}`);
    console.log('  ✅ PIPELINE COMPLETE');
    console.log(`  Duration: ${duration}s`);
    console.log(`${'═'.repeat(60)}\n`);
  } catch (error) {
    console.error(`\n❌ PIPELINE FAILED: ${error.message}`);
    process.exit(1);
  }
}

main();
