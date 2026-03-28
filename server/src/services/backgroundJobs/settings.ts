export {};

const { query } = require('../../config/database');

import { JOB_SETTING_KEYS, resolveJobConfig } from './config';
import type { BackgroundJobName } from './config';

type JobConfig = {
  enabled: boolean;
  cron: string;
};

const SETTINGS_SQL = `SELECT key, value FROM app.settings WHERE key IN ('backup_job_config', 'ml_scoring_job_config', 'mv_refresh_job_config')`;

const loadBackgroundJobConfigs = async (): Promise<Record<string, JobConfig>> => {
  const { rows } = await query(SETTINGS_SQL);
  const configs: Record<string, JobConfig> = {};

  rows.forEach((row: any) => {
    configs[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  });

  return configs;
};

const getResolvedJobConfig = (
  configs: Record<string, JobConfig>,
  jobName: BackgroundJobName
): JobConfig => resolveJobConfig(configs, jobName);

const hasJobConfigChanged = (
  previousConfigs: Record<string, JobConfig>,
  jobName: BackgroundJobName,
  nextConfig: JobConfig
): boolean => {
  const previousConfig = previousConfigs[JOB_SETTING_KEYS[jobName]];
  if (!previousConfig) {
    return true;
  }

  return previousConfig.enabled !== nextConfig.enabled || previousConfig.cron !== nextConfig.cron;
};

export { getResolvedJobConfig, hasJobConfigChanged, loadBackgroundJobConfigs };
export type { JobConfig };
