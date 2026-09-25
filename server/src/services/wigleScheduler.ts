/**
 * WiGLE Query Window Advisor
 *
 * Reads the empirical reset profile (get_wigle_reset_profile) to recommend
 * when to fire batch queries. Once enough wall-hit data accumulates, returns
 * the optimal UTC start hour for fixed-clock resets, or null for rolling windows
 * (where uniform pacing throughout the day is the correct strategy).
 */

import { adminQuery } from './adminDbService';
import logger from '../logging/logger';

export type WigleRequestKind = 'search' | 'detail' | 'stats';

export interface WigleQueryWindow {
  resetHour: number | null;
  resetType: 'fixed_clock' | 'rolling_window' | 'insufficient_data';
  /** UTC hour to start a batch run. null for rolling windows — pace uniformly instead. */
  recommendedStartUtcHour: number | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Returns the optimal query window for a WiGLE request kind based on observed
 * reset behavior. Returns insufficient_data until 3+ wall-hit events exist.
 * Never throws — returns insufficient_data on DB error.
 */
export async function getOptimalQueryWindow(kind: WigleRequestKind): Promise<WigleQueryWindow> {
  try {
    const { rows } = await adminQuery('SELECT * FROM app.get_wigle_reset_profile($1)', [kind]);
    const profile = rows[0];

    if (!profile || profile.reset_type === 'insufficient_data') {
      return {
        resetHour: null,
        resetType: 'insufficient_data',
        recommendedStartUtcHour: null,
        confidence: 'low',
      };
    }

    return {
      resetHour: profile.likely_reset_utc_hour,
      resetType: profile.reset_type,
      // For fixed-clock resets, fire immediately after the reset hour.
      // For rolling windows, pacing throughout the day is the right strategy.
      recommendedStartUtcHour:
        profile.reset_type === 'fixed_clock' ? profile.likely_reset_utc_hour : null,
      confidence: profile.confidence,
    };
  } catch (err: any) {
    logger.warn('[WiGLE Scheduler] Failed to read reset profile', {
      kind,
      error: err?.message,
    });
    return {
      resetHour: null,
      resetType: 'insufficient_data',
      recommendedStartUtcHour: null,
      confidence: 'low',
    };
  }
}
