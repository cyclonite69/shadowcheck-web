export interface JobConfig {
  enabled: boolean;
  cron: string;
  [key: string]: any;
}

export type JobKey = 'backup' | 'mlScoring' | 'mvRefresh' | 'siblingDetection';
export type ScheduleMode = 'hourly' | 'daily' | 'weekly';

export interface ScheduleFormState {
  mode: ScheduleMode;
  time: string;
  intervalHours: string;
  dayOfWeek: string;
}

export interface JobRunHistoryEntry {
  id: number;
  status: 'running' | 'completed' | 'failed';
  cron: string;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  error?: string | null;
  details?: Record<string, unknown>;
}

export interface JobRuntimeStatus {
  config: JobConfig;
  nextRun: string | null;
  recentRuns: JobRunHistoryEntry[];
  currentRun: JobRunHistoryEntry | null;
  lastRun: JobRunHistoryEntry | null;
}

export interface JobsStatusResponse {
  success: boolean;
  schedulerEnabled: boolean;
  schedulerInitialized: boolean;
  jobs: Partial<Record<JobKey, JobRuntimeStatus>>;
}

export const JOB_SETTING_KEYS: Record<JobKey, string> = {
  backup: 'backup_job_config',
  mlScoring: 'ml_scoring_job_config',
  mvRefresh: 'mv_refresh_job_config',
  siblingDetection: 'sibling_detection_job_config',
};

export const DEFAULT_CONFIGS: Record<JobKey, JobConfig> = {
  backup: { enabled: false, cron: '0 3 * * *', uploadToS3: true },
  mlScoring: { enabled: true, cron: '0 */4 * * *', limit: 10000 },
  mvRefresh: { enabled: true, cron: '30 4 * * *' },
  siblingDetection: {
    enabled: true,
    cron: '0 5 * * *',
    max_octet_delta: 6,
    max_distance_m: 5000,
    min_candidate_conf: 0.7,
    seed_limit: 1000,
    incremental: true,
  },
};

export const DEFAULT_SCHEDULES: Record<JobKey, ScheduleFormState> = {
  backup: { mode: 'daily', time: '03:00', intervalHours: '4', dayOfWeek: '1' },
  mlScoring: { mode: 'hourly', time: '00:00', intervalHours: '4', dayOfWeek: '1' },
  mvRefresh: { mode: 'daily', time: '04:30', intervalHours: '4', dayOfWeek: '1' },
  siblingDetection: { mode: 'daily', time: '05:00', intervalHours: '4', dayOfWeek: '1' },
};

export const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

export const INTERVAL_OPTIONS = ['1', '2', '3', '4', '6', '8', '12'];
