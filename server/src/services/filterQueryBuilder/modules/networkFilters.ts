/**
 * Network Filters Module
 * Handles network-level filtering (SSID, BSSID, tags, etc.)
 */

import { NETWORK_CHANNEL_EXPR, THREAT_SCORE_EXPR, THREAT_LEVEL_EXPR } from '../sqlExpressions';
import type { Filters, EnabledFlags, AppliedFilter, IgnoredFilter } from '../types';

export class NetworkFiltersBuilder {
  private filters: Filters;
  private enabled: EnabledFlags;
  private params: unknown[];
  private paramIndex: number;
  private appliedFilters: AppliedFilter[];
  private ignoredFilters: IgnoredFilter[];

  constructor(
    filters: Filters,
    enabled: EnabledFlags,
    params: unknown[],
    paramIndex: number,
    appliedFilters: AppliedFilter[],
    ignoredFilters: IgnoredFilter[]
  ) {
    this.filters = filters;
    this.enabled = enabled;
    this.params = params;
    this.paramIndex = paramIndex;
    this.appliedFilters = appliedFilters;
    this.ignoredFilters = ignoredFilters;
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

  private addIgnored(type: string, field: string, reason: string): void {
    this.ignoredFilters.push({ type, field, reason });
  }

  buildFilters(): { where: string[]; paramIndex: number } {
    const where: string[] = [];
    const f = this.filters;
    const e = this.enabled;

    // SSID filter
    if (e.ssid && f.ssid) {
      where.push(`n.ssid ILIKE ${this.addParam(`%${f.ssid}%`)}`);
      this.addApplied('network', 'ssid', f.ssid);
    }

    // BSSID filter
    if (e.bssid && f.bssid) {
      where.push(`n.bssid ILIKE ${this.addParam(`${f.bssid}%`)}`);
      this.addApplied('network', 'bssid', f.bssid);
    }

    // Observation count
    if (e.observationCountMin && f.observationCountMin !== undefined) {
      where.push(`n.observation_count >= ${this.addParam(f.observationCountMin)}`);
      this.addApplied('network', 'observationCountMin', f.observationCountMin);
    }

    if (e.observationCountMax && f.observationCountMax !== undefined) {
      where.push(`n.observation_count <= ${this.addParam(f.observationCountMax)}`);
      this.addApplied('network', 'observationCountMax', f.observationCountMax);
    }

    // Channel filter
    if (e.channelMin && f.channelMin !== undefined) {
      where.push(`(${NETWORK_CHANNEL_EXPR}) >= ${this.addParam(f.channelMin)}`);
      this.addApplied('network', 'channelMin', f.channelMin);
    }

    if (e.channelMax && f.channelMax !== undefined) {
      where.push(`(${NETWORK_CHANNEL_EXPR}) <= ${this.addParam(f.channelMax)}`);
      this.addApplied('network', 'channelMax', f.channelMax);
    }

    // Threat score
    if (e.threatScoreMin && f.threatScoreMin !== undefined) {
      where.push(`(${THREAT_SCORE_EXPR}) >= ${this.addParam(f.threatScoreMin)}`);
      this.addApplied('threat', 'threatScoreMin', f.threatScoreMin);
    }

    if (e.threatScoreMax && f.threatScoreMax !== undefined) {
      where.push(`(${THREAT_SCORE_EXPR}) <= ${this.addParam(f.threatScoreMax)}`);
      this.addApplied('threat', 'threatScoreMax', f.threatScoreMax);
    }

    // Threat categories
    if (e.threatCategories && f.threatCategories && f.threatCategories.length > 0) {
      const categories = f.threatCategories.map((c) => this.addParam(c));
      where.push(`n.threat_category IN (${categories.join(', ')})`);
      this.addApplied('threat', 'threatCategories', f.threatCategories);
    }

    // Tags
    if (e.tags && f.tags && f.tags.length > 0) {
      const tags = f.tags.map((t) => this.addParam(t));
      where.push(`n.tag IN (${tags.join(', ')})`);
      this.addApplied('network', 'tags', f.tags);
    }

    // Exclude tagged
    if (e.excludeTagged) {
      where.push(`n.tag IS NULL`);
      this.addApplied('network', 'excludeTagged', true);
    }

    return { where, paramIndex: this.paramIndex };
  }
}
