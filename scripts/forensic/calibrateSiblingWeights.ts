import { readFile } from 'node:fs/promises';
import { calibrateSiblingWeights, parseCalibrationCsv } from './siblingWeightCalibration';

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath || inputPath === '--help') {
    console.log(
      'Usage: npx tsx scripts/forensic/calibrateSiblingWeights.ts <manual-label-export.csv>'
    );
    console.log(
      'Reads a CSV export and prints candidate weights; it never writes to the database.'
    );
    return;
  }

  const csv = await readFile(inputPath, 'utf8');
  const result = calibrateSiblingWeights(parseCalibrationCsv(csv));
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'insufficient_labels') {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
