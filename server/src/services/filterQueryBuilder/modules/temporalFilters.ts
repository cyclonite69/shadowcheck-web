/**
 * Temporal Filters Module
 * Handles time-based filtering (first seen, last seen, timespan)
 */

import { RELATIVE_WINDOWS } from '../constants';
import type { Filters, EnabledFlags, AppliedFilter } from '../types';

export class TemporalFiltersBuilder {
  private filters: Filters;
  private enabled: EnabledFlags;
  private params: unknown[];
  private paramIndex: number;
  private appliedFilters: AppliedFilter[];

  constructor(
    filters: Filters,
    enabled: EnabledFlags,
    params: unknown[],
    paramIndex: number,
    appliedFilters: AppliedFilter[]
  ) {
    this.filters = filters;
    this.enabled = enabled;
    this.params = params;
    this.paramIndex = paramIndex;
    this.appliedFilters = appliedFilters;
  }

  private addParam(value: unknown): string {
    this.params.push(value);
    const index = this.paramIndex;
    this.paramIndex += 1;
    return `$${index}`;
  }

  private addApplied(type: string, field: string, value: unknown): void {
    this.appliedFilters.push({ type, field, value });
  }

  buildFilters(): { where: string[]; paramIndex: number } {
    const where: string[] = [];
    const f = this.filters;
    const e = this.enabled;

    // First seen
    if (e.firstSeenMin && f.firstSeenMin) {
      where.push(`n.first_seen >= ${this.addParam(new Date(f.firstSeenMin))}`);
      this.addApplied('temporal', 'firstSeenMin', f.firstSeenMin);
    }

    if (e.firstSeenMax && f.firstSeenMax) {
      where.push(`n.first_seen <= ${this.addParam(new Date(f.firstSeenMax))}`);
      this.addApplied('temporal', 'firstSeenMax', f.firstSeenMax);
    }

    // Last seen
    if (e.lastSeenMin && f.lastSeenMin) {
      where.push(`n.last_seen >= ${this.addParam(new Date(f.lastSeenMin))}`);
      this.addApplied('temporal', 'lastSeenMin', f.lastSeenMin);
    }

    if (e.lastSeenMax && f.lastSeenMax) {
      where.push(`n.last_seen <= ${this.addParam(new Date(f.lastSeenMax))}`);
      this.addApplied('temporal', 'lastSeenMax', f.lastSeenMax);
    }

    // Timespan (days between first and last seen)
    if (e.timespanDaysMin && f.timespanDaysMin !== undefined) {
      where.push(
        `EXTRACT(EPOCH FROM (n.last_seen - n.first_seen)) / 86400 >= ${this.addParam(
          f.timespanDaysMin
        )}`
      );
      this.addApplied('temporal', 'timespanDaysMin', f.timespanDaysMin);
    }

    if (e.timespanDaysMax && f.timespanDaysMax !== undefined) {
      where.push(
        `EXTRACT(EPOCH FROM (n.last_seen - n.first_seen)) / 86400 <= ${this.addParam(
          f.timespanDaysMax
        )}`
      );
      this.addApplied('temporal', 'timespanDaysMax', f.timespanDaysMax);
    }

    // Relative window (last N days/hours)
    if (e.relativeWindow && f.relativeWindow && RELATIVE_WINDOWS[f.relativeWindow]) {
      const interval = RELATIVE_WINDOWS[f.relativeWindow];
      where.push(`n.last_seen >= NOW() - INTERVAL '${interval}'`);
      this.addApplied('temporal', 'relativeWindow', f.relativeWindow);
    }

    return { where, paramIndex: this.paramIndex };
  }
}
