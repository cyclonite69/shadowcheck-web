export {};

const logger = require('../logging/logger');
const { query } = require('../config/database');

// Duplicated here to avoid a circular dependency on backgroundJobsService.ts.
const JOB_SETTING_KEYS = {
  backup: 'backup_job_config',
  mlScoring: 'ml_scoring_job_config',
  mvRefresh: 'mv_refresh_job_config',
} as const;

// Duplicated here to avoid a circular dependency on backgroundJobsService.ts.
const DEFAULT_JOB_CONFIGS = {
  backup: {
    enabled: process.env.ENABLE_BACKGROUND_JOBS === 'true',
    cron: process.env.BACKUP_CRON || '0 3 * * *',
  },
  mlScoring: { enabled: process.env.ENABLE_BACKGROUND_JOBS === 'true', cron: '0 */4 * * *' },
  mvRefresh: {
    enabled: process.env.ENABLE_BACKGROUND_JOBS === 'true',
    cron: process.env.MV_REFRESH_CRON || '30 4 * * *',
  },
};

async function createJobRun(jobName: string, cron: string): Promise<number> {
  const result = await query(
    `
      INSERT INTO app.background_job_runs (
        job_name,
        cron,
        status
      )
      VALUES ($1, $2, 'running')
      RETURNING id;
    `,
    [jobName, cron]
  );

  return Number(result.rows[0]?.id);
}

async function completeJobRun(jobId: number, details: Record<string, unknown>, durationMs: number) {
  await query(
    `
      UPDATE app.background_job_runs
      SET
        status = 'completed',
        details = $2::jsonb,
        duration_ms = $3,
        finished_at = NOW()
      WHERE id = $1
    `,
    [jobId, JSON.stringify(details || {}), durationMs]
  );
}

async function failJobRun(jobId: number, error: string, durationMs: number) {
  await query(
    `
      UPDATE app.background_job_runs
      SET
        status = 'failed',
        error = $2,
        duration_ms = $3,
        finished_at = NOW()
      WHERE id = $1
    `,
    [jobId, error, durationMs]
  );
}

async function trackJobRun(
  jobName: string,
  task: () => Promise<Record<string, unknown> | void>,
  {
    lastConfig,
    runningJobIds,
  }: {
    lastConfig: Record<string, any>;
    runningJobIds: Partial<Record<string, number>>;
  }
): Promise<void> {
  const cron =
    lastConfig[JOB_SETTING_KEYS[jobName as keyof typeof JOB_SETTING_KEYS]]?.cron ||
    DEFAULT_JOB_CONFIGS[jobName as keyof typeof DEFAULT_JOB_CONFIGS].cron;
  const startTime = Date.now();
  const jobId = await createJobRun(jobName, cron);
  runningJobIds[jobName] = jobId;

  try {
    const details = (await task()) || {};
    const durationMs = Date.now() - startTime;
    await completeJobRun(jobId, details, durationMs);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Background Jobs] ${jobName} failed: ${message}`);
    await failJobRun(jobId, message, durationMs);
  } finally {
    delete runningJobIds[jobName];
  }
}

async function getJobStatus(jobs: Record<string, any>) {
  const { rows } = await query(
    `
      WITH recent_runs AS (
        SELECT
          id,
          job_name,
          status,
          cron,
          started_at,
          finished_at,
          duration_ms,
          error,
          details,
          ROW_NUMBER() OVER (PARTITION BY job_name ORDER BY started_at DESC) AS row_num
        FROM app.background_job_runs
      )
      SELECT
        id,
        job_name,
        status,
        cron,
        started_at,
        finished_at,
        duration_ms,
        error,
        details,
        row_num
      FROM recent_runs
      WHERE row_num <= 5
      ORDER BY job_name, started_at DESC
    `
  );

  const dbRuns: Record<string, any[]> = { backup: [], mlScoring: [], mvRefresh: [] };
  rows.forEach((row: any) => {
    dbRuns[row.job_name]?.push({
      id: Number(row.id),
      status: row.status,
      cron: row.cron,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      durationMs: row.duration_ms ? Number(row.duration_ms) : null,
      error: row.error || null,
      details: row.details || {},
    });
  });

  const settingsRows = await query(
    "SELECT key, value FROM app.settings WHERE key IN ('backup_job_config', 'ml_scoring_job_config', 'mv_refresh_job_config')"
  );

  const configs: Record<string, any> = {};
  settingsRows.rows.forEach((row: any) => {
    configs[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  });

  const resolvedJobs = (Object.keys(JOB_SETTING_KEYS) as string[]).reduce(
    (acc, jobName) => {
      const config =
        configs[JOB_SETTING_KEYS[jobName as keyof typeof JOB_SETTING_KEYS]] ||
        DEFAULT_JOB_CONFIGS[jobName as keyof typeof DEFAULT_JOB_CONFIGS];
      const scheduledJob = jobs[jobName];
      const nextInvocation = scheduledJob?.nextInvocation?.();
      acc[jobName] = {
        config,
        nextRun: nextInvocation ? new Date(nextInvocation).toISOString() : null,
        recentRuns: dbRuns[jobName] || [],
        currentRun: (dbRuns[jobName] || []).find((run) => run.status === 'running') || null,
        lastRun: (dbRuns[jobName] || []).find((run) => run.status !== 'running') || null,
      };
      return acc;
    },
    {} as Record<string, any>
  );

  return { jobs: resolvedJobs };
}

module.exports = {
  createJobRun,
  completeJobRun,
  failJobRun,
  trackJobRun,
  getJobStatus,
};
