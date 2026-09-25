#!/usr/bin/env tsx

import { enrichZip4 } from './process-agencies';

type EnrichOptions = {
  limit: number;
  batchSize: number;
  sleepMs: number;
  dryRun: boolean;
  withCoordinates: boolean;
  testAuthOnly: boolean;
  states: string[] | null;
};

function parseArgs(argv: string[]): EnrichOptions {
  const getNum = (prefix: string, fallback: number) => {
    const raw = argv.find((a) => a.startsWith(prefix));
    if (!raw) {
      return fallback;
    }
    const n = Number(raw.split('=')[1]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const getStr = (prefix: string): string | null => {
    const raw = argv.find((a) => a.startsWith(prefix));
    if (!raw) {
      return null;
    }
    const v = raw.slice(prefix.length).trim();
    return v.length ? v : null;
  };

  const dryRun =
    argv.includes('--dry-run') || (!argv.includes('--live') && !argv.includes('--live=true'));
  const withCoordinates = argv.includes('--with-coordinates');
  const testAuthOnly = argv.includes('--test-auth');
  const state = getStr('--state=');
  const statesRaw = getStr('--states=');
  const statesList = (statesRaw || state || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return {
    limit: getNum('--limit=', 500),
    batchSize: getNum('--batch-size=', 50),
    sleepMs: getNum('--sleep-ms=', 250),
    dryRun,
    withCoordinates,
    testAuthOnly,
    states: statesList.length ? Array.from(new Set(statesList)) : null,
  };
}

export function handleRunError(error: any): void {
  console.error(error);
  process.exit(1);
}

if (require.main === module) {
  enrichZip4(parseArgs(process.argv.slice(2))).catch(handleRunError);
}

export { enrichZip4, parseArgs };
