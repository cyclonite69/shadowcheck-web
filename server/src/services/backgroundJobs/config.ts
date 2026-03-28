export {};

const ML_SCORING_CRON = '0 */4 * * *';
const BACKUP_CRON = process.env.BACKUP_CRON || '0 3 * * *';
const MV_REFRESH_CRON = process.env.MV_REFRESH_CRON || '30 4 * * *';

const JOB_SETTING_KEYS = {
  backup: 'backup_job_config',
  mlScoring: 'ml_scoring_job_config',
  mvRefresh: 'mv_refresh_job_config',
  siblingDetection: 'sibling_detection_job_config',
} as const;

type BackgroundJobName = keyof typeof JOB_SETTING_KEYS;

const DEFAULT_JOB_CONFIGS = {
  backup: { enabled: process.env.ENABLE_BACKGROUND_JOBS === 'true', cron: BACKUP_CRON },
  mlScoring: { enabled: process.env.ENABLE_BACKGROUND_JOBS === 'true', cron: ML_SCORING_CRON },
  mvRefresh: { enabled: process.env.ENABLE_BACKGROUND_JOBS === 'true', cron: MV_REFRESH_CRON },
  siblingDetection: { enabled: process.env.ENABLE_BACKGROUND_JOBS === 'true', cron: '0 5 * * *' }, // Daily at 5 AM
};

const JOB_SETTING_NAMES = Object.keys(JOB_SETTING_KEYS) as BackgroundJobName[];

const resolveJobConfig = (configs: Record<string, any>, jobName: BackgroundJobName) =>
  configs[JOB_SETTING_KEYS[jobName]] || DEFAULT_JOB_CONFIGS[jobName];

export {
  BACKUP_CRON,
  DEFAULT_JOB_CONFIGS,
  JOB_SETTING_KEYS,
  JOB_SETTING_NAMES,
  ML_SCORING_CRON,
  MV_REFRESH_CRON,
  resolveJobConfig,
};
export type { BackgroundJobName };
