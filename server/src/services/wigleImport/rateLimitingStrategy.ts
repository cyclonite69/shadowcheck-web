import { getQuotaStatus } from '../wigleRequestLedger';

/**
 * Calculate adaptive delay based on current quota utilization
 * Higher utilization = longer delay to avoid hitting hard limits
 */
export const getAdaptiveDelay = (): number => {
  const status = getQuotaStatus();
  const searchLoad = status.counts.search / status.softLimits.search;
  const baseDelay = 1500;
  const multiplier = 1 + Math.pow(searchLoad, 2);
  const jitter = Math.floor(Math.random() * 1000);
  return baseDelay * multiplier + jitter;
};

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
