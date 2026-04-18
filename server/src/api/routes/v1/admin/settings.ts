export {};
const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { settingsAdminService } = require('../../../../config/container');
const { backgroundJobsService } = require('../../../../config/container');
const featureFlagService = require('../../../../services/featureFlagService');
const logger = require('../../../../logging/logger');
const { envFlag } = require('../../../../utils/envFlag');

const repoRoot = process.cwd();

const runCommand = (command: string, args: string[], cwd = repoRoot) =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: any) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: any) => {
      stderr += data.toString();
    });

    child.on('error', (error: any) => reject(error));
    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });

const runLocalCompose = async (args: string[]) => {
  try {
    return await runCommand('docker-compose', args, repoRoot);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return runCommand('docker', ['compose', ...args], repoRoot);
    }
    throw error;
  }
};

const isLocalDockerMode = () =>
  (process.env.DB_HOST || '').trim() === 'postgres' && process.env.NODE_ENV !== 'production';

/**
 * GET /api/admin/settings
 * Get all settings
 */
router.get('/', async (req: any, res: any) => {
  try {
    const rows = await settingsAdminService.getAllSettings();
    const settings: any = {};
    rows.forEach((row: any) => {
      settings[row.key] = {
        value: row.value,
        description: row.description,
        updatedAt: row.updated_at,
      };
    });
    res.json({ success: true, settings });
  } catch (error: any) {
    logger.error('Failed to get settings', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/settings/jobs/status
 * Get background job runtime status and recent history
 */
router.get('/jobs/status', async (req: any, res: any) => {
  try {
    const status = await backgroundJobsService.getJobStatus();
    res.json({ success: true, ...status });
  } catch (error: any) {
    logger.error('Failed to get background job status', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/jobs/:jobName/run', async (req: any, res: any) => {
  try {
    const { jobName } = req.params;
    const options = req.body || {};

    if (!['backup', 'mlScoring', 'mvRefresh', 'siblingDetection'].includes(jobName)) {
      return res.status(400).json({ success: false, error: 'Unsupported background job' });
    }

    const result = await backgroundJobsService.startJobNow(jobName, options);
    const status = await backgroundJobsService.getJobStatus();
    res.json({ success: true, result, ...status });
  } catch (error: any) {
    logger.error('Failed to run background job manually', {
      error: error.message,
      jobName: req.params.jobName,
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/runtime', async (req: any, res: any) => {
  try {
    await featureFlagService.refreshCache();
    const dbBackedFlags = featureFlagService.getAllFlags();
    res.json({
      success: true,
      featureFlags: {
        adminAllowDocker: dbBackedFlags.admin_allow_docker,
        adminAllowMlTraining: dbBackedFlags.admin_allow_ml_training,
        adminAllowMlScoring: dbBackedFlags.admin_allow_ml_scoring,
        enableBackgroundJobs: dbBackedFlags.enable_background_jobs,
        apiGateEnabled: envFlag(process.env.API_GATE_ENABLED ?? 'true', true),
        forceHttps: envFlag(process.env.FORCE_HTTPS, false),
        cookieSecure: envFlag(process.env.COOKIE_SECURE, false),
        simpleRuleScoringEnabled: dbBackedFlags.simple_rule_scoring_enabled,
        scoreDebugLogging: dbBackedFlags.score_debug_logging,
        autoGeocodeOnImport: dbBackedFlags.auto_geocode_on_import,
        dedupeOnScan: dbBackedFlags.dedupe_on_scan,
        trackQueryPerformance: envFlag(process.env.TRACK_QUERY_PERFORMANCE, false),
        debugQueryPerformance: envFlag(process.env.DEBUG_QUERY_PERFORMANCE, false),
        debugGeospatial: envFlag(process.env.DEBUG_GEOSPATIAL, false),
      },
      runtime: {
        nodeEnv: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
        mlModelVersion: process.env.ML_MODEL_VERSION || '1.0.0',
        mlScoreLimit: parseInt(process.env.ML_SCORE_LIMIT ?? '0', 10) || 100,
        mlAutoScoreLimit: parseInt(process.env.ML_AUTO_SCORE_LIMIT ?? '0', 10) || 1000,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get runtime settings', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/local-stack/:action', async (req: any, res: any) => {
  if (!featureFlagService.getFlag('admin_allow_docker')) {
    return res.status(403).json({
      success: false,
      error: 'Docker controls disabled. Enable admin_allow_docker to allow local stack actions.',
    });
  }

  if (!isLocalDockerMode()) {
    return res.status(400).json({
      success: false,
      error: 'Local stack controls are only available in local Docker mode.',
    });
  }

  const action = String(req.params.action || '');
  const actionMap: Record<string, { args: string[]; message: string }> = {
    'recreate-api': {
      args: ['up', '-d', '--force-recreate', 'api'],
      message: 'API container recreated',
    },
    'rebuild-frontend': {
      args: ['up', '-d', '--build', '--force-recreate', 'frontend'],
      message: 'Frontend rebuilt and recreated',
    },
    'rebuild-stack': {
      args: ['up', '-d', '--build'],
      message: 'Full local stack rebuilt',
    },
  };

  const selected = actionMap[action];
  if (!selected) {
    return res.status(400).json({
      success: false,
      error: `Unsupported local stack action '${action}'`,
    });
  }

  try {
    const result = await runLocalCompose(selected.args);
    logger.info('Local stack action completed', {
      action,
      args: selected.args,
    });
    res.json({
      success: true,
      action,
      message: selected.message,
      stdout: result.stdout,
      stderr: result.stderr,
      cwd: repoRoot,
      composeFile: path.join(repoRoot, 'docker-compose.yml'),
    });
  } catch (error: any) {
    logger.error('Local stack action failed', {
      action,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      action,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/settings/:key
 * Get a specific setting
 */
router.get('/:key', async (req: any, res: any) => {
  try {
    const { key } = req.params;
    const setting = await settingsAdminService.getSettingByKey(key);
    if (!setting) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }
    res.json({ success: true, key, ...setting });
  } catch (error: any) {
    logger.error('Failed to get setting', { error: error.message, key: req.params.key });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update a setting
 */
router.put('/:key', async (req: any, res: any) => {
  try {
    const { key } = req.params;
    let { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }

    if (featureFlagService.isDbBackedFlagKey(key)) {
      value = envFlag(value, false);
    }

    const setting = await settingsAdminService.updateSetting(key, value);

    if (!setting) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    if (featureFlagService.isDbBackedFlagKey(key)) {
      await featureFlagService.refreshCache();
    }

    if (key === 'enable_background_jobs') {
      await backgroundJobsService.applySchedulerFlagChange();
    }

    if (['backup_job_config', 'ml_scoring_job_config', 'mv_refresh_job_config'].includes(key)) {
      if (backgroundJobsService.isSchedulerEnabled()) {
        await backgroundJobsService.rescheduleJobs();
      } else {
        logger.info('Background job config updated while scheduler is disabled', { key });
      }
    }

    logger.info('Setting updated', { key, value });
    res.json({ success: true, setting });
  } catch (error: any) {
    logger.error('Failed to update setting', { error: error.message, key: req.params.key });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/settings/ml-blending/toggle
 * Quick toggle for ML blending
 */
router.post('/ml-blending/toggle', async (req: any, res: any) => {
  try {
    const newValue = await settingsAdminService.toggleMLBlending();
    logger.info('ML blending toggled', { enabled: newValue });
    res.json({ success: true, ml_blending_enabled: newValue });
  } catch (error: any) {
    logger.error('Failed to toggle ML blending', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
