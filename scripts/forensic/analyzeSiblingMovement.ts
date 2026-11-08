import { readFile } from 'node:fs/promises';
import { analyzeSiblingMovement, parseMovementCsv } from './siblingMovementAnalysis';

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath || inputPath === '--help') {
    console.log(
      'Usage: npx tsx scripts/forensic/analyzeSiblingMovement.ts <sibling-movement-export.csv>'
    );
    console.log(
      'Analyzes paired scanner-observation footprints only; transmitter mobility remains undetermined.'
    );
    return;
  }

  const csv = await readFile(inputPath, 'utf8');
  const summaries = analyzeSiblingMovement(parseMovementCsv(csv));
  console.log(
    JSON.stringify(
      {
        summary_count: summaries.length,
        pairs_without_co_observations: summaries.filter(
          (summary) => summary.interpretation === 'no_co_observations'
        ).length,
        radius_thresholds_meters: [50, 100, 150, 300],
        stationary_like_cutoff_meters: 150,
        transmitter_mobility: 'undetermined',
        summaries,
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
