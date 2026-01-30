/**
 * Background jobs initialization.
 */

/**
 * Initialize background jobs.
 */
async function initializeBackgroundJobs(): Promise<void> {
  if (process.env.ENABLE_BACKGROUND_JOBS !== 'true') {
    console.log('[Background Jobs] Skipped (manual-only mode)');
    return;
  }

  const BackgroundJobsService = require('../services/backgroundJobsService');
  await BackgroundJobsService.initialize();
}

export { initializeBackgroundJobs };
