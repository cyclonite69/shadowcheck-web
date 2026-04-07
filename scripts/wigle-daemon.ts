import 'dotenv/config';
import {
  getImportCompletenessReport,
  resumeImportRun,
  startImportRun,
} from '../server/src/services/wigleImportRunService';
import * as logger from '../server/src/logging/logger';

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
];

const SLEEP_BETWEEN_STATES_MS = 10000; // 10 seconds between states to be safe

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runDaemon(searchTerm: string) {
  logger.info(`🚀 Starting WiGLE Procurement Daemon for: "${searchTerm}"`);

  while (true) {
    try {
      // 1. Audit current progress across all states
      const report = await getImportCompletenessReport({ searchTerm });

      // 2. Find states that are not completed
      const incompleteStates = report.states.filter((s: any) => s.status !== 'completed');

      if (incompleteStates.length === 0) {
        logger.info('✅ All states completed for this search term. Daemon exiting.');
        break;
      }

      logger.info(`📊 Found ${incompleteStates.length} incomplete states. Starting processing...`);

      for (const stateInfo of incompleteStates) {
        const stateCode = stateInfo.state;

        try {
          if (stateInfo.resumable && stateInfo.runId) {
            logger.info(`🔄 Resuming run ${stateInfo.runId} for state ${stateCode}...`);
            await resumeImportRun(stateInfo.runId);
          } else {
            logger.info(`🆕 Starting new run for state ${stateCode}...`);
            await startImportRun({
              ssid: searchTerm,
              region: stateCode,
              resultsPerPage: 100,
            });
          }

          logger.info(`✅ Finished (or paused) state ${stateCode}.`);
        } catch (error: any) {
          if (error.status === 429) {
            logger.warn('⚠️ Hit WiGLE Rate Limit (429). Sleeping for 1 hour...');
            await sleep(60 * 60 * 1000);
            break; // Break the state loop to re-audit after sleep
          } else {
            logger.error(`❌ Error processing state ${stateCode}: ${error.message}`);
          }
        }

        await sleep(SLEEP_BETWEEN_STATES_MS);
      }
    } catch (error: any) {
      logger.error(`💥 Daemon encountered a fatal error: ${error.message}`);
      await sleep(60000); // Sleep a minute before retrying
    }
  }
}

// Get search term from command line
const searchTerm = process.argv[2];
if (!searchTerm) {
  console.error('Usage: npx ts-node scripts/wigle-daemon.ts <search_term>');
  process.exit(1);
}

runDaemon(searchTerm);
